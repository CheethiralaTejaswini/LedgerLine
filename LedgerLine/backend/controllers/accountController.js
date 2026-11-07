const AccountService = require('../services/accountService');
const LedgerService = require('../services/ledgerService');
const TransactionService = require('../services/transactionService');
const { toPaise } = require('../utils/currencyHelper');

class AccountController {
  static renderCreateAccount(req, res) {
    res.render('accountHolder/createAccount', {
      title: 'Open New Account - LedgerLine',
      user: req.user
    });
  }

  static async createAccount(req, res, next) {
    try {
      const { accountType, initialDeposit } = req.body;
      const initialDepositPaise = initialDeposit ? toPaise(initialDeposit) : 0;

      const account = await AccountService.createAccount(
        req.user._id,
        accountType,
        initialDepositPaise
      );

      req.flash('success', `New ${accountType} account (${account.accountNumber}) opened successfully!`);

      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(201).json({ success: true, account });
      }

      res.redirect(`/accounts/${account._id}`);
    } catch (error) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      req.flash('error', error.message);
      res.redirect('/accounts/new');
    }
  }

  static async getAccountDetails(req, res, next) {
    try {
      const accountId = req.params.id;
      const account = await AccountService.getAccountById(accountId, req.user);
      const recentTransactions = await TransactionService.getTransactions({
        accountId,
        limit: 10
      });

      res.render('accountHolder/accountDetails', {
        title: `Account ${account.accountNumber} - LedgerLine`,
        user: req.user,
        account,
        transactions: recentTransactions.transactions
      });
    } catch (error) {
      next(error);
    }
  }

  static async renderStatement(req, res, next) {
    try {
      const accountId = req.params.id;
      const page = parseInt(req.query.page, 10) || 1;
      const { startDate, endDate } = req.query;

      const account = await AccountService.getAccountById(accountId, req.user);
      const ledgerResult = await LedgerService.getAccountLedger(accountId, {
        page,
        limit: 25,
        startDate,
        endDate
      });

      res.render('accountHolder/statement', {
        title: `Account Statement - ${account.accountNumber}`,
        user: req.user,
        account,
        entries: ledgerResult.entries,
        total: ledgerResult.total,
        page: ledgerResult.page,
        pages: ledgerResult.pages,
        startDate: startDate || '',
        endDate: endDate || ''
      });
    } catch (error) {
      next(error);
    }
  }

  static async lookupAccount(req, res, next) {
    try {
      const { accountNumber } = req.query;
      if (!accountNumber || accountNumber.trim().length < 8) {
        return res.status(400).json({ success: false, message: 'Invalid account number query' });
      }

      const account = await AccountService.getAccountByNumber(accountNumber.trim());
      if (!account) {
        return res.status(404).json({ success: false, message: 'Recipient account number does not exist' });
      }

      if (account.status !== 'ACTIVE') {
        return res.status(400).json({ success: false, message: `Recipient account is currently ${account.status}` });
      }

      return res.status(200).json({
        success: true,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        recipientName: account.userId ? account.userId.fullName : 'Account Holder'
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportStatementCSV(req, res, next) {
    try {
      const accountId = req.params.id;
      const account = await AccountService.getAccountById(accountId, req.user);
      const ledgerResult = await LedgerService.getAccountLedger(accountId, { limit: 10000 });

      let csv = 'Entry Reference,Timestamp,Transaction Type,Debit (Paise),Debit (INR),Credit (Paise),Credit (INR),Balance After (INR),Status,Description\n';

      for (const e of ledgerResult.entries) {
        const debitInr = (e.debitAmount / 100).toFixed(2);
        const creditInr = (e.creditAmount / 100).toFixed(2);
        const balanceInr = (e.balanceAfter / 100).toFixed(2);
        const dateStr = new Date(e.timestamp).toISOString();
        const safeDesc = `"${(e.description || '').replace(/"/g, '""')}"`;

        csv += `${e.entryReference},${dateStr},${e.transactionType},${e.debitAmount},${debitInr},${e.creditAmount},${creditInr},${balanceInr},${e.status},${safeDesc}\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="LedgerLine_Statement_${account.accountNumber}.csv"`);
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AccountController;

