const express = require('express');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/employee', verifyToken, requireRole(['employee', 'administrator']), (req, res) => {
  res.json({ message: `Welcome, ${req.user.fullName}.`, role: req.user.role, widgets: [] });
});

router.get('/trainer', verifyToken, requireRole(['trainer', 'administrator']), (req, res) => {
  res.json({ message: `Welcome, ${req.user.fullName}.`, role: req.user.role, widgets: [] });
});

router.get('/supervisor', verifyToken, requireRole(['supervisor', 'administrator']), (req, res) => {
  res.json({ message: `Welcome, ${req.user.fullName}.`, role: req.user.role, widgets: [] });
});

router.get('/admin', verifyToken, requireRole(['administrator']), (req, res) => {
  res.json({ message: `Welcome, ${req.user.fullName}.`, role: req.user.role, widgets: [] });
});

module.exports = router;