const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');
const { toPaise } = require('../utils/currencyHelper');

class TransactionController {
  static async renderDeposit(req, res, next) {
    try {
      const accounts = await AccountService.getUserAccounts(req.user._id);
      const activeAccounts = accounts.filter(a => a.status === 'ACTIVE');
      const selectedAccountId = req.query.account || (activeAccounts[0] ? activeAccounts[0]._id : null);
      const idempotencyKey = generateIdempotencyKey();

      res.render('accountHolder/deposit', {
        title: 'Deposit Money - LedgerLine',
        user: req.user,
        accounts: activeAccounts,
        selectedAccountId,
        idempotencyKey
      });
    } catch (error) {
      next(error);
    }
  }

  static async deposit(req, res, next) {
    try {
      const { accountId, amount, idempotencyKey, description } = req.body;
      const amountPaise = toPaise(amount);

      const result = await TransactionService.deposit({
        accountId,
        amountPaise,
        userId: req.user._id,
        idempotencyKey,
        description: description || 'Cash/Card Deposit',
        metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
      });

      req.flash('success', result.message);

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(200).json(result);
      }

      res.redirect(`/accounts/${accountId}`);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(statusCode).json({ success: false, message: error.message });
      }
      req.flash('error', error.message);
      res.redirect(`/transactions/deposit${req.body.accountId ? '?account=' + req.body.accountId : ''}`);
    }
  }

  static async renderWithdraw(req, res, next) {
    try {
      const accounts = await AccountService.getUserAccounts(req.user._id);
      const activeAccounts = accounts.filter(a => a.status === 'ACTIVE');
      const selectedAccountId = req.query.account || (activeAccounts[0] ? activeAccounts[0]._id : null);
      const idempotencyKey = generateIdempotencyKey();

      res.render('accountHolder/withdraw', {
        title: 'Withdraw Money - LedgerLine',
        user: req.user,
        accounts: activeAccounts,
        selectedAccountId,
        idempotencyKey
      });
    } catch (error) {
      next(error);
    }
  }

  static async withdraw(req, res, next) {
    try {
      const { accountId, amount, idempotencyKey, description } = req.body;
      const amountPaise = toPaise(amount);

      const result = await TransactionService.withdraw({
        accountId,
        amountPaise,
        userId: req.user._id,
        idempotencyKey,
        description: description || 'Account Withdrawal',
        metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
      });

      req.flash('success', result.message);

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(200).json(result);
      }

      res.redirect(`/accounts/${accountId}`);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(statusCode).json({ success: false, message: error.message });
      }
      req.flash('error', error.message);
      res.redirect(`/transactions/withdraw${req.body.accountId ? '?account=' + req.body.accountId : ''}`);
    }
  }

  static async renderTransfer(req, res, next) {
    try {
      const accounts = await AccountService.getUserAccounts(req.user._id);
      const activeAccounts = accounts.filter(a => a.status === 'ACTIVE');
      const selectedSourceId = req.query.from || (activeAccounts[0] ? activeAccounts[0]._id : null);
      const idempotencyKey = generateIdempotencyKey();

      res.render('accountHolder/transfer', {
        title: 'Transfer Money - LedgerLine',
        user: req.user,
        accounts: activeAccounts,
        selectedSourceId,
        idempotencyKey
      });
    } catch (error) {
      next(error);
    }
  }

  static async transfer(req, res, next) {
    try {
      const { sourceAccountId, destinationAccountNumber, amount, idempotencyKey, description } = req.body;
      const amountPaise = toPaise(amount);

      const result = await TransactionService.transfer({
        sourceAccountId,
        destinationAccountNumber,
        amountPaise,
        userId: req.user._id,
        idempotencyKey,
        description: description || 'Account Transfer',
        metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
      });

      req.flash('success', result.message);

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(200).json(result);
      }

      res.redirect(`/accounts/${sourceAccountId}`);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(statusCode).json({ success: false, message: error.message });
      }
      req.flash('error', error.message);
      res.redirect(`/transactions/transfer${req.body.sourceAccountId ? '?from=' + req.body.sourceAccountId : ''}`);
    }
  }

  static async renderHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const { type, status } = req.query;

      const history = await TransactionService.getTransactions({
        userId: req.user._id,
        page,
        limit: 15,
        type,
        status
      });

      res.render('accountHolder/transactions', {
        title: 'Transaction History - LedgerLine',
        user: req.user,
        transactions: history.transactions,
        total: history.total,
        page: history.page,
        pages: history.pages,
        type: type || '',
        status: status || ''
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TransactionController;

