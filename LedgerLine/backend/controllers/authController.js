const passport = require('passport');
const User = require('../models/User');
const AccountService = require('../services/accountService');

class AuthController {
  static renderRegister(req, res) {
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard');
    }
    res.render('auth/register', {
      title: 'Register - LedgerLine',
      user: null
    });
  }

  static async register(req, res, next) {
    try {
      const { username, email, fullName, phone, role, password } = req.body;

      // Restrict registration to ACCOUNT_HOLDER or AUDITOR (ADMIN cannot be freely registered)
      const assignedRole = role === 'AUDITOR' ? 'AUDITOR' : 'ACCOUNT_HOLDER';

      const newUser = new User({
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        phone: (phone || '').trim(),
        role: assignedRole,
        status: 'ACTIVE'
      });

      const registeredUser = await User.register(newUser, password);

      // If registered as ACCOUNT_HOLDER, automatically provision their first primary Savings account
      if (assignedRole === 'ACCOUNT_HOLDER') {
        await AccountService.createAccount(registeredUser._id, 'SAVINGS', 0);
      }

      // Log user in automatically after registration
      req.login(registeredUser, err => {
        if (err) return next(err);

        req.flash('success', `Welcome to LedgerLine, ${registeredUser.fullName}! Your account has been initialized.`);

        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: {
              id: registeredUser._id,
              username: registeredUser.username,
              email: registeredUser.email,
              role: registeredUser.role
            }
          });
        }

        return res.redirect('/dashboard');
      });
    } catch (error) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      req.flash('error', error.message);
      return res.redirect('/auth/register');
    }
  }

  static renderLogin(req, res) {
    if (req.isAuthenticated()) {
      return res.redirect('/dashboard');
    }
    res.render('auth/login', {
      title: 'Sign In - LedgerLine',
      user: null
    });
  }

  static login(req, res, next) {
    passport.authenticate('local', (err, user, info) => {
      if (err) return next(err);

      if (!user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(401).json({
            success: false,
            message: info?.message || 'Invalid username or password.'
          });
        }
        req.flash('error', info?.message || 'Invalid username or password.');
        return res.redirect('/auth/login');
      }

      req.login(user, loginErr => {
        if (loginErr) return next(loginErr);

        req.flash('success', `Welcome back, ${user.fullName}!`);

        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              role: user.role
            }
          });
        }

        const redirectUrl = req.session.returnTo || '/dashboard';
        delete req.session.returnTo;
        return res.redirect(redirectUrl);
      });
    })(req, res, next);
  }

  static logout(req, res, next) {
    req.logout(err => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie('ledgerline.sid');
        res.redirect('/auth/login');
      });
    });
  }
}

module.exports = AuthController;

