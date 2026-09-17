const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/training — Employees see published modules; Trainer sees their own; Supervisor/Admin see all
router.get('/', verifyToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    let result;
    if (role === 'trainer') {
      result = await query('SELECT * FROM training_modules WHERE trainer_id = $1 ORDER BY created_at DESC', [userId]);
    } else if (role === 'administrator' || role === 'supervisor') {
      result = await query(
        `SELECT m.*, u.full_name AS owner_name
         FROM training_modules m
         LEFT JOIN users u ON m.trainer_id = u.user_id
         ORDER BY m.created_at DESC`
      );
    } else {
      result = await query(
        `SELECT m.*, TRUE AS assigned
         FROM training_modules m
         JOIN module_assignments a ON a.module_id = m.module_id AND a.user_id = $1
         WHERE m.status = 'published'
         ORDER BY m.created_at DESC`,
        [userId]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('List modules error:', err);
    res.status(500).json({ error: 'Something went wrong loading training modules.' });
  }
});

// GET /api/training/:id — module detail + attached quiz + hazard scene info
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const moduleResult = await query(
      `SELECT m.*, u.full_name AS owner_name,
              EXISTS(SELECT 1 FROM module_assignments a WHERE a.module_id = m.module_id AND a.user_id = $2) AS assigned
       FROM training_modules m
       LEFT JOIN users u ON m.trainer_id = u.user_id WHERE m.module_id = $1`,
      [id, req.user.userId]
    );
    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Module not found.' });
    }

    if (req.user.role === 'employee' && !moduleResult.rows[0].assigned) {
      return res.status(403).json({ error: 'This module has not been assigned to you. Contact your administrator or trainer.' });
    }

    let progress = null;
    if (req.user.role === 'employee') {
      await query(
        `INSERT INTO module_progress (user_id, module_id, status, percent_complete)
         VALUES ($1, $2, 'in_progress', 0)
         ON CONFLICT (user_id, module_id) DO NOTHING`,
        [req.user.userId, id]
      );
      const progressResult = await query(
        'SELECT * FROM module_progress WHERE user_id = $1 AND module_id = $2',
        [req.user.userId, id]
      );
      progress = progressResult.rows[0] || null;
    }

    const quizResult = await query('SELECT quiz_id, passing_score, time_limit_sec FROM quizzes WHERE module_id = $1', [id]);
    const hazardResult = await query('SELECT scene_id, title FROM hazard_scenes WHERE module_id = $1', [id]);

    res.json({
      ...moduleResult.rows[0],
      quiz: quizResult.rows[0] || null,
      hazardScene: hazardResult.rows[0] || null,
      progress,
    });
  } catch (err) {
    console.error('Get module error:', err);
    res.status(500).json({ error: 'Something went wrong loading this module.' });
  }
});

// POST /api/training — Administrator-only: creates a module (also creates
// an empty quiz shell). Trainers no longer create modules themselves —
// they receive ownership of Admin-created modules and build the quiz and
// hazard puzzle for them, but don't author the training content itself.
router.post('/', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const { title, topic, contentType, contentBody, mediaUrl, isMandatory, trainerId } = req.body;
    if (!title || !contentBody) {
      return res.status(400).json({ error: 'title and contentBody are required.' });
    }

    let ownerId = req.user.userId;
    if (trainerId) {
      const trainerCheck = await query(
        `SELECT u.user_id FROM users u JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = $1 AND r.role_name = 'trainer' AND u.status = 'active'`,
        [trainerId]
      );
      if (trainerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'That trainer account was not found or is not active.' });
      }
      ownerId = trainerId;
    }

    const inserted = await query(
      `INSERT INTO training_modules (title, topic, content_type, content_body, media_url, is_mandatory, status, trainer_id)
       VALUES ($1,$2,$3,$4,$5,$6,'draft',$7) RETURNING *`,
      [title, topic || null, contentType || 'text', contentBody, mediaUrl || null, isMandatory !== false, ownerId]
    );

    await query(
      `INSERT INTO quizzes (module_id, passing_score, time_limit_sec) VALUES ($1, 70, 600)`,
      [inserted.rows[0].module_id]
    );

    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    console.error('Create module error:', err);
    res.status(500).json({ error: 'Something went wrong creating the module.' });
  }
});

// PUT /api/training/:id — Administrator-only: edit module content.
// Trainers can no longer edit the training content itself — only the
// quiz and hazard puzzle for modules assigned to them (see quizRoutes.js
// and hazardRoutes.js), which still correctly enforce ownership.
router.put('/:id', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, topic, contentType, contentBody, mediaUrl, isMandatory } = req.body;
    const result = await query(
      `UPDATE training_modules SET title=$1, topic=$2, content_type=$3, content_body=$4, media_url=$5, is_mandatory=$6
       WHERE module_id = $7 RETURNING *`,
      [title, topic, contentType, contentBody, mediaUrl, isMandatory, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update module error:', err);
    res.status(500).json({ error: 'Something went wrong updating the module.' });
  }
});

// PATCH /api/training/:id/publish — publish / unpublish. Same ownership
// rule as editing: a Trainer can only publish their own assigned modules.
router.patch('/:id/publish', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'trainer') {
      const ownerCheck = await query('SELECT trainer_id FROM training_modules WHERE module_id = $1', [id]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
      if (ownerCheck.rows[0].trainer_id !== req.user.userId) {
        return res.status(403).json({ error: 'This module is not assigned to you.' });
      }
    }

    const { status } = req.body;
    if (!['published', 'unpublished'].includes(status)) {
      return res.status(400).json({ error: 'status must be published or unpublished.' });
    }
    const result = await query('UPDATE training_modules SET status = $1 WHERE module_id = $2 RETURNING *', [status, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Publish module error:', err);
    res.status(500).json({ error: 'Something went wrong updating publish status.' });
  }
});

// PATCH /api/training/:id/reassign — Admin-only: move an existing module to
// a different Trainer (e.g. a Trainer leaves, their content gets handed off).
router.patch('/:id/reassign', verifyToken, requireRole(['administrator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { trainerId } = req.body;
    if (!trainerId) {
      return res.status(400).json({ error: 'trainerId is required.' });
    }

    const trainerCheck = await query(
      `SELECT u.user_id FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1 AND r.role_name = 'trainer' AND u.status = 'active'`,
      [trainerId]
    );
    if (trainerCheck.rows.length === 0) {
      return res.status(400).json({ error: 'That trainer account was not found or is not active.' });
    }

    const result = await query(
      'UPDATE training_modules SET trainer_id = $1 WHERE module_id = $2 RETURNING *',
      [trainerId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Reassign module error:', err);
    res.status(500).json({ error: 'Something went wrong reassigning the module.' });
  }
});

// POST /api/training/:id/assign — Trainer/Admin assign an existing module
// to one or more employees (separate from the at-registration flow, for
// modules that already exist when the assignment need comes up). A
// Trainer may only assign out a module that's actually theirs.
router.post('/:id/assign', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array.' });
    }

    if (req.user.role === 'trainer') {
      const ownerCheck = await query('SELECT trainer_id FROM training_modules WHERE module_id = $1', [id]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
      if (ownerCheck.rows[0].trainer_id !== req.user.userId) {
        return res.status(403).json({ error: 'This module is not assigned to you.' });
      }
    }

    for (const userId of userIds) {
      await query(
        `INSERT INTO module_assignments (module_id, user_id, assigned_by)
         VALUES ($1, $2, $3) ON CONFLICT (module_id, user_id) DO NOTHING`,
        [id, userId, req.user.userId]
      );
    }

    res.json({ message: `Module assigned to ${userIds.length} user(s).` });
  } catch (err) {
    console.error('Assign module error:', err);
    res.status(500).json({ error: 'Something went wrong assigning the module.' });
  }
});

// POST /api/training/:id/mark-complete — Employee marks a text-only module
// (no quiz attached) as complete themselves, since there's no automatic
// scoring event to trigger completion for that kind of content.
router.post('/:id/mark-complete', verifyToken, requireRole(['employee']), async (req, res) => {
  try {
    const { id } = req.params;
    const quizCheck = await query('SELECT quiz_id FROM quizzes q WHERE q.module_id = $1', [id]);
    if (quizCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This module has a quiz — complete it by passing the quiz instead.' });
    }

    await query(
      `INSERT INTO module_progress (user_id, module_id, status, percent_complete, completed_at)
       VALUES ($1, $2, 'completed', 100, NOW())
       ON CONFLICT (user_id, module_id)
       DO UPDATE SET status = 'completed', percent_complete = 100, completed_at = NOW()`,
      [req.user.userId, id]
    );

    res.json({ message: 'Module marked as complete.' });
  } catch (err) {
    console.error('Mark complete error:', err);
    res.status(500).json({ error: 'Something went wrong marking this module complete.' });
  }
});

module.exports = router;