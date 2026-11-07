const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');

class UserController {
  /**
   * Main dashboard gateway: routes user to their appropriate role-specific dashboard.
   */
  static async renderDashboard(req, res, next) {
    try {
      const { user } = req;

      if (user.role === 'ADMIN') {
        return res.redirect('/admin/dashboard');
      }

      if (user.role === 'AUDITOR') {
        return res.redirect('/auditor/dashboard');
      }

      // Default: ACCOUNT_HOLDER Dashboard
      const [accounts, summary, recentTransactions] = await Promise.all([
        AccountService.getUserAccounts(user._id),
        AccountService.getUserSummary(user._id),
        TransactionService.getTransactions({ userId: user._id, limit: 5 })
      ]);

      res.render('accountHolder/dashboard', {
        title: 'Account Holder Dashboard - LedgerLine',
        user,
        accounts,
        summary,
        recentTransactions: recentTransactions.transactions
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;

