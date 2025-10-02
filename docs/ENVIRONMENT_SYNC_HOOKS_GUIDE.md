# Environment Synchronization Git Hooks Guide

## Overview

This project now includes automated git hooks that prevent environment synchronization issues between development environments and fresh git clones. These hooks were created to address the specific issue where critical database fixes were present in development but missing in fresh setups.

## Problem Solved

**Before hooks**: Developers could commit code that worked locally but failed in fresh environments due to:
- Missing Unknown entity creation in base schema
- Database constraint issues not reflected in schema
- Critical import validation fixes not integrated into base setup
- Manual database changes that weren't documented

**After hooks**: Automatic validation prevents these issues and provides actionable guidance.

## Hook Components

### 1. Pre-Commit Hook: Database Change Validation

**File**: `.githooks/pre-commit-database-changes.js`

**Purpose**: Prevents commits that could break fresh git clones

**Checks**:
- ✅ **Schema Entity Support**: Ensures base schema supports all entity types used in code
- ✅ **Environment Sync Requirements**: Validates Unknown entity creation and constraint compatibility
- ✅ **Manual Database Dependencies**: Detects hardcoded psql commands or manual setup requirements
- ✅ **Migration Integration**: Warns about migration files that should be in base schema

**Example Output**:
```bash
🔍 Checking for database-dependent changes...
❌ Environment Sync Issue: Import code expects Unknown entities but schema doesn't auto-create them
   Fresh git clones will fail: "Unknown collaborator not found"
   ✅ Solution: Add Unknown entity creation to db/schema.sql
🚫 COMMIT BLOCKED
```

### 2. Post-Commit Hook: Environment Drift Detection

**File**: `.githooks/post-commit-environment-sync.js`

**Purpose**: Advisory monitoring after commits to detect potential drift

**Checks**:
- 🔍 **Critical Fix Detection**: Scans recent commits for patterns like "CRITICAL FIX", "silent failure", etc.
- 🔍 **Environment Validation**: Compares current setup against committed requirements
- 🔍 **Migration Analysis**: Identifies migration files that should be integrated into base schema
- 💡 **Actionable Recommendations**: Provides specific steps to maintain environment consistency

**Example Output**:
```bash
🔍 Post-commit environment synchronization check...
⚠️  Recent critical fixes detected:
   Critical Fix: e5fec05 CRITICAL FIX: Resolve silent failure bug in migration import
💡 Recommendation: Ensure fixes are integrated into base schema for fresh clones

🔧 Environment Synchronization Checklist:
✅ Recommended actions for maintaining environment consistency:
1. Test Fresh Clone Setup:
   dropdb test_fresh_clone && createdb test_fresh_clone
   psql test_fresh_clone -f db/schema.sql
```

## Setup Instructions

### For Existing Clones
```bash
# Run the setup script (hooks should already be configured)
.githooks/setup-environment-sync-hooks.sh
```

### For Fresh Clones
The hooks are automatically available after cloning. To activate:
```bash
# Ensure hooks are executable and test them
.githooks/setup-environment-sync-hooks.sh
```

## Hook Integration

The hooks integrate with the existing git hook infrastructure:

### Pre-Commit Flow
```bash
.git/hooks/pre-commit
├── Error swallowing detection (.githooks/find-error-swallowing.sh)
├── Database change validation (.githooks/pre-commit-database-changes.js) ← NEW
└── Sensitive file blocking (built-in)
```

### Post-Commit Flow
```bash
.git/hooks/post-commit
├── CLAUDE.md auto-updater (.githooks/post-commit-claude-updater.js)
└── Environment sync check (.githooks/post-commit-environment-sync.js) ← NEW
```

## Validation Rules

### Pre-Commit Validation (Blocking)

1. **Unknown Entity Requirements**:
   - If code references "Unknown collaborator/project", schema must auto-create them
   - Base schema must include `INSERT INTO ... ON CONFLICT DO NOTHING` statements

2. **Database Constraint Compatibility**:
   - No positive number constraints if Unknown entities need `*_number = 0`
   - Schema must support reserved ID 0 for Unknown entities

3. **Manual Database Dependencies**:
   - No hardcoded `psql -c "ALTER TABLE"` commands in code
   - No manual setup instructions in commit messages

4. **Entity Type Support**:
   - All `get_next_number('entity_type')` calls must have corresponding sequences in schema
   - CASE statements in `get_next_number()` function must include all entity types

### Post-Commit Monitoring (Advisory)

1. **Critical Fix Detection**:
   - Scans for commit messages containing "CRITICAL FIX", "silent failure", "migration import"
   - Suggests schema integration for recent fixes

2. **Migration File Analysis**:
   - Identifies `remove_positive_number_constraints.sql` and similar critical migrations
   - Recommends integration into base schema

3. **Environment Testing Suggestions**:
   - Provides specific commands to test fresh clone setup
   - Validates Unknown entity creation in fresh databases

## Common Scenarios

### Scenario 1: Adding New Import Feature
```bash
# Modify routes/multiFileImport.js to reference Unknown entities
git add routes/multiFileImport.js
git commit -m "Add specimen import with Unknown fallback"

# Pre-commit hook checks:
✅ Schema includes Unknown entity creation
✅ No positive constraints blocking Unknown entities
✅ Commit allowed
```

### Scenario 2: Database Schema Changes
```bash
# Modify db/schema.sql to add new entity type
git add db/schema.sql utils/idGeneration.js
git commit -m "Add new inventory entity type"

# Pre-commit hook checks:
✅ Schema includes sequence for 'inventory' entity type
✅ get_next_number() function includes inventory CASE statement
✅ Commit allowed
```

### Scenario 3: Critical Fix Integration
```bash
# After identifying critical fix in development
# Hook detects: "This fix should be in base schema"

# Developer action:
1. Integrate fix into db/schema.sql
2. Remove migration file dependency
3. Test fresh clone setup
4. Commit with schema changes
```

## Troubleshooting

### Hook Execution Issues
```bash
# Make sure hooks are executable
chmod +x .githooks/pre-commit-database-changes.js
chmod +x .githooks/post-commit-environment-sync.js

# Test hooks manually
node .githooks/pre-commit-database-changes.js
node .githooks/post-commit-environment-sync.js
```

### False Positives
If hooks incorrectly block a commit:
```bash
# Temporary bypass (use sparingly)
git commit --no-verify -m "Your message"

# Preferred: Fix the underlying issue identified by the hook
```

### Node.js Dependencies
The hooks require Node.js to be available in the environment:
```bash
# Check Node.js availability
node --version

# If Node.js is missing, install it or contact system admin
```

## Testing Fresh Environment Setup

The hooks encourage testing fresh environment setup with these commands:

```bash
# 1. Create test database
dropdb test_fresh_clone && createdb test_fresh_clone

# 2. Apply base schema only (no migrations)
psql test_fresh_clone -f db/schema.sql

# 3. Verify Unknown entities exist
psql test_fresh_clone -c "SELECT collaborator_number, pi_name FROM collaborators WHERE collaborator_number = 0;"
psql test_fresh_clone -c "SELECT project_number, disease FROM projects WHERE project_number = 0;"

# 4. Test import operations
# Should work without "Unknown entity not found" errors
```

## Benefits

✅ **Prevents environment drift** between development and fresh clones  
✅ **Catches database dependency issues** before they reach other developers  
✅ **Provides actionable guidance** for fixing environment sync problems  
✅ **Maintains consistency** across different development environments  
✅ **Reduces debugging time** for new team members setting up the project  
✅ **Documents critical requirements** automatically through validation  

## Future Enhancements

Potential additions to the hook system:

- **Database connectivity testing**: Verify schema can be applied successfully
- **Import validation testing**: Run actual import tests in hook validation
- **Performance regression detection**: Monitor for changes that could slow down imports
- **Documentation synchronization**: Ensure CLAUDE.md reflects current hook requirements

---

**Created**: 2025-08-12  
**Purpose**: Address environment synchronization issues discovered during fresh git clone testing  
**Maintenance**: Update validation rules as new environment requirements are identified