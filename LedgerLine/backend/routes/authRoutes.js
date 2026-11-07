const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../validators/authValidator');
const { authLimiter } = require('../middleware/rateLimiter');

router.get('/register', AuthController.renderRegister);
router.post('/register', authLimiter, validateRegister, AuthController.register);

router.get('/login', AuthController.renderLogin);
router.post('/login', authLimiter, validateLogin, AuthController.login);

router.all('/logout', AuthController.logout);

module.exports = router;

