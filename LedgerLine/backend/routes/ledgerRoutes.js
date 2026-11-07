const express = require('express');
const router = express.Router();
const LedgerController = require('../controllers/ledgerController');
const isAuthenticated = require('../middleware/isAuthenticated');
const authorizeRole = require('../middleware/authorizeRole');

router.get('/dashboard', isAuthenticated, authorizeRole('AUDITOR', 'ADMIN'), LedgerController.renderDashboard);
router.get('/accounts', isAuthenticated, authorizeRole('AUDITOR', 'ADMIN'), LedgerController.renderAccounts);
router.get('/ledger', isAuthenticated, authorizeRole('AUDITOR', 'ADMIN'), LedgerController.renderLedger);
router.get('/reconciliation', isAuthenticated, authorizeRole('AUDITOR', 'ADMIN'), LedgerController.runReconciliation);

module.exports = router;

