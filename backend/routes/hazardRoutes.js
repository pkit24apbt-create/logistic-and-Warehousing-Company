const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { updateModuleCompletion } = require('../utils/moduleCompletion');

const router = express.Router();

// GET /api/hazard/module/:moduleId/scenes — lists every puzzle attached to
// a module (a module can now have more than one). Used to show a card per
// puzzle on the module page, instead of assuming there is only ever one.
router.get('/module/:moduleId/scenes', verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;

    if (req.user.role === 'employee') {
      const assignedCheck = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [moduleId, req.user.userId]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    }

    const result = await query(
      `SELECT hs.scene_id, hs.title,
              (SELECT COUNT(*) FROM hazard_hotspots hh WHERE hh.scene_id = hs.scene_id) AS hazard_count
       FROM hazard_scenes hs WHERE hs.module_id = $1 ORDER BY hs.scene_id`,
      [moduleId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List hazard scenes error:', err);
    res.status(500).json({ error: 'Something went wrong loading the hazard puzzles.' });
  }
});

// GET /api/hazard/scene/:sceneId/play — employee-facing: the image, the
// intro tips, and the hazard count, WITHOUT revealing hotspot locations.
router.get('/scene/:sceneId/play', verifyToken, async (req, res) => {
  try {
    const { sceneId } = req.params;
    const sceneResult = await query(
      `SELECT hs.scene_id, hs.title, hs.image_url, hs.intro_tips, hs.module_id,
              (SELECT COUNT(*) FROM hazard_hotspots hh WHERE hh.scene_id = hs.scene_id) AS hazard_count
       FROM hazard_scenes hs WHERE hs.scene_id = $1`,
      [sceneId]
    );
    if (sceneResult.rows.length === 0) return res.status(404).json({ error: 'Puzzle not found.' });
    const scene = sceneResult.rows[0];

    if (req.user.role === 'employee') {
      const assignedCheck = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [scene.module_id, req.user.userId]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    }

    res.json(scene);
  } catch (err) {
    console.error('Get hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong loading the hazard puzzle.' });
  }
});

// POST /api/hazard/scene/:sceneId/submit — server-side scoring: checks the
// employee's clicked points against the real hotspot locations, which are
// never sent to the browser until after this runs.
router.post('/scene/:sceneId/submit', verifyToken, requireRole(['employee']), async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { clicks } = req.body; // [{x, y}, ...] percentages
    const { userId } = req.user;

    const sceneResult = await query('SELECT module_id FROM hazard_scenes WHERE scene_id = $1', [sceneId]);
    if (sceneResult.rows.length === 0) return res.status(404).json({ error: 'Puzzle not found.' });
    const { module_id } = sceneResult.rows[0];

    const assignedCheck = await query(
      'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
      [module_id, userId]
    );
    if (assignedCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This module has not been assigned to you.' });
    }

    const hotspotsResult = await query(
      'SELECT hotspot_id, x_percent, y_percent, label, explanation FROM hazard_hotspots WHERE scene_id = $1',
      [sceneId]
    );
    const hotspots = hotspotsResult.rows;
    const TOLERANCE = 8; // percentage points of "close enough"

    const found = new Set();
    (clicks || []).forEach((click) => {
      hotspots.forEach((h) => {
        if (found.has(h.hotspot_id)) return;
        const dx = Number(h.x_percent) - click.x;
        const dy = Number(h.y_percent) - click.y;
        if (Math.sqrt(dx * dx + dy * dy) <= TOLERANCE) found.add(h.hotspot_id);
      });
    });

    const foundCount = found.size;
    const totalCount = hotspots.length;
    const score = totalCount > 0 ? Math.round((foundCount / totalCount) * 100) : 0;

    await query(
      'INSERT INTO hazard_attempts (scene_id, user_id, found_count, total_count, score) VALUES ($1,$2,$3,$4,$5)',
      [sceneId, userId, foundCount, totalCount, score]
    );

    // Recalculate overall module completion — checks BOTH every quiz
    // level AND every hazard puzzle together, not just this puzzle alone.
    const isModuleComplete = await updateModuleCompletion(userId, module_id);

    res.json({
      score,
      foundCount,
      totalCount,
      hotspots: hotspots.map((h) => ({ ...h, wasFound: found.has(h.hotspot_id) })),
      isModuleComplete,
    });
  } catch (err) {
    console.error('Submit hazard attempt error:', err);
    res.status(500).json({ error: 'Something went wrong submitting your attempt.' });
  }
});

// GET /api/hazard/scene/:sceneId/manage — trainer/admin: loads a specific
// scene's existing data for editing.
router.get('/scene/:sceneId/manage', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { sceneId } = req.params;
    const sceneResult = await query(
      `SELECT hs.*, m.trainer_id FROM hazard_scenes hs JOIN training_modules m ON hs.module_id = m.module_id
       WHERE hs.scene_id = $1`,
      [sceneId]
    );
    if (sceneResult.rows.length === 0) return res.status(404).json({ error: 'Puzzle not found.' });
    const scene = sceneResult.rows[0];

    if (req.user.role === 'trainer' && scene.trainer_id !== req.user.userId) {
      return res.status(403).json({ error: 'This module is not assigned to you.' });
    }

    const hotspotsResult = await query(
      'SELECT hotspot_id, x_percent AS x, y_percent AS y, label, explanation FROM hazard_hotspots WHERE scene_id = $1',
      [sceneId]
    );

    res.json({
      sceneId: scene.scene_id,
      title: scene.title,
      imageUrl: scene.image_url,
      introTips: scene.intro_tips,
      hotspots: hotspotsResult.rows,
    });
  } catch (err) {
    console.error('Manage hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong loading this puzzle.' });
  }
});

// POST /api/hazard/module/:moduleId/scenes — trainer/admin: creates a NEW
// additional puzzle for a module. Calling this again for the same module
// adds a second (or third) puzzle rather than replacing the first.
router.post('/module/:moduleId/scenes', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { title, imageUrl, introTips, hotspots } = req.body;

    if (req.user.role === 'trainer') {
      const ownerCheck = await query('SELECT trainer_id FROM training_modules WHERE module_id = $1', [moduleId]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
      if (ownerCheck.rows[0].trainer_id !== req.user.userId) {
        return res.status(403).json({ error: 'This module is not assigned to you.' });
      }
    }

    if (!title || !imageUrl || !Array.isArray(hotspots) || hotspots.length === 0) {
      return res.status(400).json({ error: 'title, imageUrl, and at least one hotspot are required.' });
    }

    const sceneResult = await query(
      'INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips) VALUES ($1,$2,$3,$4) RETURNING scene_id',
      [moduleId, title, imageUrl, introTips || null]
    );
    const sceneId = sceneResult.rows[0].scene_id;

    for (const h of hotspots) {
      await query(
        'INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation) VALUES ($1,$2,$3,$4,$5)',
        [sceneId, h.x, h.y, h.label, h.explanation || null]
      );
    }

    res.status(201).json({ sceneId, message: 'Puzzle created.' });
  } catch (err) {
    console.error('Create hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong creating the puzzle.' });
  }
});

// PUT /api/hazard/scene/:sceneId — trainer/admin: updates an existing
// puzzle's title, image, tips, and full hotspot set.
router.put('/scene/:sceneId', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { title, imageUrl, introTips, hotspots } = req.body;

    const ownerCheck = await query(
      `SELECT m.trainer_id FROM hazard_scenes hs JOIN training_modules m ON hs.module_id = m.module_id WHERE hs.scene_id = $1`,
      [sceneId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Puzzle not found.' });
    if (req.user.role === 'trainer' && ownerCheck.rows[0].trainer_id !== req.user.userId) {
      return res.status(403).json({ error: 'This module is not assigned to you.' });
    }

    if (!title || !imageUrl || !Array.isArray(hotspots) || hotspots.length === 0) {
      return res.status(400).json({ error: 'title, imageUrl, and at least one hotspot are required.' });
    }

    await query(
      'UPDATE hazard_scenes SET title = $1, image_url = $2, intro_tips = $3 WHERE scene_id = $4',
      [title, imageUrl, introTips || null, sceneId]
    );

    await query('DELETE FROM hazard_hotspots WHERE scene_id = $1', [sceneId]);
    for (const h of hotspots) {
      await query(
        'INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation) VALUES ($1,$2,$3,$4,$5)',
        [sceneId, h.x, h.y, h.label, h.explanation || null]
      );
    }

    res.json({ message: 'Puzzle updated.' });
  } catch (err) {
    console.error('Update hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong updating the puzzle.' });
  }
});

// DELETE /api/hazard/scene/:sceneId — trainer/admin: removes one puzzle,
// leaving any other puzzles on the same module untouched.
router.delete('/scene/:sceneId', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { sceneId } = req.params;
    const ownerCheck = await query(
      `SELECT m.trainer_id FROM hazard_scenes hs JOIN training_modules m ON hs.module_id = m.module_id WHERE hs.scene_id = $1`,
      [sceneId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Puzzle not found.' });
    if (req.user.role === 'trainer' && ownerCheck.rows[0].trainer_id !== req.user.userId) {
      return res.status(403).json({ error: 'This module is not assigned to you.' });
    }

    await query('DELETE FROM hazard_scenes WHERE scene_id = $1', [sceneId]);
    res.json({ message: 'Puzzle removed.' });
  } catch (err) {
    console.error('Delete hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong removing the puzzle.' });
  }
});

module.exports = router;