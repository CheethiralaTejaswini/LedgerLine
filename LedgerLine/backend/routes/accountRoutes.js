const express = require('express');
const router = express.Router();
const AccountController = require('../controllers/accountController');
const isAuthenticated = require('../middleware/isAuthenticated');
const authorizeRole = require('../middleware/authorizeRole');
const checkAccountOwnership = require('../middleware/checkAccountOwnership');
const { validateCreateAccount } = require('../validators/accountValidator');

router.get('/new', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), AccountController.renderCreateAccount);
router.get('/lookup', isAuthenticated, AccountController.lookupAccount);
router.post('/', isAuthenticated, authorizeRole('ACCOUNT_HOLDER'), validateCreateAccount, AccountController.createAccount);

router.get('/:id/statement/export', isAuthenticated, checkAccountOwnership, AccountController.exportStatementCSV);
router.get('/:id/statement', isAuthenticated, checkAccountOwnership, AccountController.renderStatement);
router.get('/:id', isAuthenticated, checkAccountOwnership, AccountController.getAccountDetails);

module.exports = router;

