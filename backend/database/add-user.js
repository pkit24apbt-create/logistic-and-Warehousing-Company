// Adds one user account directly from the terminal, with any role.
// The Administrator can also do this from the browser (Users & Roles page);
// this script is only for creating the very first account or for emergencies.
//
// USAGE (from the backend folder):
//   node database/add-user.js "Full Name" email@company.com "A-Strong-Password1" administrator
//
// The last value is the role: employee, trainer, supervisor or administrator.
// The password is typed on the command line, so it is never saved in this file.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/db');

const [fullName, email, password, role] = process.argv.slice(2);

async function run() {
  if (!fullName || !email || !password || !role) {
    console.error('Usage: node database/add-user.js "Full Name" email@company.com "Password" role');
    console.error('Roles: employee, trainer, supervisor, administrator');
    await pool.end();
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('The password must be at least 8 characters.');
    await pool.end();
    process.exit(1);
  }

  const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [role]);
  if (roleResult.rows.length === 0) {
    console.error(`Role '${role}' not found. Valid roles: employee, trainer, supervisor, administrator`);
    await pool.end();
    process.exit(1);
  }

  const existing = await query('SELECT user_id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.error(`An account with email '${email}' already exists.`);
    await pool.end();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await query(
    `INSERT INTO users (role_id, full_name, email, password_hash, status)
     VALUES ($1, $2, $3, $4, 'active')`,
    [roleResult.rows[0].role_id, fullName, email, passwordHash]
  );

  console.log(`Created ${role}: ${email}`);
  await pool.end();
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});