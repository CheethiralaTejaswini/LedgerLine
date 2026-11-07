const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const isAuthenticated = require('../middleware/isAuthenticated');

router.get('/dashboard', isAuthenticated, UserController.renderDashboard);

module.exports = router;

