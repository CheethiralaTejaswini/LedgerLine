/**
 * Authentication verification middleware
 */
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: You must be logged in to access this resource.'
    });
  }

  req.session.returnTo = req.originalUrl;
  req.flash('error', 'You must be logged in to access this page.');
  return res.redirect('/auth/login');
}

module.exports = isAuthenticated;

