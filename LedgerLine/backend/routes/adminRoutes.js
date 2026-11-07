const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const isAuthenticated = require('../middleware/isAuthenticated');
const authorizeRole = require('../middleware/authorizeRole');

router.use(isAuthenticated, authorizeRole('ADMIN'));

router.get('/dashboard', AdminController.renderDashboard);
router.get('/users', AdminController.renderUsers);
router.post('/users/:userId/status', AdminController.updateUserStatus);
router.get('/accounts', AdminController.renderAccounts);
router.post('/accounts/:accountId/status', AdminController.updateAccountStatus);
router.get('/transactions', AdminController.renderTransactions);

module.exports = router;

