// Adds one user account directly, with any role. Use this until Sprint 4's
// Admin > Users & Roles panel is built (that will let your Administrator
// do this from the browser instead of the terminal).
//
// EDIT the NEW_USER values below, then run:
//   node database/add-user.js

require('dotenv').config();
const bcrypt = require('bcrypt');
const { query, pool } = require('../config/db');

const NEW_USER = {
  fullName: 'Second Admin',
  email: 'admin@company.com',
  password: 'password123!',
  role: 'administrator', // one of: employee, trainer, supervisor, administrator
};

async function run() {
  const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [NEW_USER.role]);
  if (roleResult.rows.length === 0) {
    console.error(`Role '${NEW_USER.role}' not found. Valid roles: employee, trainer, supervisor, administrator`);
    await pool.end();
    return;
  }

  const existing = await query('SELECT user_id FROM users WHERE email = $1', [NEW_USER.email]);
  if (existing.rows.length > 0) {
    console.error(`An account with email '${NEW_USER.email}' already exists.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(NEW_USER.password, 10);

  await query(
    `INSERT INTO users (role_id, full_name, email, password_hash, status)
     VALUES ($1, $2, $3, $4, 'active')`,
    [roleResult.rows[0].role_id, NEW_USER.fullName, NEW_USER.email, passwordHash]
  );

  console.log(`Created ${NEW_USER.role}: ${NEW_USER.email}`);
  console.log(`Password: ${NEW_USER.password}`);

  await pool.end();
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});