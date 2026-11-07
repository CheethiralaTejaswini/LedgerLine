const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');

describe('3. Deposit Operation Tests', () => {
  let testUser;
  let testAccount;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    testUser = await User.register(
      new User({
        username: 'deposit_user',
        email: 'dep@example.com',
        fullName: 'Deposit User'
      }),
      'Password@123'
    );
    testAccount = await AccountService.createAccount(testUser._id, 'SAVINGS', 0);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('should successfully deposit money atomically and record both transaction and ledger entries', async () => {
    const depositPaise = 500000; // ₹ 5,000.00
    const key = generateIdempotencyKey();

    const result = await TransactionService.deposit({
      accountId: testAccount._id,
      amountPaise: depositPaise,
      userId: testUser._id,
      idempotencyKey: key,
      description: 'Initial Cash Deposit'
    });

    assert.ok(result.success);
    assert.strictEqual(result.newBalance, depositPaise);

    // Verify Account Balance
    const updatedAccount = await Account.findById(testAccount._id);
    assert.strictEqual(updatedAccount.balance, depositPaise);

    // Verify Transaction Record
    const txn = await Transaction.findOne({ transactionReference: result.transactionReference });
    assert.ok(txn);
    assert.strictEqual(txn.type, 'DEPOSIT');
    assert.strictEqual(txn.status, 'SUCCESS');
    assert.strictEqual(txn.amount, depositPaise);

    // Verify Ledger Entry
    const ledger = await LedgerEntry.findOne({ transactionId: txn._id });
    assert.ok(ledger);
    assert.strictEqual(ledger.creditAmount, depositPaise);
    assert.strictEqual(ledger.debitAmount, 0);
    assert.strictEqual(ledger.balanceAfter, depositPaise);
    assert.strictEqual(ledger.status, 'POSTED');
  });

  it('should reject deposit into frozen or closed account', async () => {
    await Account.findByIdAndUpdate(testAccount._id, { status: 'FROZEN' });

    await assert.rejects(
      async () => {
        await TransactionService.deposit({
          accountId: testAccount._id,
          amountPaise: 100000,
          userId: testUser._id,
          idempotencyKey: generateIdempotencyKey()
        });
      },
      /FROZEN/i
    );
  });
});

