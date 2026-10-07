require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimitModule = require('express-rate-limit');
const rateLimit = rateLimitModule.rateLimit || rateLimitModule;

require('./config/db');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const quizRoutes = require('./routes/quizRoutes');
const hazardRoutes = require('./routes/hazardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const tourRoutes = require('./routes/tourRoutes');
const managementRoutes = require('./routes/managementRoutes');

const app = express();

// Standard security headers (this server only sends JSON, so they never get in the way).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Slows down password guessing: 20 failed sign-ins per 15 minutes per address.
// Successful sign-ins are not counted, so normal use is never affected.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed sign-in attempts. Please wait 15 minutes and try again.' },
});
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/hazard', hazardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tour', tourRoutes);
app.use('/api/management', managementRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'safestack-backend' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SafeStack backend running on http://localhost:${PORT}`));