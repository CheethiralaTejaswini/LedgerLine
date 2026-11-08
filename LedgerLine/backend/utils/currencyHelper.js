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

/**
 * Converts integer paise into Indian currency words for bank receipts and vouchers.
 * E.g., 150050 -> "Rupees One Thousand Five Hundred and Fifty Paise Only"
 * @param {number} paise 
 * @returns {string}
 */
function paiseToWords(paise) {
  if (!Number.isInteger(paise) || paise < 0) return 'Zero Rupees Only';
  if (paise === 0) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n) {
    let str = '';
    if (n >= 10000000) {
      str += numToWords(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += numToWords(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += numToWords(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += numToWords(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) str += units[n] + ' ';
      else {
        str += tens[Math.floor(n / 10)] + ' ';
        if (n % 10 > 0) str += units[n % 10] + ' ';
      }
    }
    return str.trim();
  }

  const rupees = Math.floor(paise / 100);
  const remainderPaise = paise % 100;

  let result = 'Rupees ';
  if (rupees > 0) {
    result += numToWords(rupees);
  } else {
    result += 'Zero';
  }

  if (remainderPaise > 0) {
    result += ` and ${numToWords(remainderPaise)} Paise`;
  }
  result += ' Only';

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Validates that an amount is a strictly valid non-negative integer paise.
 * @param {any} paise
 * @returns {boolean}
 */
function isValidPaiseInteger(paise) {
  return typeof paise === 'number' && Number.isInteger(paise) && paise >= 0 && Number.isSafeInteger(paise);
}

module.exports = {
  toPaise,
  formatPaiseToINR,
  paiseToRupees,
  paiseToWords,
  isValidPaiseInteger
};

