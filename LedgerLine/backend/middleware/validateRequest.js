/**
 * Generic Joi schema validation middleware factory
 */
function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const messages = error.details.map(d => d.message);
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: messages
        });
      }
      req.flash('error', messages.join('. '));
      return res.redirect('back');
    }

    req[source] = value;
    next();
  };
}

module.exports = validateRequest;

