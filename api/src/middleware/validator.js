// middleware/validator.js
const Joi = require('joi');

module.exports = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const detalles = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));

      const err = new Error('Validación fallida');
      err.name = 'ValidationError';
      err.detalles = detalles;
      err.status = 400;
      return next(err);
    }

    req.validatedBody = value;
    next();
  };
};
