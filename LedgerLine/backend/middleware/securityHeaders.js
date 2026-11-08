/**
 * Enterprise Security Headers Middleware
 * Protects LedgerLine against Clickjacking, MIME sniffing, XSS, and unauthorized framing.
 */
function securityHeaders(req, res, next) {
  // Prevent clickjacking by forbidding embedding inside any iframe/frame
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME-sniffing vulnerabilities
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection filter in legacy browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features (camera, microphone, geolocation)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Enforce HTTPS HSTS when in production or on reverse proxies
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove fingerprinting header
  res.removeHeader('X-Powered-By');

  next();
}

module.exports = securityHeaders;
