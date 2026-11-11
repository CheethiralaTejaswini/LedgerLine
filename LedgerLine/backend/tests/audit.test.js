const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDB, clearTestDB, teardownTestDB } = require('./testHelper');
const AuditLog = require('../models/AuditLog');
const AuditService = require('../services/auditService');
const { paiseToWords, isValidPaiseInteger } = require('../utils/currencyHelper');

describe('10. Security Audit Trail & Monetary Precision Invariants', () => {
  before(async () => {
    await setupTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  after(async () => {
    await teardownTestDB();
  });

  it('Audit Immutability: Should successfully insert audit entry and forbid subsequent updates', async () => {
    const entry = await AuditLog.create({
      action: 'SECURITY_ALERT',
      severity: 'CRITICAL',
      username: 'attacker',
      details: { reason: 'Rate limit violation' }
    });

    assert.ok(entry._id);
    assert.equal(entry.severity, 'CRITICAL');

    // Attempting to modify existing audit record must be rejected by immutability hooks
    await assert.rejects(
      async () => {
        await AuditLog.updateOne({ _id: entry._id }, { severity: 'INFO' });
      },
      /AUDIT_IMMUTABILITY_VIOLATION/
    );
  });

  it('Audit Immutability: Deleting an existing audit log must be rejected by database pre-hooks', async () => {
    const entry = await AuditLog.create({
      action: 'HIGH_VALUE_TRANSFER',
      severity: 'WARN',
      username: 'corporate_user',
      details: { amountPaise: 5000000 }
    });

    await assert.rejects(
      async () => {
        await AuditLog.deleteOne({ _id: entry._id });
      },
      /AUDIT_IMMUTABILITY_VIOLATION/
    );
  });

  it('AuditService: logEvent should gracefully record events and retrieve them chronologically', async () => {
    await AuditService.logEvent({
      action: 'LOGIN_SUCCESS',
      severity: 'INFO',
      user: { username: 'alice', _id: null },
      details: { ip: '192.168.1.1' }
    });

    const logs = await AuditService.getRecentLogs(10);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'LOGIN_SUCCESS');
    assert.equal(logs[0].username, 'alice');
  });

  it('Currency Helper: paiseToWords and isValidPaiseInteger must satisfy financial precision invariants', () => {
    // Exact word conversions
    assert.equal(paiseToWords(150050), 'Rupees One Thousand Five Hundred and Fifty Paise Only');
    assert.equal(paiseToWords(10000000), 'Rupees One Lakh Only');
    assert.equal(paiseToWords(0), 'Zero Rupees Only');

    // Integer paise validation
    assert.equal(isValidPaiseInteger(100), true);
    assert.equal(isValidPaiseInteger(0), true);
    assert.equal(isValidPaiseInteger(-50), false);
    assert.equal(isValidPaiseInteger(10.5), false);
    assert.equal(isValidPaiseInteger('100'), false);
    assert.equal(isValidPaiseInteger(NaN), false);
  });
});
