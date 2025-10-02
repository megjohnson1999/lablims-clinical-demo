#!/bin/bash

# Post-Commit Hook Installation Script for CLAUDE.md Auto-Updater
# 
# This script installs the post-commit hook that automatically updates
# CLAUDE.md with current project status after each significant commit.

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Icons
SUCCESS="✅"
ERROR="❌"
INFO="ℹ️"
UPDATE="🔄"
INSTALL="📦"

echo -e "${BOLD}${CYAN}📦 CLAUDE.md Post-Commit Hook Installer${NC}\n"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${ERROR} ${RED}Error: Not in a git repository${NC}"
    echo -e "${YELLOW}Please run this script from the root of your git repository.${NC}"
    exit 1
fi

# Check if we're in the correct directory (has package.json and client/)
if [ ! -f "package.json" ] || [ ! -d "client" ]; then
    echo -e "${ERROR} ${RED}Error: Must be run from LIMS root directory${NC}"
    echo -e "${YELLOW}Expected files: package.json, client/ directory${NC}"
    exit 1
fi

echo -e "${BLUE}${INFO} Installing post-commit hook...${NC}"

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create the actual git hook that calls our Node.js script
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash

# Post-commit hook for LIMS CLAUDE.md auto-updater
# Calls the Node.js script to update documentation

# Only run if the post-commit script exists
if [ -f ".githooks/post-commit-claude-updater.js" ]; then
    node .githooks/post-commit-claude-updater.js
else
    echo "Warning: CLAUDE.md updater script not found"
fi
EOF

# Make the hook executable
chmod +x .git/hooks/post-commit

# Make our Node.js script executable too
if [ -f ".githooks/post-commit-claude-updater.js" ]; then
    chmod +x .githooks/post-commit-claude-updater.js
    echo -e "  ${SUCCESS} Post-commit hook script configured"
else
    echo -e "  ${ERROR} ${RED}post-commit-claude-updater.js not found${NC}"
    exit 1
fi

# Check if CLAUDE.md exists, create template if not
if [ ! -f "CLAUDE.md" ]; then
    echo -e "${BLUE}${INFO} Creating CLAUDE.md template...${NC}"
    
    cat > CLAUDE.md << 'EOF'
# Pathogen Discovery Database (LIMS) - Development Guide

## Project Overview

This is a comprehensive **Laboratory Information Management System (LIMS)** for pathogen research workflows. Built with Node.js/Express backend and React frontend, it provides hierarchical specimen tracking, experiment management, inventory control, and comprehensive data import/export capabilities.

**Key Architecture**: Full-stack JavaScript with PostgreSQL database, RESTful API, JWT authentication, and Material-UI interface.

## Quick Start Commands

### Development
```bash
# Start both backend and frontend concurrently
npm run dev

# Backend only (port 5000)
npm run server

# Frontend only (port 3000)  
npm start --prefix client
```

### Database Setup
```bash
# Apply core schema
psql $DATABASE_URL -f db/schema.sql

# Apply REQUIRED migrations (in order)
psql $DATABASE_URL -f db/migrations/clean_unified_schema_fixed.sql
```

### Testing & Quality
```bash
# Run diagnostics before development
npm run diag

# Test login: admin / admin123
```

## Current Development Status

This document is automatically updated after each significant commit to track:
- API endpoint changes
- Database schema modifications  
- Package dependency updates
- New feature implementations
- Architectural changes

**Last Manual Update**: Initial template creation

---

*Auto-generated updates appear below after commits with significant changes.*

EOF
    
    echo -e "  ${SUCCESS} CLAUDE.md template created"
fi

# Test the hook by running it manually
echo -e "\n${BLUE}${INFO} Testing post-commit hook...${NC}"

if node .githooks/post-commit-claude-updater.js; then
    echo -e "\n${SUCCESS} ${GREEN}Hook test completed successfully!${NC}"
else
    echo -e "\n${ERROR} ${RED}Hook test failed${NC}"
    echo -e "${YELLOW}The hook is installed but may have issues. Check the error messages above.${NC}"
fi

# Add npm script for manual updates
echo -e "\n${BLUE}${INFO} Adding npm script for manual updates...${NC}"

# Check if package.json has a scripts section and add our update script
if command -v jq >/dev/null 2>&1; then
    # Use jq if available for safe JSON manipulation
    jq '.scripts["update-claude"] = "node .githooks/post-commit-claude-updater.js"' package.json > package.json.tmp && mv package.json.tmp package.json
    echo -e "  ${SUCCESS} Added 'npm run update-claude' script"
else
    # Fallback method if jq is not available
    if grep -q '"update-claude":' package.json; then
        echo -e "  ${YELLOW} npm update-claude script already exists"
    else
        echo -e "  ${YELLOW} jq not found - add this to package.json scripts manually:"
        echo -e "    ${CYAN}\"update-claude\": \"node .githooks/post-commit-claude-updater.js\"${NC}"
    fi
fi

echo -e "\n${BOLD}${GREEN}🎉 Installation Complete!${NC}\n"

echo -e "${BOLD}${CYAN}📋 How It Works:${NC}"
echo -e "• Hook runs automatically after each ${CYAN}git commit${NC}"
echo -e "• Detects changes to API routes, database schema, configs"
echo -e "• Updates CLAUDE.md with current project status"
echo -e "• Only triggers on significant changes to avoid spam"

echo -e "\n${BOLD}${CYAN}💡 Usage:${NC}"
echo -e "  ${GREEN}Automatic:${NC}     Hook runs after every commit"
echo -e "  ${GREEN}Manual:${NC}        npm run update-claude"
echo -e "  ${GREEN}Diagnostics:${NC}   npm run diag (pre-commit check)"

echo -e "\n${BOLD}${CYAN}🎯 What Gets Tracked:${NC}"
echo -e "• ${BLUE}API Changes:${NC} routes/*.js modifications"
echo -e "• ${BLUE}Database:${NC} db/migrations/*.sql and schema changes"  
echo -e "• ${BLUE}Config:${NC} package.json, .env, middleware changes"
echo -e "• ${BLUE}Features:${NC} New components, services, utilities"

echo -e "\n${BOLD}${CYAN}🔧 Hook Behavior:${NC}"
echo -e "• ${GREEN}Major changes:${NC} Always triggers update"
echo -e "• ${GREEN}Minor changes:${NC} Skipped to avoid noise"
echo -e "• ${GREEN}Significance:${NC} Auto-detected based on file types"

echo -e "\n${BOLD}${GREEN}${SUCCESS} Ready for automatic CLAUDE.md updates!${NC}"
echo -e "Make a commit to see the hook in action.\n"