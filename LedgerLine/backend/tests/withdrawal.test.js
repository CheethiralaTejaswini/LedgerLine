const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');

describe('4. Withdrawal Operation Tests', () => {
  let testUser;
  let testAccount;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    testUser = await User.register(
      new User({
        username: 'withdraw_user',
        email: 'with@example.com',
        fullName: 'Withdraw User'
      }),
      'Password@123'
    );
    // Create account with initial ₹ 10,000.00 (1,000,000 paise)
    testAccount = await AccountService.createAccount(testUser._id, 'CURRENT', 1000000);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('should successfully withdraw funds when sufficient balance is available', async () => {
    const withdrawAmount = 400000; // ₹ 4,000.00
    const key = generateIdempotencyKey();

    const result = await TransactionService.withdraw({
      accountId: testAccount._id,
      amountPaise: withdrawAmount,
      userId: testUser._id,
      idempotencyKey: key,
      description: 'ATM Cash Out'
    });

    assert.ok(result.success);
    assert.strictEqual(result.newBalance, 600000); // 1,000,000 - 400,000 = 600,000

    const updatedAccount = await Account.findById(testAccount._id);
    assert.strictEqual(updatedAccount.balance, 600000);

    const ledger = await LedgerEntry.findOne({ transactionType: 'WITHDRAWAL', accountId: testAccount._id });
    assert.ok(ledger);
    assert.strictEqual(ledger.debitAmount, withdrawAmount);
    assert.strictEqual(ledger.balanceAfter, 600000);
  });

  it('should reject withdrawals that exceed available balance (Insufficient balance rejection)', async () => {
    const excessiveAmount = 2000000; // ₹ 20,000.00 (exceeds ₹ 10,000.00)
    const key = generateIdempotencyKey();

    await assert.rejects(
      async () => {
        await TransactionService.withdraw({
          accountId: testAccount._id,
          amountPaise: excessiveAmount,
          userId: testUser._id,
          idempotencyKey: key
        });
      },
      /Insufficient funds/i
    );

    // Verify account balance was NOT modified
    const unchangedAccount = await Account.findById(testAccount._id);
    assert.strictEqual(unchangedAccount.balance, 1000000);

    // Verify refused transaction attempt was recorded in the append-only ledger
    const refusedEntry = await LedgerEntry.findOne({
      accountId: testAccount._id,
      status: 'REFUSED'
    });
    assert.ok(refusedEntry, 'Refused attempt must be logged in ledger');
    assert.strictEqual(refusedEntry.balanceAfter, 1000000);
    assert.match(refusedEntry.description, /Insufficient funds/i);
  });
});

