const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 10;

router.post('/setup', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await query('SELECT COUNT(*)::int AS count FROM users');
    if (existing.rows[0].count > 0) {
      return res.status(403).json({ error: 'Setup has already been completed.' });
    }

    const roleResult = await query("SELECT role_id FROM roles WHERE role_name = 'administrator'");
    if (roleResult.rows.length === 0) {
      return res.status(400).json({
        error: "The 'administrator' role is missing. Run database/schema.sql first.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await query(
      `INSERT INTO users (role_id, full_name, email, password_hash, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [roleResult.rows[0].role_id, fullName, email, passwordHash]
    );

    res.status(201).json({ message: 'Administrator account created. You can now sign in.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already in use.' });
    }
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Something went wrong during setup.' });
  }
});

router.get('/setup-status', async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*)::int AS count FROM users');
    res.json({ setupNeeded: result.rows[0].count === 0 });
  } catch (err) {
    console.error('Setup status error:', err);
    res.status(500).json({ error: 'Something went wrong checking setup status.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await query(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.status, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account is not active. Contact an administrator.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role_name, fullName: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: { userId: user.user_id, fullName: user.full_name, email: user.email, role: user.role_name },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong logging in.' });
  }
});

router.post('/logout', verifyToken, (req, res) => {
  res.json({ message: 'Logged out.' });
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.full_name, u.email, u.department, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('/me error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;