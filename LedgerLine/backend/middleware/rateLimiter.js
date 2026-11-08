const rateLimit = require('express-rate-limit');

// Strict rate limiter for authentication endpoints (prevent brute-force password cracking)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login or registration attempts from this IP. Please try again after 15 minutes.'
  },
  handler: (req, res, next, options) => {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(options.statusCode).json(options.message);
    }
    req.flash('error', 'Too many attempts. Please try again after 15 minutes.');
    res.redirect('/auth/login');
  }
});

// Sensitive financial transaction rate limiter (prevent automated rapid submission)
const transactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many financial operations initiated. Please wait a moment before trying again.'
  },
  handler: (req, res, next, options) => {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(options.statusCode).json(options.message);
    }
    req.flash('error', 'Too many requests. Please wait a moment before trying again.');
    res.redirect('back');
  }
});

// High-frequency API limiter for lookup & telemetry
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'API rate limit exceeded. Please throttle requests.'
  }
});

module.exports = {
  authLimiter,
  transactionLimiter,
  apiLimiter
};

