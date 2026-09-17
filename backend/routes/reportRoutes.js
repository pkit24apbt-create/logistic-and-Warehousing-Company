const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/reports/compliance
// Per-employee compliance: how many mandatory published modules exist,
// how many that employee has passed, and their compliance percentage.
// Real, computed data — no invented numbers.
router.get('/compliance', verifyToken, requireRole(['supervisor', 'administrator']), async (req, res) => {
  try {
    const mandatoryCount = await query(
      `SELECT COUNT(*)::int AS count FROM training_modules WHERE status = 'published' AND is_mandatory = TRUE`
    );
    const total = mandatoryCount.rows[0].count;

    const employees = await query(
      `SELECT u.user_id, u.full_name, u.department FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = 'employee' AND u.status = 'active' ORDER BY u.full_name`
    );

    const rows = [];
    for (const emp of employees.rows) {
      const passed = await query(
        `SELECT COUNT(DISTINCT m.module_id)::int AS count
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.quiz_id
         JOIN training_modules m ON q.module_id = m.module_id
         WHERE qa.user_id = $1 AND qa.passed = TRUE
           AND m.status = 'published' AND m.is_mandatory = TRUE`,
        [emp.user_id]
      );
      const lastActivity = await query(
        `SELECT MAX(attempted_at) AS last_at FROM quiz_attempts WHERE user_id = $1`,
        [emp.user_id]
      );
      const completedCount = passed.rows[0].count;
      const compliance = total > 0 ? Math.round((completedCount / total) * 100) : 0;
      rows.push({
        userId: emp.user_id,
        fullName: emp.full_name,
        department: emp.department,
        completedCount,
        totalMandatory: total,
        compliancePercent: compliance,
        lastActivity: lastActivity.rows[0].last_at,
      });
    }

    res.json({ totalMandatory: total, employees: rows });
  } catch (err) {
    console.error('Compliance report error:', err);
    res.status(500).json({ error: 'Something went wrong generating the compliance report.' });
  }
});

// GET /api/reports/module-performance
// Per-module pass rate and average score across everyone who's attempted it.
router.get('/module-performance', verifyToken, requireRole(['supervisor', 'administrator']), async (req, res) => {
  try {
    const result = await query(
      `SELECT m.module_id, m.title,
              COUNT(qa.attempt_id)::int AS attempt_count,
              COALESCE(ROUND(AVG(qa.score)), 0)::int AS avg_score,
              COALESCE(ROUND(100.0 * SUM(CASE WHEN qa.passed THEN 1 ELSE 0 END) / NULLIF(COUNT(qa.attempt_id), 0)), 0)::int AS pass_rate
       FROM training_modules m
       LEFT JOIN quizzes q ON q.module_id = m.module_id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.quiz_id
       WHERE m.status = 'published'
       GROUP BY m.module_id, m.title
       ORDER BY m.title`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Module performance report error:', err);
    res.status(500).json({ error: 'Something went wrong generating the module performance report.' });
  }
});

module.exports = router;