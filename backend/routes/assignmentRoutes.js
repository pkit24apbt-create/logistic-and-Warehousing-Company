const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Everything here is for Trainers (their own modules only) and Administrators.
router.use(verifyToken, requireRole(['trainer', 'administrator']));

// Loads the module and checks the caller may manage it.
// Returns the module row, or sends the error response and returns null.
async function loadManagedModule(req, res) {
  const moduleId = Number(req.params.id);
  if (!Number.isInteger(moduleId)) {
    res.status(400).json({ error: 'Invalid module id.' });
    return null;
  }
  const result = await query('SELECT module_id, title, trainer_id FROM training_modules WHERE module_id = $1', [moduleId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Module not found.' });
    return null;
  }
  const moduleRow = result.rows[0];
  if (req.user.role === 'trainer' && moduleRow.trainer_id !== req.user.userId) {
    res.status(403).json({ error: 'This module is not assigned to you.' });
    return null;
  }
  return moduleRow;
}

// GET /api/assignments/module/:id
// Every active employee, with whether they already have this module.
router.get('/module/:id', async (req, res) => {
  try {
    const moduleRow = await loadManagedModule(req, res);
    if (!moduleRow) return;

    const result = await query(
      `SELECT u.user_id, u.full_name, u.email, u.department,
              a.assigned_at,
              CASE WHEN a.assignment_id IS NULL THEN FALSE ELSE TRUE END AS assigned
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN module_assignments a ON a.user_id = u.user_id AND a.module_id = $1
       WHERE r.role_name = 'employee' AND u.status = 'active'
       ORDER BY u.full_name`,
      [moduleRow.module_id]
    );

    res.json({
      module: { module_id: moduleRow.module_id, title: moduleRow.title },
      employees: result.rows.map((row) => ({ ...row, assigned: Boolean(row.assigned) })),
    });
  } catch (err) {
    console.error('Load assignments error:', err);
    res.status(500).json({ error: 'Something went wrong loading employees.' });
  }
});

// POST /api/assignments/module/:id   body: { userIds: [1, 2, 3] }
router.post('/module/:id', async (req, res) => {
  try {
    const moduleRow = await loadManagedModule(req, res);
    if (!moduleRow) return;

    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Choose at least one employee.' });
    }
    const ids = [...new Set(userIds.map(Number))].filter(Number.isInteger);
    if (ids.length === 0) return res.status(400).json({ error: 'Choose at least one employee.' });

    let added = 0;
    for (const userId of ids) {
      // Only active employees can be given a module.
      const valid = await query(
        `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE u.user_id = $1 AND r.role_name = 'employee' AND u.status = 'active'`,
        [userId]
      );
      if (valid.rows.length === 0) continue;

      const existing = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [moduleRow.module_id, userId]
      );
      if (existing.rows.length > 0) continue;

      await query(
        'INSERT INTO module_assignments (module_id, user_id, assigned_by) VALUES ($1, $2, $3)',
        [moduleRow.module_id, userId, req.user.userId]
      );
      added += 1;
    }

    res.json({ message: added === 1 ? 'Module assigned to 1 employee.' : `Module assigned to ${added} employees.`, added });
  } catch (err) {
    console.error('Assign module error:', err);
    res.status(500).json({ error: 'Something went wrong assigning the module.' });
  }
});

// DELETE /api/assignments/module/:id/user/:userId
// Takes the module off an employee's list. Their past scores are kept.
router.delete('/module/:id/user/:userId', async (req, res) => {
  try {
    const moduleRow = await loadManagedModule(req, res);
    if (!moduleRow) return;

    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid employee id.' });

    await query('DELETE FROM module_assignments WHERE module_id = $1 AND user_id = $2', [moduleRow.module_id, userId]);
    res.json({ message: 'Module removed from this employee.' });
  } catch (err) {
    console.error('Unassign module error:', err);
    res.status(500).json({ error: 'Something went wrong removing the module.' });
  }
});

module.exports = router;