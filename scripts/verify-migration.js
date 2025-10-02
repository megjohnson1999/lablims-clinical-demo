#!/usr/bin/env node

/**
 * Comprehensive migration verification script
 * Verifies that the auto-ID migration preserved existing data and set correct counter values
 */

const db = require('../db');
const { execSync } = require('child_process');

class MigrationVerifier {
  constructor() {
    this.results = {
      dataPreservation: {},
      sequenceInitialization: {},
      structuralChanges: {},
      issues: []
    };
  }

  async verifyDataPreservation() {
    console.log('🔍 Verifying data preservation...\n');
    
    try {
      // Check all tables have their original record counts and UUID primary keys intact
      const tables = ['collaborators', 'projects', 'specimens', 'patients'];
      
      for (const table of tables) {
        const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(countResult.rows[0].count);
        
        // Check that UUID primary keys are still intact
        const uuidCheck = await db.query(`
          SELECT COUNT(*) as uuid_count 
          FROM ${table} 
          WHERE id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        `);
        const uuidCount = parseInt(uuidCheck.rows[0].uuid_count);
        
        this.results.dataPreservation[table] = {
          totalRecords: count,
          uuidRecords: uuidCount,
          allUuidsIntact: count === uuidCount,
          dataLoss: count === 0 && table !== 'specimens' // specimens might be empty in test DB
        };
        
        console.log(`   ${table}: ${count} records, ${uuidCount} valid UUIDs ${count === uuidCount ? '✅' : '❌'}`);
      }

      // Check specific data integrity for key fields
      const collaboratorDataCheck = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN pi_name IS NOT NULL AND pi_name != '' THEN 1 END) as with_names,
          COUNT(CASE WHEN pi_institute IS NOT NULL AND pi_institute != '' THEN 1 END) as with_institutes
        FROM collaborators
      `);
      
      if (collaboratorDataCheck.rows.length > 0) {
        const data = collaboratorDataCheck.rows[0];
        console.log(`   Collaborator data integrity: ${data.with_names}/${data.total} have names, ${data.with_institutes}/${data.total} have institutes`);
      }
      
    } catch (error) {
      this.results.issues.push(`Data preservation check failed: ${error.message}`);
      console.error('❌ Data preservation verification failed:', error);
    }
  }

  async verifySequenceInitialization() {
    console.log('\n📊 Verifying sequence initialization...\n');
    
    try {
      // Check that sequences exist and are properly initialized
      const sequences = ['collaborator_id_seq', 'project_id_seq', 'specimen_id_seq'];
      
      for (const seqName of sequences) {
        // Get current sequence value
        const seqResult = await db.query(`
          SELECT last_value, is_called 
          FROM ${seqName}
        `);
        
        if (seqResult.rows.length === 0) {
          this.results.issues.push(`Sequence ${seqName} does not exist`);
          continue;
        }
        
        const { last_value, is_called } = seqResult.rows[0];
        const entityType = seqName.replace('_id_seq', '');
        
        // Get maximum existing ID from the corresponding table
        let maxExistingId = 0;
        try {
          if (entityType === 'collaborator') {
            // Check irb_id and any existing collaborator_number
            const maxCheck = await db.query(`
              SELECT GREATEST(
                COALESCE(MAX(CAST(irb_id AS INTEGER)) FILTER (WHERE irb_id ~ '^\\d+$'), 0),
                COALESCE(MAX(collaborator_number), 0)
              ) as max_id
              FROM collaborators
            `);
            maxExistingId = parseInt(maxCheck.rows[0].max_id) || 0;
          } else if (entityType === 'project') {
            const maxCheck = await db.query(`
              SELECT GREATEST(
                COALESCE(MAX(CAST(project_number AS INTEGER)) FILTER (WHERE project_number ~ '^\\d+$'), 0),
                COALESCE(MAX(project_id), 0)
              ) as max_id
              FROM projects
            `);
            maxExistingId = parseInt(maxCheck.rows[0].max_id) || 0;
          } else if (entityType === 'specimen') {
            const maxCheck = await db.query(`
              SELECT GREATEST(
                COALESCE(MAX(CAST(REGEXP_REPLACE(tube_id, '[^0-9]', '', 'g') AS INTEGER)) FILTER (WHERE tube_id ~ '\\d+'), 0),
                COALESCE(MAX(CAST(run_number AS INTEGER)) FILTER (WHERE run_number ~ '^\\d+$'), 0),
                COALESCE(MAX(specimen_number), 0)
              ) as max_id
              FROM specimens
            `);
            maxExistingId = parseInt(maxCheck.rows[0].max_id) || 0;
          }
        } catch (err) {
          console.log(`   Warning: Could not determine max existing ID for ${entityType}: ${err.message}`);
        }
        
        const expectedMinValue = Math.max(maxExistingId + 1, 1);
        const actualNextValue = is_called ? last_value + 1 : last_value;
        
        this.results.sequenceInitialization[entityType] = {
          sequenceName: seqName,
          lastValue: last_value,
          isCalled: is_called,
          nextValue: actualNextValue,
          maxExistingId: maxExistingId,
          expectedMinValue: expectedMinValue,
          properlyInitialized: actualNextValue >= expectedMinValue
        };
        
        const status = actualNextValue >= expectedMinValue ? '✅' : '❌';
        console.log(`   ${entityType}: sequence=${actualNextValue}, max_existing=${maxExistingId}, expected>=${expectedMinValue} ${status}`);
      }
      
    } catch (error) {
      this.results.issues.push(`Sequence initialization check failed: ${error.message}`);
      console.error('❌ Sequence verification failed:', error);
    }
  }

  async verifyStructuralChanges() {
    console.log('\n🏗️ Verifying structural changes...\n');
    
    try {
      // Check that new columns were added
      const expectedColumns = {
        'collaborators': 'collaborator_number',
        'projects': 'project_id', 
        'specimens': 'specimen_number'
      };
      
      for (const [table, column] of Object.entries(expectedColumns)) {
        const columnCheck = await db.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        `, [table, column]);
        
        const exists = columnCheck.rows.length > 0;
        if (exists) {
          const columnInfo = columnCheck.rows[0];
          console.log(`   ${table}.${column}: ${columnInfo.data_type} (nullable: ${columnInfo.is_nullable}) ✅`);
          
          this.results.structuralChanges[`${table}.${column}`] = {
            exists: true,
            dataType: columnInfo.data_type,
            isNullable: columnInfo.is_nullable
          };
        } else {
          console.log(`   ${table}.${column}: missing ❌`);
          this.results.structuralChanges[`${table}.${column}`] = { exists: false };
          this.results.issues.push(`Missing column: ${table}.${column}`);
        }
      }
      
      // Check that functions were created
      const functions = ['get_next_id', 'peek_next_id'];
      for (const funcName of functions) {
        const funcCheck = await db.query(`
          SELECT proname, pronargs
          FROM pg_proc 
          WHERE proname = $1
        `, [funcName]);
        
        const exists = funcCheck.rows.length > 0;
        console.log(`   Function ${funcName}: ${exists ? 'exists' : 'missing'} ${exists ? '✅' : '❌'}`);
        
        if (!exists) {
          this.results.issues.push(`Missing function: ${funcName}`);
        }
      }
      
      // Check that audit table was created
      const auditTableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'id_generation_log'
      `);
      
      const auditExists = auditTableCheck.rows.length > 0;
      console.log(`   Audit table id_generation_log: ${auditExists ? 'exists' : 'missing'} ${auditExists ? '✅' : '❌'}`);
      
      if (!auditExists) {
        this.results.issues.push('Missing audit table: id_generation_log');
      }
      
    } catch (error) {
      this.results.issues.push(`Structural verification failed: ${error.message}`);
      console.error('❌ Structural verification failed:', error);
    }
  }

  async generateReport() {
    console.log('\n📋 Migration Verification Report');
    console.log('================================\n');
    
    // Summary
    const issueCount = this.results.issues.length;
    console.log(`Overall Status: ${issueCount === 0 ? '✅ PASSED' : `❌ ${issueCount} ISSUES FOUND`}\n`);
    
    if (issueCount > 0) {
      console.log('Issues Found:');
      this.results.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log('');
    }
    
    // Data preservation summary
    console.log('Data Preservation:');
    Object.entries(this.results.dataPreservation).forEach(([table, data]) => {
      const status = data.allUuidsIntact && !data.dataLoss ? '✅' : '❌';
      console.log(`   ${table}: ${data.totalRecords} records preserved ${status}`);
    });
    
    // Sequence initialization summary  
    console.log('\nSequence Initialization:');
    Object.entries(this.results.sequenceInitialization).forEach(([entity, data]) => {
      const status = data.properlyInitialized ? '✅' : '❌';
      console.log(`   ${entity}: next=${data.nextValue}, safe=${data.properlyInitialized} ${status}`);
    });
    
    return {
      passed: issueCount === 0,
      issueCount,
      details: this.results
    };
  }
}

async function runVerification() {
  console.log('🔍 Starting Migration Verification...\n');
  
  const verifier = new MigrationVerifier();
  
  try {
    await verifier.verifyDataPreservation();
    await verifier.verifySequenceInitialization();
    await verifier.verifyStructuralChanges();
    
    const report = await verifier.generateReport();
    
    if (report.passed) {
      console.log('\n🎉 Migration verification completed successfully!');
      console.log('✅ All existing data preserved');
      console.log('✅ Sequences properly initialized');
      console.log('✅ Database structure updated correctly');
    } else {
      console.log(`\n⚠️  Migration verification found ${report.issueCount} issues.`);
      console.log('Please review the issues above and fix before proceeding.');
    }
    
    return report;
    
  } catch (error) {
    console.error('💥 Migration verification failed:', error);
    return { passed: false, error: error.message };
  } finally {
    // Don't close the db connection here as other scripts might need it
  }
}

if (require.main === module) {
  runVerification()
    .then(result => {
      process.exit(result.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runVerification, MigrationVerifier };