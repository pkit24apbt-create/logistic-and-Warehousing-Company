const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// DELETE /api/admin/users/:id — permanently delete an account.
//
// Safe by design: an account can only be deleted while it has NO training
// history. Anyone with scores or certificates, or who owns training content,
// must be deactivated instead, so the training records stay complete.
router.delete('/users/:id', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Invalid user id.' });

    if (targetId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const found = await query(
      `SELECT u.user_id, u.full_name, u.status, r.role_name
       FROM users u JOIN roles r ON r.role_id = u.role_id
       WHERE u.user_id = $1`,
      [targetId]
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const target = found.rows[0];

    // Never remove the last active administrator.
    if (target.role_name === 'administrator' && target.status === 'active') {
      const admins = await query(
        `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'administrator' AND u.status = 'active' AND u.user_id <> $1`,
        [targetId]
      );
      if (Number(admins.rows[0].count) === 0) {
        return res.status(400).json({ error: 'You cannot delete the last active administrator.' });
      }
    }

    // Training history and ownership block a delete.
    const checks = [
      ['quiz results', 'SELECT COUNT(*) AS count FROM quiz_attempts WHERE user_id = $1'],
      ['puzzle results', 'SELECT COUNT(*) AS count FROM hazard_attempts WHERE user_id = $1'],
      ['certificates', 'SELECT COUNT(*) AS count FROM certificates WHERE user_id = $1'],
      ['training modules they own', 'SELECT COUNT(*) AS count FROM training_modules WHERE trainer_id = $1 OR created_by_id = $1'],
      ['puzzles they own', 'SELECT COUNT(*) AS count FROM hazard_scenes WHERE trainer_id = $1'],
    ];
    const reasons = [];
    for (const [label, sql] of checks) {
      const result = await query(sql, [targetId]);
      if (Number(result.rows[0].count) > 0) reasons.push(label);
    }
    if (reasons.length > 0) {
      return res.status(409).json({
        error: `${target.full_name} has ${reasons.join(', ')}, so the account cannot be deleted. Deactivate it instead to keep the training records.`,
      });
    }

    // Keep the assignment history of other people, just forget who assigned it.
    await query('UPDATE module_assignments SET assigned_by = NULL WHERE assigned_by = $1', [targetId]);

    try {
      await query('DELETE FROM users WHERE user_id = $1', [targetId]);
    } catch (err) {
      if (err.code === '23503') {
        return res.status(409).json({
          error: `${target.full_name} is still linked to other records, so the account cannot be deleted. Deactivate it instead.`,
        });
      }
      throw err;
    }

    res.json({ message: `${target.full_name}'s account was deleted.` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Something went wrong deleting the user.' });
  }
});

module.exports = router;