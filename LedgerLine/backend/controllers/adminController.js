const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const { formatPaiseToINR } = require('../utils/currencyHelper');

class AdminController {
  static async renderDashboard(req, res, next) {
    try {
      const [
        totalUsers,
        totalAccounts,
        totalTransactions,
        suspiciousRefusedCount,
        balanceAggregation,
        recentTransactions,
        recentRefusedEntries
      ] = await Promise.all([
        User.countDocuments(),
        Account.countDocuments(),
        Transaction.countDocuments(),
        LedgerEntry.countDocuments({ status: 'REFUSED' }),
        Account.aggregate([
          { $match: { status: 'ACTIVE' } },
          { $group: { _id: null, totalBalance: { $sum: '$balance' } } }
        ]),
        Transaction.find()
          .populate('initiatedBy', 'username fullName')
          .sort({ createdAt: -1 })
          .limit(6)
          .lean(),
        LedgerEntry.find({ status: 'REFUSED' })
          .populate('initiatedBy', 'username fullName')
          .sort({ timestamp: -1 })
          .limit(6)
          .lean()
      ]);

      const totalActiveBalance = balanceAggregation[0] ? balanceAggregation[0].totalBalance : 0;

      res.render('admin/dashboard', {
        title: 'Admin Control Center - LedgerLine',
        user: req.user,
        stats: {
          totalUsers,
          totalAccounts,
          totalTransactions,
          suspiciousRefusedCount,
          formattedActiveBalance: formatPaiseToINR(totalActiveBalance)
        },
        recentTransactions: recentTransactions.map(t => ({
          ...t,
          formattedAmount: formatPaiseToINR(t.amount)
        })),
        recentRefusedEntries
      });
    } catch (error) {
      next(error);
    }
  }

  static async renderUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments()
      ]);

      res.render('admin/users', {
        title: 'User Management - LedgerLine',
        user: req.user,
        users,
        total,
        page,
        pages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req, res, next) {
    try {
      const { userId } = req.params;
      const { status, role } = req.body;

      const updateData = {};
      if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) {
        updateData.status = status;
      }
      if (role && ['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR'].includes(role)) {
        updateData.role = role;
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
      if (!updatedUser) {
        throw new Error('User not found');
      }

      req.flash('success', `User ${updatedUser.username} updated successfully.`);
      res.redirect('/admin/users');
    } catch (error) {
      req.flash('error', error.message);
      res.redirect('/admin/users');
    }
  }

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

      res.render('admin/accounts', {
        title: 'Account Oversight - LedgerLine',
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

  static async updateAccountStatus(req, res, next) {
    try {
      const { accountId } = req.params;
      const { status } = req.body;

      await AccountService.updateAccountStatus(accountId, status);
      req.flash('success', `Account status updated to ${status}.`);
      res.redirect('/admin/accounts');
    } catch (error) {
      req.flash('error', error.message);
      res.redirect('/admin/accounts');
    }
  }

  static async renderTransactions(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const { type, status, search } = req.query;

      const transactionsResult = await TransactionService.getAllTransactions({
        page,
        limit: 25,
        type,
        status,
        search
      });

      res.render('admin/transactions', {
        title: 'Global Transactions - LedgerLine',
        user: req.user,
        transactions: transactionsResult.transactions,
        total: transactionsResult.total,
        page: transactionsResult.page,
        pages: transactionsResult.pages,
        type: type || '',
        status: status || '',
        search: search || ''
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;

