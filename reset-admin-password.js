const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetAdminPassword() {
  try {
    // Set new password
    const newPassword = 'admin123';
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update admin user password
    const result = await pool.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2 RETURNING id, username, email',
      [hashedPassword, 'admin']
    );
    
    if (result.rowCount > 0) {
      console.log('Admin password reset successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
      console.log('User details:', result.rows[0]);
    } else {
      console.log('No admin user found to update.');
    }
    
    // Close the pool
    await pool.end();
  } catch (err) {
    console.error('Error resetting admin password:', err);
    await pool.end();
  }
}

// Run the function
resetAdminPassword();