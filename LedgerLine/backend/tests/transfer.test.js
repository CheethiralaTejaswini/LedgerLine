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

describe('5. Internal Money Transfer & Conservation Tests', () => {
  let userA, userB;
  let accountA, accountB;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    userA = await User.register(new User({ username: 'user_a', email: 'a@example.com', fullName: 'User A' }), 'Pass@123');
    userB = await User.register(new User({ username: 'user_b', email: 'b@example.com', fullName: 'User B' }), 'Pass@123');

    // Account A starts with ₹ 50,000.00 (5,000,000 paise)
    accountA = await AccountService.createAccount(userA._id, 'SAVINGS', 5000000);
    // Account B starts with ₹ 10,000.00 (1,000,000 paise)
    accountB = await AccountService.createAccount(userB._id, 'CURRENT', 1000000);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('Money Conservation: Source debit must equal destination credit and total system balance remains unchanged', async () => {
    const transferPaise = 1500000; // ₹ 15,000.00
    const initialTotalSystemBalance = accountA.balance + accountB.balance; // 6,000,000 paise

    const result = await TransactionService.transfer({
      sourceAccountId: accountA._id,
      destinationAccountNumber: accountB.accountNumber,
      amountPaise: transferPaise,
      userId: userA._id,
      idempotencyKey: generateIdempotencyKey(),
      description: 'Consulting Settlement'
    });

    assert.ok(result.success);

    // Fetch updated accounts
    const updatedA = await Account.findById(accountA._id);
    const updatedB = await Account.findById(accountB._id);

    // Verify individual balances
    assert.strictEqual(updatedA.balance, 3500000); // 5,000,000 - 1,500,000 = 3,500,000
    assert.strictEqual(updatedB.balance, 2500000); // 1,000,000 + 1,500,000 = 2,500,000

    // STRICT MONEY CONSERVATION INVARIANT: Total system balance MUST remain identical
    const finalTotalSystemBalance = updatedA.balance + updatedB.balance;
    assert.strictEqual(finalTotalSystemBalance, initialTotalSystemBalance);

    // Verify Ledger: Debit side equals Credit side
    const debitLedger = await LedgerEntry.findOne({ transactionType: 'TRANSFER_DEBIT', accountId: accountA._id });
    const creditLedger = await LedgerEntry.findOne({ transactionType: 'TRANSFER_CREDIT', accountId: accountB._id });

    assert.ok(debitLedger);
    assert.ok(creditLedger);
    assert.strictEqual(debitLedger.debitAmount, transferPaise);
    assert.strictEqual(creditLedger.creditAmount, transferPaise);
    assert.strictEqual(debitLedger.debitAmount, creditLedger.creditAmount, 'Debit must equal credit');
  });

  it('should reject transfers to the same source account (Self-transfer prevention)', async () => {
    await assert.rejects(
      async () => {
        await TransactionService.transfer({
          sourceAccountId: accountA._id,
          destinationAccountNumber: accountA.accountNumber, // Same account
          amountPaise: 500000,
          userId: userA._id,
          idempotencyKey: generateIdempotencyKey()
        });
      },
      /same account/i
    );
  });

  it('should reject transfers to non-existent destination account numbers', async () => {
    await assert.rejects(
      async () => {
        await TransactionService.transfer({
          sourceAccountId: accountA._id,
          destinationAccountNumber: '999999999999', // Invalid
          amountPaise: 500000,
          userId: userA._id,
          idempotencyKey: generateIdempotencyKey()
        });
      },
      /does not exist/i
    );
  });

  it('Failed transfers must roll back completely without deducting source balance', async () => {
    const excessivePaise = 90000000; // ₹ 9,00,000.00 (Exceeds available balance)

    await assert.rejects(
      async () => {
        await TransactionService.transfer({
          sourceAccountId: accountA._id,
          destinationAccountNumber: accountB.accountNumber,
          amountPaise: excessivePaise,
          userId: userA._id,
          idempotencyKey: generateIdempotencyKey()
        });
      },
      /Insufficient funds/i
    );

    // Verify source account is completely untouched
    const freshA = await Account.findById(accountA._id);
    const freshB = await Account.findById(accountB._id);
    assert.strictEqual(freshA.balance, 5000000);
    assert.strictEqual(freshB.balance, 1000000);
  });
});

