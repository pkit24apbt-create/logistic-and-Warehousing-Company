const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 10;

// Every route below requires a valid token AND the administrator role.
// This is the only place (besides the one-time /setup) where new accounts
// can be created — and it's fully protected, so only a logged-in
// Administrator can ever reach it.
router.use(verifyToken, requireRole(['administrator']));

// Generates a random, human-typeable temporary password like "Kx7m-Qp2v".
// Used both for new accounts and for password resets — the admin sees it
// once on screen, gives it to the person, and it is never stored or shown
// again in plain text anywhere.
function generateTempPassword() {
  const part = () => crypto.randomBytes(3).toString('hex');
  return `${part()}-${part()}`;
}

// GET /api/admin/trainers — simple list for populating "assign to trainer"
// dropdowns when Admin creates or reassigns training content.
router.get('/trainers', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.full_name FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'trainer' AND u.status = 'active' ORDER BY u.full_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List trainers error:', err);
    res.status(500).json({ error: 'Something went wrong loading trainers.' });
  }
});

// GET /api/admin/users — list every account
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.full_name, u.email, u.department, u.status, u.must_change_password, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Something went wrong loading users.' });
  }
});

// GET /api/admin/published-modules — for populating the "assign at
// registration" checklist when creating a new Employee account.
router.get('/published-modules', async (req, res) => {
  try {
    const result = await query(
      `SELECT module_id, title, topic FROM training_modules WHERE status = 'published' ORDER BY title`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List published modules error:', err);
    res.status(500).json({ error: 'Something went wrong loading modules.' });
  }
});

// GET /api/admin/all-modules — every module regardless of status, with its
// current owner, for populating the "hand ownership to this new Trainer"
// checklist when creating a new Trainer account.
router.get('/all-modules', async (req, res) => {
  try {
    const result = await query(
      `SELECT m.module_id, m.title, m.topic, m.status, u.full_name AS owner_name
       FROM training_modules m LEFT JOIN users u ON m.trainer_id = u.user_id
       ORDER BY m.title`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List all modules error:', err);
    res.status(500).json({ error: 'Something went wrong loading modules.' });
  }
});

// POST /api/admin/users — create a new account with any role.
// The Administrator types the initial password themselves (name, email,
// password, role — like a normal registration form). For security, the
// account still starts flagged as must_change_password = true, so the
// very first thing that person does after logging in is set their OWN
// real password — the Admin's password only gets them in the door once.
// An Administrator may also pass `assignedModuleIds` — training modules
// to assign to this person immediately, at the moment their account is
// created, rather than only leaving them to discover the library later.
router.post('/users', async (req, res) => {
  const { fullName, email, password, roleName, department, assignedModuleIds, reassignModuleIds } = req.body;

  if (!fullName || !email || !password || !roleName) {
    return res.status(400).json({ error: 'fullName, email, password and roleName are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Unknown role.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const inserted = await query(
      `INSERT INTO users (role_id, full_name, email, password_hash, department, status, must_change_password)
       VALUES ($1, $2, $3, $4, $5, 'active', TRUE)
       RETURNING user_id, full_name, email, department, status`,
      [roleResult.rows[0].role_id, fullName, email, passwordHash, department || null]
    );

    const newUserId = inserted.rows[0].user_id;

    // If creating a Trainer, an Administrator can hand them ownership of
    // existing modules right away — they can immediately edit content,
    // build the quiz, and build the hazard puzzle for those modules.
    let reassignedCount = 0;
    if (roleName === 'trainer' && Array.isArray(reassignModuleIds) && reassignModuleIds.length > 0) {
      for (const moduleId of reassignModuleIds) {
        const result = await query(
          'UPDATE training_modules SET trainer_id = $1 WHERE module_id = $2',
          [newUserId, moduleId]
        );
        reassignedCount += result.rowCount;
      }
    }

    if (Array.isArray(assignedModuleIds) && assignedModuleIds.length > 0) {
      for (const moduleId of assignedModuleIds) {
        await query(
          `INSERT INTO module_assignments (module_id, user_id, assigned_by)
           VALUES ($1, $2, $3) ON CONFLICT (module_id, user_id) DO NOTHING`,
          [moduleId, newUserId, req.user.userId]
        );
      }
    }

    res.status(201).json({
      ...inserted.rows[0],
      roleName,
      assignedModuleCount: Array.isArray(assignedModuleIds) ? assignedModuleIds.length : 0,
      reassignedModuleCount: reassignedCount,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already in use.' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Something went wrong creating the user.' });
  }
});

// PATCH /api/admin/users/:id — change role, status, or department
router.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { roleName, status, department } = req.body;

  try {
    if (roleName) {
      const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
      if (roleResult.rows.length === 0) return res.status(400).json({ error: 'Unknown role.' });
      await query('UPDATE users SET role_id = $1 WHERE user_id = $2', [roleResult.rows[0].role_id, id]);
    }
    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'status must be active or inactive.' });
      }
      await query('UPDATE users SET status = $1 WHERE user_id = $2', [status, id]);
    }
    if (department !== undefined) {
      await query('UPDATE users SET department = $1 WHERE user_id = $2', [department, id]);
    }
    res.json({ message: 'User updated.' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Something went wrong updating the user.' });
  }
});

// POST /api/admin/users/:id/reset-password
// Issues a brand-new one-time temporary password for a single account.
// The old password stops working immediately, and the account is flagged
// to force a password change on next login — exactly like a new account.
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await query('SELECT user_id, full_name, email FROM users WHERE user_id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    await query(
      'UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE user_id = $2',
      [passwordHash, id]
    );

    res.json({
      userId: existing.rows[0].user_id,
      fullName: existing.rows[0].full_name,
      email: existing.rows[0].email,
      temporaryPassword: tempPassword,
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong resetting the password.' });
  }
});

// POST /api/admin/users/reset-all-passwords
// Issues a fresh one-time temporary password for every active account
// except the Administrator making the request (so they can't accidentally
// lock themselves out). Returns the full list so the admin can distribute
// them — this is a bulk, deliberate action and should be used carefully.
router.post('/reset-all-passwords', async (req, res) => {
  try {
    const users = await query(
      `SELECT user_id, full_name, email FROM users WHERE status = 'active' AND user_id != $1`,
      [req.user.userId]
    );

    const results = [];
    for (const u of users.rows) {
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
      await query(
        'UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE user_id = $2',
        [passwordHash, u.user_id]
      );
      results.push({ userId: u.user_id, fullName: u.full_name, email: u.email, temporaryPassword: tempPassword });
    }

    res.json({ message: `${results.length} account(s) reset.`, results });
  } catch (err) {
    console.error('Reset all passwords error:', err);
    res.status(500).json({ error: 'Something went wrong resetting passwords.' });
  }
});

module.exports = router;