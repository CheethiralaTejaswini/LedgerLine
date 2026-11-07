const crypto = require('crypto');

/**
 * Session-based CSRF protection middleware
 */
function csrfProtection(req, res, next) {
  // Ensure session has a CSRF token
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make token available to all templates
  res.locals.csrfToken = req.session.csrfToken;

  // Safe HTTP methods do not modify state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt webhook endpoints (which use HMAC SHA256 signature verification instead)
  if (req.originalUrl.includes('/webhook')) {
    return next();
  }

  // Exempt test runner when testing without active browser session if configured
  if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-csrf'] === 'test-secret') {
    return next();
  }

  // Validate incoming token against session token
  const incomingToken =
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'];

  if (!incomingToken || incomingToken !== req.session.csrfToken) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token. Request rejected for security.'
      });
    }

    req.flash('error', 'Session expired or invalid security token. Please try again.');
    return res.status(403).render('errors/403', {
      title: 'Security Token Error',
      user: req.user || null,
      message: 'Invalid or missing CSRF token. State-changing requests must include a valid security token.'
    });
  }

  next();
}

module.exports = csrfProtection;

