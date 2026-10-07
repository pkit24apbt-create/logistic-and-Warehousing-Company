const express = require('express');
const { query } = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Every signed-in user can read and clear their own notifications.
router.use(verifyToken);

// GET /api/notifications/mine — newest 20, plus how many are unread
router.get('/mine', async (req, res) => {
  try {
    const list = await query(
      `SELECT notification_id, module_id, kind, title, message, created_at, read_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, notification_id DESC
       LIMIT 20`,
      [req.user.userId]
    );
    const unread = await query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [req.user.userId]
    );
    res.json({
      unreadCount: Number(unread.rows[0].count),
      notifications: list.rows,
    });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Something went wrong loading notifications.' });
  }
});

// POST /api/notifications/mine/read-all
router.post('/mine/read-all', async (req, res) => {
  try {
    await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [req.user.userId]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Read all notifications error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// POST /api/notifications/mine/:id/read
router.post('/mine/:id/read', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid notification id.' });
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE notification_id = $1 AND user_id = $2 AND read_at IS NULL',
      [id, req.user.userId]
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Read notification error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;