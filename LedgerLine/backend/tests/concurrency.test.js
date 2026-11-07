const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');

describe('6. Concurrency & Race Condition Prevention Tests', () => {
  let user;
  let account;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    user = await User.register(
      new User({ username: 'race_user', email: 'race@example.com', fullName: 'Race Condition Tester' }),
      'Pass@123'
    );
    // Balance: ₹ 1,000.00 (100,000 paise)
    account = await AccountService.createAccount(user._id, 'SAVINGS', 100000);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('Two simultaneous concurrent withdrawals must NEVER overdraw an account or produce a negative balance', async () => {
    const withdrawAmount = 80000; // ₹ 800.00 each. Combined would be ₹ 1,600.00 (exceeding ₹ 1,000.00)

    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    // Fire two withdrawal requests simultaneously
    const [result1, result2] = await Promise.allSettled([
      TransactionService.withdraw({
        accountId: account._id,
        amountPaise: withdrawAmount,
        userId: user._id,
        idempotencyKey: key1,
        description: 'Concurrent Withdrawal A'
      }),
      TransactionService.withdraw({
        accountId: account._id,
        amountPaise: withdrawAmount,
        userId: user._id,
        idempotencyKey: key2,
        description: 'Concurrent Withdrawal B'
      })
    ]);

    // Count how many succeeded and how many failed
    const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
    const rejected = [result1, result2].filter(r => r.status === 'rejected');

    assert.strictEqual(succeeded.length, 1, 'Exactly one concurrent withdrawal must succeed');
    assert.strictEqual(rejected.length, 1, 'The competing concurrent withdrawal must be rejected');

    // Verify account balance is strictly positive (100,000 - 80,000 = 20,000 paise)
    const finalAccount = await Account.findById(account._id);
    assert.strictEqual(finalAccount.balance, 20000);
    assert.ok(finalAccount.balance >= 0, 'Account balance must never become negative');
  });

  it('Multiple parallel transfers from the same account must strictly respect available balance limit', async () => {
    // Initial balance: 100,000 paise. Fire 5 concurrent transfers of 30,000 paise each.
    // At most 3 can succeed (3 x 30,000 = 90,000 <= 100,000). Remaining 2 MUST be rejected.
    const destUser = await User.register(new User({ username: 'dest_parallel', email: 'd@example.com', fullName: 'Dest' }), 'Pass@123');
    const destAccount = await AccountService.createAccount(destUser._id, 'CURRENT', 0);

    const transferAmount = 30000; // ₹ 300.00
    const promises = Array.from({ length: 5 }, () =>
      TransactionService.transfer({
        sourceAccountId: account._id,
        destinationAccountNumber: destAccount.accountNumber,
        amountPaise: transferAmount,
        userId: user._id,
        idempotencyKey: generateIdempotencyKey()
      })
    );

    const outcomes = await Promise.allSettled(promises);
    const fulfilledCount = outcomes.filter(o => o.status === 'fulfilled').length;
    const rejectedCount = outcomes.filter(o => o.status === 'rejected').length;

    assert.strictEqual(fulfilledCount, 3, 'Exactly 3 transfers can be accommodated by 100,000 balance');
    assert.strictEqual(rejectedCount, 2, '2 transfers must be rejected due to balance exhaustion');

    const freshSource = await Account.findById(account._id);
    const freshDest = await Account.findById(destAccount._id);

    assert.strictEqual(freshSource.balance, 10000); // 100,000 - 90,000 = 10,000 paise (₹ 100.00)
    assert.strictEqual(freshDest.balance, 90000); // 3 x 30,000 = 90,000 paise
  });
});

