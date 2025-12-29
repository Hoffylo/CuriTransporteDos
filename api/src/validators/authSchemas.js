const Joi = require('joi');

// Esquemas de validación para registro y login
const nombreApellidoPattern = /^[\p{L}\s]+$/u; // Solo letras y espacios

const registroSchema = Joi.object({
  username: Joi.string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[A-Za-z0-9_]+$/)
    .messages({
      'string.pattern.base': 'El username solo puede contener letras, números y guion bajo'
    })
    .required(),
  nombre: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(nombreApellidoPattern)
    .messages({
      'string.pattern.base': 'El nombre solo puede contener letras y espacios'
    })
    .required(),
  apellido: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(nombreApellidoPattern)
    .messages({
      'string.pattern.base': 'El apellido solo puede contener letras y espacios'
    })
    .required(),
  correo: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required(),
  password: Joi.string()
    .min(8)
    .max(16)
    .required(),
  usuario_anonimo_id: Joi.string()
    .trim()
    .pattern(/^anon_[A-Za-z0-9-]+$/)
    .optional()
});

const loginSchema = Joi.object({
  correo: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required(),
  password: Joi.string()
    .min(8)
    .max(16)
    .required(),
  usuario_anonimo_id: Joi.string()
    .trim()
    .pattern(/^anon_[A-Za-z0-9-]+$/)
    .optional()
});

module.exports = {
  registroSchema,
  loginSchema,
};
