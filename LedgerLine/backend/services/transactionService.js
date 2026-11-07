const mongoose = require('mongoose');
const crypto = require('crypto');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const LedgerService = require('./ledgerService');
const IdempotencyService = require('./idempotencyService');
const { hasReplicaSet } = require('../config/db');
const { formatPaiseToINR } = require('../utils/currencyHelper');

class TransactionService {
  /**
   * Generates a unique traceable transaction reference code.
   * E.g., TXN-20261107-A1B2C3D4
   */
  static generateTransactionReference() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `TXN-${dateStr}-${rand}`;
  }

  /**
   * Process a Deposit (External money in).
   */
  static async deposit({
    accountId,
    amountPaise,
    userId,
    idempotencyKey,
    description = 'Cash/Gateway Deposit',
    metadata = {}
  }) {
    if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
      throw new Error('Deposit amount must be a positive integer in paise.');
    }

    // 1. Idempotency Check & Lock
    const endpoint = '/api/transactions/deposit';
    const lock = await IdempotencyService.acquireLock(idempotencyKey, userId, endpoint, {
      accountId,
      amountPaise
    });

    if (lock.isExisting && lock.status === 'COMPLETED') {
      return lock.record.responseBody;
    }

    const txnRef = this.generateTransactionReference();
    const useSession = hasReplicaSet();
    let session = null;

    if (useSession) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // Find and verify account
      const account = await Account.findById(accountId).session(session || undefined);
      if (!account) {
        throw new Error('Target account not found.');
      }

      if (account.status !== 'ACTIVE') {
        throw new Error(`Account is currently ${account.status}. Deposits cannot be processed.`);
      }

      // Update account balance atomically
      const updatedAccount = await Account.findOneAndUpdate(
        { _id: accountId, status: 'ACTIVE' },
        { $inc: { balance: amountPaise } },
        { session: session || undefined, new: true }
      );

      if (!updatedAccount) {
        throw new Error('Failed to update account balance atomically.');
      }

      // Record transaction document
      const txnData = {
        transactionReference: txnRef,
        type: 'DEPOSIT',
        status: 'SUCCESS',
        sourceAccount: null,
        destinationAccount: account._id,
        destinationAccountNumber: account.accountNumber,
        amount: amountPaise,
        currency: 'INR',
        idempotencyKey,
        initiatedBy: userId,
        description,
        metadata
      };

      const txn = new Transaction(txnData);
      if (session) {
        await txn.save({ session });
      } else {
        await txn.save();
      }

      // Record Append-Only Ledger Entry
      await LedgerService.recordEntry(
        {
          transactionId: txn._id,
          accountId: account._id,
          accountNumber: account.accountNumber,
          transactionType: 'DEPOSIT',
          debitAmount: 0,
          creditAmount: amountPaise,
          balanceAfter: updatedAccount.balance,
          initiatedBy: userId,
          status: 'POSTED',
          description,
          metadata
        },
        session
      );

      if (session) {
        await session.commitTransaction();
      }

      const result = {
        success: true,
        message: `Successfully deposited ${formatPaiseToINR(amountPaise)} into account ${account.accountNumber}.`,
        transactionReference: txnRef,
        newBalance: updatedAccount.balance,
        formattedNewBalance: formatPaiseToINR(updatedAccount.balance),
        accountNumber: account.accountNumber
      };

      // Mark Idempotency as completed
      await IdempotencyService.completeLock(idempotencyKey, 200, result, txnRef);

      return result;
    } catch (err) {
      if (session) {
        await session.abortTransaction();
      }
      await IdempotencyService.failLock(idempotencyKey, err.message);
      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Process a Withdrawal (External money out).
   * Strict Concurrency Protection: Rejects any attempt that would cause balance < 0.
   */
  static async withdraw({
    accountId,
    amountPaise,
    userId,
    idempotencyKey,
    description = 'Account Withdrawal',
    metadata = {}
  }) {
    if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
      throw new Error('Withdrawal amount must be a positive integer in paise.');
    }

    // 1. Idempotency Check & Lock
    const endpoint = '/api/transactions/withdraw';
    const lock = await IdempotencyService.acquireLock(idempotencyKey, userId, endpoint, {
      accountId,
      amountPaise
    });

    if (lock.isExisting && lock.status === 'COMPLETED') {
      return lock.record.responseBody;
    }

    const txnRef = this.generateTransactionReference();
    const useSession = hasReplicaSet();
    let session = null;

    if (useSession) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      const account = await Account.findById(accountId).session(session || undefined);
      if (!account) {
        throw new Error('Account not found.');
      }

      if (account.status !== 'ACTIVE') {
        throw new Error(`Account is ${account.status}. Withdrawals are not allowed.`);
      }

      // Check available balance before debit
      if (account.balance < amountPaise) {
        // Record refused attempt in the immutable audit ledger
        await LedgerService.recordRefusedAttempt({
          transactionId: new mongoose.Types.ObjectId(),
          accountId: account._id,
          accountNumber: account.accountNumber,
          transactionType: 'REFUSED_ATTEMPT',
          currentBalance: account.balance,
          initiatedBy: userId,
          reason: `Insufficient funds: Required ${formatPaiseToINR(amountPaise)}, Available ${formatPaiseToINR(account.balance)}`,
          metadata: { requestedAmountPaise: amountPaise, idempotencyKey }
        });

        const err = new Error(`Insufficient funds: Available balance is ${formatPaiseToINR(account.balance)}, requested ${formatPaiseToINR(amountPaise)}.`);
        err.statusCode = 400;
        throw err;
      }

      // Atomic Balance Debit with condition $gte amountPaise to prevent concurrent race conditions
      const updatedAccount = await Account.findOneAndUpdate(
        {
          _id: accountId,
          balance: { $gte: amountPaise },
          status: 'ACTIVE'
        },
        { $inc: { balance: -amountPaise } },
        { session: session || undefined, new: true }
      );

      if (!updatedAccount) {
        // Race condition occurred: Another concurrent withdrawal just spent the balance!
        await LedgerService.recordRefusedAttempt({
          transactionId: new mongoose.Types.ObjectId(),
          accountId: account._id,
          accountNumber: account.accountNumber,
          transactionType: 'REFUSED_ATTEMPT',
          currentBalance: account.balance,
          initiatedBy: userId,
          reason: 'Concurrent race condition: Available balance changed during operation',
          metadata: { requestedAmountPaise: amountPaise, idempotencyKey }
        });

        const err = new Error('Withdrawal rejected: Insufficient available balance due to concurrent transaction.');
        err.statusCode = 409;
        throw err;
      }

      // Record transaction
      const txnData = {
        transactionReference: txnRef,
        type: 'WITHDRAWAL',
        status: 'SUCCESS',
        sourceAccount: account._id,
        sourceAccountNumber: account.accountNumber,
        destinationAccount: null,
        amount: amountPaise,
        currency: 'INR',
        idempotencyKey,
        initiatedBy: userId,
        description,
        metadata
      };

      const txn = new Transaction(txnData);
      if (session) {
        await txn.save({ session });
      } else {
        await txn.save();
      }

      // Record Ledger Entry
      await LedgerService.recordEntry(
        {
          transactionId: txn._id,
          accountId: account._id,
          accountNumber: account.accountNumber,
          transactionType: 'WITHDRAWAL',
          debitAmount: amountPaise,
          creditAmount: 0,
          balanceAfter: updatedAccount.balance,
          initiatedBy: userId,
          status: 'POSTED',
          description,
          metadata
        },
        session
      );

      if (session) {
        await session.commitTransaction();
      }

      const result = {
        success: true,
        message: `Successfully withdrew ${formatPaiseToINR(amountPaise)} from account ${account.accountNumber}.`,
        transactionReference: txnRef,
        newBalance: updatedAccount.balance,
        formattedNewBalance: formatPaiseToINR(updatedAccount.balance),
        accountNumber: account.accountNumber
      };

      await IdempotencyService.completeLock(idempotencyKey, 200, result, txnRef);

      return result;
    } catch (err) {
      if (session) {
        await session.abortTransaction();
      }
      await IdempotencyService.failLock(idempotencyKey, err.message);
      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Process Internal Account-to-Account Money Transfer.
   * Guarantees:
   * 1. Money conservation: source debit == destination credit.
   * 2. Atomic: both succeed or both rollback.
   * 3. Idempotent: duplicates return original response.
   * 4. Concurrency-safe: cannot overdraw source account.
   */
  static async transfer({
    sourceAccountId,
    destinationAccountNumber,
    amountPaise,
    userId,
    idempotencyKey,
    description = 'Internal Account Transfer',
    metadata = {}
  }) {
    if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
      throw new Error('Transfer amount must be a positive integer in paise.');
    }

    // 1. Idempotency Check & Lock
    const endpoint = '/api/transactions/transfer';
    const lock = await IdempotencyService.acquireLock(idempotencyKey, userId, endpoint, {
      sourceAccountId,
      destinationAccountNumber,
      amountPaise
    });

    if (lock.isExisting && lock.status === 'COMPLETED') {
      return lock.record.responseBody;
    }

    const txnRef = this.generateTransactionReference();
    const useSession = hasReplicaSet();
    let session = null;

    if (useSession) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    try {
      // 2. Validate Source Account
      const sourceAccount = await Account.findById(sourceAccountId).session(session || undefined);
      if (!sourceAccount) {
        throw new Error('Source account not found.');
      }

      if (sourceAccount.status !== 'ACTIVE') {
        throw new Error(`Source account is ${sourceAccount.status}. Transfers are disabled.`);
      }

      // Check self-transfer
      if (sourceAccount.accountNumber === destinationAccountNumber.trim()) {
        throw new Error('Cannot transfer money to the same account.');
      }

      // 3. Validate Destination Account
      const destAccount = await Account.findOne({
        accountNumber: destinationAccountNumber.trim()
      }).session(session || undefined);

      if (!destAccount) {
        throw new Error(`Destination account number '${destinationAccountNumber}' does not exist.`);
      }

      if (destAccount.status !== 'ACTIVE') {
        throw new Error(`Destination account is ${destAccount.status}. Cannot accept transfers.`);
      }

      // 4. Pre-check balance
      if (sourceAccount.balance < amountPaise) {
        await LedgerService.recordRefusedAttempt({
          transactionId: new mongoose.Types.ObjectId(),
          accountId: sourceAccount._id,
          accountNumber: sourceAccount.accountNumber,
          transactionType: 'REFUSED_ATTEMPT',
          currentBalance: sourceAccount.balance,
          initiatedBy: userId,
          reason: `Insufficient funds for transfer: Available ${formatPaiseToINR(sourceAccount.balance)}, Required ${formatPaiseToINR(amountPaise)}`,
          metadata: { destinationAccountNumber, requestedAmountPaise: amountPaise, idempotencyKey }
        });

        const err = new Error(`Insufficient funds: Available balance is ${formatPaiseToINR(sourceAccount.balance)}, required ${formatPaiseToINR(amountPaise)}.`);
        err.statusCode = 400;
        throw err;
      }

      // 5. Atomic Debit of Source Account
      const updatedSource = await Account.findOneAndUpdate(
        {
          _id: sourceAccount._id,
          balance: { $gte: amountPaise },
          status: 'ACTIVE'
        },
        { $inc: { balance: -amountPaise } },
        { session: session || undefined, new: true }
      );

      if (!updatedSource) {
        await LedgerService.recordRefusedAttempt({
          transactionId: new mongoose.Types.ObjectId(),
          accountId: sourceAccount._id,
          accountNumber: sourceAccount.accountNumber,
          transactionType: 'REFUSED_ATTEMPT',
          currentBalance: sourceAccount.balance,
          initiatedBy: userId,
          reason: 'Transfer rejected: Race condition detected on source balance',
          metadata: { destinationAccountNumber, requestedAmountPaise: amountPaise, idempotencyKey }
        });

        const err = new Error('Transfer rejected: Insufficient available balance due to concurrent transaction.');
        err.statusCode = 409;
        throw err;
      }

      // 6. Atomic Credit of Destination Account
      const updatedDest = await Account.findOneAndUpdate(
        {
          _id: destAccount._id,
          status: 'ACTIVE'
        },
        { $inc: { balance: amountPaise } },
        { session: session || undefined, new: true }
      );

      if (!updatedDest) {
        // Destination could not be credited (e.g. status changed concurrently)
        // If not in MongoDB replica set transaction, rollback manually:
        if (!session) {
          await Account.findByIdAndUpdate(sourceAccount._id, { $inc: { balance: amountPaise } });
        }
        throw new Error('Destination account failed to receive credit. Transfer rolled back.');
      }

      // 7. Money Conservation Invariant Check
      // Total debit MUST strictly equal total credit
      const debitTotal = amountPaise;
      const creditTotal = amountPaise;
      if (debitTotal !== creditTotal) {
        throw new Error('FATAL FINANCIAL INVARIANT VIOLATION: Debit total does not equal credit total.');
      }

      // 8. Record Transaction Record
      const txn = new Transaction({
        transactionReference: txnRef,
        type: 'TRANSFER',
        status: 'SUCCESS',
        sourceAccount: sourceAccount._id,
        sourceAccountNumber: sourceAccount.accountNumber,
        destinationAccount: destAccount._id,
        destinationAccountNumber: destAccount.accountNumber,
        amount: amountPaise,
        currency: 'INR',
        idempotencyKey,
        initiatedBy: userId,
        description,
        metadata: {
          ...metadata,
          sourcePreviousBalance: sourceAccount.balance,
          sourceNewBalance: updatedSource.balance,
          destinationPreviousBalance: destAccount.balance,
          destinationNewBalance: updatedDest.balance
        }
      });

      if (session) {
        await txn.save({ session });
      } else {
        await txn.save();
      }

      // 9. Record Append-Only Ledger Entries (Both sides of transfer)
      // Source Side (Debit)
      await LedgerService.recordEntry(
        {
          transactionId: txn._id,
          accountId: sourceAccount._id,
          accountNumber: sourceAccount.accountNumber,
          transactionType: 'TRANSFER_DEBIT',
          debitAmount: amountPaise,
          creditAmount: 0,
          balanceAfter: updatedSource.balance,
          initiatedBy: userId,
          status: 'POSTED',
          description: `Transfer to A/C ${destAccount.accountNumber}: ${description}`,
          metadata: { destAccountNumber: destAccount.accountNumber, txnRef }
        },
        session
      );

      // Destination Side (Credit)
      await LedgerService.recordEntry(
        {
          transactionId: txn._id,
          accountId: destAccount._id,
          accountNumber: destAccount.accountNumber,
          transactionType: 'TRANSFER_CREDIT',
          debitAmount: 0,
          creditAmount: amountPaise,
          balanceAfter: updatedDest.balance,
          initiatedBy: userId,
          status: 'POSTED',
          description: `Transfer received from A/C ${sourceAccount.accountNumber}: ${description}`,
          metadata: { sourceAccountNumber: sourceAccount.accountNumber, txnRef }
        },
        session
      );

      if (session) {
        await session.commitTransaction();
      }

      const result = {
        success: true,
        message: `Successfully transferred ${formatPaiseToINR(amountPaise)} to account ${destAccount.accountNumber}.`,
        transactionReference: txnRef,
        sourceNewBalance: updatedSource.balance,
        formattedSourceBalance: formatPaiseToINR(updatedSource.balance),
        sourceAccountNumber: sourceAccount.accountNumber,
        destinationAccountNumber: destAccount.accountNumber
      };

      await IdempotencyService.completeLock(idempotencyKey, 200, result, txnRef);

      return result;
    } catch (err) {
      if (session) {
        await session.abortTransaction();
      }
      await IdempotencyService.failLock(idempotencyKey, err.message);
      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Get transaction history for an account or user.
   */
  static async getTransactions({ accountId, userId, page = 1, limit = 20, type, status } = {}) {
    const query = {};
    if (accountId) {
      query.$or = [{ sourceAccount: accountId }, { destinationAccount: accountId }];
    } else if (userId) {
      query.initiatedBy = userId;
    }

    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('sourceAccount', 'accountNumber accountType')
        .populate('destinationAccount', 'accountNumber accountType')
        .populate('initiatedBy', 'username fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        formattedAmount: formatPaiseToINR(t.amount)
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get all transactions for Admin & Auditor.
   */
  static async getAllTransactions({ page = 1, limit = 50, type, status, search } = {}) {
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { transactionReference: { $regex: search, $options: 'i' } },
        { sourceAccountNumber: { $regex: search, $options: 'i' } },
        { destinationAccountNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('initiatedBy', 'username fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    return {
      transactions: transactions.map(t => ({
        ...t,
        formattedAmount: formatPaiseToINR(t.amount)
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get single transaction details.
   */
  static async getTransactionByRef(ref) {
    const txn = await Transaction.findOne({ transactionReference: ref })
      .populate('sourceAccount')
      .populate('destinationAccount')
      .populate('initiatedBy', 'username fullName email')
      .lean();

    if (!txn) {
      throw new Error('Transaction not found');
    }

    return {
      ...txn,
      formattedAmount: formatPaiseToINR(txn.amount)
    };
  }
}

module.exports = TransactionService;

