const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const AccountService = require('../services/accountService');
const TransactionService = require('../services/transactionService');
const IdempotencyService = require('../services/idempotencyService');
const generateIdempotencyKey = require('../utils/generateIdempotencyKey');

describe('7. Request Idempotency Tests', () => {
  let userA, userB;
  let accountA, accountB;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    userA = await User.register(new User({ username: 'idem_a', email: 'ia@example.com', fullName: 'Idem User A' }), 'Pass@123');
    userB = await User.register(new User({ username: 'idem_b', email: 'ib@example.com', fullName: 'Idem User B' }), 'Pass@123');

    accountA = await AccountService.createAccount(userA._id, 'SAVINGS', 2000000); // ₹ 20,000.00
    accountB = await AccountService.createAccount(userB._id, 'CURRENT', 0);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('Repeated idempotency keys must not create duplicate transfers and must return identical response', async () => {
    const fixedKey = generateIdempotencyKey();
    const transferAmount = 500000; // ₹ 5,000.00

    // First request
    const firstCall = await TransactionService.transfer({
      sourceAccountId: accountA._id,
      destinationAccountNumber: accountB.accountNumber,
      amountPaise: transferAmount,
      userId: userA._id,
      idempotencyKey: fixedKey,
      description: 'Monthly retainer'
    });

    assert.ok(firstCall.success);
    assert.strictEqual(firstCall.sourceNewBalance, 1500000);

    // Second request with EXACT SAME idempotency key
    const duplicateCall = await TransactionService.transfer({
      sourceAccountId: accountA._id,
      destinationAccountNumber: accountB.accountNumber,
      amountPaise: transferAmount,
      userId: userA._id,
      idempotencyKey: fixedKey,
      description: 'Monthly retainer'
    });

    // Duplicate call returns identical result without re-processing!
    assert.deepStrictEqual(duplicateCall, firstCall);

    // Verify account A was only debited ONCE!
    const updatedA = await Account.findById(accountA._id);
    const updatedB = await Account.findById(accountB._id);

    assert.strictEqual(updatedA.balance, 1500000, 'Balance must only reflect a single deduction');
    assert.strictEqual(updatedB.balance, 500000, 'Destination must only receive single credit');
  });

  it('Concurrent requests with the exact same key must detect in-flight lock and reject with 409 Conflict', async () => {
    const key = generateIdempotencyKey();

    // Acquire lock 1
    const lock1 = await IdempotencyService.acquireLock(key, userA._id, '/api/transactions/transfer', { amount: 100 });
    assert.strictEqual(lock1.status, 'LOCKED');

    // Simultaneous attempt with same pending key
    await assert.rejects(
      async () => {
        await IdempotencyService.acquireLock(key, userA._id, '/api/transactions/transfer', { amount: 100 });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.match(err.message, /currently being processed/i);
        return true;
      }
    );
  });

  it('Reusing an idempotency key with different payload parameters must be rejected', async () => {
    const key = generateIdempotencyKey();

    await TransactionService.deposit({
      accountId: accountA._id,
      amountPaise: 100000,
      userId: userA._id,
      idempotencyKey: key
    });

    // Reusing key with different amount
    await assert.rejects(
      async () => {
        await TransactionService.deposit({
          accountId: accountA._id,
          amountPaise: 200000, // Different amount!
          userId: userA._id,
          idempotencyKey: key
        });
      },
      /different request parameters/i
    );
  });
});

