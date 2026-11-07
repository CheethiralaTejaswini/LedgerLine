const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transactionController');
const isAuthenticated = require('../middleware/isAuthenticated');
const authorizeRole = require('../middleware/authorizeRole');
const checkAccountOwnership = require('../middleware/checkAccountOwnership');
const { transactionLimiter } = require('../middleware/rateLimiter');
const {
  validateDeposit,
  validateWithdraw,
  validateTransfer
} = require('../validators/transactionValidator');

// Transaction History
router.get('/', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), TransactionController.renderHistory);

// Deposit
router.get('/deposit', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), TransactionController.renderDeposit);
router.post(
  '/deposit',
  isAuthenticated,
  authorizeRole('ACCOUNT_HOLDER'),
  transactionLimiter,
  validateDeposit,
  checkAccountOwnership,
  TransactionController.deposit
);

// Withdrawal
router.get('/withdraw', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), TransactionController.renderWithdraw);
router.post(
  '/withdraw',
  isAuthenticated,
  authorizeRole('ACCOUNT_HOLDER'),
  transactionLimiter,
  validateWithdraw,
  checkAccountOwnership,
  TransactionController.withdraw
);

// Money Transfer
router.get('/transfer', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), TransactionController.renderTransfer);
router.post(
  '/transfer',
  isAuthenticated,
  authorizeRole('ACCOUNT_HOLDER'),
  transactionLimiter,
  validateTransfer,
  checkAccountOwnership,
  TransactionController.transfer
);

module.exports = router;

