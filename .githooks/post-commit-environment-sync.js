#!/usr/bin/env node

/**
 * Post-commit hook for environment synchronization monitoring
 * 
 * This hook runs after commits to detect potential environment drift
 * and provide actionable guidance for maintaining consistency.
 */

const { execSync } = require('child_process');
const fs = require('fs');

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

/**
 * Check if recent commits contain critical fixes that might not be in base schema
 */
function checkForCriticalFixes() {
  try {
    // Look for critical fix patterns in recent commits
    const recentCommits = execSync('git log --oneline --since="2 weeks ago"', { encoding: 'utf8' });
    
    const criticalPatterns = [
      { pattern: /CRITICAL.*FIX|critical.*fix/i, type: 'Critical Fix' },
      { pattern: /silent.*failure|false.*success/i, type: 'Import Validation Fix' },
      { pattern: /migration.*import|import.*failure/i, type: 'Migration Import Fix' },
      { pattern: /Unknown.*entity|Unknown.*collaborator/i, type: 'Unknown Entity Fix' },
      { pattern: /constraint.*violation|positive.*constraint/i, type: 'Database Constraint Fix' }
    ];
    
    const foundFixes = [];
    const commitLines = recentCommits.split('\n').filter(line => line.trim());
    
    for (const line of commitLines) {
      for (const { pattern, type } of criticalPatterns) {
        if (pattern.test(line)) {
          foundFixes.push({ type, commit: line.trim() });
          break;
        }
      }
    }
    
    if (foundFixes.length > 0) {
      console.log(`${colors.yellow}⚠️  Recent critical fixes detected:${colors.reset}`);
      foundFixes.forEach(fix => {
        console.log(`   ${colors.cyan}${fix.type}:${colors.reset} ${fix.commit}`);
      });
      console.log(`\n${colors.blue}💡 Recommendation:${colors.reset} Ensure fixes are integrated into base schema for fresh clones`);
      return true;
    }
    
    return false;
  } catch (error) {
    // Silently fail - this is just advisory
    return false;
  }
}

/**
 * Validate current environment against committed schema requirements
 */
function validateCurrentEnvironment() {
  let hasWarnings = false;
  
  try {
    // Check if schema includes required Unknown entities
    const schemaContent = fs.readFileSync('db/schema.sql', 'utf8');
    
    const hasUnknownCollaborator = /INSERT INTO collaborators.*Unknown.*ON CONFLICT.*DO NOTHING/is.test(schemaContent);
    const hasUnknownProject = /INSERT INTO projects.*Unknown.*ON CONFLICT.*DO NOTHING/is.test(schemaContent);
    
    // Check if import code exists and expects Unknown entities
    const importFilesExist = fs.existsSync('routes/multiFileImport.js');
    let expectsUnknownEntities = false;
    
    if (importFilesExist) {
      try {
        const importContent = fs.readFileSync('routes/multiFileImport.js', 'utf8');
        expectsUnknownEntities = /Unknown.*collaborator|Unknown.*project|pi_name.*=.*'Unknown'/i.test(importContent);
      } catch (e) {
        // Skip if can't read file
      }
    }
    
    if (expectsUnknownEntities && (!hasUnknownCollaborator || !hasUnknownProject)) {
      console.log(`${colors.yellow}⚠️  Environment Sync Warning: Import code expects Unknown entities but they're not auto-created in schema${colors.reset}`);
      console.log(`   Fresh git clones may fail with "Unknown collaborator not found" errors`);
      hasWarnings = true;
    }
    
    // Check for uncommitted migration files that should be in base schema
    const migrationDir = 'db/migrations';
    if (fs.existsSync(migrationDir)) {
      const migrationFiles = fs.readdirSync(migrationDir).filter(f => 
        f.includes('remove_positive_number_constraints') ||
        f.includes('create_unknown_entities') ||
        f.includes('fix_migration_import')
      );
      
      if (migrationFiles.length > 0) {
        console.log(`${colors.yellow}⚠️  Critical migration files exist that may need integration into base schema:${colors.reset}`);
        migrationFiles.forEach(file => {
          console.log(`   - db/migrations/${file}`);
        });
        console.log(`   Consider integrating these fixes into db/schema.sql for fresh clone compatibility`);
        hasWarnings = true;
      }
    }
    
  } catch (error) {
    // Silently fail - this is advisory
  }
  
  return hasWarnings;
}

/**
 * Generate actionable recommendations for environment synchronization
 */
function generateRecommendations() {
  console.log(`\n${colors.blue}🔧 Environment Synchronization Checklist:${colors.reset}`);
  console.log(`${colors.green}✅ Recommended actions for maintaining environment consistency:${colors.reset}`);
  console.log(`\n1. ${colors.cyan}Test Fresh Clone Setup:${colors.reset}`);
  console.log(`   dropdb test_fresh_clone && createdb test_fresh_clone`);
  console.log(`   psql test_fresh_clone -f db/schema.sql`);
  console.log(`   # Should work without additional steps`);
  
  console.log(`\n2. ${colors.cyan}Verify Unknown Entity Creation:${colors.reset}`);
  console.log(`   psql test_fresh_clone -c "SELECT collaborator_number, pi_name FROM collaborators WHERE collaborator_number = 0;"`);
  console.log(`   psql test_fresh_clone -c "SELECT project_number, disease FROM projects WHERE project_number = 0;"`);
  
  console.log(`\n3. ${colors.cyan}Test Import Functionality:${colors.reset}`);
  console.log(`   # Fresh clone should handle import operations without "Unknown entity not found" errors`);
  
  console.log(`\n4. ${colors.cyan}Documentation:${colors.reset}`);
  console.log(`   # Update ENVIRONMENT_SYNC_FIX_SUMMARY.md if fixes are added to schema`);
  console.log(`   # Document any new critical dependencies in CLAUDE.md`);
  
  console.log(`\n${colors.blue}💡 For questions about environment sync, see ENVIRONMENT_SYNC_FIX_SUMMARY.md${colors.reset}`);
}

function main() {
  const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8' }).trim();
  
  console.log(`${colors.blue}🔍 Post-commit environment synchronization check...${colors.reset}`);
  console.log(`${colors.cyan}Last commit: ${lastCommit}${colors.reset}\n`);
  
  let hasIssues = false;
  
  // Check for recent critical fixes
  hasIssues = checkForCriticalFixes() || hasIssues;
  
  // Validate current environment setup
  hasIssues = validateCurrentEnvironment() || hasIssues;
  
  if (hasIssues) {
    generateRecommendations();
  } else {
    console.log(`${colors.green}✅ Environment synchronization looks good${colors.reset}`);
    console.log(`${colors.cyan}Fresh git clones should work without additional setup${colors.reset}`);
  }
  
  // Always return 0 - this is advisory only, never block
  return 0;
}

// Only run if called directly (not sourced)
if (require.main === module) {
  process.exit(main());
}

module.exports = { main, checkForCriticalFixes, validateCurrentEnvironment };