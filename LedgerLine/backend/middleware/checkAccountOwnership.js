const Account = require('../models/Account');

/**
 * Account ownership verification middleware
 * Ensures the currently logged-in user owns the specified account.
 * Admins can access all accounts; Auditors have read-only access where permitted.
 */
async function checkAccountOwnership(req, res, next) {
  try {
    const accountId = req.params.accountId || req.params.id || req.body.accountId || req.body.sourceAccountId || req.query.accountId;

    if (!accountId) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: 'Account identifier is required.' });
      }
      req.flash('error', 'Account identifier missing.');
      return res.redirect('/accounts');
    }

    const account = await Account.findById(accountId);
    if (!account) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'Account not found.' });
      }
      req.flash('error', 'Account not found.');
      return res.redirect('/accounts');
    }

    // Admins and Auditors have access based on route authorization
    if (req.user.role === 'ADMIN' || req.user.role === 'AUDITOR') {
      req.targetAccount = account;
      return next();
    }

    // Account Holder must be the owner
    if (account.userId.toString() !== req.user._id.toString()) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have ownership of this account.'
        });
      }
      return res.status(403).render('errors/403', {
        title: 'Access Denied',
        user: req.user,
        message: 'You are not authorized to view or manage this account.'
      });
    }

    req.targetAccount = account;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = checkAccountOwnership;

