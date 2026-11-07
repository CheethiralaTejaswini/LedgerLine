const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique UUIDv4 string for request idempotency tracking.
 */
function generateIdempotencyKey() {
  return uuidv4();
}

module.exports = generateIdempotencyKey;

