const LedgerService = require('../services/ledgerService');
const AccountService = require('../services/accountService');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const Account = require('../models/Account');
const { formatPaiseToINR } = require('../utils/currencyHelper');

class LedgerController {
  /**
   * Auditor Dashboard: Provides read-only analytical insight and audit integrity verification.
   */
  static async renderDashboard(req, res, next) {
    try {
      const [
        totalAccounts,
        totalTransactions,
        totalLedgerEntries,
        refusedAttemptsCount,
        recentLedgerEntries,
        balanceAggregation
      ] = await Promise.all([
        Account.countDocuments(),
        Transaction.countDocuments(),
        LedgerEntry.countDocuments(),
        LedgerEntry.countDocuments({ status: 'REFUSED' }),
        LedgerEntry.find()
          .populate('initiatedBy', 'username fullName')
          .sort({ timestamp: -1 })
          .limit(10)
          .lean(),
        Account.aggregate([
          { $match: { status: 'ACTIVE' } },
          { $group: { _id: null, totalBalance: { $sum: '$balance' } } }
        ])
      ]);

      const totalActiveBalance = balanceAggregation[0] ? balanceAggregation[0].totalBalance : 0;

      res.render('auditor/dashboard', {
        title: 'Auditor Dashboard - LedgerLine',
        user: req.user,
        stats: {
          totalAccounts,
          totalTransactions,
          totalLedgerEntries,
          refusedAttemptsCount,
          totalActiveBalancePaise: totalActiveBalance,
          formattedActiveBalance: formatPaiseToINR(totalActiveBalance)
        },
        recentEntries: recentLedgerEntries
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Auditor Read-Only Accounts View
   */
  static async renderAccounts(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const { status, type, search } = req.query;

      const accountsResult = await AccountService.getAllAccounts({
        page,
        limit: 20,
        status,
        type,
        search
      });

      res.render('auditor/accounts', {
        title: 'Audit Accounts - LedgerLine',
        user: req.user,
        accounts: accountsResult.accounts,
        total: accountsResult.total,
        page: accountsResult.page,
        pages: accountsResult.pages,
        status: status || '',
        type: type || '',
        search: search || ''
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Auditor Append-Only Ledger Trail
   */
  static async renderLedger(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const { type, status, startDate, endDate } = req.query;

      const ledgerResult = await LedgerService.getAllEntries({
        page,
        limit: 30,
        type,
        status,
        startDate,
        endDate
      });

      res.render('auditor/ledger', {
        title: 'Append-Only Audit Ledger - LedgerLine',
        user: req.user,
        entries: ledgerResult.entries,
        total: ledgerResult.total,
        page: ledgerResult.page,
        pages: ledgerResult.pages,
        type: type || '',
        status: status || '',
        startDate: startDate || '',
        endDate: endDate || ''
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cryptographic Reconciliation Audit API
   */
  static async runReconciliation(req, res, next) {
    try {
      const report = await LedgerService.reconcileSystem();
      return res.status(200).json({
        success: true,
        report
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = LedgerController;

