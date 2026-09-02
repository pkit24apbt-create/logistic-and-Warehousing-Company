const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 10;

router.post('/register', async (req, res) => {
  const { fullName, email, password, roleName, department } = req.body;

  if (!fullName || !email || !password || !roleName) {
    return res.status(400).json({ error: 'fullName, email, password and roleName are required.' });
  }

  try {
    const roleResult = await query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ error: `Unknown role '${roleName}'.` });
    }
    const roleId = roleResult.rows[0].role_id;

    const existing = await query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const inserted = await query(
      `INSERT INTO users (role_id, full_name, email, password_hash, department, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING user_id, full_name, email, department, status`,
      [roleId, fullName, email, passwordHash, department || null]
    );

    res.status(201).json({ message: 'Account created.', user: inserted.rows[0] });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong creating the account.' });
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