#!/bin/bash

# Fresh Schema Test Script
# Purpose: Ensure consolidated schema works for fresh installations
# Usage: ./scripts/test-fresh-schema.sh

set -e

echo "🧪 Testing Fresh Database Schema Installation..."

# Generate test database name with timestamp
TEST_DB="test_lims_$(date +%s)"

echo "📋 Creating test database: $TEST_DB"
createdb "$TEST_DB"

echo "🗄️  Applying consolidated schema..."
psql -d "$TEST_DB" -f db/schema.sql > /dev/null

echo "✅ Testing table creation..."
TABLE_COUNT=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
EXPECTED_TABLES=16  # Clean LIMS system without legacy complexity

if [ "$TABLE_COUNT" -eq "$EXPECTED_TABLES" ]; then
    echo "   ✓ All $EXPECTED_TABLES tables created successfully"
else
    echo "   ❌ Expected $EXPECTED_TABLES tables, found $TABLE_COUNT"
    exit 1
fi

echo "✅ Testing sequence creation..."
SEQUENCE_COUNT=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM information_schema.sequences WHERE sequence_schema = 'public';")
EXPECTED_SEQUENCES=7  # Clean sequence set without legacy sequences

if [ "$SEQUENCE_COUNT" -eq "$EXPECTED_SEQUENCES" ]; then
    echo "   ✓ All $EXPECTED_SEQUENCES sequences created successfully"
else
    echo "   ❌ Expected $EXPECTED_SEQUENCES sequences, found $SEQUENCE_COUNT"
    exit 1
fi

echo "✅ Testing ID generation functions..."
COLLABORATOR_ID=$(psql -d "$TEST_DB" -t -c "SELECT get_next_number('collaborator');")
PROJECT_ID=$(psql -d "$TEST_DB" -t -c "SELECT get_next_number('project');")
INVENTORY_ID=$(psql -d "$TEST_DB" -t -c "SELECT get_next_number('inventory');")
EXPERIMENT_ID=$(psql -d "$TEST_DB" -t -c "SELECT get_next_number('experiment');")

if [[ "$COLLABORATOR_ID" -eq 1 && "$PROJECT_ID" -eq 1 && "$INVENTORY_ID" -eq 1 && "$EXPERIMENT_ID" -eq 1 ]]; then
    echo "   ✓ ID generation functions working correctly"
else
    echo "   ❌ ID generation failed: C=$COLLABORATOR_ID, P=$PROJECT_ID, I=$INVENTORY_ID, E=$EXPERIMENT_ID"
    exit 1
fi

echo "✅ Testing system configuration data..."
CONFIG_COUNT=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM system_options;")

if [ "$CONFIG_COUNT" -gt 23 ]; then
    echo "   ✓ System configuration data loaded ($CONFIG_COUNT options)"
else
    echo "   ❌ Insufficient system configuration data: $CONFIG_COUNT options"
    exit 1
fi

echo "✅ Testing Unknown entities..."
UNKNOWN_COLLABORATOR=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM collaborators WHERE collaborator_number = 0;")
UNKNOWN_PROJECT=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM projects WHERE project_number = 0;")

if [[ "$UNKNOWN_COLLABORATOR" -eq 1 && "$UNKNOWN_PROJECT" -eq 1 ]]; then
    echo "   ✓ Unknown fallback entities created successfully"
else
    echo "   ❌ Unknown entities missing: Collaborator=$UNKNOWN_COLLABORATOR, Project=$UNKNOWN_PROJECT"
    exit 1
fi

echo "🧹 Cleaning up test database..."
dropdb "$TEST_DB"

echo ""
echo "🎉 SUCCESS: Consolidated schema creates fully functional LIMS system!"
echo "   - All essential tables and sequences created"
echo "   - ID generation system functional"
echo "   - System configuration loaded"
echo "   - Unknown entities in place for migration imports"
echo ""
echo "✅ Ready for fresh installations with single command:"
echo "   psql -d your_database -f db/schema.sql"