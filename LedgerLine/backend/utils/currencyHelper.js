/**
 * Currency Utility for LedgerLine
 * 
 * Guarantees all calculations use the smallest currency unit (paise: 1 INR = 100 paise).
 * Strictly forbids floating-point representations in accounting and ledger logic.
 */

/**
 * Converts INR (can be string or number like 100.50) into integer paise.
 * Throws error if invalid or fractional paise.
 * @param {string|number} inrAmount 
 * @returns {number} Integer paise
 */
function toPaise(inrAmount) {
  if (inrAmount === null || inrAmount === undefined) {
    throw new Error('Amount is required');
  }

  const str = String(inrAmount).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error('Invalid currency format. Must be a valid positive amount with up to 2 decimal places.');
  }

  const parts = str.split('.');
  const rupees = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1].padEnd(2, '0'), 10) : 0;

  const totalPaise = rupees * 100 + paise;
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    throw new Error('Amount must be a positive integer value within safe limits.');
  }

  return totalPaise;
}

/**
 * Converts integer paise into formatted INR string.
 * @param {number} paise 
 * @param {boolean} includeSymbol Default true
 * @returns {string} E.g., "₹ 1,500.50" or "1,500.50"
 */
function formatPaiseToINR(paise, includeSymbol = true) {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return includeSymbol ? '₹ 0.00' : '0.00';
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;
  const paiseStr = String(remainderPaise).padStart(2, '0');

  // Format with Indian numbering system (lakhs, crores)
  const rupeeStr = rupees.toLocaleString('en-IN');
  const formatted = `${isNegative ? '-' : ''}${rupeeStr}.${paiseStr}`;

  return includeSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Converts integer paise into raw decimal number for read-only displays.
 * @param {number} paise 
 * @returns {number}
 */
function paiseToRupees(paise) {
  return (paise || 0) / 100;
}

module.exports = {
  toPaise,
  formatPaiseToINR,
  paiseToRupees
};

