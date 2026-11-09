const AuditLog = require('../models/AuditLog');

/**
 * Audit Logging Service
 * Records compliance, security, and financial integrity events in append-only storage.
 */
class AuditService {
  /**
   * Log an event to the append-only audit trail
   */
  static async logEvent({ action, severity = 'INFO', user = null, req = null, details = {} }) {
    try {
      const ipAddress = req?.headers['x-forwarded-for']?.split(',')[0].trim() || req?.socket?.remoteAddress || '127.0.0.1';
      const userAgent = req?.headers['user-agent'] || 'UNKNOWN';

      await AuditLog.create({
        action,
        severity,
        userId: user?._id || user?.id || null,
        username: user?.username || 'SYSTEM',
        ipAddress,
        userAgent,
        details,
        timestamp: new Date()
      });
    } catch (err) {
      // Never crash the primary transaction thread on audit logging failures; output warning
      console.error('[LedgerLine Audit Warning] Failed to persist audit entry:', err.message);
    }
  }

  /**
   * Fetch recent audit logs for auditor review
   */
  static async getRecentLogs(limit = 100, filter = {}) {
    return AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = AuditService;
