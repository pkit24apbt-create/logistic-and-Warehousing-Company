const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/employee', verifyToken, requireRole(['employee', 'administrator']), async (req, res) => {
  try {
    const { userId } = req.user;
    const [modules, completed] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS count FROM training_modules m
         JOIN module_assignments a ON a.module_id = m.module_id AND a.user_id = $1
         WHERE m.status = 'published'`,
        [userId]
      ),
      query(
        `SELECT COUNT(DISTINCT m.module_id)::int AS count
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.quiz_id
         JOIN training_modules m ON q.module_id = m.module_id
         WHERE qa.user_id = $1 AND qa.passed = TRUE`,
        [userId]
      ),
    ]);
    res.json({
      message: `Welcome, ${req.user.fullName}.`,
      role: req.user.role,
      widgets: { availableModules: modules.rows[0].count, completedModules: completed.rows[0].count },
    });
  } catch (err) {
    console.error('Employee dashboard error:', err);
    res.status(500).json({ error: 'Something went wrong loading your dashboard.' });
  }
});

router.get('/trainer', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { userId } = req.user;
    const [modules, attempts] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM training_modules WHERE trainer_id = $1`, [userId]),
      query(
        `SELECT COUNT(*)::int AS count FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.quiz_id
         JOIN training_modules m ON q.module_id = m.module_id
         WHERE m.trainer_id = $1`,
        [userId]
      ),
    ]);
    res.json({
      message: `Welcome, ${req.user.fullName}.`,
      role: req.user.role,
      widgets: { modulesCreated: modules.rows[0].count, quizAttemptsReceived: attempts.rows[0].count },
    });
  } catch (err) {
    console.error('Trainer dashboard error:', err);
    res.status(500).json({ error: 'Something went wrong loading your dashboard.' });
  }
});

router.get('/supervisor', verifyToken, requireRole(['supervisor', 'administrator']), (req, res) => {
  res.json({ message: `Welcome, ${req.user.fullName}.`, role: req.user.role, widgets: [] });
});

router.get('/admin', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const [users, modules, roles, breakdown] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM users`),
      query(`SELECT COUNT(*)::int AS count FROM training_modules`),
      query(`SELECT COUNT(*)::int AS count FROM roles`),
      query(
        `SELECT r.role_name, COUNT(u.user_id)::int AS count
         FROM roles r LEFT JOIN users u ON u.role_id = r.role_id
         GROUP BY r.role_name ORDER BY r.role_name`
      ),
    ]);
    res.json({
      message: `Welcome, ${req.user.fullName}.`,
      role: req.user.role,
      widgets: {
        totalUsers: users.rows[0].count,
        totalModules: modules.rows[0].count,
        totalRoles: roles.rows[0].count,
        roleBreakdown: breakdown.rows,
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Something went wrong loading your dashboard.' });
  }
});

module.exports = router;