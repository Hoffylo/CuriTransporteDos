// middleware/cors.js
const corsLib = require('cors');
require('dotenv').config();

const corsOptions = {
  // Para apps móviles (Flutter/React Native): permitir cualquier origen
  // Las apps móviles no envían header Origin, así que CORS no las bloquea
  // En producción puedes restringir si tienes un frontend web
  origin: (origin, callback) => {
    // Permitir requests sin origin (apps móviles, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // En desarrollo: permitir todo
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción: verificar lista de orígenes permitidos
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    callback(new Error('No permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400, // Cache preflight por 24 horas
};

module.exports = corsLib(corsOptions);
