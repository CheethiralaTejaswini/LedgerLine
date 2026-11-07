const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const AccountService = require('../services/accountService');

describe('2. Account Management Tests', () => {
  let testUser;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    testUser = await User.register(
      new User({
        username: 'acct_user',
        email: 'acct@example.com',
        fullName: 'Account Test User'
      }),
      'Password@123'
    );
  });

  after(async () => {
    await teardownTestDB();
  });

  it('should generate a 12-digit unique account number starting with bank routing prefix', async () => {
    const account = await AccountService.createAccount(testUser._id, 'SAVINGS', 0);

    assert.ok(account._id);
    assert.strictEqual(account.accountNumber.length, 12);
    assert.ok(account.accountNumber.startsWith('100'));
    assert.strictEqual(account.balance, 0);
    assert.strictEqual(account.status, 'ACTIVE');
  });

  it('should strictly reject negative balance values at the database schema level', async () => {
    const negativeAccount = new Account({
      accountNumber: '100999888777',
      userId: testUser._id,
      accountType: 'CURRENT',
      balance: -5000 // Invalid negative paise
    });

    await assert.rejects(
      async () => {
        await negativeAccount.save();
      },
      /cannot be negative/i
    );
  });

  it('should reject non-integer fractional paise values', async () => {
    const floatAccount = new Account({
      accountNumber: '100999888778',
      userId: testUser._id,
      accountType: 'SAVINGS',
      balance: 100.55 // Invalid floating-point value
    });

    await assert.rejects(
      async () => {
        await floatAccount.save();
      },
      /integer/i
    );
  });

  it('should correctly calculate user account summaries in paise', async () => {
    await AccountService.createAccount(testUser._id, 'SAVINGS', 250000); // ₹ 2,500.00
    await AccountService.createAccount(testUser._id, 'CURRENT', 750000); // ₹ 7,500.00

    const summary = await AccountService.getUserSummary(testUser._id);
    assert.strictEqual(summary.totalAccounts, 2);
    assert.strictEqual(summary.totalBalancePaise, 1000000); // ₹ 10,000.00
    assert.strictEqual(summary.formattedTotalBalance, '₹ 10,000.00');
  });
});

