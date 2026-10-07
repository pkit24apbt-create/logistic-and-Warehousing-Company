const jwt = require('jsonwebtoken');

// A user who signed in with a one-time (temporary) password may ONLY reach
// these three endpoints until they have set their own password.
const ALLOWED_WHILE_PASSWORD_CHANGE_PENDING = [
  '/api/auth/change-password',
  '/api/auth/me',
  '/api/auth/logout',
];

function verifyToken(req, res, next) {
  // Browsers send an OPTIONS "preflight" request before certain real
  // requests. Preflight requests never carry a token, so let them through.
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Token problems are 401 with code AUTH_REQUIRED: the website signs the
  // user out ONLY for this. Permission problems are 403 and just show a message.
  if (!token) {
    return res.status(401).json({ error: 'Access token is required.', code: 'AUTH_REQUIRED' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.', code: 'AUTH_REQUIRED' });
    }
    req.user = payload;

    if (payload.mustChangePassword) {
      const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
      if (!ALLOWED_WHILE_PASSWORD_CHANGE_PENDING.includes(path)) {
        return res.status(403).json({
          error: 'You must set your own password before using SafeStack.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
    }

    next();
  });
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };