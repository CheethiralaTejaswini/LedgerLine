const crypto = require('crypto');

/**
 * Generate a cryptographically secure 12-digit account number.
 * Format: 2026XXXXXXXX (Starts with current year or bank routing prefix '100' + 9 random digits)
 * E.g., 100847291034
 */
function generateAccountNumber() {
  const prefix = '100';
  // Generate 9 random digits
  const randomBytes = crypto.randomBytes(5);
  const num = (randomBytes.readUInt32BE(0) % 900000000) + 100000000;
  return `${prefix}${num}`;
}

module.exports = generateAccountNumber;

