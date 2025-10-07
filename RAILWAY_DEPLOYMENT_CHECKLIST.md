# Clinical-LIMS Railway Deployment Checklist

## ⚠️ PRE-DEPLOYMENT: GIT REPOSITORY PREPARATION

### 1. Commit Uncommitted Changes
The clinical-demo repo has **uncommitted demo mode features** that MUST be pushed before deployment:

```bash
cd "/Users/Megan Johnson/Projects/lablims/clinical-demo"

# Check current status
git status

# Add all demo mode files and changes
git add -A

# Commit changes
git commit -m "feat: Add demo mode with auto-login and welcome modal

- Added DemoBanner component for cross-demo navigation
- Added DemoContactModal for user engagement
- Added WelcomeModal for first-time users
- Added DemoContext for demo mode management
- Updated Login with auto-login functionality
- Updated Layout with demo banner integration
- Updated README with demo mode documentation
- Added RAILWAY_DEPLOYMENT_CHECKLIST.md"

# Push to GitHub
git push origin main
```

**Verify on GitHub**:
- Go to: https://github.com/megjohnson1999/lablims-clinical-demo
- Confirm all files are present:
  - `client/src/components/common/DemoBanner.js`
  - `client/src/components/common/DemoContactModal.js`
  - `client/src/components/common/WelcomeModal.js`
  - `client/src/context/DemoContext.js`
  - `RAILWAY_DEPLOYMENT_CHECKLIST.md`

---

## STEP 1: PREPARE ENVIRONMENT VARIABLES (5 minutes)

### Generate JWT Secret
```bash
# Run this command to generate a secure 64-character secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**📋 Copy this value** - you'll need it for Railway

### Choose Demo Mode Settings
Decide whether this will be a public demo or private instance.

---

## STEP 2: CREATE RAILWAY PROJECT (10 minutes)

### 1. Create New Project
- Go to https://railway.app/dashboard
- Click **"New Project"**
- Name it: `clinical-lims` or `pathogen-discovery-lims`

### 2. Add PostgreSQL Database
- In your new project, click **"+ New"**
- Select **"Database"** → **"Add PostgreSQL"**
- Wait for provisioning (30-60 seconds)
- ✅ `DATABASE_URL` will be auto-populated

### 3. Add GitHub Repository
- Click **"+ New"** again
- Select **"GitHub Repo"**
- Choose repository: **`megjohnson1999/lablims-clinical-demo`**
- Branch: **`main`**
- Railway will detect Node.js and attempt first build

### 4. Link Database to App
- Click on the web service
- Go to **"Variables"** tab
- Click **"Add Variable Reference"**
- Select `DATABASE_URL` from the PostgreSQL service

---

## STEP 3: CONFIGURE ALL ENVIRONMENT VARIABLES

Click on web service → **"Variables"** tab → **"New Variable"**

### CRITICAL VARIABLES (Required for Deployment)

```bash
# Database (auto-populated from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Authentication (REQUIRED - use value from Step 1)
JWT_SECRET=<paste-64-char-secret-from-step-1>

# Node Environment
NODE_ENV=production

# Build Configuration (CRITICAL - prevents build failures)
CI=false

# Admin Password (for create-admin.js script)
ADMIN_PASSWORD=admin123
```

### REACT APP VARIABLES (Frontend - Critical for Features)

```bash
# API Configuration (REQUIRED - must be empty string for Railway)
REACT_APP_API_URL=

# Demo Mode Configuration (Choose based on your use case)
REACT_APP_DEMO_MODE=true
REACT_APP_DEMO_USERNAME=admin
REACT_APP_DEMO_PASSWORD=admin123
```

### CROSS-DEMO NAVIGATION (Optional - for linking multiple demos)

```bash
# URLs for demo banner navigation
REACT_APP_CLINICAL_DEMO_URL=https://clinical-lims-production.up.railway.app
REACT_APP_ANIMAL_DEMO_URL=https://web-production-3d1c7.up.railway.app
REACT_APP_MAIN_SITE_URL=https://lablims.com
```

### OPTIONAL VARIABLES (Advanced Features)

```bash
# Version tracking (optional)
REACT_APP_VERSION=1.0.0

# Logging configuration (optional)
LOG_LEVEL=info
LOG_TO_FILE=false

# Inventory defaults (optional)
DEFAULT_CURRENCY=USD

# Label printer template (optional)
LABEL_TEMPLATE=PathDiscCapLid.Lab
```

### AI PROTOCOL EXTRACTION (Optional - Disable for Now)

```bash
# Disable AI features (recommended for initial deployment)
LLM_EXTRACTION_ENABLED=false

# Only set these if you enable AI features later:
# ANTHROPIC_API_KEY=sk-ant-api03-...
# Requires Railway Volume mounted at /data
```

### VARIABLES NOT NEEDED

These are set automatically by Railway or only used for testing:
- `PORT` - Railway sets this automatically
- `RAILWAY_ENVIRONMENT` - Auto-set by Railway
- `TEST_AUTH_TOKEN` - Only for automated tests
- AWS S3 variables - Not used in Railway deployment

---

## STEP 4: TRIGGER FIRST DEPLOYMENT (5 minutes)

After setting all variables:

1. **Railway will auto-redeploy** when you save environment variables
2. **Monitor build logs**:
   - Click on the service
   - Go to **"Deployments"** tab
   - Click on the latest deployment
   - Watch **"Build Logs"** and **"Deploy Logs"**

3. **Expected build time**: 3-5 minutes

4. **Get your Railway URL**:
   - Go to **"Settings"** tab
   - Find **"Domains"** section
   - Railway provides a URL like: `clinical-lims-production-xxxx.up.railway.app`
   - **📋 Copy this URL**

---

## STEP 5: POST-DEPLOYMENT SETUP (15 minutes)

### 1. Verify Deployment Success

```bash
# Test health endpoint (should return success immediately)
curl https://your-railway-url.up.railway.app/api/health
```

**Expected Response**:
```json
{
  "message": "Pathogen Discovery Database API",
  "dbConnection": "Success",
  "timestamp": "2025-10-07T..."
}
```

❌ **If health check fails**, check Railway logs for errors.

### 2. Deploy Database Schema

**The database is empty after first deployment.** You must deploy the schema:

**Option A: Via API Endpoint** (Recommended - No Railway CLI needed)
```bash
# This endpoint applies db/schema.sql automatically
curl -X POST https://your-railway-url.up.railway.app/api/admin/deploy-schema
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Database schema deployed successfully"
}
```

**Option B: Via Railway CLI** (If Option A fails)
```bash
# Install Railway CLI if not already installed
npm install -g @railway/cli

# Login and link to your project
railway login
cd "/Users/Megan Johnson/Projects/lablims/clinical-demo"
railway link

# Apply schema directly
railway run sh -c 'psql $DATABASE_URL < db/schema.sql'
```

### 3. Create Admin User

**Option A: Use create-admin.js Script** (Uses ADMIN_PASSWORD env var)
```bash
cd "/Users/Megan Johnson/Projects/lablims/clinical-demo"
railway link  # if not already linked
railway run node create-admin.js
```

**This creates**:
- Username: `admin`
- Password: `admin123` (from ADMIN_PASSWORD env var)
- Role: `admin`
- Email: `admin@example.com`

**Option B: Load Demo Data** (Includes admin user + sample data)
```bash
railway run sh -c 'psql $DATABASE_URL < demo_data_expanded.sql'
```

**Demo data includes**:
- ✅ Admin user (username: `admin`, password: `demo123`)
- ✅ 10 collaborators (research institutions)
- ✅ 15 research projects (various diseases)
- ✅ 25+ patients with specimen data
- ✅ Sample protocols and experiments
- ✅ Inventory categories and items

⚠️ **Important**: If using demo data, the admin password will be `demo123`, not `admin123`!

---

## STEP 6: VERIFY FUNCTIONALITY (10 minutes)

### Test in Browser

1. **Open Railway URL** in browser
2. **Auto-login should work** (if `REACT_APP_DEMO_MODE=true`)
   - Should see welcome modal
   - Should see demo banner at top
   - Should be logged in as admin

3. **If auto-login disabled**, manually login:
   - Username: `admin`
   - Password: `admin123` (or `demo123` if you loaded demo data)

### Test Core Features

- [ ] **Dashboard loads** with statistics
- [ ] **View Collaborators** page
- [ ] **View Projects** page
- [ ] **View Patients** page
- [ ] **View Inventory** page
- [ ] **Create test collaborator** (verify write permissions)
- [ ] **Check browser console** - no errors
- [ ] **Check network tab** - API calls succeeding

### Test Demo Features (if enabled)

- [ ] **Demo banner appears** at top of page
- [ ] **Welcome modal shows** on first visit
- [ ] **Cross-demo links work** (if you set other demo URLs)
- [ ] **Auto-login works** on page refresh

---

## OPTIONAL: ENABLE DOCUMENT STORAGE & AI FEATURES

⚠️ **Only do this if you need AI protocol extraction feature**

### 1. Create Railway Volume

- In Railway project, click **"+ New"**
- Select **"Volume"**
- Name: `protocol-documents`
- Mount Path: `/data`
- Size: **1GB** (sufficient for most use cases)

### 2. Add AI Environment Variables

```bash
LLM_EXTRACTION_ENABLED=true
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### 3. Redeploy
Railway will auto-redeploy when you save variables.

### 4. Test Document Upload
- Go to Protocols page
- Try uploading a Word or PDF document
- Check AI extraction functionality

**Cost Estimate**: ~$0.01-0.05 per protocol extraction with Claude API

---

## TROUBLESHOOTING GUIDE

### Build Fails with "Treating warnings as errors"

**Cause**: `CI=true` makes React build treat warnings as errors

**Fix**: Ensure `CI=false` is set in Railway environment variables

### "No token, authorization denied" on API calls

**Cause**: JWT_SECRET not set or incorrect

**Fix**:
1. Verify `JWT_SECRET` is set in Railway variables
2. Must be at least 32 characters
3. Redeploy after adding

### "Database connection failed" or "connect ECONNREFUSED"

**Cause**: DATABASE_URL not properly linked

**Fix**:
1. Check `DATABASE_URL` is a reference to Postgres service: `${{Postgres.DATABASE_URL}}`
2. Ensure PostgreSQL service is running
3. Check Railway logs for specific connection errors

### Health endpoint returns 500 error

**Cause**: Server crash on startup

**Fix**:
1. Check **Deploy Logs** in Railway dashboard
2. Common issues:
   - Missing JWT_SECRET
   - Database connection failure
   - Missing dependencies (unlikely with proper package.json)

### "Table does not exist" errors when using app

**Cause**: Database schema not deployed

**Fix**: Run schema deployment (Step 5.2)

### Cannot login - "Invalid credentials"

**Cause**: Admin user not created

**Fix**:
1. Run `railway run node create-admin.js`
2. Or load demo data: `railway run sh -c 'psql $DATABASE_URL < demo_data_expanded.sql'`

### Auto-login not working

**Cause**: Demo mode environment variables not set correctly

**Fix**:
1. Verify `REACT_APP_DEMO_MODE=true`
2. Verify `REACT_APP_DEMO_USERNAME=admin`
3. Verify `REACT_APP_DEMO_PASSWORD=admin123` (or `demo123` if using demo data)
4. **Must redeploy** after changing REACT_APP variables (rebuild required)

### Protocol upload fails / "Cannot read property 'path' of undefined"

**Cause**: No Railway Volume configured for file storage

**Fix**:
- **Either**: Disable feature with `LLM_EXTRACTION_ENABLED=false`
- **Or**: Create Railway Volume mounted at `/data` (see Optional section)

### Demo banner shows but links are broken

**Cause**: Cross-demo URLs not configured

**Fix**:
1. Set `REACT_APP_CLINICAL_DEMO_URL` to your clinical-lims URL
2. Set `REACT_APP_ANIMAL_DEMO_URL` to your animal-lims URL
3. Redeploy (REACT_APP vars require rebuild)

---

## ENVIRONMENT VARIABLE REFERENCE

### Complete List by Category

**Database & Core** (4 variables):
- `DATABASE_URL` - Auto from PostgreSQL service ✅ Required
- `JWT_SECRET` - 64-char random string ✅ Required
- `NODE_ENV` - Always `production` ✅ Required
- `PORT` - Auto-set by Railway ⚠️ Do not set manually

**Build Configuration** (1 variable):
- `CI` - Set to `false` ✅ Required to prevent build failures

**Admin Setup** (1 variable):
- `ADMIN_PASSWORD` - Used by create-admin.js ✅ Recommended

**Frontend API** (1 variable):
- `REACT_APP_API_URL` - Empty string ✅ Required for production

**Demo Mode** (3 variables):
- `REACT_APP_DEMO_MODE` - `true` or `false` ✅ Required for auto-login
- `REACT_APP_DEMO_USERNAME` - Default: `admin` ⚠️ Optional
- `REACT_APP_DEMO_PASSWORD` - Match your admin password ✅ Required if demo mode enabled

**Cross-Demo Links** (3 variables):
- `REACT_APP_CLINICAL_DEMO_URL` - Your clinical-lims URL ⚠️ Optional
- `REACT_APP_ANIMAL_DEMO_URL` - Your animal-lims URL ⚠️ Optional
- `REACT_APP_MAIN_SITE_URL` - Your main website ⚠️ Optional

**AI Features** (2 variables):
- `LLM_EXTRACTION_ENABLED` - `false` (disable) ✅ Recommended to disable initially
- `ANTHROPIC_API_KEY` - Only if AI enabled ⚠️ Optional

**Optional Configuration** (4 variables):
- `REACT_APP_VERSION` - Version string ⚠️ Optional
- `LOG_LEVEL` - `info`, `debug`, `error` ⚠️ Optional
- `DEFAULT_CURRENCY` - `USD` default ⚠️ Optional
- `LABEL_TEMPLATE` - Printer template name ⚠️ Optional

**Total**: 10 required, 13 optional = 23 possible environment variables

---

## DEPLOYMENT CHECKLIST SUMMARY

### Pre-Deployment
- [ ] Commit and push all changes to GitHub main branch
- [ ] Generate JWT secret (64 characters)
- [ ] Decide on demo mode vs private deployment

### Railway Setup
- [ ] Create new Railway project
- [ ] Add PostgreSQL database
- [ ] Connect GitHub repository (megjohnson1999/lablims-clinical-demo)
- [ ] Set all required environment variables (minimum 10)
- [ ] Wait for first deployment to complete

### Post-Deployment
- [ ] Verify health endpoint returns success
- [ ] Deploy database schema via API or Railway CLI
- [ ] Create admin user OR load demo data
- [ ] Test login functionality
- [ ] Verify core features work (collaborators, projects, inventory)
- [ ] Test demo mode features (if enabled)
- [ ] Check browser console for errors

### Optional
- [ ] Create Railway Volume for document storage
- [ ] Enable AI features with ANTHROPIC_API_KEY
- [ ] Configure custom domain
- [ ] Set up monitoring/alerts

---

## ESTIMATED TIMELINE

**Total Time: 30-45 minutes**

| Step | Time | Notes |
|------|------|-------|
| Git push uncommitted changes | 2 min | One-time before first deploy |
| Generate JWT secret | 1 min | Copy and save securely |
| Create Railway project | 3 min | Project + PostgreSQL + GitHub |
| Configure environment variables | 10 min | All 23 variables if using all features |
| First deployment wait time | 5 min | Automated build process |
| Deploy database schema | 2 min | Single API call or CLI command |
| Create admin user | 2 min | Railway CLI command |
| Testing and verification | 10 min | Thorough feature testing |
| Troubleshooting buffer | 5-15 min | If any issues arise |

---

## POST-DEPLOYMENT MAINTENANCE

### Update Deployment
```bash
# Any push to main branch auto-deploys
cd "/Users/Megan Johnson/Projects/lablims/clinical-demo"
git add .
git commit -m "your changes"
git push origin main
# Railway auto-detects and redeploys
```

### View Logs
- Railway Dashboard → Service → Deployments → Latest → Deploy Logs
- Or use CLI: `railway logs`

### Database Backups
- Railway provides automatic PostgreSQL backups
- Access via Railway Dashboard → PostgreSQL → Backups tab

### Monitor Health
- Set up uptime monitoring: https://your-url.railway.app/api/health
- Use Railway's built-in metrics and monitoring

---

## FINAL VERIFICATION

After completing all steps, your Clinical-LIMS should:
- ✅ Load at Railway-provided URL
- ✅ Auto-login if demo mode enabled
- ✅ Show populated database with collaborators/projects (if demo data loaded)
- ✅ Allow CRUD operations on all entities
- ✅ Display demo banner with cross-links (if configured)
- ✅ No console errors
- ✅ All API calls succeeding
- ✅ Health endpoint returning success

**You're ready to share the demo URL with stakeholders! 🎉**
