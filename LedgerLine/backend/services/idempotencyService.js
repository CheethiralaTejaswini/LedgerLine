const crypto = require('crypto');
const IdempotencyRecord = require('../models/IdempotencyRecord');

class IdempotencyService {
  /**
   * Generates a deterministic SHA-256 hash of the request parameters.
   */
  static hashRequest(endpoint, payload) {
    const sortedPayload = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(`${endpoint}:${sortedPayload}`).digest('hex');
  }

  /**
   * Acquires an idempotency lock for the given key.
   * If the key was already completed, returns the cached result.
   * If the key is currently pending (in-flight), rejects to prevent race conditions.
   * 
   * @param {string} key Unique UUIDv4 key
   * @param {string} userId Requesting user ID
   * @param {string} endpoint Request URI
   * @param {object} payload Request body
   * @returns {Promise<{ isExisting: boolean, record: object }>}
   */
  static async acquireLock(key, userId, endpoint, payload) {
    if (!key) {
      throw new Error('Idempotency key is required.');
    }

    const requestHash = this.hashRequest(endpoint, payload);

    try {
      // Attempt to create a PENDING lock record atomically
      const newRecord = await IdempotencyRecord.create({
        key,
        userId,
        endpoint,
        requestHash,
        status: 'PENDING',
        lockedAt: new Date()
      });

      return {
        isExisting: false,
        status: 'LOCKED',
        record: newRecord
      };
    } catch (err) {
      // If error is duplicate key error (code 11000)
      if (err.code === 11000) {
        const existingRecord = await IdempotencyRecord.findOne({ key });
        if (!existingRecord) {
          throw new Error('Failed to resolve existing idempotency record.');
        }

        // If request parameters don't match the original key usage
        if (existingRecord.requestHash !== requestHash) {
          const mismatchError = new Error('Idempotency key reused with different request parameters.');
          mismatchError.statusCode = 422;
          throw mismatchError;
        }

        // If another concurrent request is currently processing with this key
        if (existingRecord.status === 'PENDING') {
          const conflictError = new Error('A duplicate request with this idempotency key is currently being processed. Please wait.');
          conflictError.statusCode = 409;
          throw conflictError;
        }

        // Key was completed previously
        return {
          isExisting: true,
          status: existingRecord.status,
          record: existingRecord
        };
      }

      throw err;
    }
  }

  /**
   * Marks the idempotency record as COMPLETED and stores the response.
   */
  static async completeLock(key, responseCode, responseBody, transactionReference = null) {
    return await IdempotencyRecord.findOneAndUpdate(
      { key },
      {
        $set: {
          status: 'COMPLETED',
          responseCode,
          responseBody,
          transactionReference,
          completedAt: new Date()
        }
      },
      { new: true }
    );
  }

  /**
   * Marks the idempotency record as FAILED.
   */
  static async failLock(key, errorReason) {
    return await IdempotencyRecord.findOneAndUpdate(
      { key },
      {
        $set: {
          status: 'FAILED',
          responseCode: 400,
          responseBody: { error: errorReason },
          completedAt: new Date()
        }
      },
      { new: true }
    );
  }
}

module.exports = IdempotencyService;

