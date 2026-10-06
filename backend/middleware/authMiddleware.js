const jwt = require('jsonwebtoken');

// Problems with the login TOKEN (missing, invalid, expired) answer 401 with
// code AUTH_REQUIRED - the only case where the browser signs the user out.
// Being logged in but not ALLOWED to do something answers 403 with a message,
// which the browser shows instead of logging the user out.
function authRequired(res, message) {
  return res.status(401).json({ error: message, code: 'AUTH_REQUIRED' });
}

function verifyToken(req, res, next) {
  // Browsers send an OPTIONS "preflight" request before certain real
  // requests (like our POST/PATCH calls with an Authorization header).
  // Preflight requests never carry a token, so we must let them through
  // here - otherwise every protected route incorrectly rejects its own
  // preflight check, which the browser then reports as a CORS error even
  // though the real request would have worked fine.
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return authRequired(res, 'Access token is required.');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return authRequired(res, 'Your session has expired or is invalid. Please sign in again.');
    }
    req.user = payload;
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