const crypto = require('crypto');
const LedgerEntry = require('../models/LedgerEntry');

class LedgerService {
  /**
   * Generates a unique immutable reference string for a ledger entry.
   */
  static generateEntryReference() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ENT-${dateStr}-${rand}`;
  }

  /**
   * Records a strictly immutable financial movement in the ledger.
   */
  static async recordEntry(
    {
      transactionId,
      accountId,
      accountNumber,
      transactionType,
      debitAmount = 0,
      creditAmount = 0,
      balanceAfter,
      initiatedBy,
      status = 'POSTED',
      description = '',
      metadata = {}
    },
    session = null
  ) {
    const entryData = {
      entryReference: this.generateEntryReference(),
      transactionId,
      accountId,
      accountNumber,
      transactionType,
      debitAmount,
      creditAmount,
      balanceAfter,
      initiatedBy,
      status,
      description,
      metadata,
      timestamp: new Date()
    };

    const doc = new LedgerEntry(entryData);
    if (session) {
      await doc.save({ session });
    } else {
      await doc.save();
    }

    return doc;
  }

  /**
   * Records a refused or rejected transaction attempt for security auditing.
   */
  static async recordRefusedAttempt({
    transactionId,
    accountId,
    accountNumber,
    transactionType = 'REFUSED_ATTEMPT',
    currentBalance = 0,
    initiatedBy,
    reason,
    metadata = {}
  }) {
    try {
      const entryData = {
        entryReference: this.generateEntryReference(),
        transactionId,
        accountId,
        accountNumber,
        transactionType,
        debitAmount: 0,
        creditAmount: 0,
        balanceAfter: currentBalance,
        initiatedBy,
        status: 'REFUSED',
        description: `REFUSED ATTEMPT: ${reason}`,
        metadata: {
          ...metadata,
          refusalReason: reason
        },
        timestamp: new Date()
      };

      const doc = new LedgerEntry(entryData);
      return await doc.save();
    } catch (err) {
      console.error('[LedgerService] Failed to record refused attempt:', err.message);
      return null;
    }
  }

  /**
   * Fetch ledger history for a specific account.
   */
  static async getAccountLedger(accountId, { page = 1, limit = 20, startDate, endDate } = {}) {
    const query = { accountId };
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      LedgerEntry.find(query)
        .populate('initiatedBy', 'username fullName email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LedgerEntry.countDocuments(query)
    ]);

    return {
      entries,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Fetch system-wide ledger entries for Auditors and Admins.
   */
  static async getAllEntries({ page = 1, limit = 50, type, status, startDate, endDate } = {}) {
    const query = {};
    if (type) query.transactionType = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      LedgerEntry.find(query)
        .populate('initiatedBy', 'username fullName role email')
        .populate('accountId', 'accountNumber accountType')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LedgerEntry.countDocuments(query)
    ]);

    return {
      entries,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Cryptographic Financial Reconciliation for a single account.
   * Proves that current account balance strictly equals sum(credits) - sum(debits).
   */
  static async reconcileAccount(accountId) {
    const Account = require('../models/Account');
    const account = await Account.findById(accountId);
    if (!account) {
      throw new Error('Account not found for reconciliation.');
    }

    const aggregation = await LedgerEntry.aggregate([
      { $match: { accountId: account._id, status: 'POSTED' } },
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$creditAmount' },
          totalDebits: { $sum: '$debitAmount' },
          entryCount: { $sum: 1 }
        }
      }
    ]);

    const stats = aggregation[0] || { totalCredits: 0, totalDebits: 0, entryCount: 0 };
    const calculatedBalance = stats.totalCredits - stats.totalDebits;
    const isReconciled = account.balance === calculatedBalance;

    return {
      accountId: account._id,
      accountNumber: account.accountNumber,
      actualAccountBalance: account.balance,
      calculatedLedgerBalance: calculatedBalance,
      discrepancyPaise: account.balance - calculatedBalance,
      isReconciled,
      totalCredits: stats.totalCredits,
      totalDebits: stats.totalDebits,
      postedEntriesCount: stats.entryCount,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * System-Wide Financial Reconciliation across all accounts.
   * Verifies that all account balances match their respective ledger trails.
   */
  static async reconcileSystem() {
    const Account = require('../models/Account');
    const accounts = await Account.find({ status: { $ne: 'CLOSED' } });
    const results = [];
    let systemReconciled = true;

    for (const acc of accounts) {
      const rec = await this.reconcileAccount(acc._id);
      if (!rec.isReconciled) {
        systemReconciled = false;
      }
      results.push(rec);
    }

    return {
      systemReconciled,
      totalAccountsAudited: accounts.length,
      auditTimestamp: new Date().toISOString(),
      accountReconciliations: results
    };
  }
}

module.exports = LedgerService;

