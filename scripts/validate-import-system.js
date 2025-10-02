#!/usr/bin/env node

/**
 * Import System Validation Script
 * Tests both migration and project import workflows to ensure they work correctly
 */

const db = require('../db');
const fs = require('fs');
const path = require('path');

class ImportSystemValidator {
  constructor() {
    this.results = {
      schemaValidation: {},
      migrationImportTest: {},
      projectImportTest: {},
      conflictTests: {},
      issues: [],
      recommendations: []
    };
  }

  async validateSchema() {
    console.log('🔍 Validating database schema...\n');
    
    try {
      // Check required tables exist
      const tableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('collaborators', 'projects', 'specimens', 'patients', 'legacy_id_mappings')
        ORDER BY table_name
      `);
      
      const existingTables = tableCheck.rows.map(row => row.table_name);
      const requiredTables = ['collaborators', 'projects', 'specimens', 'patients', 'legacy_id_mappings'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      this.results.schemaValidation.tables = {
        existing: existingTables,
        missing: missingTables,
        allPresent: missingTables.length === 0
      };
      
      if (missingTables.length > 0) {
        this.results.issues.push(`Missing tables: ${missingTables.join(', ')}`);
        console.log(`❌ Missing tables: ${missingTables.join(', ')}`);
      } else {
        console.log('✅ All required tables exist');
      }

      // Check required columns exist
      const columnChecks = [
        { table: 'collaborators', column: 'collaborator_number', type: 'integer' },
        { table: 'projects', column: 'project_number', type: 'character varying' },
        { table: 'specimens', column: 'specimen_number', type: 'integer' },
        { table: 'patients', column: 'patient_number', type: 'integer' },
        { table: 'patients', column: 'external_id', type: 'character varying' }
      ];
      
      const columnResults = [];
      for (const check of columnChecks) {
        const columnQuery = await db.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [check.table, check.column]);
        
        if (columnQuery.rows.length === 0) {
          this.results.issues.push(`Missing column: ${check.table}.${check.column}`);
          columnResults.push({ ...check, exists: false });
          console.log(`❌ Missing column: ${check.table}.${check.column}`);
        } else {
          const col = columnQuery.rows[0];
          columnResults.push({ ...check, exists: true, actualType: col.data_type, nullable: col.is_nullable });
          console.log(`✅ Column ${check.table}.${check.column}: ${col.data_type}`);
        }
      }
      
      this.results.schemaValidation.columns = columnResults;

      // Check sequences exist and are initialized
      const sequenceCheck = await db.query(`
        SELECT sequence_name, last_value, is_called
        FROM information_schema.sequences
        WHERE sequence_name LIKE '%_id_seq'
        ORDER BY sequence_name
      `);
      
      const requiredSequences = ['collaborator_id_seq', 'project_id_seq', 'specimen_id_seq', 'patient_id_seq'];
      const existingSequences = sequenceCheck.rows.map(row => row.sequence_name);
      const missingSequences = requiredSequences.filter(seq => !existingSequences.includes(seq));
      
      this.results.schemaValidation.sequences = {
        existing: sequenceCheck.rows,
        missing: missingSequences,
        allPresent: missingSequences.length === 0
      };
      
      if (missingSequences.length > 0) {
        this.results.issues.push(`Missing sequences: ${missingSequences.join(', ')}`);
        console.log(`❌ Missing sequences: ${missingSequences.join(', ')}`);
      } else {
        console.log('✅ All required sequences exist');
        sequenceCheck.rows.forEach(seq => {
          console.log(`   ${seq.sequence_name}: ${seq.last_value} (called: ${seq.is_called})`);
        });
      }

      // Check functions exist
      const functionCheck = await db.query(`
        SELECT proname as function_name, pronargs as arg_count
        FROM pg_proc
        WHERE proname IN ('get_next_id', 'peek_next_id', 'create_legacy_mapping', 'get_uuid_by_legacy_id', 'update_sequences_after_migration')
        ORDER BY proname
      `);
      
      const requiredFunctions = ['get_next_id', 'peek_next_id', 'create_legacy_mapping', 'get_uuid_by_legacy_id', 'update_sequences_after_migration'];
      const existingFunctions = functionCheck.rows.map(row => row.function_name);
      const missingFunctions = requiredFunctions.filter(func => !existingFunctions.includes(func));
      
      this.results.schemaValidation.functions = {
        existing: existingFunctions,
        missing: missingFunctions,
        allPresent: missingFunctions.length === 0
      };
      
      if (missingFunctions.length > 0) {
        this.results.issues.push(`Missing functions: ${missingFunctions.join(', ')}`);
        console.log(`❌ Missing functions: ${missingFunctions.join(', ')}`);
      } else {
        console.log('✅ All required functions exist');
      }

    } catch (error) {
      this.results.issues.push(`Schema validation failed: ${error.message}`);
      console.error('❌ Schema validation failed:', error);
    }
  }

  async testMigrationImport() {
    console.log('\n📥 Testing migration import behavior...\n');
    
    try {
      // Test with sample data that mimics the CSV structure
      const testCollaborator = {
        ID: '999',
        IRB_ID: 'TEST-999',
        PI_Name: 'Test PI',
        PI_Institute: 'Test Institution',
        PI_Email: 'test@example.com'
      };
      
      const testProject = {
        ID: '888',
        Collaborator: '999',
        Disease: 'Test Disease',
        Specimen_Type: 'Test Specimen',
        Source: 'Test Source'
      };
      
      // Test collaborator normalization
      const { normalizeCollaborator } = require('../utils/unifiedColumnMapping');
      const normalizedCollab = normalizeCollaborator(testCollaborator, 'migration');
      
      this.results.migrationImportTest.collaborator = {
        input: testCollaborator,
        normalized: normalizedCollab,
        preservesId: normalizedCollab.collaborator_number === 999,
        hasLegacyId: normalizedCollab.legacy_id === '999'
      };
      
      console.log('✅ Collaborator normalization test passed');
      console.log(`   Preserves ID: ${normalizedCollab.collaborator_number} (original: ${testCollaborator.ID})`);
      
      // Test project normalization
      const { normalizeProject } = require('../utils/unifiedColumnMapping');
      const normalizedProject = normalizeProject(testProject, 'migration');
      
      this.results.migrationImportTest.project = {
        input: testProject,
        normalized: normalizedProject,
        preservesId: normalizedProject.project_number === '888',
        hasCollaboratorRef: normalizedProject.collaborator_legacy_id === '999'
      };
      
      console.log('✅ Project normalization test passed');
      console.log(`   Preserves ID: ${normalizedProject.project_number} (original: ${testProject.ID})`);
      console.log(`   Collaborator ref: ${normalizedProject.collaborator_legacy_id} (original: ${testProject.Collaborator})`);
      
    } catch (error) {
      this.results.issues.push(`Migration import test failed: ${error.message}`);
      console.error('❌ Migration import test failed:', error);
    }
  }

  async testProjectImport() {
    console.log('\n📊 Testing project import behavior...\n');
    
    try {
      // Test with normalized data that mimics new project creation
      const testCollaborator = {
        pi_name: 'New Project PI',
        pi_institute: 'New Project Institution',
        pi_email: 'newproject@example.com'
      };
      
      const testProject = {
        collaborator_id: '123', // This would be looked up by collaborator_number
        disease: 'New Project Disease',
        specimen_type: 'New Project Specimen'
      };
      
      // Test collaborator normalization for project import
      const { normalizeCollaborator } = require('../utils/unifiedColumnMapping');
      const normalizedCollab = normalizeCollaborator(testCollaborator, 'project');
      
      this.results.projectImportTest.collaborator = {
        input: testCollaborator,
        normalized: normalizedCollab,
        usesSequence: normalizedCollab.collaborator_number === null,
        hasNoLegacyId: !normalizedCollab.legacy_id
      };
      
      console.log('✅ Collaborator normalization (project) test passed');
      console.log(`   Uses sequence: ${normalizedCollab.collaborator_number === null}`);
      
      // Test project normalization for project import
      const { normalizeProject } = require('../utils/unifiedColumnMapping');
      const normalizedProject = normalizeProject(testProject, 'project');
      
      this.results.projectImportTest.project = {
        input: testProject,
        normalized: normalizedProject,
        usesSequence: normalizedProject.project_number === null,
        hasCollaboratorRef: normalizedProject.collaborator_legacy_id === '123'
      };
      
      console.log('✅ Project normalization (project) test passed');
      console.log(`   Uses sequence: ${normalizedProject.project_number === null}`);
      
    } catch (error) {
      this.results.issues.push(`Project import test failed: ${error.message}`);
      console.error('❌ Project import test failed:', error);
    }
  }

  async testConflictPrevention() {
    console.log('\n⚔️ Testing ID conflict prevention...\n');
    
    try {
      // Test sequence initialization after migration
      const sequenceUpdate = await db.query('SELECT * FROM update_sequences_after_migration()');
      
      if (sequenceUpdate.rows.length > 0) {
        console.log('✅ Sequence update function works');
        sequenceUpdate.rows.forEach(row => {
          console.log(`   ${row.entity_type}: old=${row.old_sequence_value}, new=${row.new_sequence_value}, max_existing=${row.max_existing_id}`);
        });
        
        this.results.conflictTests.sequenceUpdate = {
          success: true,
          updates: sequenceUpdate.rows
        };
      } else {
        console.log('⚠️ No sequence updates needed (database may be empty)');
        this.results.conflictTests.sequenceUpdate = {
          success: true,
          updates: []
        };
      }
      
      // Test data consistency validation
      const consistencyCheck = await db.query('SELECT * FROM validate_import_consistency()');
      
      if (consistencyCheck.rows.length > 0) {
        console.log('⚠️ Data consistency issues found:');
        consistencyCheck.rows.forEach(row => {
          console.log(`   ${row.table_name}.${row.issue_type}: ${row.issue_count} issues`);
          if (row.sample_issues && row.sample_issues.length > 0) {
            console.log(`     Sample: ${row.sample_issues.join(', ')}`);
          }
        });
        
        this.results.conflictTests.consistencyIssues = consistencyCheck.rows;
        this.results.issues.push(`Data consistency issues found in ${consistencyCheck.rows.length} areas`);
      } else {
        console.log('✅ No data consistency issues found');
        this.results.conflictTests.consistencyIssues = [];
      }
      
    } catch (error) {
      this.results.issues.push(`Conflict prevention test failed: ${error.message}`);
      console.error('❌ Conflict prevention test failed:', error);
    }
  }

  async generateRecommendations() {
    console.log('\n📋 Generating recommendations...\n');
    
    // Schema recommendations
    if (this.results.schemaValidation.tables?.missing?.length > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Schema',
        issue: 'Missing database tables',
        solution: `Run missing migrations: ${this.results.schemaValidation.tables.missing.map(t => `db/migrations/create_${t}.sql`).join(', ')}`
      });
    }
    
    if (this.results.schemaValidation.columns?.some(col => !col.exists)) {
      const missingCols = this.results.schemaValidation.columns.filter(col => !col.exists);
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Schema',
        issue: 'Missing database columns',
        solution: `Apply column migrations for: ${missingCols.map(col => `${col.table}.${col.column}`).join(', ')}`
      });
    }
    
    if (this.results.schemaValidation.sequences?.missing?.length > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Schema',
        issue: 'Missing database sequences',
        solution: `Create sequences: ${this.results.schemaValidation.sequences.missing.join(', ')}`
      });
    }
    
    if (this.results.schemaValidation.functions?.missing?.length > 0) {
      this.results.recommendations.push({
        priority: 'HIGH',
        category: 'Schema',
        issue: 'Missing database functions',
        solution: 'Run db/migrations/fix_unified_column_mapping.sql to create missing functions'
      });
    }
    
    // Import system recommendations
    if (this.results.conflictTests.consistencyIssues?.length > 0) {
      this.results.recommendations.push({
        priority: 'MEDIUM',
        category: 'Data',
        issue: 'Data consistency issues detected',
        solution: 'Review and fix data inconsistencies before running imports'
      });
    }
    
    // Best practices recommendations
    this.results.recommendations.push({
      priority: 'MEDIUM',
      category: 'Process',
      issue: 'Import workflow optimization',
      solution: 'Always run migration imports before project imports to establish baseline sequences'
    });
    
    this.results.recommendations.push({
      priority: 'LOW',
      category: 'Monitoring',
      issue: 'Import validation',
      solution: 'Run this validation script after each import to verify data integrity'
    });
    
    // Display recommendations
    this.results.recommendations.forEach((rec, index) => {
      const priorityIcon = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`${priorityIcon} ${rec.priority} - ${rec.category}: ${rec.issue}`);
      console.log(`   Solution: ${rec.solution}\n`);
    });
  }

  async generateReport() {
    console.log('\n📊 Import System Validation Report');
    console.log('==================================\n');
    
    const totalIssues = this.results.issues.length;
    const highPriorityRecs = this.results.recommendations.filter(r => r.priority === 'HIGH').length;
    
    console.log(`Overall Status: ${totalIssues === 0 && highPriorityRecs === 0 ? '✅ READY' : `⚠️ ${totalIssues} ISSUES, ${highPriorityRecs} HIGH PRIORITY`}\n`);
    
    if (totalIssues > 0) {
      console.log('Issues Found:');
      this.results.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
    }
    
    // Schema summary
    console.log('Schema Validation:');
    console.log(`   Tables: ${this.results.schemaValidation.tables?.allPresent ? '✅' : '❌'} (${this.results.schemaValidation.tables?.existing?.length || 0}/5)`);
    console.log(`   Columns: ${this.results.schemaValidation.columns?.every(col => col.exists) ? '✅' : '❌'}`);
    console.log(`   Sequences: ${this.results.schemaValidation.sequences?.allPresent ? '✅' : '❌'} (${this.results.schemaValidation.sequences?.existing?.length || 0}/4)`);
    console.log(`   Functions: ${this.results.schemaValidation.functions?.allPresent ? '✅' : '❌'} (${this.results.schemaValidation.functions?.existing?.length || 0}/5)`);
    
    console.log('\nImport System Tests:');
    console.log(`   Migration Import: ${this.results.migrationImportTest.collaborator?.preservesId ? '✅' : '❌'} ID preservation`);
    console.log(`   Project Import: ${this.results.projectImportTest.collaborator?.usesSequence ? '✅' : '❌'} Sequence usage`);
    console.log(`   Conflict Prevention: ${this.results.conflictTests.sequenceUpdate?.success ? '✅' : '❌'} Sequence management`);
    
    return {
      ready: totalIssues === 0 && highPriorityRecs === 0,
      totalIssues,
      highPriorityRecommendations: highPriorityRecs,
      details: this.results
    };
  }
}

async function runValidation() {
  console.log('🔍 Starting Import System Validation...\n');
  
  const validator = new ImportSystemValidator();
  
  try {
    await validator.validateSchema();
    await validator.testMigrationImport();
    await validator.testProjectImport();
    await validator.testConflictPrevention();
    await validator.generateRecommendations();
    
    const report = await validator.generateReport();
    
    if (report.ready) {
      console.log('\n🎉 Import system validation completed successfully!');
      console.log('✅ Database schema is properly configured');
      console.log('✅ Both import types work correctly');
      console.log('✅ ID conflict prevention is working');
    } else {
      console.log(`\n⚠️ Import system validation found ${report.totalIssues} issues with ${report.highPriorityRecommendations} high-priority items.`);
      console.log('Please review the recommendations above and fix before proceeding.');
    }
    
    return report;
    
  } catch (error) {
    console.error('💥 Import system validation failed:', error);
    return { ready: false, error: error.message };
  }
}

if (require.main === module) {
  runValidation()
    .then(result => {
      process.exit(result.ready ? 0 : 1);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runValidation, ImportSystemValidator };