const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Generate secure password
function generateSecurePassword() {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char
  
  // Fill remaining characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

async function createAdmin() {
  try {
    // Check if any admin users already exist
    const existingAdmins = await pool.query(
      "SELECT id, username FROM users WHERE role = 'admin' OR role = 'lab_manager'"
    );

    if (existingAdmins.rows.length > 0) {
      console.log('Admin users already exist:');
      existingAdmins.rows.forEach(admin => {
        console.log(`- ${admin.username} (${admin.id})`);
      });
      console.log('Use the user management interface to create additional users.');
      await pool.end();
      return;
    }

    // Get admin password from environment or generate secure one
    const adminPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
    const generatedPassword = !process.env.ADMIN_PASSWORD;
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    // Insert admin user with lab_manager role (can manage users)
    const result = await pool.query(`
      INSERT INTO users (
        username, email, password, first_name, last_name, role, 
        force_password_change, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, username, email, role, force_password_change
    `, [
      'admin', 
      'admin@lab.local', 
      hashedPassword, 
      'Lab', 
      'Administrator', 
      'lab_manager', 
      generatedPassword, // Force password change if generated
      true
    ]);
    
    console.log('\n🎉 Lab Manager account created successfully!');
    console.log('=====================================');
    console.log(`Username: ${result.rows[0].username}`);
    console.log(`Email: ${result.rows[0].email}`);
    console.log(`Role: ${result.rows[0].role}`);
    console.log(`Password: ${adminPassword}`);
    
    if (generatedPassword) {
      console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
      console.log('- This password was randomly generated');
      console.log('- You will be required to change it on first login');
      console.log('- Store this password securely and delete it after first login');
      console.log('\n💡 For production security:');
      console.log('- Set ADMIN_PASSWORD environment variable for predictable passwords');
      console.log('- Set NODE_ENV=production to disable public registration');
      console.log('- Use a strong, unique JWT_SECRET in your environment');
    }
    
    console.log('\n🔐 Next Steps:');
    console.log('1. Login with the credentials above');
    console.log('2. Change the password (if prompted)');
    console.log('3. Use the User Management interface to create accounts for your lab team');
    console.log('   - Lab Technicians: Full CRUD on specimens, protocols, experiments');
    console.log('   - Bioinformaticians: Full access to sequencing data and experiments');
    console.log('   - Researchers: Read-only access to assigned projects');
    
    // Close the pool
    await pool.end();
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      console.error('Admin user already exists. Use password reset if needed.');
    } else {
      console.error('Error creating admin user:', err.message);
    }
    await pool.end();
  }
}

// Run the function
createAdmin();