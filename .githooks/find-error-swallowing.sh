#!/bin/bash

# Pre-commit hook to find error swallowing patterns
# Detects try-catch blocks that might hide errors

set -e

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Scanning for error swallowing patterns...${NC}"

# Files to check (JavaScript/Node.js files) - exclude all node_modules
FILES=$(find . -name "*.js" -not -path "./node_modules/*" -not -path "./client/node_modules/*" -not -path "./.git/*" -not -path "./client/build/*")

ISSUES_FOUND=0

# Pattern 1: Empty catch blocks
echo -e "\n${YELLOW}📋 Checking for empty catch blocks...${NC}"
for file in $FILES; do
    if grep -n "catch.*{[[:space:]]*}" "$file" 2>/dev/null; then
        echo -e "${RED}❌ Empty catch block found in: $file${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Pattern 2: Generic error logging without re-throwing
echo -e "\n${YELLOW}📋 Checking for generic error swallowing...${NC}"
for file in $FILES; do
    # Look for catch blocks that only log errors
    if grep -n -A3 "catch.*(" "$file" 2>/dev/null | grep -E "(console\.log|console\.error)" | grep -v "throw\|return.*status.*json\|res\.status" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Potential error swallowing in: $file${NC}"
        grep -n -A3 "catch.*(" "$file" | grep -E "(console\.log|console\.error)" | head -2
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Pattern 3: Missing error handling in async functions
echo -e "\n${YELLOW}📋 Checking for missing error handling in async operations...${NC}"
for file in $FILES; do
    # Look for async/await without try-catch
    if grep -n "await.*(" "$file" 2>/dev/null | head -5; then
        echo -e "${YELLOW}ℹ️  File has async operations (verify error handling): $file${NC}"
    fi
done

# Pattern 4: Database operations without error handling
echo -e "\n${YELLOW}📋 Checking for database operations without proper error handling...${NC}"
for file in $FILES; do
    if grep -n "db\.query\|client\.query" "$file" 2>/dev/null | grep -v "try\|catch" | head -3; then
        echo -e "${YELLOW}⚠️  Database operations found (verify error handling): $file${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

# Pattern 5: Success responses without validation
echo -e "\n${YELLOW}📋 Checking for success responses without validation...${NC}"
for file in $FILES; do
    if grep -n "success.*true\|message.*successfully" "$file" 2>/dev/null; then
        # Check if there's validation nearby
        if ! grep -A5 -B5 "success.*true\|message.*successfully" "$file" 2>/dev/null | grep -E "(COUNT|length|rows\.length|validation)" >/dev/null; then
            echo -e "${RED}❌ Success response without validation in: $file${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    fi
done

echo -e "\n${YELLOW}📊 Summary:${NC}"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No obvious error swallowing patterns found${NC}"
else
    echo -e "${RED}❌ Found $ISSUES_FOUND potential error handling issues${NC}"
    echo -e "${YELLOW}💡 Review these patterns to ensure errors are properly handled and visible${NC}"
fi

echo -e "\n${GREEN}🔍 Error swallowing scan complete${NC}"