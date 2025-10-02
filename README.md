# Pathogen Discovery Database (LIMS)

## 🆕 New Features (v2.2)

This branch introduces major enhancements to the LIMS system:

- **🧪 Experiment Tracking & Protocol Management**: Comprehensive experiment workflow management with protocol templates and automatic inventory consumption
- **📦 Inventory Management System**: Real-time reagent tracking with automatic reservation and consumption during experiments
- **📊 Excel/CSV Import System**: Comprehensive drag-and-drop import with batch processing, validation, and error reporting
- **🧬 Sequencing & Analysis Tracking**: Track sequencing runs, analysis status, and file locations with workflow management
- **🏷️ Barcode System**: Code 128 barcode generation, printable labels, and scanner-friendly search
- **📈 Enhanced Export**: Professional Excel exports with advanced formatting using ExcelJS
- **🔍 Advanced Search**: Improved search capabilities with barcode support and filtering
- **📋 Metadata Management**: Project-specific metadata upload and viewing with CSV import capabilities
- **📄 Document Management System**: Comprehensive document library with protocol document storage, AI-assisted workflows, and AWS S3 migration strategy
- **⚙️ System Configuration Management**: Dynamic system options and configurable dropdown menus
- **🎯 Enhanced Error Handling**: Comprehensive error display components with detailed feedback
- **🔧 Improved Project Management**: Enhanced project utilities, sorting, and selection components

A comprehensive Laboratory Information Management System (LIMS) designed for tracking pathogen specimens, samples, and related data in research environments.

## Overview

The Pathogen Discovery Database is a web-based LIMS that helps researchers track biological specimens through hierarchical structures of collaborators, projects, and specimens. It includes features for:

- **Experiment Tracking & Protocol Management** with automatic inventory integration
- **Inventory Management** with real-time reagent tracking and consumption
- **Document Management** with protocol document storage and AI-assisted workflows
- Sample storage location tracking
- Patient data management  
- **Excel/CSV Export** with advanced formatting
- **Excel/CSV Import** with batch processing and validation
- **Sequencing & Analysis Tracking** with workflow management
- **Barcode System** with Code 128 barcode generation and scanning
- Label generation and printing
- Bulk import/export
- Audit logging
- Role-based access control

## Features

### Core Functionality
- **Hierarchical Data Structure**: Organize data in a Collaborator → Project → Specimen hierarchy
- **Location Tracking**: Precise sample tracking with freezer, rack, box, and position coordinates
- **User Management**: Role-based access controls (admin, editor, user)
- **Label Generation**: Generate labels for Brady printers
- **Bulk Operations**: Import/export data in bulk for efficient data entry

### Data Model
- **Collaborators**: Research labs and principal investigators
- **Projects**: Research initiatives, studies, and grants
- **Specimens**: Biological samples with detailed metadata
- **Patients**: Patient information with de-identification options
- **Protocols**: Standardized laboratory procedures with reagent requirements
- **Experiments**: Experiment execution records with protocol linkage and sample tracking
- **Inventory**: Reagent and supply tracking with automatic consumption
- **Documents**: Protocol document storage with AI-assisted workflows and cloud migration support

### Advanced Features

#### 🧪 Experiment Tracking & Protocol Management
- **Protocol Templates**: Create reusable protocols with standardized reagent lists and procedures
- **Experiment Workflow**: Track experiment execution from setup to completion
- **Automatic Inventory Integration**: Real-time reagent reservation and consumption during experiments
- **Sample Tracking**: Link experiments to specific specimens for complete traceability
- **Protocol Versioning**: Maintain version control for evolving laboratory procedures
- **Manual Entry Focus**: Streamlined manual data entry optimized for laboratory workflows

#### 📦 Inventory Management System
- **Real-time Reagent Tracking**: Monitor reagent quantities and availability across the lab
- **Automatic Reservations**: Reserve reagents when experiments are planned
- **Consumption Tracking**: Automatically deduct reagents when experiments are completed
- **Low Stock Alerts**: Visual indicators and notifications for reagents running low
- **Batch and Expiration Tracking**: Monitor reagent batches and expiration dates
- **Integration with Experiments**: Seamless workflow from protocol selection to inventory consumption

#### 📊 Excel Export & Import System
- **Export**: Professional Excel exports with formatting using ExcelJS
- **Import**: Comprehensive Excel/CSV import with drag-and-drop interface
- Advanced filtering and batch processing for large datasets (15,000+ records)
- Support for hierarchical headers (`collaborator:PI_Name`, `project:Disease`, etc.)
- Data validation, duplicate detection, and error reporting
- Both CSV and Excel format options with identical data sets
- Includes all specimen data plus sequencing tracking information

#### 🧬 Sequencing & Analysis Tracking  
- Track sequencing runs with run IDs and file locations
- Analysis status workflow (pending → in_progress → completed/failed)
- FASTQ file location and results file path tracking
- Integrated into search and export functionality
- Visual status indicators and bioinformatician-friendly interface

#### 🏷️ Barcode System Foundation
- Code 128 barcode generation using jsbarcode library
- Printable labels with specimen barcodes in multiple sizes
- Barcode-friendly search with scanner simulation
- Quick specimen lookup from dashboard
- Integration with specimen detail views

#### ⚙️ System Configuration Management
- **Dynamic System Options**: Configurable dropdown menus for user roles, specimen types, and other categories
- **Database-Driven Configuration**: System options stored in database with admin management capabilities
- **Consistent UI Components**: Reusable SystemOptionSelect component for standardized dropdown menus
- **Flexible Configuration**: Easy addition of new option categories without code changes
- **User Registration Enhancement**: Dynamic role selection based on system configuration

#### 📋 Metadata Management System
- **Project-Specific Metadata**: View and manage metadata fields organized by project context
- **CSV Metadata Upload**: Bulk import metadata from CSV files with specimen matching capabilities
- **Contextual Viewing**: Enhanced metadata display that eliminates cross-project empty columns
- **Step-by-Step Upload Wizard**: Guided metadata import with validation and preview functionality
- **Specimen Matching**: Intelligent matching of CSV data with existing specimens using multiple identifiers
- **Real-Time Progress**: Upload progress tracking with batch processing for large metadata sets

#### 📄 Document Management System
- **Protocol Document Storage**: Centralized repository for protocol documents (Word, PDF, Markdown) with metadata organization
- **AI-Assisted Workflow**: Recommended workflow for uploading protocol documents and using AI to extract reagent lists automatically
- **Advanced File Management**: Drag-and-drop upload, categorization, search, and filtering capabilities with file type validation
- **Cloud Migration Ready**: AWS S3 migration strategy included for scalable cloud deployment
- **Integration with Protocols**: Seamless linking of documents to specific protocols with workflow guidance
- **File Security**: Proper file name sanitization, secure storage, and access control for uploaded documents
- **Batch Operations**: Bulk document management with progress tracking and error handling

#### 🎯 Enhanced Error Handling
- **Comprehensive Error Display**: Rich error components with expandable details, suggestions, and retry options
- **API Error Management**: Centralized error handling with custom hooks for consistent error processing
- **User-Friendly Feedback**: Clear error messages with actionable suggestions and context information
- **Validation Enhancement**: Improved form validation with real-time feedback and error recovery

### Technical Highlights
- Full-stack JavaScript application (Node.js/Express + React)
- PostgreSQL database with migration system
- RESTful API architecture
- Material UI for modern, responsive interface
- JWT-based authentication
- Professional barcode generation and printing capabilities

## Technology Stack

- **Frontend**: React, Material UI, Context API
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with UUID support, database migrations
- **Authentication**: JWT (JSON Web Tokens)
- **Export/Import Libraries**: ExcelJS (Excel generation), xlsx (Excel parsing), csv-writer (CSV export), multer (file uploads)
- **Document Processing**: mammoth (Word document parsing), pdf-parse (PDF text extraction)
- **UI Libraries**: react-dropzone (drag-and-drop file uploads)
- **Barcode**: jsbarcode (Code 128 barcode generation)
- **Error Handling**: Custom error display components, API error hooks, comprehensive validation
- **Configuration**: Dynamic system options, database-driven configuration management
- **Other Tools**: bcrypt (password hashing), express-validator, lodash

## Installation

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/lndroit/Pathogen_Discovery_Database_Mirror.git
   cd Pathogen_Discovery_Database_Mirror
   ```

2. **Install server dependencies**
   ```bash
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Set up the database**
   - Create a PostgreSQL database
   - **Single step setup** - Run the complete schema:
   ```bash
   psql -U postgres -d your_database_name -f db/schema.sql
   ```
   - Apply optional feature migrations as needed:
   ```bash
   # System configuration features (dynamic dropdowns)
   psql -U postgres -d your_database_name -f db/migrations/add_system_configuration.sql
   
   # Experiment tracking and inventory management
   psql -U postgres -d your_database_name -f db/migrations/add_experiment_tracking.sql
   
   # Inventory system
   psql -U postgres -d your_database_name -f db/migrations/add_inventory_system.sql
   
   # Document management system metadata fields
   psql -U postgres -d your_database_name -f db/migrations/add_document_metadata_fields.sql
   ```
   
   **Note**: The base schema now includes all required integer ID columns and auto-generation functions. No additional migrations are required for basic functionality.

5. **Configure environment variables**
   - Copy the example environment file
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` with your database credentials and JWT secret

6. **Create admin user**
   ```bash
   node create-admin.js
   ```

7. **Start the application**
   - For development (running backend and frontend separately):
   ```bash
   # Terminal 1 - Backend
   npm start
   
   # Terminal 2 - Frontend
   cd client
   npm start
   ```
   - For production, build the frontend first:
   ```bash
   cd client
   npm run build
   cd ..
   npm start
   ```

8. **Access the application**
   - Open your browser to `http://localhost:3000`
   - Login with admin user (username: admin, password: admin123)

### Optional: Git Hooks Setup

The repository includes optional git hooks that provide additional development features:

#### Pre-commit Column Validation Hook
Validates column naming consistency and prevents commits with deprecated field usage:
```bash
# Install column validation hook
./.githooks/setup-hooks.sh
```

**What it does:**
- Validates column naming consistency across database schema, frontend, and backend
- Prevents commits using deprecated fields (e.g., `*_legacy_id`)
- Ensures proper primary key naming conventions
- Can be configured via `.githooks/hook-config.json`

#### Post-commit Documentation Hook  
Automatically updates CLAUDE.md with project status after significant commits:
```bash
# Install CLAUDE.md auto-updater hook
./.githooks/install-post-commit-hook.sh
```

**What it does:**
- Auto-updates CLAUDE.md after commits with significant changes
- Tracks API endpoint changes, database modifications, and config updates
- Provides current project status and statistics
- Manual trigger available: `npm run update-claude`

#### Hook Management
```bash
# Skip hooks for one commit (if needed)
git commit --no-verify -m "Emergency fix"

# Disable hooks permanently
rm .git/hooks/pre-commit .git/hooks/post-commit

# Re-install hooks
./.githooks/setup-hooks.sh
./.githooks/install-post-commit-hook.sh

# Test hooks manually
node .githooks/validate-column-consistency.js
node .githooks/post-commit-claude-updater.js
```

**Note:** Git hooks are optional development tools and are not required for basic LIMS functionality.

## Data Import & Export

### Excel/CSV Import System

The system features a comprehensive import system with a user-friendly interface:

#### Key Features
- **Drag-and-drop file upload** for Excel (.xlsx) and CSV files
- **Three-step wizard**: Upload → Preview → Import
- **Batch processing** for large datasets (handles 15,000+ records efficiently)
- **Real-time validation** with detailed error reporting
- **Duplicate detection** with configurable handling options
- **Transaction safety** with automatic rollback on errors

#### Supported File Formats
- **Excel files** (.xlsx) - recommended for complex datasets
- **CSV files** - for simple data transfers
- **Hierarchical headers** like `collaborator:PI_Name`, `project:Disease`, `specimen:Tube_ID`
- **Standard headers** like `PI Name`, `Disease`, `Specimen ID`

#### How to Import Data

1. **Navigate to Specimens** → Click **Import** button
2. **Upload your file** using drag-and-drop or file picker
3. **Preview your data** - verify columns are recognized and check for errors
4. **Configure options**:
   - Skip duplicates vs. update existing specimens
   - Set batch size for large imports (1000-2000 recommended)
5. **Execute import** - watch real-time progress and results

#### Data Requirements
- **Required fields**: PI Name, PI Institute, and either Specimen ID or Tube ID
- **Project numbers**: Use your lab's project IDs (e.g., "849", "850") 
- **Hierarchical data**: System automatically creates/finds Collaborators → Projects → Specimens
- **Validation**: Automatic validation for dates, enums, and required fields

#### Import File Structure
The system accepts both flat and hierarchical column formats:

**Standard Format:**
```
Specimen ID, PI Name, PI Institute, Disease, Specimen Type, ...
```

**Hierarchical Format:**
```
collaborator:PI_Name, collaborator:PI_Institute, project:Disease, specimen:Tube_ID, ...
```

## Usage

### User Roles

- **Admin**: Full system access, including user management
- **Editor**: Can create, update, and delete records, but not manage users
- **User**: Read-only access to records

### Navigation

- **Dashboard**: Overview of system data
- **Collaborators**: Manage research partners
- **Projects**: Manage research projects with metadata upload and viewing capabilities
- **Specimens**: Track biological samples with enhanced search and filtering
- **Patients**: Manage patient information
- **Protocols**: Create and manage laboratory procedure templates
- **Documents**: Upload, organize, and manage protocol documents with AI-assisted workflows
- **Experiments**: Plan, execute, and track laboratory experiments
- **Inventory**: Monitor and manage reagent stocks and supplies
- **Labels**: Generate and print labels
- **Settings**: Manage user profile and system settings

### Working with Metadata

#### Project-Level Metadata Management
- **Navigate to Project Details**: Access any project to view its metadata section
- **View Metadata Fields**: See all metadata fields specific to that project displayed as organized chips
- **Upload Metadata**: Use the "Upload Metadata" button to bulk import CSV metadata files
- **Contextual Benefits**: All specimens in a project share the same metadata schema, eliminating empty columns

#### Metadata Upload Process
1. **Prepare CSV File**: Create a CSV with specimen identifiers and metadata columns
2. **Upload & Configure**: Use the step-by-step wizard to upload and configure specimen matching
3. **Review & Validate**: Preview the matching results and metadata that will be applied
4. **Apply Changes**: Execute the bulk metadata update with progress tracking

#### Best Practices
- **Use Project Detail pages** for metadata viewing instead of the specimens list
- **Visit individual specimen pages** for detailed metadata examination
- **Prepare CSV files** with clear column headers matching your specimen identifiers
- **Test with small batches** before importing large metadata sets

## Deployment

### Server Requirements
- Node.js runtime environment
- PostgreSQL database
- HTTPS for secure communications (recommended)

### Deployment Options
- **Traditional Server**: Deploy to any server with Node.js and PostgreSQL
- **Cloud Platforms**: Compatible with AWS, Azure, Google Cloud, Heroku, etc.
- **Docker**: Containerization supported (Dockerfile included)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Designed for the needs of pathogen discovery and research labs
- Built with open-source technologies

## Troubleshooting

### Common Setup Issues

#### UUIDs Showing Instead of Numbers in UI
**Problem**: The interface shows UUID values (e.g., `a1b2c3d4...`) instead of user-friendly numbers (e.g., `#25`, `#126`).

**Cause**: Using an old version of the base schema that doesn't include integer ID columns.

**Solution**:
1. **For fresh installations**: Make sure you're using the latest schema: `psql -U postgres -d your_database_name -f db/schema.sql`
2. **For existing installations**: Apply the upgrade migration: `psql -U postgres -d your_database_name -f db/migrations/clean_unified_schema_fixed.sql`
3. Verify columns exist: `\d+ projects` should show `project_number` column

**Note**: As of 2025-08-08, the base schema includes all required integer ID columns. Fresh installations should work immediately.

#### "Column does not exist" Errors
**Problem**: API errors about missing columns like `project_number`, `collaborator_number`.

**Cause**: The clean unified schema migration wasn't applied.

**Solution**: Run the required migrations as shown in the setup steps above.

#### Server Connection Issues
**Problem**: "Can't connect to localhost" or server disconnection errors.

**Solution**: Use stable server startup method:
```bash
# Terminal 1: Start backend directly (more stable)
node server.js

# Terminal 2: Start frontend separately  
cd client && npm start
```

Avoid using `npm run dev` which can cause connection instability.

## Support

For issues, questions, or feature requests, please file an issue on the GitHub repository.