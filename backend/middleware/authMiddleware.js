const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  // Browsers send an OPTIONS "preflight" request before certain real
  // requests (like our POST/PATCH calls with an Authorization header).
  // Preflight requests never carry a token, so we must let them through
  // here — otherwise every protected route incorrectly rejects its own
  // preflight check with 401, which the browser then reports as a CORS
  // error even though the real request would have worked fine.
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
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