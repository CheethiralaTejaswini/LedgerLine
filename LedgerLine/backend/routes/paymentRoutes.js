const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const isAuthenticated = require('../middleware/isAuthenticated');
const authorizeRole = require('../middleware/authorizeRole');

router.post('/create-order', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), PaymentController.createOrder);
router.post('/verify', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), PaymentController.verifyPayment);
router.post('/webhook', PaymentController.webhook);

module.exports = router;

