#!/usr/bin/env node

const db = require('./db');

async function clearTestData() {
  try {
    console.log('🗑️  Clearing test data from database...');
    
    // Delete all data except Unknown entities (ID=0)
    await db.query('DELETE FROM specimens WHERE specimen_number != 0');
    console.log('✅ Cleared specimens (kept Unknown if exists)');
    
    await db.query('DELETE FROM patients WHERE patient_number != 0');
    console.log('✅ Cleared patients (kept Unknown if exists)');
    
    await db.query('DELETE FROM projects WHERE project_number != 0');
    console.log('✅ Cleared projects (kept Unknown)');
    
    await db.query('DELETE FROM collaborators WHERE collaborator_number != 0');
    console.log('✅ Cleared collaborators (kept Unknown)');
    
    // Clear audit log
    await db.query('DELETE FROM audit_log');
    console.log('✅ Cleared audit log');
    
    // Reset sequences to start from 1 (since 0 is reserved)
    await db.query("SELECT setval('collaborator_number_seq', 1, false)");
    await db.query("SELECT setval('project_number_seq', 1, false)");
    await db.query("SELECT setval('specimen_number_seq', 1, false)");
    await db.query("SELECT setval('patient_number_seq', 1, false)");
    console.log('✅ Reset sequences to start from 1');
    
    // Verify current counts
    const counts = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM collaborators) as collaborators,
        (SELECT COUNT(*) FROM projects) as projects,
        (SELECT COUNT(*) FROM specimens) as specimens,
        (SELECT COUNT(*) FROM patients) as patients
    `);
    
    console.log('\n📊 Current database state:');
    console.log(`Collaborators: ${counts.rows[0].collaborators} (should be 1 - Unknown)`);
    console.log(`Projects: ${counts.rows[0].projects} (should be 1 - Unknown)`);
    console.log(`Specimens: ${counts.rows[0].specimens} (should be 0)`);
    console.log(`Patients: ${counts.rows[0].patients} (should be 0)`);
    
    // Show the Unknown entities
    const unknownCollab = await db.query('SELECT * FROM collaborators WHERE collaborator_number = 0');
    const unknownProject = await db.query('SELECT * FROM projects WHERE project_number = 0');
    
    if (unknownCollab.rows.length > 0) {
      console.log(`\n🔍 Unknown Collaborator: ${unknownCollab.rows[0].pi_name} (${unknownCollab.rows[0].pi_institute})`);
    }
    
    if (unknownProject.rows.length > 0) {
      console.log(`🔍 Unknown Project: ${unknownProject.rows[0].disease} - ${unknownProject.rows[0].specimen_type}`);
    }
    
    console.log('\n🎉 Database cleared! Ready for your migration import.');
    
  } catch (error) {
    console.error('❌ Error clearing test data:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

clearTestData();