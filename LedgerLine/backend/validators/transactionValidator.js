const Joi = require('joi');

const depositSchema = Joi.object({
  accountId: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid account ID',
    'any.required': 'Account is required'
  }),
  amount: Joi.number().positive().precision(2).min(1).max(5000000).required().messages({
    'number.base': 'Amount must be a valid number',
    'number.positive': 'Deposit amount must be greater than zero',
    'number.min': 'Minimum deposit is ₹ 1.00',
    'number.max': 'Deposit exceeds maximum allowable transaction limit (₹ 50,00,000)',
    'any.required': 'Deposit amount is required'
  }),
  idempotencyKey: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid idempotency key format (must be UUIDv4)',
    'any.required': 'Idempotency key is required for financial operations'
  }),
  description: Joi.string().max(255).allow('').optional(),
  _csrf: Joi.string().optional()
});

const withdrawSchema = Joi.object({
  accountId: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid account ID',
    'any.required': 'Account is required'
  }),
  amount: Joi.number().positive().precision(2).min(1).max(5000000).required().messages({
    'number.base': 'Amount must be a valid number',
    'number.positive': 'Withdrawal amount must be greater than zero',
    'number.min': 'Minimum withdrawal is ₹ 1.00',
    'number.max': 'Withdrawal exceeds maximum allowable transaction limit (₹ 50,00,000)',
    'any.required': 'Withdrawal amount is required'
  }),
  idempotencyKey: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid idempotency key format (must be UUIDv4)',
    'any.required': 'Idempotency key is required for financial operations'
  }),
  description: Joi.string().max(255).allow('').optional(),
  _csrf: Joi.string().optional()
});

const transferSchema = Joi.object({
  sourceAccountId: Joi.string().hex().length(24).required().messages({
    'string.length': 'Invalid source account ID',
    'any.required': 'Source account is required'
  }),
  destinationAccountNumber: Joi.string().trim().min(8).max(20).required().messages({
    'string.min': 'Destination account number must be at least 8 digits',
    'any.required': 'Destination account number is required'
  }),
  amount: Joi.number().positive().precision(2).min(1).max(5000000).required().messages({
    'number.base': 'Amount must be a valid number',
    'number.positive': 'Transfer amount must be greater than zero',
    'number.min': 'Minimum transfer is ₹ 1.00',
    'number.max': 'Transfer exceeds maximum allowable transaction limit (₹ 50,00,000)',
    'any.required': 'Transfer amount is required'
  }),
  idempotencyKey: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid idempotency key format (must be UUIDv4)',
    'any.required': 'Idempotency key is required for financial operations'
  }),
  description: Joi.string().max(255).allow('').optional(),
  _csrf: Joi.string().optional()
});

function validateDeposit(req, res, next) {
  const { error } = depositSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, errors: errorMessages });
    }
    req.flash('error', errorMessages.join('. '));
    return res.redirect(`/transactions/deposit${req.body.accountId ? '?account=' + req.body.accountId : ''}`);
  }
  next();
}

function validateWithdraw(req, res, next) {
  const { error } = withdrawSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, errors: errorMessages });
    }
    req.flash('error', errorMessages.join('. '));
    return res.redirect(`/transactions/withdraw${req.body.accountId ? '?account=' + req.body.accountId : ''}`);
  }
  next();
}

function validateTransfer(req, res, next) {
  const { error } = transferSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, errors: errorMessages });
    }
    req.flash('error', errorMessages.join('. '));
    return res.redirect(`/transactions/transfer${req.body.sourceAccountId ? '?from=' + req.body.sourceAccountId : ''}`);
  }
  next();
}

module.exports = {
  depositSchema,
  withdrawSchema,
  transferSchema,
  validateDeposit,
  validateWithdraw,
  validateTransfer
};

