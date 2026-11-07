/**
 * Role-Based Access Control (RBAC) middleware
 * @param  {...string} roles Allowed roles (e.g., 'ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR')
 */
function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      req.flash('error', 'Please log in to continue.');
      return res.redirect('/auth/login');
    }

    if (!roles.includes(req.user.role)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to perform this action.'
        });
      }
      return res.status(403).render('errors/403', {
        title: 'Access Denied',
        user: req.user,
        message: 'You do not have permission to access this resource.'
      });
    }

    next();
  };
}

module.exports = authorizeRole;

