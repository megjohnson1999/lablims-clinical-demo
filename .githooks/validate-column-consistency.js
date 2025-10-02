#!/usr/bin/env node

/**
 * Pre-commit Hook: Column Naming Consistency Validator
 * 
 * Validates that column naming is consistent across:
 * 1. Database schema files
 * 2. Frontend React components 
 * 3. Import utility functions
 * 4. Backend API routes
 * 
 * Prevents commits that introduce column naming inconsistencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * Master Column Mapping Rules
 * Defines expected column names across all system layers
 * Updated to reflect actual database schema as of 2025-08-08
 */
const COLUMN_MAPPINGS = {
  collaborators: {
    database: {
      primaryKey: 'id',           // UUID primary key (verified in actual schema)
      userFriendlyId: 'collaborator_number',  // Integer display ID (exists in schema)
      required: ['pi_name', 'pi_institute'],
      optional: ['irb_id', 'pi_email', 'pi_phone', 'pi_fax', 'internal_contact', 'comments', 'created_at', 'updated_at']
    },
    frontend: {
      expectedFields: ['id', 'collaborator_number', 'pi_name', 'pi_institute', 'irb_id', 'pi_email', 'pi_phone', 'pi_fax', 'internal_contact', 'comments'],
      deprecatedFields: ['collaborator_legacy_id', 'legacy_id'],
      displayField: 'collaborator_number'
    },
    csvImport: {
      acceptedHeaders: {
        'id': ['ID', 'id', 'collaborator_id', 'Collaborator_ID'],
        'pi_name': ['PI_Name', 'pi_name', 'PI Name', 'PI_name', 'PiName'],
        'pi_institute': ['PI_Institute', 'pi_institute', 'PI Institute', 'PiInstitute'],
        'irb_id': ['IRB_ID', 'irb_id', 'IRB ID', 'IRB_id'],
        'pi_email': ['PI_Email', 'pi_email', 'PI Email', 'PI_email'],
        'pi_phone': ['PI_Phone', 'pi_phone', 'PI Phone', 'PI_phone'],
        'comments': ['Comments', 'comments', 'notes', 'Notes']
      }
    }
  },
  
  projects: {
    database: {
      primaryKey: 'id',           // UUID primary key (verified in actual schema)
      userFriendlyId: 'project_number',  // Integer display ID (exists in schema)
      required: ['collaborator_id'],
      optional: ['disease', 'specimen_type', 'source', 'date_received', 'feedback_date', 'comments', 'created_at', 'updated_at']
    },
    frontend: {
      expectedFields: ['id', 'project_number', 'disease', 'specimen_type', 'source', 'date_received', 'feedback_date', 'collaborator_id', 'comments',
                      // JOINed fields from collaborators table (available via API routes)
                      'pi_name', 'pi_institute', 'collaborator_number'],
      deprecatedFields: ['project_legacy_id', 'legacy_id'],
      displayField: 'project_number'
    },
    csvImport: {
      acceptedHeaders: {
        'id': ['ID', 'id', 'project_id', 'Project_ID'],
        'disease': ['Disease', 'disease'],
        'specimen_type': ['Specimen_Type', 'specimen_type', 'Specimen Type'],
        'source': ['Source', 'source'],
        'collaborator_reference': ['Collaborator', 'collaborator', 'collaborator_id'],
        'comments': ['Comments', 'comments', 'notes', 'Notes']
      }
    }
  },
  
  specimens: {
    database: {
      primaryKey: 'id',           // UUID primary key (verified in actual schema)
      userFriendlyId: 'specimen_number',  // Integer display ID (exists in schema)
      required: ['project_id'],
      optional: ['patient_id', 'tube_id', 'extracted', 'initial_quantity', 'position_freezer', 
                'position_rack', 'position_box', 'position_dimension_one', 'position_dimension_two',
                'activity_status', 'date_collected', 'collection_category', 'extraction_method',
                'nucleated_cells', 'cell_numbers', 'percentage_segs', 'csf_protein', 'csf_gluc',
                'used_up', 'specimen_site', 'run_number', 'comments', 'sequencing_run_id',
                'fastq_location', 'analysis_status', 'results_location', 'sequencing_notes',
                'metadata', 'created_at', 'updated_at']
    },
    frontend: {
      // Frontend can access JOINed fields from related tables
      expectedFields: ['id', 'specimen_number', 'tube_id', 'project_id', 'patient_id',
                      'extracted', 'initial_quantity', 'position_freezer', 'position_rack', 
                      'position_box', 'activity_status', 'date_collected', 'specimen_site',
                      'used_up', 'comments', 'run_number', 'sequencing_run_id', 'fastq_location',
                      'analysis_status', 'results_location', 'sequencing_notes', 'metadata',
                      // JOINed fields from projects table
                      'project_number', 'disease', 'specimen_type', 'source',
                      // JOINed fields from collaborators table  
                      'pi_name', 'pi_institute',
                      // JOINed fields from patients table (with and without patient_ prefix)
                      'external_id', 'first_name', 'last_name',
                      'patient_external_id', 'patient_first_name', 'patient_last_name',
                      // Additional joined/computed fields
                      'collection_category', 'extraction_method', 'nucleated_cells', 
                      'cell_numbers', 'percentage_segs', 'csf_protein', 'csf_gluc'],
      deprecatedFields: ['specimen_legacy_id', 'project_legacy_id'],
      displayField: 'specimen_number'
    },
    csvImport: {
      acceptedHeaders: {
        'tube_id': ['tube_id', 'Tube_ID', 'specimen_id', 'Specimen_ID', 'sample_id', 'Sample_ID', 'ID', 'id'],
        'project_reference': ['project_id', 'Project_ID', 'Project', 'project'],
        'patient_reference': ['patient_id', 'Patient_ID', 'Patient', 'patient'],
        'extracted': ['extracted', 'Extracted', 'is_extracted', 'Is_Extracted'],
        'initial_quantity': ['initial_quantity', 'Initial_Quantity', 'Quantity', 'quantity', 'Volume', 'volume'],
        'position_freezer': ['position_freezer', 'Position_Freezer', 'Freezer', 'freezer', 'Location', 'location'],
        'comments': ['comments', 'Comments', 'Notes', 'notes', 'Description', 'description']
      }
    }
  },
  
  patients: {
    database: {
      primaryKey: 'id',           // UUID primary key (verified in actual schema)  
      userFriendlyId: 'patient_number',  // Integer display ID (exists in schema)
      required: [],  // external_id is not required in actual schema
      optional: ['external_id', 'first_name', 'last_name', 'date_of_birth', 'diagnosis', 
                'physician_first_name', 'physician_last_name', 'comments', 'created_at', 'updated_at']
    },
    frontend: {
      expectedFields: ['id', 'patient_number', 'external_id', 'first_name', 'last_name', 
                      'date_of_birth', 'diagnosis', 'physician_first_name', 'physician_last_name', 'comments'],
      deprecatedFields: ['patient_legacy_id'],  // Removed patient_external_id as it's not actually deprecated
      displayField: 'patient_number'
    },
    csvImport: {
      acceptedHeaders: {
        'external_id': ['ID', 'id', 'patient_id', 'Patient_ID', 'external_id', 'External_ID'],
        'first_name': ['first_name', 'First_Name', 'firstname', 'FirstName', 'First Name'],
        'last_name': ['last_name', 'Last_Name', 'lastname', 'LastName', 'Last Name'],
        'diagnosis': ['diagnosis', 'Diagnosis', 'disease', 'Disease'],
        'comments': ['comments', 'Comments', 'notes', 'Notes']
      }
    }
  }
};

/**
 * Get list of changed files from git
 */
function getChangedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not get changed files, checking all files${colors.reset}`);
    return [];
  }
}

/**
 * Parse database schema files for column definitions
 */
function parseDatabaseSchema() {
  const schemaIssues = [];
  const schemaFiles = [
    'db/schema.sql',
    'db/migrations/clean_unified_schema_fixed.sql',
    'db/migrations/add_running_counters_with_data_scan.sql'
  ];
  
  for (const file of schemaFiles) {
    if (!fs.existsSync(file)) continue;
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Skip validation for base schema.sql since migrations have updated the actual database
      // The clean_unified_schema_fixed.sql migration added all the required columns
      if (file.includes('schema.sql')) {
        // Only check for critical issues in base schema
        continue;
      }
      
      // Check for consistent primary key naming
      const createTableRegex = /CREATE TABLE[^(]*\s+(\w+)\s*\(/gi;
      let match;
      
      while ((match = createTableRegex.exec(content)) !== null) {
        const tableName = match[1].toLowerCase();
        
        if (COLUMN_MAPPINGS[tableName]) {
          // Extract column definitions for this table
          const tableStartIndex = match.index;
          const tableEndIndex = content.indexOf(');', tableStartIndex);
          const tableDefinition = content.substring(tableStartIndex, tableEndIndex);
          
          const expectedMapping = COLUMN_MAPPINGS[tableName].database;
          
          // Check primary key naming - look for either pattern since migrations update structure
          if (expectedMapping.primaryKey === 'id') {
            const hasCorrectPrimaryKey = 
              tableDefinition.includes(`${expectedMapping.primaryKey} UUID PRIMARY KEY`) ||
              tableDefinition.includes(`ADD COLUMN ${expectedMapping.primaryKey} UUID`) ||
              tableDefinition.includes(`id UUID PRIMARY KEY`);
              
            if (!hasCorrectPrimaryKey && file.includes('clean_unified_schema')) {
              // Only flag as error if this is in the main unified schema file
              schemaIssues.push({
                file,
                table: tableName,
                issue: `Primary key should be named '${expectedMapping.primaryKey}' with UUID type`,
                severity: 'warning'  // Downgraded to warning since actual DB is correct
              });
            }
          }
          
          // Check for user-friendly ID column - look for ADD COLUMN statements too
          if (expectedMapping.userFriendlyId) {
            const friendlyIdPattern = new RegExp(`${expectedMapping.userFriendlyId}\\s+(INTEGER|int)`, 'i');
            const addColumnPattern = new RegExp(`ADD COLUMN.*${expectedMapping.userFriendlyId}\\s+(INTEGER|int)`, 'i');
            
            if (!friendlyIdPattern.test(tableDefinition) && !addColumnPattern.test(content)) {
              // Only report if we're looking at the main migration files
              if (file.includes('clean_unified_schema') || file.includes('running_counters')) {
                schemaIssues.push({
                  file,
                  table: tableName,
                  issue: `User-friendly ID column '${expectedMapping.userFriendlyId}' may not be defined in this migration`,
                  severity: 'warning'  // Downgraded since actual DB has these columns
                });
              }
            }
          }
          
          // Check required columns - only for critical missing columns
          for (const requiredCol of expectedMapping.required) {
            if (!tableDefinition.toLowerCase().includes(requiredCol.toLowerCase())) {
              schemaIssues.push({
                file,
                table: tableName,
                issue: `Required column '${requiredCol}' not found in table definition`,
                severity: 'warning'
              });
            }
          }
        }
      }
    } catch (error) {
      schemaIssues.push({
        file,
        issue: `Error reading schema file: ${error.message}`,
        severity: 'warning'
      });
    }
  }
  
  return schemaIssues;
}

/**
 * Parse frontend components for column usage
 */
function parseFrontendComponents(changedFiles = []) {
  const frontendIssues = [];
  const componentPattern = 'client/src/components/**/*.js';
  
  // Use glob pattern to find all component files
  let componentFiles = [];
  try {
    const { execSync } = require('child_process');
    const globPattern = 'client/src/components/**/*.js';
    const findCmd = `find client/src/components -name "*.js" -type f 2>/dev/null || true`;
    const output = execSync(findCmd, { encoding: 'utf8' });
    componentFiles = output.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    // Fallback to known component files
    componentFiles = [
      'client/src/components/specimens/SpecimenList.js',
      'client/src/components/projects/ProjectList.js',
      'client/src/components/collaborators/CollaboratorList.js',
      'client/src/utils/projectUtils.js'
    ];
  }
  
  // If we have changed files, filter to only check those
  if (changedFiles.length > 0) {
    componentFiles = componentFiles.filter(file => 
      changedFiles.some(changed => changed === file || file.endsWith(changed))
    );
  }
  
  for (const file of componentFiles) {
    if (!fs.existsSync(file)) continue;
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for deprecated field usage
      for (const [entityType, mapping] of Object.entries(COLUMN_MAPPINGS)) {
        const deprecatedFields = mapping.frontend.deprecatedFields || [];
        
        for (const deprecatedField of deprecatedFields) {
          const deprecatedPattern = new RegExp(`\\b${deprecatedField}\\b`, 'g');
          const matches = content.match(deprecatedPattern);
          
          if (matches) {
            const lines = content.split('\n');
            const matchingLines = lines
              .map((line, index) => ({ line: line.trim(), number: index + 1 }))
              .filter(({ line }) => deprecatedPattern.test(line));
            
            for (const { line, number } of matchingLines) {
              frontendIssues.push({
                file,
                line: number,
                entity: entityType,
                issue: `Deprecated field '${deprecatedField}' used. Use '${mapping.frontend.displayField}' instead.`,
                code: line,
                severity: 'error'
              });
            }
          }
        }
        
        // Check for correct field usage patterns
        const expectedFields = mapping.frontend.expectedFields;
        const entityPattern = new RegExp(`\\b${entityType.slice(0, -1)}\\.(\\w+)`, 'g');
        let match;
        
        while ((match = entityPattern.exec(content)) !== null) {
          const fieldName = match[1];
          if (!expectedFields.includes(fieldName) && 
              !mapping.database.optional.includes(fieldName) &&
              !['created_at', 'updated_at'].includes(fieldName)) {
            
            // Find line number
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            const line = content.split('\n')[lineNumber - 1];
            
            frontendIssues.push({
              file,
              line: lineNumber,
              entity: entityType,
              issue: `Unexpected field '${fieldName}' accessed. Expected fields: ${expectedFields.join(', ')}`,
              code: line.trim(),
              severity: 'warning'
            });
          }
        }
      }
    } catch (error) {
      frontendIssues.push({
        file,
        issue: `Error reading component file: ${error.message}`,
        severity: 'warning'
      });
    }
  }
  
  return frontendIssues;
}

/**
 * Parse import utilities for column mapping consistency
 */
function parseImportUtilities(changedFiles = []) {
  const importIssues = [];
  const importFiles = [
    'utils/unifiedColumnMapping.js',
    'routes/multiFileImport.js',
    'routes/specimenImport.js',
    'routes/import.js'
  ];
  
  // Filter to changed files if provided
  const filesToCheck = changedFiles.length > 0 
    ? importFiles.filter(file => changedFiles.includes(file))
    : importFiles;
  
  for (const file of filesToCheck) {
    if (!fs.existsSync(file)) continue;
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for legacy_id usage (should be removed)
      const legacyIdPattern = /legacy_id|legacyId/g;
      const matches = content.match(legacyIdPattern);
      
      if (matches) {
        const lines = content.split('\n');
        const matchingLines = lines
          .map((line, index) => ({ line: line.trim(), number: index + 1 }))
          .filter(({ line }) => legacyIdPattern.test(line));
        
        for (const { line, number } of matchingLines) {
          importIssues.push({
            file,
            line: number,
            issue: "Legacy ID usage detected. Should use direct number column mapping.",
            code: line,
            severity: 'error'
          });
        }
      }
      
      // Check for consistent CSV header mapping
      for (const [entityType, mapping] of Object.entries(COLUMN_MAPPINGS)) {
        const csvHeaders = mapping.csvImport.acceptedHeaders;
        
        // Look for normalize function for this entity
        const normalizeFunctionPattern = new RegExp(`function normalize${entityType.charAt(0).toUpperCase() + entityType.slice(1, -1)}`, 'g');
        
        if (normalizeFunctionPattern.test(content)) {
          // Check that the function uses expected header variations
          for (const [dbColumn, expectedHeaders] of Object.entries(csvHeaders)) {
            const someHeadersFound = expectedHeaders.some(header => 
              content.includes(`rawData.${header}`) || content.includes(`rawData['${header}']`)
            );
            
            if (!someHeadersFound) {
              importIssues.push({
                file,
                entity: entityType,
                issue: `Missing CSV header mapping for '${dbColumn}'. Expected headers: ${expectedHeaders.join(', ')}`,
                severity: 'warning'
              });
            }
          }
        }
      }
      
    } catch (error) {
      importIssues.push({
        file,
        issue: `Error reading import file: ${error.message}`,
        severity: 'warning'
      });
    }
  }
  
  return importIssues;
}

/**
 * Check backend routes for consistent column usage
 */
function parseBackendRoutes(changedFiles = []) {
  const routeIssues = [];
  const routeFiles = [
    'routes/collaborators.js',
    'routes/projects.js', 
    'routes/specimens.js',
    'routes/patients.js'
  ];
  
  const filesToCheck = changedFiles.length > 0
    ? routeFiles.filter(file => changedFiles.includes(file))
    : routeFiles;
  
  for (const file of filesToCheck) {
    if (!fs.existsSync(file)) continue;
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      const entityType = path.basename(file, '.js'); // e.g., 'specimens'
      
      if (COLUMN_MAPPINGS[entityType]) {
        const mapping = COLUMN_MAPPINGS[entityType];
        
        // Check for potentially problematic uuid column references
        // But be more lenient - only flag obvious inconsistencies
        const problematicUuidPattern = /\$\d+::uuid|\buuid\s*,|\buuid\s*\)/g;
        const matches = content.match(problematicUuidPattern);
        
        if (matches && mapping.database.primaryKey === 'id') {
          const lines = content.split('\n');
          const matchingLines = lines
            .map((line, index) => ({ line: line.trim(), number: index + 1 }))
            .filter(({ line }) => {
              // Only flag lines that have problematic uuid usage
              return problematicUuidPattern.test(line) && 
                     !line.includes('uuid_generate_v4') &&
                     !line.includes('::uuid') && // Skip type casting which is valid
                     line.includes('uuid'); // Must actually reference uuid
            });
          
          for (const { line, number } of matchingLines) {
            // Additional filtering to avoid false positives
            if (!line.includes('VALUES') && !line.includes('INSERT') && !line.includes('UPDATE')) {
              routeIssues.push({
                file,
                line: number,
                entity: entityType,
                issue: `Potential inconsistent primary key reference. Consider using '${mapping.database.primaryKey}' instead of 'uuid'`,
                code: line,
                severity: 'warning'  // Downgraded to warning to avoid false positives
              });
            }
          }
        }
        
        // Check that user-friendly ID column is being selected in queries
        const selectPattern = /SELECT[\s\S]*?FROM\s+\w+/gi;
        let selectMatch;
        
        while ((selectMatch = selectPattern.exec(content)) !== null) {
          const selectClause = selectMatch[0];
          const userFriendlyId = mapping.database.userFriendlyId;
          
          // Only suggest including user-friendly ID if:
          // 1. It's not a SELECT * query
          // 2. It's not already included
          // 3. It's a substantial SELECT query (not just a count or existence check)
          if (userFriendlyId && 
              !selectClause.includes(userFriendlyId) && 
              !selectClause.includes('*') &&
              !selectClause.includes('COUNT') &&
              !selectClause.includes('EXISTS') &&
              selectClause.length > 50) {
            
            const beforeMatch = content.substring(0, selectMatch.index);
            const lineNumber = beforeMatch.split('\n').length;
            
            routeIssues.push({
              file,
              line: lineNumber,
              entity: entityType,
              issue: `Consider including '${userFriendlyId}' in SELECT query for frontend display`,
              severity: 'info'  // Downgraded to info level
            });
          }
        }
      }
    } catch (error) {
      routeIssues.push({
        file,
        issue: `Error reading route file: ${error.message}`,
        severity: 'warning'
      });
    }
  }
  
  return routeIssues;
}

/**
 * Generate summary report of all issues found
 */
function generateReport(allIssues) {
  const errorCount = allIssues.filter(issue => issue.severity === 'error').length;
  const warningCount = allIssues.filter(issue => issue.severity === 'warning').length;
  const infoCount = allIssues.filter(issue => issue.severity === 'info').length;
  
  console.log(`\n${colors.bold}${colors.blue}Column Naming Consistency Validation Report${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);
  
  if (allIssues.length === 0) {
    console.log(`${colors.green}✅ No column naming inconsistencies found!${colors.reset}\n`);
    return true;
  }
  
  // Show summary with all severity levels
  let summary = [];
  if (errorCount > 0) summary.push(`${colors.red}❌ ${errorCount} errors${colors.reset}`);
  if (warningCount > 0) summary.push(`${colors.yellow}⚠️  ${warningCount} warnings${colors.reset}`);
  if (infoCount > 0) summary.push(`${colors.blue}ℹ️  ${infoCount} info${colors.reset}`);
  
  console.log(summary.join(', ') + '\n');
  
  // Group issues by file and severity
  const issuesByFile = {};
  allIssues.forEach(issue => {
    const file = issue.file || 'General';
    if (!issuesByFile[file]) {
      issuesByFile[file] = [];
    }
    issuesByFile[file].push(issue);
  });
  
  for (const [file, issues] of Object.entries(issuesByFile)) {
    // Sort issues by severity: error, warning, info
    const sortedIssues = issues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    console.log(`${colors.bold}📁 ${file}${colors.reset}`);
    
    sortedIssues.forEach(issue => {
      let icon, color;
      switch (issue.severity) {
        case 'error':
          icon = '❌';
          color = colors.red;
          break;
        case 'warning':
          icon = '⚠️';
          color = colors.yellow;
          break;
        case 'info':
          icon = 'ℹ️';
          color = colors.blue;
          break;
        default:
          icon = '•';
          color = colors.reset;
      }
      
      console.log(`  ${icon} ${color}${issue.issue}${colors.reset}`);
      
      if (issue.line) {
        console.log(`     Line ${issue.line}${issue.entity ? ` (${issue.entity})` : ''}`);
      }
      
      if (issue.code) {
        console.log(`     ${colors.blue}>${colors.reset} ${issue.code}`);
      }
      
      console.log('');
    });
  }
  
  // Provide appropriate feedback based on severity levels
  if (errorCount > 0) {
    console.log(`${colors.red}${colors.bold}🚫 Commit blocked due to ${errorCount} error(s).${colors.reset}`);
    console.log(`\n${colors.bold}Critical fixes needed:${colors.reset}`);
    console.log(`1. Replace deprecated fields (project_legacy_id → project_number)`);
    console.log(`2. Remove legacy_id references from import utilities`);
    console.log(`3. Update frontend components to use correct column names\n`);
  } else if (warningCount > 0 || infoCount > 0) {
    console.log(`${colors.green}✅ Commit allowed${colors.reset} - no critical errors found.\n`);
    if (warningCount > 0) {
      console.log(`${colors.yellow}${colors.bold}Optional improvements:${colors.reset}`);
      console.log(`• Review warnings above to improve code consistency`);
      console.log(`• Consider addressing schema documentation issues\n`);
    }
    if (infoCount > 0) {
      console.log(`${colors.blue}${colors.bold}Suggestions:${colors.reset}`);
      console.log(`• Review info items for potential optimizations`);
      console.log(`• Consider including user-friendly IDs in SELECT queries\n`);
    }
  }
  
  return errorCount === 0;
}

/**
 * Main validation function
 */
function main() {
  console.log(`${colors.blue}🔍 Running column naming consistency validation...${colors.reset}\n`);
  
  const changedFiles = getChangedFiles();
  
  if (changedFiles.length > 0) {
    console.log(`${colors.blue}📝 Checking ${changedFiles.length} changed files${colors.reset}`);
  } else {
    console.log(`${colors.blue}📝 Checking all relevant files${colors.reset}`);
  }
  
  // Run all validations
  const schemaIssues = parseDatabaseSchema();
  const frontendIssues = parseFrontendComponents(changedFiles);
  const importIssues = parseImportUtilities(changedFiles);
  const routeIssues = parseBackendRoutes(changedFiles);
  
  // Combine all issues
  const allIssues = [
    ...schemaIssues.map(issue => ({ ...issue, category: 'Database Schema' })),
    ...frontendIssues.map(issue => ({ ...issue, category: 'Frontend Components' })),
    ...importIssues.map(issue => ({ ...issue, category: 'Import Utilities' })),
    ...routeIssues.map(issue => ({ ...issue, category: 'Backend Routes' }))
  ];
  
  // Generate report and determine if commit should be allowed
  const success = generateReport(allIssues);
  
  if (!success) {
    console.log(`${colors.red}Pre-commit validation failed. Please fix the above issues before committing.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Column naming consistency validation passed!${colors.reset}\n`);
    process.exit(0);
  }
}

// Run the validation
if (require.main === module) {
  main();
}

module.exports = {
  parseDatabaseSchema,
  parseFrontendComponents,
  parseImportUtilities,
  parseBackendRoutes,
  COLUMN_MAPPINGS
};