#!/usr/bin/env node

/**
 * Pre-commit hook to prevent database-dependent code commits
 * 
 * This hook prevents commits that might depend on manual database changes
 * by detecting suspicious patterns and enforcing schema consistency.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

/**
 * Validates environment synchronization requirements for import system
 */
function validateEnvironmentSync(changedFiles) {
  let hasIssues = false;
  
  try {
    // Check if schema includes Unknown entity creation
    const schemaContent = fs.readFileSync('db/schema.sql', 'utf8');
    
    // Check for Unknown entity auto-creation in schema
    const hasUnknownCollaborator = /INSERT INTO collaborators.*Unknown.*ON CONFLICT.*DO NOTHING/is.test(schemaContent);
    const hasUnknownProject = /INSERT INTO projects.*Unknown.*ON CONFLICT.*DO NOTHING/is.test(schemaContent);
    
    // Check if import code expects Unknown entities
    const importFiles = changedFiles.filter(f => 
      f.includes('multiFileImport') || 
      f.includes('import') || 
      f.includes('migration')
    );
    
    let expectsUnknownEntities = false;
    for (const file of importFiles) {
      try {
        const content = execSync(`git show :${file}`, { encoding: 'utf8' });
        if (/Unknown.*collaborator|Unknown.*project|pi_name.*=.*'Unknown'/i.test(content)) {
          expectsUnknownEntities = true;
          break;
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
    
    if (expectsUnknownEntities && (!hasUnknownCollaborator || !hasUnknownProject)) {
      console.log(`${colors.red}❌ Environment Sync Issue: Import code expects Unknown entities but schema doesn't auto-create them${colors.reset}`);
      console.log(`   Fresh git clones will fail: "Unknown collaborator not found"`);
      console.log(`   ✅ Solution: Add Unknown entity creation to db/schema.sql (see ENVIRONMENT_SYNC_FIX_SUMMARY.md)`);
      hasIssues = true;
    }
    
    // Check for constraint violations that block Unknown entity creation
    const hasPositiveConstraints = /CHECK.*\w+_number\s*>\s*0|ADD CONSTRAINT.*positive/i.test(schemaContent);
    if (hasPositiveConstraints && expectsUnknownEntities) {
      console.log(`${colors.red}❌ Environment Sync Issue: Schema has positive number constraints that block Unknown entities${colors.reset}`);
      console.log(`   Fresh git clones will fail: "constraint violation on number = 0"`);
      console.log(`   ✅ Solution: Remove positive number constraints from db/schema.sql`);
      hasIssues = true;
    }
    
    // Check if there are migration files that should be integrated into base schema
    const migrationFiles = ['remove_positive_number_constraints.sql', 'create_unknown_entities.sql'];
    for (const migFile of migrationFiles) {
      const migPath = `db/migrations/${migFile}`;
      if (fs.existsSync(migPath)) {
        console.log(`${colors.yellow}⚠️  Environment Sync Warning: ${migFile} exists but should be integrated into base schema${colors.reset}`);
        console.log(`   Fresh clones won't auto-apply migrations, causing environment drift`);
        hasIssues = true;
      }
    }
    
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Environment sync validation failed: ${error.message}${colors.reset}`);
  }
  
  return hasIssues;
}

/**
 * Validates that base schema supports all entity types used in code
 */
function validateSchemaEntitySupport(changedFiles) {
  let hasIssues = false;
  
  try {
    // Extract entity types from get_next_number() calls in staged files
    const entityTypesInCode = new Set();
    
    for (const file of changedFiles.filter(f => f.endsWith('.js'))) {
      try {
        const content = execSync(`git show :${file}`, { encoding: 'utf8' });
        const matches = content.matchAll(/get_next_number\(['"]([a-zA-Z_]+)['"]\)/g);
        
        for (const match of matches) {
          entityTypesInCode.add(match[1]);
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
    
    if (entityTypesInCode.size === 0) return false;
    
    // Check if base schema supports all entity types
    try {
      const schemaContent = fs.readFileSync('db/schema.sql', 'utf8');
      
      for (const entityType of entityTypesInCode) {
        const sequenceName = `${entityType}_id_seq`;
        const altSequenceName = `${entityType}_number_seq`;
        
        const hasSequence = schemaContent.includes(sequenceName) || schemaContent.includes(altSequenceName);
        const hasCaseStatement = new RegExp(`WHEN\\s+'${entityType}'\\s+THEN`, 'i').test(schemaContent);
        
        if (!hasSequence || !hasCaseStatement) {
          console.log(`${colors.red}❌ Base schema missing support for entity type: '${entityType}'${colors.reset}`);
          console.log(`   Missing: ${!hasSequence ? `${sequenceName} sequence` : ''} ${!hasCaseStatement ? `CASE statement in get_next_number()` : ''}`);
          hasIssues = true;
        }
      }
      
      if (hasIssues) {
        console.log(`${colors.yellow}⚠️  Fresh git clones will fail with "Invalid entity type" errors${colors.reset}`);
        console.log(`   Add missing sequences and CASE statements to db/schema.sql`);
      }
      
    } catch (e) {
      console.log(`${colors.yellow}⚠️  Could not validate schema support: ${e.message}${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Entity type validation failed: ${error.message}${colors.reset}`);
  }
  
  return hasIssues;
}

function main() {
  console.log(`${colors.blue}🔍 Checking for database-dependent changes...${colors.reset}`);
  
  let hasIssues = false;
  
  try {
    // Get staged files
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .trim().split('\n').filter(f => f);
    
    if (stagedFiles.length === 0) {
      return 0; // No staged files
    }

    // Check for database-related file changes
    const databaseFiles = stagedFiles.filter(file => 
      file.includes('multiFileImport.js') ||
      file.includes('routes/') ||
      file.includes('db/') ||
      file.includes('schema.sql') ||
      file.includes('migration')
    );

    if (databaseFiles.length > 0) {
      console.log(`${colors.yellow}⚠️  Database-related files detected:${colors.reset}`);
      databaseFiles.forEach(file => console.log(`   - ${file}`));
      
      // Check staged content for suspicious patterns that indicate manual database dependency
      const suspiciousPatterns = [
        { pattern: /psql.*-c.*ALTER TABLE/i, message: 'Manual psql ALTER TABLE command found in code' },
        { pattern: /psql.*-c.*DROP CONSTRAINT/i, message: 'Manual psql DROP CONSTRAINT command found in code' },
        { pattern: /TODO.*psql.*-c|FIXME.*psql.*-c/i, message: 'Manual psql command referenced in comments' },
        { pattern: /manually run.*psql|run this psql/i, message: 'Instructions to run manual psql commands' },
        { pattern: /get_next_number\(['"][a-zA-Z_]+['"]\)/g, message: 'New entity type in get_next_number() - verify base schema supports it' }
      ];

      for (const file of databaseFiles) {
        try {
          const content = execSync(`git show :${file}`, { encoding: 'utf8' });
          
          for (const { pattern, message } of suspiciousPatterns) {
            if (pattern.test(content)) {
              console.log(`${colors.red}❌ ${file}: ${message}${colors.reset}`);
              hasIssues = true;
            }
          }
        } catch (e) {
          // File might be deleted or new, skip
        }
      }

      // Check if base schema supports all entity types used in code
      const schemaChanged = stagedFiles.includes('db/schema.sql');
      const codeChanged = databaseFiles.some(f => f.endsWith('.js'));
      
      if (codeChanged) {
        hasIssues = validateSchemaEntitySupport(databaseFiles) || hasIssues;
      }
      
      // Validate environment synchronization (Unknown entities, constraints, etc.)
      hasIssues = validateEnvironmentSync(databaseFiles) || hasIssues;
      
      // Only warn if there are actual suspicious patterns found - schema updates are normal
      if (hasIssues) {
        if (codeChanged && !schemaChanged) {
          console.log(`${colors.yellow}⚠️  Database code changed but schema.sql not updated${colors.reset}`);
          console.log(`   Make sure schema.sql supports the new code requirements`);
        }
      }
      
      // Check commit message for explicit manual database command references
      try {
        const commitMsg = fs.readFileSync('.git/COMMIT_EDITMSG', 'utf8');
        if (/psql.*-c.*ALTER|manually run.*psql.*-c|TODO.*psql.*-c/i.test(commitMsg)) {
          console.log(`${colors.red}❌ Commit message references manual database commands${colors.reset}`);
          hasIssues = true;
        }
      } catch (e) {
        // COMMIT_EDITMSG might not exist yet
      }
    }

    if (hasIssues) {
      console.log(`\n${colors.red}🚫 COMMIT BLOCKED${colors.reset}`);
      console.log(`${colors.yellow}This commit appears to depend on manual database changes.${colors.reset}`);
      console.log(`\n${colors.blue}Required actions:${colors.reset}`);
      console.log(`1. Update db/schema.sql to include all database requirements`);
      console.log(`2. Remove manual psql commands from code/comments`);
      console.log(`3. Ensure fresh installations work: psql -f db/schema.sql`);
      console.log(`4. Test with: dropdb test_db && createdb test_db && psql test_db -f db/schema.sql`);
      console.log(`\n${colors.blue}See CLAUDE.md "Database Change Protocol" for guidelines${colors.reset}`);
      
      return 1; // Block commit
    }

    console.log(`${colors.green}✅ Database change validation passed${colors.reset}`);
    return 0; // Allow commit
    
  } catch (error) {
    console.error(`${colors.red}❌ Database validation failed:${colors.reset}`, error.message);
    return 1; // Block commit on error
  }
}

process.exit(main());