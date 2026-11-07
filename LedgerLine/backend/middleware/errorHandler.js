/**
 * Centralized Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[LedgerLine Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred.';

  // MongoDB / Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `Duplicate entry: A record with that ${field} already exists.`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join('. ');
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found or invalid identifier for ${err.path}.`;
  }

  // API or AJAX response
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(isDev ? { stack: err.stack } : {})
    });
  }

  // Browser response
  res.status(statusCode).render('errors/500', {
    title: `${statusCode} Error`,
    user: req.user || null,
    currUser: req.user || null,
    currentPath: req.path || '',
    statusCode,
    message,
    stack: isDev ? err.stack : null
  });
}

function notFoundHandler(req, res, next) {
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({
      success: false,
      message: `Endpoint ${req.method} ${req.originalUrl} not found.`
    });
  }

  res.status(404).render('errors/404', {
    title: 'Page Not Found',
    user: req.user || null,
    currUser: req.user || null,
    currentPath: req.path || '',
    url: req.originalUrl
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};

