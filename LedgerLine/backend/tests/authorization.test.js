const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');
const Account = require('../models/Account');
const LedgerEntry = require('../models/LedgerEntry');
const AccountService = require('../services/accountService');
const LedgerService = require('../services/ledgerService');
const authorizeRole = require('../middleware/authorizeRole');
const checkAccountOwnership = require('../middleware/checkAccountOwnership');
const mongoose = require('mongoose');

describe('8. Role-Based Authorization & Ledger Immutability Tests', () => {
  let user1, user2, adminUser, auditorUser;
  let account1, account2;

  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    user1 = await User.register(new User({ username: 'user_one', email: 'u1@example.com', fullName: 'User One', role: 'ACCOUNT_HOLDER' }), 'Pass@123');
    user2 = await User.register(new User({ username: 'user_two', email: 'u2@example.com', fullName: 'User Two', role: 'ACCOUNT_HOLDER' }), 'Pass@123');
    adminUser = await User.register(new User({ username: 'super_admin', email: 'admin@example.com', fullName: 'Admin', role: 'ADMIN' }), 'Pass@123');
    auditorUser = await User.register(new User({ username: 'super_auditor', email: 'audit@example.com', fullName: 'Auditor', role: 'AUDITOR' }), 'Pass@123');

    account1 = await AccountService.createAccount(user1._id, 'SAVINGS', 500000);
    account2 = await AccountService.createAccount(user2._id, 'CURRENT', 1000000);
  });

  after(async () => {
    await teardownTestDB();
  });

  it('Account Ownership: Users cannot access another user accounts', async () => {
    // User 1 tries to access User 2's account details
    await assert.rejects(
      async () => {
        await AccountService.getAccountById(account2._id, user1);
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Access denied/i);
        return true;
      }
    );

    // User 1 can access their own account
    const ownAccount = await AccountService.getAccountById(account1._id, user1);
    assert.strictEqual(ownAccount._id.toString(), account1._id.toString());
  });

  it('Admin and Auditor can access account details across all users', async () => {
    const accountForAdmin = await AccountService.getAccountById(account1._id, adminUser);
    assert.ok(accountForAdmin);

    const accountForAuditor = await AccountService.getAccountById(account1._id, auditorUser);
    assert.ok(accountForAuditor);
  });

  it('Role Authorization Middleware: Rejects unauthorized roles from privileged operations', async () => {
    const adminOnlyMiddleware = authorizeRole('ADMIN');

    // Simulate request with Account Holder user
    let nextCalled = false;
    const reqHolder = { user: user1, xhr: true };
    const resHolder = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    adminOnlyMiddleware(reqHolder, resHolder, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Next must not be called for unauthorized role');
    assert.strictEqual(resHolder.statusCode, 403);
    assert.match(resHolder.data.message, /Access Denied/i);

    // Simulate request with Admin user
    let adminNextCalled = false;
    const reqAdmin = { user: adminUser, xhr: true };
    const resAdmin = {};
    adminOnlyMiddleware(reqAdmin, resAdmin, () => { adminNextCalled = true; });
    assert.strictEqual(adminNextCalled, true, 'Next must be called for Admin');
  });

  it('Strict Append-Only Invariant: Ledger entries CANNOT be modified or deleted through application APIs', async () => {
    // Record a valid ledger entry
    const entry = await LedgerService.recordEntry({
      transactionId: new mongoose.Types.ObjectId(),
      accountId: account1._id,
      accountNumber: account1.accountNumber,
      transactionType: 'DEPOSIT',
      creditAmount: 50000,
      balanceAfter: 550000,
      initiatedBy: user1._id,
      description: 'Audit immutability test'
    });

    assert.ok(entry._id);

    // 1. Attempting updateOne must throw immutability violation error
    await assert.rejects(
      async () => {
        await LedgerEntry.updateOne({ _id: entry._id }, { $set: { creditAmount: 999999 } });
      },
      /IMMUTABILITY_VIOLATION/i
    );

    // 2. Attempting findOneAndUpdate must throw immutability violation error
    await assert.rejects(
      async () => {
        await LedgerEntry.findOneAndUpdate({ _id: entry._id }, { $set: { balanceAfter: 0 } });
      },
      /IMMUTABILITY_VIOLATION/i
    );

    // 3. Attempting deleteOne must throw immutability violation error
    await assert.rejects(
      async () => {
        await LedgerEntry.deleteOne({ _id: entry._id });
      },
      /IMMUTABILITY_VIOLATION/i
    );

    // 4. Attempting findOneAndDelete must throw immutability violation error
    await assert.rejects(
      async () => {
        await LedgerEntry.findOneAndDelete({ _id: entry._id });
      },
      /IMMUTABILITY_VIOLATION/i
    );

    // Verify entry is completely intact and unchanged
    const pristineEntry = await LedgerEntry.findById(entry._id);
    assert.strictEqual(pristineEntry.creditAmount, 50000);
    assert.strictEqual(pristineEntry.balanceAfter, 550000);
  });
});

