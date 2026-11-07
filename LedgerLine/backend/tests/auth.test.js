const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const User = require('../models/User');

describe('1. Authentication & User Management Tests', () => {
  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  after(async () => {
    await teardownTestDB();
  });

  it('should register a new user with hashed password and default role', async () => {
    const user = new User({
      username: 'john_doe',
      email: 'john@example.com',
      fullName: 'John Doe',
      role: 'ACCOUNT_HOLDER'
    });

    const registered = await User.register(user, 'SecurePassword@123');

    assert.ok(registered._id);
    assert.strictEqual(registered.username, 'john_doe');
    assert.strictEqual(registered.role, 'ACCOUNT_HOLDER');
    assert.strictEqual(registered.status, 'ACTIVE');
    assert.ok(registered.hash); // password hashed
    assert.ok(registered.salt); // salt generated
  });

  it('should prevent registration with duplicate username or email', async () => {
    const user1 = new User({
      username: 'sam_smith',
      email: 'sam@example.com',
      fullName: 'Sam Smith',
      role: 'ACCOUNT_HOLDER'
    });
    await User.register(user1, 'Password@123');

    const user2 = new User({
      username: 'sam_smith', // duplicate
      email: 'different@example.com',
      fullName: 'Sam Other',
      role: 'ACCOUNT_HOLDER'
    });

    await assert.rejects(
      async () => {
        await User.register(user2, 'Password@123');
      },
      /already registered|duplicate/i
    );
  });

  it('should authenticate valid credentials and reject invalid passwords', async () => {
    const user = new User({
      username: 'auth_user',
      email: 'auth@example.com',
      fullName: 'Auth User'
    });
    const registered = await User.register(user, 'CorrectPass@123');

    // Authenticate with correct password
    const resultSuccess = await new Promise((resolve) => {
      registered.authenticate('CorrectPass@123', (err, user) => {
        resolve({ err, user });
      });
    });
    assert.ok(resultSuccess.user);

    // Authenticate with incorrect password
    const resultFail = await new Promise((resolve) => {
      registered.authenticate('WrongPassword@999', (err, user) => {
        resolve({ err, user });
      });
    });
    assert.strictEqual(resultFail.user, false);
  });
});

