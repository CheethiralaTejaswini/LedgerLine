const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const LedgerService = require('../services/ledgerService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');

describe('9. Cryptographic Financial Reconciliation & Audit Tests', () => {
  let userA, userB;
  let accountA, accountB;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    userA = await User.register(new User({ username: 'rec_user_a', email: 'ra@example.com', fullName: 'Reconciliation User A' }), 'Pass@123');
    userB = await User.register(new User({ username: 'rec_user_b', email: 'rb@example.com', fullName: 'Reconciliation User B' }), 'Pass@123');

    accountA = await AccountService.createAccount(userA._id, 'SAVINGS', 0);
    accountB = await AccountService.createAccount(userB._id, 'CURRENT', 0);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('Account Reconciliation: Account balance must strictly equal sum of ledger credits minus sum of ledger debits', async () => {
    // 1. Deposit ₹ 10,000 into Account A
    await TransactionService.deposit({
      accountId: accountA._id,
      amountPaise: 1000000,
      userId: userA._id,
      idempotencyKey: generateIdempotencyKey(),
      description: 'Deposit 1'
    });

    // 2. Transfer ₹ 4,000 from Account A to Account B
    await TransactionService.transfer({
      sourceAccountId: accountA._id,
      destinationAccountNumber: accountB.accountNumber,
      amountPaise: 400000,
      userId: userA._id,
      idempotencyKey: generateIdempotencyKey(),
      description: 'Transfer 1'
    });

    // 3. Withdraw ₹ 1,500 from Account A
    await TransactionService.withdraw({
      accountId: accountA._id,
      amountPaise: 150000,
      userId: userA._id,
      idempotencyKey: generateIdempotencyKey(),
      description: 'Withdrawal 1'
    });

    // Reconcile Account A
    const reportA = await LedgerService.reconcileAccount(accountA._id);
    assert.strictEqual(reportA.isReconciled, true);
    assert.strictEqual(reportA.actualAccountBalance, 450000); // 1,000,000 - 400,000 - 150,000 = 450,000 paise (₹ 4,500.00)
    assert.strictEqual(reportA.calculatedLedgerBalance, 450000);
    assert.strictEqual(reportA.discrepancyPaise, 0);
    assert.strictEqual(reportA.totalCredits, 1000000);
    assert.strictEqual(reportA.totalDebits, 550000);

    // Reconcile Account B
    const reportB = await LedgerService.reconcileAccount(accountB._id);
    assert.strictEqual(reportB.isReconciled, true);
    assert.strictEqual(reportB.actualAccountBalance, 400000);
    assert.strictEqual(reportB.calculatedLedgerBalance, 400000);
    assert.strictEqual(reportB.discrepancyPaise, 0);
  });

  it('System-Wide Reconciliation: Validates invariant consistency across all portfolios', async () => {
    const systemReport = await LedgerService.reconcileSystem();
    assert.strictEqual(systemReport.systemReconciled, true);
    assert.ok(systemReport.totalAccountsAudited >= 2);
    assert.ok(Array.isArray(systemReport.accountReconciliations));
    assert.ok(systemReport.accountReconciliations.every(r => r.isReconciled));
  });

  it('Recipient Lookup Helper: Successfully resolves account number and provides recipient name', async () => {
    const found = await AccountService.getAccountByNumber(accountA.accountNumber);
    assert.ok(found);
    assert.strictEqual(found.accountNumber, accountA.accountNumber);
    assert.strictEqual(found.userId.fullName, 'Reconciliation User A');
  });
});

