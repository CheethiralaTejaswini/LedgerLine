const Joi = require('joi');

const createAccountSchema = Joi.object({
  accountType: Joi.string().valid('SAVINGS', 'CURRENT', 'BUSINESS').required().messages({
    'any.only': 'Account type must be SAVINGS, CURRENT, or BUSINESS',
    'any.required': 'Account type is required'
  }),
  initialDeposit: Joi.number().min(0).max(10000000).default(0).messages({
    'number.min': 'Initial deposit cannot be negative',
    'number.max': 'Initial deposit exceeds single transaction limit'
  }),
  _csrf: Joi.string().optional()
});

function validateCreateAccount(req, res, next) {
  const { error } = createAccountSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, errors: errorMessages });
    }
    req.flash('error', errorMessages.join('. '));
    return res.redirect('/accounts/new');
  }
  next();
}

module.exports = {
  createAccountSchema,
  validateCreateAccount
};

