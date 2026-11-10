const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const passport = require('passport');

const createSessionConfig = require('./config/session');
const configurePassport = require('./config/passport');
const csrfProtection = require('./middleware/csrfProtection');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { formatPaiseToINR } = require('./utils/currencyHelper');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

const securityHeaders = require('./middleware/securityHeaders');

// Trust reverse proxy (Render, Heroku, AWS ELB, NGINX) for secure cookies
app.set('trust proxy', 1);

// Apply Enterprise Security Headers globally
app.use(securityHeaders);

// View engine setup
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Static assets
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Request parsing & Method Override
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(methodOverride('_method'));

// Session & Flash
app.use(createSessionConfig());
app.use(flash());

// Authentication (Passport)
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Global Template Variables & Utilities (Mounted before CSRF so error handlers always have locals)
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currUser = req.user || null;
  res.locals.user = req.user || null;
  res.locals.formatINR = formatPaiseToINR;
  res.locals.currentPath = req.path || '';
  res.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
  next();
});

// Health check endpoint (exempt from CSRF for uptime monitors)
app.use('/health', healthRoutes);

// CSRF Protection
app.use(csrfProtection);

// Landing Page
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('home', {
    title: 'LedgerLine – Secure Money Transfer & Ledger Management System',
    user: null
  });
});

// Mount Application Routes
app.use('/auth', authRoutes);
app.use('/', userRoutes);
app.use('/accounts', accountRoutes);
app.use('/transactions', transactionRoutes);
app.use('/auditor', ledgerRoutes);
app.use('/admin', adminRoutes);
app.use('/payments', paymentRoutes);

// Access Denied Helper Route
app.get('/access-denied', (req, res) => {
  res.status(403).render('errors/403', {
    title: 'Access Denied',
    user: req.user,
    message: 'You do not have permission to access the requested resource.'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

