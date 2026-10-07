const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// The 360 degree image shown in the Virtual Tour. It must be an equirectangular
// panorama (2:1). This is the original warehouse photo.
// To use the Blender render instead, change this to '/assets/photos/warehouse-360-blender.png'.
const TOUR_IMAGE_URL = '/assets/photos/warehouse-360-preview.png';

// GET /api/tour — the single shared warehouse tour, open to every
// logged-in role (Employee, Trainer, Supervisor, Administrator).
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM tour_hotspots ORDER BY sort_order');
    res.json({
      imageUrl: TOUR_IMAGE_URL,
      hotspots: result.rows.map((h) => ({
        id: h.hotspot_id,
        x: Number(h.x_percent),
        y: Number(h.y_percent),
        label: h.label,
        description: h.description,
      })),
    });
  } catch (err) {
    console.error('Get tour error:', err);
    res.status(500).json({ error: 'Something went wrong loading the tour.' });
  }
});

// PUT /api/tour/hotspots — Admin/Trainer replace the full hotspot set for
// the tour (kept simple: one global tour, not per-module).
router.put('/hotspots', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const { hotspots } = req.body;
    if (!Array.isArray(hotspots) || hotspots.length === 0) {
      return res.status(400).json({ error: 'hotspots must be a non-empty array.' });
    }

    await query('DELETE FROM tour_hotspots');
    for (let i = 0; i < hotspots.length; i++) {
      const h = hotspots[i];
      await query(
        'INSERT INTO tour_hotspots (x_percent, y_percent, label, description, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [h.x, h.y, h.label, h.description || null, i]
      );
    }

    res.json({ message: 'Tour updated.' });
  } catch (err) {
    console.error('Update tour error:', err);
    res.status(500).json({ error: 'Something went wrong updating the tour.' });
  }
});

module.exports = router;