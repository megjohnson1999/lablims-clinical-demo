#!/usr/bin/env node

/**
 * Post-Commit Hook: CLAUDE.md Auto-Updater
 * 
 * Automatically updates CLAUDE.md with current project status when significant
 * changes are detected in commits:
 * - API endpoint modifications (routes/*.js)
 * - Database schema changes (db/migrations/*.sql)
 * - Major architectural updates (package.json, config changes)
 * - New feature implementations
 * 
 * Maintains a living document for Claude context with minimal manual intervention.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const icons = {
  success: '✅',
  info: 'ℹ️',
  update: '🔄',
  database: '🗄️',
  api: '🌐',
  config: '⚙️'
};

/**
 * Execute command with error handling
 */
function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get files changed in the last commit
 */
function getChangedFiles() {
  try {
    const output = executeCommand('git diff-tree --no-commit-id --name-only -r HEAD');
    return output ? output.split('\n').filter(file => file.length > 0) : [];
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not get changed files${colors.reset}`);
    return [];
  }
}

/**
 * Get commit message and metadata
 */
function getCommitInfo() {
  const message = executeCommand('git log -1 --pretty=format:"%s"') || 'Unknown commit';
  const hash = executeCommand('git log -1 --pretty=format:"%h"') || 'unknown';
  const date = executeCommand('git log -1 --pretty=format:"%ci"') || new Date().toISOString();
  const author = executeCommand('git log -1 --pretty=format:"%an"') || 'Unknown';
  
  return { message, hash, date, author };
}

/**
 * Analyze changed files to determine update significance
 */
function analyzeChanges(changedFiles) {
  const analysis = {
    apiEndpoints: [],
    databaseMigrations: [],
    configChanges: [],
    packageChanges: [],
    newFeatures: [],
    significance: 'minor'
  };

  for (const file of changedFiles) {
    // API endpoint changes
    if (file.startsWith('routes/') && file.endsWith('.js')) {
      analysis.apiEndpoints.push(file);
      analysis.significance = 'major';
    }
    
    // Database migrations
    if (file.startsWith('db/migrations/') && file.endsWith('.sql')) {
      analysis.databaseMigrations.push(file);
      analysis.significance = 'major';
    }
    
    // Database schema changes
    if (file === 'db/schema.sql') {
      analysis.databaseMigrations.push(file);
      analysis.significance = 'major';
    }
    
    // Configuration changes
    if (['package.json', 'client/package.json', '.env', 'config/', 'middleware/'].some(pattern => 
        file.includes(pattern))) {
      analysis.configChanges.push(file);
      if (file === 'package.json' || file === 'client/package.json') {
        analysis.packageChanges.push(file);
        analysis.significance = 'major';
      }
    }
    
    // New feature detection (new component directories, new services)
    if ((file.includes('components/') || file.includes('services/') || file.includes('utils/')) 
        && !file.includes('test') && file.endsWith('.js')) {
      // Check if it's a new file
      const gitStatus = executeCommand(`git log --oneline --diff-filter=A -- "${file}"`);
      if (gitStatus && gitStatus.includes('HEAD')) {
        analysis.newFeatures.push(file);
        analysis.significance = 'major';
      }
    }
  }

  return analysis;
}

/**
 * Scan current API endpoints
 */
function scanApiEndpoints() {
  const endpoints = [];
  const routesDir = 'routes';
  
  if (!fs.existsSync(routesDir)) return endpoints;
  
  try {
    const routeFiles = fs.readdirSync(routesDir)
      .filter(file => file.endsWith('.js') && !file.includes('test'));
    
    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      
      // Extract route definitions
      const routeMatches = content.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g);
      if (routeMatches) {
        const basePath = file.replace('.js', '');
        routeMatches.forEach(match => {
          const methodMatch = match.match(/router\.(\w+)/);
          const pathMatch = match.match(/['"`]([^'"`]+)['"`]/);
          
          if (methodMatch && pathMatch) {
            const method = methodMatch[1].toUpperCase();
            const routePath = pathMatch[1];
            const fullPath = `/api/${basePath}${routePath === '/' ? '' : routePath}`;
            endpoints.push({ method, path: fullPath, file });
          }
        });
      }
    }
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not scan API endpoints${colors.reset}`);
  }
  
  return endpoints;
}

/**
 * Scan database schema
 */
function scanDatabaseSchema() {
  const schema = {
    tables: [],
    migrations: []
  };
  
  // Scan main schema file
  try {
    if (fs.existsSync('db/schema.sql')) {
      const content = fs.readFileSync('db/schema.sql', 'utf8');
      const tableMatches = content.match(/CREATE TABLE[^(]*\s+(\w+)\s*\(/gi);
      if (tableMatches) {
        schema.tables = tableMatches.map(match => {
          const nameMatch = match.match(/CREATE TABLE[^(]*\s+(\w+)\s*\(/i);
          return nameMatch ? nameMatch[1] : 'unknown';
        });
      }
    }
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not scan schema.sql${colors.reset}`);
  }
  
  // Scan migrations
  try {
    if (fs.existsSync('db/migrations')) {
      const migrationFiles = fs.readdirSync('db/migrations')
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      schema.migrations = migrationFiles.map(file => {
        const stats = fs.statSync(path.join('db/migrations', file));
        return {
          name: file,
          created: stats.mtime.toISOString().split('T')[0]
        };
      });
    }
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not scan migrations${colors.reset}`);
  }
  
  return schema;
}

/**
 * Get package information
 */
function getPackageInfo() {
  const packages = {};
  
  // Backend package.json
  try {
    if (fs.existsSync('package.json')) {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      packages.backend = {
        version: pkg.version || '1.0.0',
        dependencies: Object.keys(pkg.dependencies || {}).length,
        devDependencies: Object.keys(pkg.devDependencies || {}).length,
        scripts: Object.keys(pkg.scripts || {})
      };
    }
  } catch (error) {
    packages.backend = { error: 'Could not read package.json' };
  }
  
  // Frontend package.json
  try {
    if (fs.existsSync('client/package.json')) {
      const pkg = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
      packages.frontend = {
        version: pkg.version || '0.1.0',
        dependencies: Object.keys(pkg.dependencies || {}).length,
        devDependencies: Object.keys(pkg.devDependencies || {}).length,
        scripts: Object.keys(pkg.scripts || {})
      };
    }
  } catch (error) {
    packages.frontend = { error: 'Could not read client/package.json' };
  }
  
  return packages;
}

/**
 * Generate CLAUDE.md update section
 */
function generateClaudeUpdate(commitInfo, analysis, endpoints, schema, packages) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  let update = `\n## 🔄 Auto-Generated Status Update (${timestamp})\n\n`;
  
  // Commit information
  update += `**Latest Commit**: \`${commitInfo.hash}\` - ${commitInfo.message}\n`;
  update += `**Author**: ${commitInfo.author} | **Date**: ${commitInfo.date.split('T')[0]}\n\n`;
  
  // Significance assessment
  if (analysis.significance === 'major') {
    update += `${icons.update} **MAJOR UPDATE DETECTED** - Significant architectural changes made\n\n`;
  }
  
  // API Endpoints Summary
  if (endpoints.length > 0) {
    update += `### ${icons.api} Current API Endpoints (${endpoints.length} total)\n\n`;
    
    // Group by method
    const methodGroups = endpoints.reduce((acc, ep) => {
      if (!acc[ep.method]) acc[ep.method] = [];
      acc[ep.method].push(ep);
      return acc;
    }, {});
    
    for (const [method, eps] of Object.entries(methodGroups)) {
      update += `**${method}**: ${eps.length} endpoints\n`;
      if (eps.length <= 10) { // Only show details if not too many
        eps.forEach(ep => update += `- \`${method} ${ep.path}\`\n`);
      }
      update += '\n';
    }
  }
  
  // Database Schema Summary
  if (schema.tables.length > 0 || schema.migrations.length > 0) {
    update += `### ${icons.database} Database Schema Status\n\n`;
    
    if (schema.tables.length > 0) {
      update += `**Tables (${schema.tables.length})**: ${schema.tables.join(', ')}\n\n`;
    }
    
    if (schema.migrations.length > 0) {
      update += `**Recent Migrations**:\n`;
      schema.migrations.slice(-5).forEach(migration => {
        update += `- \`${migration.name}\` (${migration.created})\n`;
      });
      update += '\n';
    }
  }
  
  // Package Information
  update += `### ${icons.config} Package Status\n\n`;
  
  if (packages.backend && !packages.backend.error) {
    update += `**Backend** v${packages.backend.version}: `;
    update += `${packages.backend.dependencies} dependencies, `;
    update += `${packages.backend.scripts.length} npm scripts\n`;
  }
  
  if (packages.frontend && !packages.frontend.error) {
    update += `**Frontend** v${packages.frontend.version}: `;
    update += `${packages.frontend.dependencies} dependencies, `;
    update += `${packages.frontend.scripts.length} npm scripts\n`;
  }
  update += '\n';
  
  // Changes in this commit
  if (analysis.apiEndpoints.length > 0) {
    update += `**API Changes**: ${analysis.apiEndpoints.join(', ')}\n`;
  }
  
  if (analysis.databaseMigrations.length > 0) {
    update += `**Database Changes**: ${analysis.databaseMigrations.join(', ')}\n`;
  }
  
  if (analysis.configChanges.length > 0) {
    update += `**Config Changes**: ${analysis.configChanges.join(', ')}\n`;
  }
  
  if (analysis.newFeatures.length > 0) {
    update += `**New Features**: ${analysis.newFeatures.join(', ')}\n`;
  }
  
  update += `\n---\n\n`;
  
  return update;
}

/**
 * Update CLAUDE.md file
 */
function updateClaudeFile(updateContent) {
  const claudeFile = 'CLAUDE.md';
  
  try {
    if (!fs.existsSync(claudeFile)) {
      console.log(`${colors.yellow}Warning: CLAUDE.md not found, creating new file${colors.reset}`);
      fs.writeFileSync(claudeFile, '# LIMS Project Documentation\n\nAuto-generated updates appear below:\n\n');
    }
    
    let existingContent = fs.readFileSync(claudeFile, 'utf8');
    
    // Find the insertion point (after the header, before any auto-generated content)
    const insertionMarker = '## 🔄 Auto-Generated Status Update';
    const existingUpdateIndex = existingContent.indexOf(insertionMarker);
    
    if (existingUpdateIndex !== -1) {
      // Replace existing auto-generated section
      const beforeUpdate = existingContent.substring(0, existingUpdateIndex);
      existingContent = beforeUpdate + updateContent;
    } else {
      // Append to end of file
      existingContent += updateContent;
    }
    
    fs.writeFileSync(claudeFile, existingContent);
    console.log(`${colors.green}${icons.success} CLAUDE.md updated successfully${colors.reset}`);
    
    return true;
  } catch (error) {
    console.log(`${colors.red}Error updating CLAUDE.md: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Main hook function
 */
function runPostCommitHook() {
  console.log(`${colors.bold}${colors.cyan}🔄 Post-Commit CLAUDE.md Updater${colors.reset}\n`);
  
  // Get changed files and commit info
  const changedFiles = getChangedFiles();
  const commitInfo = getCommitInfo();
  
  if (changedFiles.length === 0) {
    console.log(`${colors.yellow}No files changed, skipping update${colors.reset}`);
    return;
  }
  
  console.log(`${colors.blue}${icons.info} Analyzing ${changedFiles.length} changed files...${colors.reset}`);
  
  // Analyze changes
  const analysis = analyzeChanges(changedFiles);
  
  // Skip update if only minor changes
  if (analysis.significance === 'minor' && 
      analysis.apiEndpoints.length === 0 && 
      analysis.databaseMigrations.length === 0 &&
      analysis.configChanges.length === 0) {
    console.log(`${colors.yellow}Only minor changes detected, skipping CLAUDE.md update${colors.reset}`);
    return;
  }
  
  console.log(`${colors.blue}${icons.info} Scanning current project status...${colors.reset}`);
  
  // Gather current project status
  const endpoints = scanApiEndpoints();
  const schema = scanDatabaseSchema();
  const packages = getPackageInfo();
  
  // Generate update content
  const updateContent = generateClaudeUpdate(commitInfo, analysis, endpoints, schema, packages);
  
  // Update CLAUDE.md
  const success = updateClaudeFile(updateContent);
  
  if (success) {
    console.log(`\n${colors.green}${colors.bold}✨ CLAUDE.md updated successfully!${colors.reset}`);
    console.log(`${colors.blue}Summary: ${analysis.significance} update with ${changedFiles.length} files changed${colors.reset}`);
    
    // Show what was detected
    if (analysis.apiEndpoints.length > 0) {
      console.log(`${colors.green}• API changes: ${analysis.apiEndpoints.length} files${colors.reset}`);
    }
    if (analysis.databaseMigrations.length > 0) {
      console.log(`${colors.green}• Database changes: ${analysis.databaseMigrations.length} files${colors.reset}`);
    }
    if (analysis.newFeatures.length > 0) {
      console.log(`${colors.green}• New features: ${analysis.newFeatures.length} files${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}Failed to update CLAUDE.md${colors.reset}`);
  }
}

// Run the hook if called directly
if (require.main === module) {
  runPostCommitHook();
}

module.exports = {
  runPostCommitHook,
  analyzeChanges,
  scanApiEndpoints,
  scanDatabaseSchema
};