# LabLIMS Clinical Edition

Web-based Laboratory Information Management System for clinical research labs. Track specimens, patients, experiments, and manage inventory.

## Features

- Specimen tracking through complete workflow
- Patient management with clinical data
- Collaborator and project organization
- Inventory tracking with automated alerts
- Protocol library with AI-assisted extraction
- Experiment tracking with inventory integration
- Sequencing pipeline management
- Barcode label generation
- Bulk import/export (Excel/CSV)
- Complete audit logging for compliance

## Tech Stack

**Backend**: Node.js, Express, PostgreSQL
**Frontend**: React, Material-UI

## Quick Start

### Railway Deployment

1. Create Railway project with PostgreSQL
2. Connect GitHub repository
3. Add environment variables:
   ```bash
   DATABASE_URL=<auto-set-by-railway>
   JWT_SECRET=<generate-random-64-char-string>
   NODE_ENV=production
   CI=false
   LOAD_DEMO_DATA=true

   # Demo mode (optional - for public demos)
   REACT_APP_DEMO_MODE=true
   REACT_APP_DEMO_USERNAME=admin
   REACT_APP_DEMO_PASSWORD=<your-demo-password>
   ```
4. Deploy - database initializes automatically

### Local Development

```bash
# Clone and install
git clone <repo-url>
cd clinical-demo
npm install && cd client && npm install && cd ..

# Setup database
createdb lablims_clinical_demo

# Configure
cp .env.example .env
# Edit .env with DATABASE_URL and JWT_SECRET

# Run (backend: 5000, frontend: 3000)
npm run dev
```

## License

MIT
