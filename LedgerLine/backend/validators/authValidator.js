const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': 'Username must only contain letters and numbers',
    'string.min': 'Username must be at least 3 characters',
    'string.max': 'Username cannot exceed 30 characters',
    'any.required': 'Username is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Full name must be at least 2 characters',
    'any.required': 'Full name is required'
  }),
  password: Joi.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'any.required': 'Password is required'
  }),
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Password confirmation is required'
  }),
  role: Joi.string().valid('ACCOUNT_HOLDER', 'AUDITOR').default('ACCOUNT_HOLDER'),
  phone: Joi.string().allow('').optional(),
  _csrf: Joi.string().optional()
});

const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': 'Username or email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  }),
  _csrf: Joi.string().optional()
});

function validateRegister(req, res, next) {
  const { error } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, errors: errorMessages });
    }
    req.flash('error', errorMessages.join('. '));
    return res.redirect('/auth/register');
  }
  next();
}

function validateLogin(req, res, next) {
  const { error } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessages = error.details.map(d => d.message);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, errors: errorMessages });
    }
    req.flash('error', errorMessages.join('. '));
    return res.redirect('/auth/login');
  }
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  registerSchema,
  loginSchema
};

