# Technical Debt Cleanup Plan

**Created**: September 30, 2025
**Status**: Deferred - Not causing active problems
**Priority**: Address after current feature development

## Overview

This document outlines a systematic plan for addressing technical debt in the Pathogen Discovery Database LIMS. The codebase is in good health overall (assessed at **5/10 debt severity - Moderate**), with production deployment stable and core functionality working well. This cleanup is **not urgent** but will improve maintainability and developer experience.

## Current State Assessment

### ✅ What's Working Well

- **48,000+ lines of code** with only **1 TODO comment**
- **Solid architecture**: Clean separation of concerns, service layer pattern
- **4 test files** already written (just not wired up)
- **Modern dependencies**: Only minor version updates needed
- **Production-ready**: Railway auto-deployment, proper logging, security
- **Smart database design**: UUID + sequential IDs, transaction safety

### ⚠️ Areas Needing Attention

1. **Duplicate Error Handlers** (Medium Priority)
2. **Import System Proliferation** (Medium Priority)
3. **No Linting/Formatting** (High Priority)
4. **Tests Not Connected** (High Priority)
5. **Unused Dependencies** (Low Priority)
6. **Dormant Code Bug** (Low Priority)

---

## Cleanup Plan

### Phase 1: Development Tools Setup (2-3 hours)

**Objective**: Enable code quality enforcement without touching production code

#### 1.1 Add ESLint Configuration

```bash
# Install ESLint
npm install --save-dev eslint eslint-config-airbnb-base eslint-plugin-import

# Create .eslintrc.json
```

**Configuration file** (`.eslintrc.json`):
```json
{
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2021
  },
  "rules": {
    "no-console": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-undef": "error"
  }
}
```

**Add to package.json scripts**:
```json
"lint": "eslint . --ext .js --ignore-pattern node_modules/ --ignore-pattern client/",
"lint:fix": "eslint . --ext .js --fix --ignore-pattern node_modules/ --ignore-pattern client/"
```

**Safety**: ✅ Non-breaking - only adds warnings, doesn't change code

---

#### 1.2 Add Prettier Configuration

```bash
# Install Prettier
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```

**Configuration file** (`.prettierrc.json`):
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Add to package.json scripts**:
```json
"format": "prettier --write \"**/*.{js,json,md}\"",
"format:check": "prettier --check \"**/*.{js,json,md}\""
```

**Safety**: ✅ Non-breaking - only formats on command, doesn't auto-change

---

#### 1.3 Wire Up Existing Tests

**Current state**: 4 test files exist but `npm test` exits with error

**Configuration file** (`jest.config.js`):
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/client/']
};
```

**Install Jest**:
```bash
npm install --save-dev jest @types/jest
```

**Update package.json scripts**:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage"
```

**Test the tests**:
```bash
npm test
```

**Safety**: ✅ Non-breaking - tests are isolated from production code

**Expected outcome**: Some tests may fail (they reference old APIs), but framework will work

---

### Phase 2: Error Handler Consolidation (3-4 hours)

**Objective**: Single source of truth for error handling

#### 2.1 Audit Current Usage

**Files to review**:
- `utils/errorHandler.js` (6.8KB)
- `utils/errorHandling.js` (9.1KB)
- `middleware/enhancedErrorHandler.js` (15.4KB)

**Routes using each**:
```bash
# Run this to see which routes use which handler
grep -r "require.*errorHandler\|require.*errorHandling" routes/
```

**Current findings**:
- `errorHandler.js`: Used by `collaborators.js`, `specimenImport.js`
- `errorHandling.js`: Used by `ids.js`, `metadata.js`, `protocols.js`, `specimens.js`
- Both export `createErrorResponse()` but with different signatures

---

#### 2.2 Choose Canonical Handler

**Recommendation**: Use `utils/errorHandling.js` as the canonical version

**Reasons**:
1. More comprehensive error context (operation, timestamp, error type)
2. Better structured for logging
3. More recent pattern (based on code structure)
4. Used by more critical routes (specimens, protocols)

---

#### 2.3 Migration Strategy

**Safe migration process**:

1. **Create compatibility layer** (no breaking changes):
```javascript
// utils/errorHandler.js
// Add deprecation notice and re-export from errorHandling.js

const {
  createErrorResponse: newCreateErrorResponse,
  handleDatabaseError,
  handleValidationErrors
} = require('./errorHandling');

// Compatibility wrapper for old signature
const createErrorResponse = (message, details = null, statusCode = 500) => {
  // Map old signature to new
  return newCreateErrorResponse('legacy',
    { message, statusCode },
    { details }
  );
};

// Export everything
module.exports = {
  createErrorResponse,
  handleDatabaseError,
  handleValidationErrors,
  asyncHandler: require('./errorHandling').withErrorHandling
};
```

2. **Test compatibility** (run all routes using old handler)

3. **Migrate routes one by one** (with git commits between each):
   - Update `require` statements
   - Update function calls to new signature
   - Test route locally
   - Commit

4. **After all migrations complete**, remove compatibility layer

**Safety**: ✅ Gradual migration with backwards compatibility

---

### Phase 3: Import System Refactoring (1-2 days)

**Objective**: Consolidate 5 import routes into clear, maintainable structure

#### 3.1 Current Import Files Analysis

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `multiFileImport.js` | 1,347 | Multi-entity batch import | Keep |
| `import.js` | 1,062 | Basic data import | Analyze overlap |
| `specimenImport.js` | 973 | Specimen-specific import | Keep |
| `comprehensiveImport.js` | 359 | Comprehensive import with validation | Analyze overlap |
| `unifiedImport.js` | 312 | Unified import handler | Analyze overlap |

**Supporting utilities**:
- `unifiedColumnMapping.js` (14KB)
- `unifiedImportLogic.js` (12KB)

---

#### 3.2 Refactoring Strategy

**Step 1: Document each import route's purpose**

Create `docs/IMPORT_SYSTEM_ARCHITECTURE.md`:
```markdown
# Import System Architecture

## Import Types

### 1. Multi-File Import (`/api/import/multi-file`)
**Use case**: Migration imports - preserving existing ID numbers
**Entities**: Collaborators, projects, specimens, patients
**Format**: Excel/CSV with hierarchical data

### 2. Specimen Import (`/api/import/specimen`)
**Use case**: Adding specimens to existing projects
**Entities**: Specimens only
**Format**: Excel/CSV

### 3. Comprehensive Import (`/api/import/comprehensive`)
**Use case**: [Document this]
**Entities**: [Document this]

### 4. Unified Import (`/api/unified-import`)
**Use case**: [Document this]
**Entities**: [Document this]

### 5. Basic Import (`/api/import`)
**Use case**: [Document this]
**Entities**: [Document this]
```

**Step 2: Identify overlapping code**

```bash
# Find duplicate functions between import files
grep -h "^const\|^function" routes/*import*.js | sort | uniq -d
```

**Step 3: Extract common logic to service**

Create `services/importService.js`:
```javascript
/**
 * Shared import functionality across all import routes
 */

const validateImportData = (data, schema) => { /* ... */ };
const processImportBatch = (data, options) => { /* ... */ };
const generateImportReport = (results) => { /* ... */ };

module.exports = {
  validateImportData,
  processImportBatch,
  generateImportReport
};
```

**Step 4: Refactor routes to use common service**

**Safety measures**:
- ✅ Keep original files as backups (`.bak` extension)
- ✅ Create feature branch: `refactor/import-consolidation`
- ✅ Test each import type after refactoring
- ✅ Don't merge until all import types verified working
- ✅ Keep Railway on stable branch until testing complete

---

#### 3.3 Testing Plan for Import Refactoring

**Critical**: Import system is heavily used - thorough testing required

**Test cases**:
1. Multi-file import with 100+ collaborators, projects, specimens
2. Specimen import to existing project
3. Import with validation errors (ensure proper error messages)
4. Import with ID preservation (migration mode)
5. Import with auto-generated IDs (project mode)

**Testing environment**:
```bash
# Use local database with test data
psql -U postgres -d lims_test -f db/schema.sql
psql -U postgres -d lims_test -f tests/fixtures/test_data.sql
```

---

### Phase 4: Dependency Cleanup (1 hour)

**Objective**: Remove unused dependencies, update outdated packages

#### 4.1 Remove Unused Dependencies

**Audit findings**:
- `config` package (using dotenv instead)
- Redundant CSV libraries: `csv-parse`, `csv-parser`, `csv-writer`, `csv-stringify`
  - Keep: `csv-stringify` (used in export routes)
  - Remove: Others if not actually used

**Verification process**:
```bash
# Check if package is actually imported
grep -r "require('config')" --include="*.js" --exclude-dir=node_modules

# If no results, safe to remove
npm uninstall config
```

**Safety**: ✅ Git will catch if we removed something important

---

#### 4.2 Update Dependencies

**Current outdated packages** (minor versions only):
- axios: 1.8.4 → 1.12.2
- dotenv: 16.5.0 → 16.6.1
- pg: 8.14.1 → 8.16.3
- winston: 3.17.0 → 3.18.1

**Update strategy**:
```bash
# Update one at a time, test between each
npm update axios
npm test
npm start  # Verify server starts

# Repeat for each package
```

**Safety**: ✅ Only minor version updates - no breaking changes expected

**Note**: Express 4→5 is a major version - skip for now (requires migration guide)

---

### Phase 5: Fix Dormant Code Bug (15 minutes)

**Objective**: Fix `db` reference in server.js admin endpoints

#### 5.1 The Issue

**Location**: `server.js:124-127`

```javascript
// ❌ Current code - 'db' is not defined
await db.query(fixFunctions);
const collaboratorNext = await db.query("SELECT get_next_number('collaborator') as next_id");
```

**Impact**: Endpoint `/api/admin/fix-id-functions` would crash if called

---

#### 5.2 The Fix

**Option A: Import db module** (Recommended)
```javascript
// At top of server.js, add:
const db = require('./db');

// Use db instead of pool everywhere
```

**Option B: Use existing pool**
```javascript
// Lines 124-127, change:
await pool.query(fixFunctions);
const collaboratorNext = await pool.query("SELECT get_next_number('collaborator') as next_id");
```

**Option C: Remove unused endpoints** (if never used)
```javascript
// Delete lines 70-140 entirely if these admin endpoints aren't needed
```

**Recommendation**: Option A for consistency with rest of codebase

---

#### 5.3 Testing

```bash
# Start server
node server.js

# Test endpoint (in another terminal)
curl -X POST http://localhost:5000/api/admin/fix-id-functions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return success instead of crashing
```

**Safety**: ✅ Endpoint isn't used in production, safe to test locally

---

## Execution Timeline

### If addressing all debt:

| Phase | Time | Can Skip? |
|-------|------|-----------|
| Phase 1: Dev Tools | 2-3 hours | No - enables quality checks |
| Phase 2: Error Handlers | 3-4 hours | Yes - working but inconsistent |
| Phase 3: Import Refactoring | 1-2 days | Yes - working but complex |
| Phase 4: Dependencies | 1 hour | Yes - low impact |
| Phase 5: Dormant Bug | 15 min | Yes - never called |

**Total estimated time**: 2-3 days of focused work

---

## Recommended Approach

### Option 1: "Essential Quality" (High Priority Only)

**Time**: 3-4 hours
**Impact**: Immediate quality improvements

1. ✅ Add ESLint + Prettier
2. ✅ Wire up tests to npm test
3. ✅ Run `npm run lint` and fix critical issues

**Result**: Developer experience improves, can catch bugs earlier

---

### Option 2: "Progressive Cleanup" (Spread over time)

**Time**: 30-60 min per week over 4-6 weeks
**Impact**: Gradual improvement without disrupting feature work

**Week 1**: Phase 1 (Dev tools)
**Week 2**: Phase 5 (Quick bug fix)
**Week 3**: Phase 4 (Dependencies)
**Week 4**: Phase 2 Part 1 (Audit error handlers)
**Week 5**: Phase 2 Part 2 (Migrate error handlers)
**Week 6**: Plan Phase 3 (Import refactoring - decide if needed)

**Result**: Continuous improvement without blocking feature development

---

### Option 3: "Defer Everything" (When not causing problems)

**Time**: 0 hours now
**Impact**: Technical debt remains but system keeps working

**Revisit when**:
- Adding new developers to team (inconsistencies cause confusion)
- Import system becomes hard to maintain (users request new features)
- Error handling causes production issues (inconsistent error messages)

---

## Safety Principles

Throughout all cleanup work, follow these principles:

1. **✅ Create feature branch** for each phase
2. **✅ One logical change per commit** with clear messages
3. **✅ Test locally before pushing** to Railway (main branch)
4. **✅ Keep original files as .bak** until refactoring verified
5. **✅ Use Railway dashboard** to monitor deployments
6. **✅ Can rollback** via Railway if issues occur
7. **✅ Document changes** in commit messages and CLAUDE.md

---

## Success Metrics

After cleanup is complete, you should see:

- ✅ `npm test` runs successfully
- ✅ `npm run lint` shows no critical errors
- ✅ Consistent error messages across all API routes
- ✅ Import system documentation clearly explains when to use each type
- ✅ Dependencies up to date (within minor versions)
- ✅ All admin endpoints work without crashes
- ✅ Codebase easier to navigate for new developers

---

## Related Documentation

- `docs/AUTO_ID_IMPLEMENTATION.md` - ID generation system
- `docs/USER_GUIDE_IMPORT_EXPORT.md` - Import/export user guide
- `CLAUDE.md` - Main development guide

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-09-30 | Defer cleanup - not urgent | System stable, prioritizing new features |
| TBD | Begin Phase 1 | [Document when/why you start] |

---

## Notes

- This plan was created based on a comprehensive codebase review on 2025-09-30
- Codebase health is good (5/10 debt severity - Moderate)
- No critical issues blocking production
- Cleanup will improve maintainability but isn't urgent
- Estimated 2-3 days total work if addressing everything at once
- Can be done progressively without disrupting feature development

**Last Updated**: September 30, 2025
