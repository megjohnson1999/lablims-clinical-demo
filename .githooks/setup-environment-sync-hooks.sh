#!/bin/bash

# Setup script for environment synchronization git hooks
# Run this after cloning the repository to enable automatic environment sync checking

echo "🔧 Setting up environment synchronization git hooks..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    echo "Run this script from the root of your git repository"
    exit 1
fi

# Make sure .githooks directory exists
if [ ! -d ".githooks" ]; then
    echo "❌ Error: .githooks directory not found"
    echo "This script should be run from the project root where .githooks exists"
    exit 1
fi

# Make hook scripts executable
echo "📋 Making hook scripts executable..."
chmod +x .githooks/pre-commit-database-changes.js
chmod +x .githooks/post-commit-environment-sync.js

# Check if hooks are already installed
if [ -f ".git/hooks/pre-commit" ] && grep -q "pre-commit-database-changes.js" .git/hooks/pre-commit; then
    echo "✅ Pre-commit hook already installed"
else
    echo "⚠️  Pre-commit hook not installed or missing environment sync"
    echo "   Check .git/hooks/pre-commit and ensure it calls .githooks/pre-commit-database-changes.js"
fi

if [ -f ".git/hooks/post-commit" ] && grep -q "post-commit-environment-sync.js" .git/hooks/post-commit; then
    echo "✅ Post-commit hook already installed"
else
    echo "⚠️  Post-commit hook not installed or missing environment sync"
    echo "   Check .git/hooks/post-commit and ensure it calls .githooks/post-commit-environment-sync.js"
fi

# Test the hooks
echo ""
echo "🧪 Testing environment sync hooks..."

echo "Testing pre-commit database validation..."
if node .githooks/pre-commit-database-changes.js > /dev/null 2>&1; then
    echo "✅ Pre-commit hook working"
else
    echo "❌ Pre-commit hook failed - check Node.js installation"
fi

echo "Testing post-commit environment sync..."
if node .githooks/post-commit-environment-sync.js > /dev/null 2>&1; then
    echo "✅ Post-commit hook working"
else
    echo "❌ Post-commit hook failed - check Node.js installation"
fi

echo ""
echo "🎉 Environment synchronization hooks setup complete!"
echo ""
echo "🔍 These hooks will now:"
echo "   • Pre-commit: Prevent commits that could break fresh git clones"
echo "   • Post-commit: Check for environment drift and suggest fixes"
echo "   • Detect missing Unknown entity creation in schema"
echo "   • Warn about uncommitted database fixes"
echo "   • Validate schema/code compatibility"
echo ""
echo "📚 For more info, see ENVIRONMENT_SYNC_FIX_SUMMARY.md"