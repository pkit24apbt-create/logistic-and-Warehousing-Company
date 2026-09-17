const express = require('express');
const { query, pool } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Distance threshold (in percent of image width/height) for a click to
// count as "finding" a hotspot. Forgiving enough for a rough click near
// the hazard, tight enough that clicking randomly everywhere won't work.
const HIT_RADIUS_PERCENT = 6;

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// GET /api/hazard/module/:moduleId
// Returns the scene image and total hazard count ONLY — never the actual
// hotspot coordinates or labels. That's what makes this a genuine puzzle
// rather than something you could solve by reading the network tab.
router.get('/module/:moduleId', verifyToken, async (req, res) => {
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

    const sceneResult = await query('SELECT * FROM hazard_scenes WHERE module_id = $1', [moduleId]);
    if (sceneResult.rows.length === 0) {
      return res.status(404).json({ error: 'No hazard scene attached to this module.' });
    }
    const scene = sceneResult.rows[0];

    const countResult = await query('SELECT COUNT(*)::int AS count FROM hazard_hotspots WHERE scene_id = $1', [scene.scene_id]);

    res.json({
      sceneId: scene.scene_id,
      title: scene.title,
      imageUrl: scene.image_url,
      totalHotspots: countResult.rows[0].count,
    });
  } catch (err) {
    console.error('Get hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong loading the hazard scene.' });
  }
});

// POST /api/hazard/:sceneId/submit
router.post('/:sceneId/submit', verifyToken, async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { clicks } = req.body;
    const { userId } = req.user;

    if (!Array.isArray(clicks)) {
      return res.status(400).json({ error: 'clicks must be an array of { x, y } points.' });
    }

    if (req.user.role === 'employee') {
      const sceneCheck = await query('SELECT module_id FROM hazard_scenes WHERE scene_id = $1', [sceneId]);
      if (sceneCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Hazard scene not found.' });
      }
      const assignedCheck = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [sceneCheck.rows[0].module_id, userId]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    }

    const hotspotsResult = await query('SELECT * FROM hazard_hotspots WHERE scene_id = $1', [sceneId]);
    const hotspots = hotspotsResult.rows;
    if (hotspots.length === 0) {
      return res.status(404).json({ error: 'This hazard scene has no hotspots configured.' });
    }

    const claimed = new Set();
    for (const click of clicks) {
      let bestMatch = null;
      let bestDistance = HIT_RADIUS_PERCENT;
      for (const h of hotspots) {
        if (claimed.has(h.hotspot_id)) continue;
        const d = distance(Number(click.x), Number(click.y), Number(h.x_percent), Number(h.y_percent));
        if (d <= bestDistance) {
          bestDistance = d;
          bestMatch = h;
        }
      }
      if (bestMatch) claimed.add(bestMatch.hotspot_id);
    }

    const foundCount = claimed.size;
    const totalCount = hotspots.length;
    const score = Math.round((foundCount / totalCount) * 100);

    await query(
      `INSERT INTO hazard_attempts (scene_id, user_id, found_count, total_count, score) VALUES ($1,$2,$3,$4,$5)`,
      [sceneId, userId, foundCount, totalCount, score]
    );

    res.json({
      foundCount,
      totalCount,
      score,
      hotspots: hotspots.map((h) => ({
        x: Number(h.x_percent),
        y: Number(h.y_percent),
        label: h.label,
        explanation: h.explanation,
        found: claimed.has(h.hotspot_id),
      })),
    });
  } catch (err) {
    console.error('Submit hazard attempt error:', err);
    res.status(500).json({ error: 'Something went wrong submitting your attempt.' });
  }
});

// POST /api/hazard/module/:moduleId — Trainer/Admin create or replace a
// scene and its hotspots for a module. A Trainer may only do this for a
// module actually assigned to them.
router.post('/module/:moduleId', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { moduleId } = req.params;

    if (req.user.role === 'trainer') {
      const ownerCheck = await query('SELECT trainer_id FROM training_modules WHERE module_id = $1', [moduleId]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
      if (ownerCheck.rows[0].trainer_id !== req.user.userId) {
        return res.status(403).json({ error: 'This module is not assigned to you.' });
      }
    }

    const { title, imageUrl, hotspots } = req.body;
    if (!title || !imageUrl || !Array.isArray(hotspots) || hotspots.length === 0) {
      return res.status(400).json({ error: 'title, imageUrl and at least one hotspot are required.' });
    }

    await client.query('BEGIN');

    const existing = await client.query('SELECT scene_id FROM hazard_scenes WHERE module_id = $1', [moduleId]);
    let sceneId;
    if (existing.rows.length > 0) {
      sceneId = existing.rows[0].scene_id;
      await client.query('UPDATE hazard_scenes SET title = $1, image_url = $2 WHERE scene_id = $3', [title, imageUrl, sceneId]);
      await client.query('DELETE FROM hazard_hotspots WHERE scene_id = $1', [sceneId]);
    } else {
      const inserted = await client.query(
        'INSERT INTO hazard_scenes (module_id, title, image_url, trainer_id) VALUES ($1,$2,$3,$4) RETURNING scene_id',
        [moduleId, title, imageUrl, req.user.userId]
      );
      sceneId = inserted.rows[0].scene_id;
    }

    for (const h of hotspots) {
      await client.query(
        'INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation) VALUES ($1,$2,$3,$4,$5)',
        [sceneId, h.x, h.y, h.label, h.explanation || null]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Hazard scene saved.', sceneId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong saving the hazard scene.' });
  } finally {
    client.release();
  }
});

// GET /api/hazard/module/:moduleId/manage — Trainer/Admin view of the full
// hazard scene INCLUDING hotspot positions, for building/editing. This is
// separate from the employee-facing GET above, which deliberately hides
// positions to keep the puzzle honest.
router.get('/module/:moduleId/manage', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { moduleId } = req.params;

    if (req.user.role === 'trainer') {
      const ownerCheck = await query('SELECT trainer_id FROM training_modules WHERE module_id = $1', [moduleId]);
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
      if (ownerCheck.rows[0].trainer_id !== req.user.userId) {
        return res.status(403).json({ error: 'This module is not assigned to you.' });
      }
    }

    const sceneResult = await query('SELECT * FROM hazard_scenes WHERE module_id = $1', [moduleId]);
    if (sceneResult.rows.length === 0) {
      return res.json({ exists: false, hotspots: [] });
    }
    const scene = sceneResult.rows[0];
    const hotspotsResult = await query('SELECT * FROM hazard_hotspots WHERE scene_id = $1 ORDER BY hotspot_id', [scene.scene_id]);

    res.json({
      exists: true,
      sceneId: scene.scene_id,
      title: scene.title,
      imageUrl: scene.image_url,
      hotspots: hotspotsResult.rows.map((h) => ({
        x: Number(h.x_percent),
        y: Number(h.y_percent),
        label: h.label,
        explanation: h.explanation,
      })),
    });
  } catch (err) {
    console.error('Get hazard scene for management error:', err);
    res.status(500).json({ error: 'Something went wrong loading the hazard scene.' });
  }
});

module.exports = router;