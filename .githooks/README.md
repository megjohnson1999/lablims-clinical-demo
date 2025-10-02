# Git Hooks for Column Naming Consistency

This directory contains pre-commit hooks that validate column naming consistency across the LIMS application layers.

## Installed Hooks

### 1. Column Naming Consistency Validator (`validate-column-consistency.js`)

**Purpose**: Prevents commits that introduce column naming inconsistencies between:
- Database schema files
- Frontend React components  
- Import utility functions
- Backend API routes

**Triggers**: Runs automatically before each commit

**Configuration**: Edit `hook-config.json` to customize behavior

## What It Validates

### ✅ Database Schema
- Consistent primary key naming (`id` for UUID columns)
- Required user-friendly ID columns (`*_number` INTEGER)
- Presence of required columns per entity

### ✅ Frontend Components  
- Usage of correct field names (e.g., `project_number` not `project_legacy_id`)
- Detection of deprecated field references
- Validation against expected field sets

### ✅ Import Utilities
- Removal of legacy_id mapping logic
- Consistent CSV header expectations
- Proper column name normalization

### ✅ Backend Routes
- Consistent primary key column references  
- Inclusion of user-friendly IDs in SELECT queries
- Proper field naming in API responses

## Hook Behavior

**🔴 Errors (Block Commit)**:
- Usage of deprecated fields (`*_legacy_id`)
- Inconsistent primary key column naming
- Missing required database columns
- Legacy ID infrastructure usage

**🟡 Warnings (Allow Commit)**:
- Unexpected field access patterns
- Missing CSV header mappings
- Non-critical inconsistencies

## Managing Hooks

### Disable Temporarily
```bash
# Skip hooks for one commit
git commit --no-verify -m "Emergency fix"

# Disable permanently
rm .git/hooks/pre-commit
```

### Re-enable
```bash
# Re-run setup script
./.githooks/setup-hooks.sh
```

### Update Hook Logic
Edit `.githooks/validate-column-consistency.js` and the changes will take effect immediately.

## Testing Hooks Manually

```bash
# Run validation on current working directory
node .githooks/validate-column-consistency.js

# Test with specific files
git add <files>
node .githooks/validate-column-consistency.js
```

## Common Issues & Fixes

### Frontend Display Issues
```javascript
// ❌ Deprecated - causes commit to fail
{specimen.project_legacy_id ? specimen.project_legacy_id : specimen.project_id}

// ✅ Correct - passes validation  
{specimen.project_number ? `#${specimen.project_number}` : specimen.project_id}
```

### Import Utility Issues
```javascript
// ❌ Legacy approach - causes commit to fail
legacy_id: rawData.ID,
collaborator_legacy_id: rawData.collaborator

// ✅ Direct approach - passes validation
collaborator_number: importType === 'migration' ? parseInt(rawData.ID) : null
```

### Database Schema Issues
```sql
-- ❌ Inconsistent - causes commit to fail
CREATE TABLE specimens (uuid UUID PRIMARY KEY, ...)

-- ✅ Consistent - passes validation  
CREATE TABLE specimens (id UUID PRIMARY KEY, ...)
```
