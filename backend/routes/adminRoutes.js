const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 10;

router.use(verifyToken, requireRole(['administrator']));

router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.full_name, u.email, u.department, u.status, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Something went wrong loading users.' });
  }
});

router.post('/users', async (req, res) => {
  const { fullName, email, password, roleName, department } = req.body;

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
      `INSERT INTO users (role_id, full_name, email, password_hash, department, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING user_id, full_name, email, department, status`,
      [roleResult.rows[0].role_id, fullName, email, passwordHash, department || null]
    );

    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already in use.' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Something went wrong creating the user.' });
  }
});

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

module.exports = router;