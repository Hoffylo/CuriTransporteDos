// api/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { verificarToken, esAdmin } = require('./middleware/auth');

require('dotenv').config();

const app = express();

// ========== MIDDLEWARES GLOBALES CON SEGURIDAD TLS ==========

// Helmet con configuración de seguridad mejorada para TLS
app.use(helmet({
  // Strict-Transport-Security: fuerza HTTPS
  strictTransportSecurity: {
    maxAge: 31536000,           // 1 año
    includeSubDomains: true,
    preload: true
  },
  // Prevenir downgrade attacks
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Para Swagger UI
      styleSrc: ["'self'", "'unsafe-inline'"],  // Para Swagger UI
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: process.env.ENABLE_HTTPS === 'true' ? [] : null,
    }
  },
  // Prevenir clickjacking
  frameguard: { action: 'deny' },
  // Ocultar X-Powered-By
  hidePoweredBy: true,
  // Prevenir MIME sniffing
  noSniff: true,
  // XSS Protection
  xssFilter: true,
}));

// Middleware para forzar HTTPS en producción
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      next();
    } else {
      res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  });
}

app.use(cors()); 
app.use(morgan('dev')); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== SWAGGER/OPENAPI ==========
// Configurar servidores según el entorno
const getSwaggerServers = () => {
  const servers = [];
  
  // Servidor de producción (IP Elástica o dominio)
  if (process.env.API_BASE_URL) {
    servers.push({
      url: process.env.API_BASE_URL,
      description: 'Servidor de producción',
    });
  }
  
  // Servidor de desarrollo
  servers.push({
    url: `http://localhost:${process.env.PORT || 3001}`,
    description: 'Servidor de desarrollo',
  });
  
  return servers;
};

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Curitransporte API',
      version: '1.0.0',
      description: 'API de geolocalización colaborativa de buses en Curicó - Millennium',
      contact: {
        name: 'Equipo Curitransporte',
        email: 'support@curitransporte.cl',
      },
    },
    servers: getSwaggerServers(),
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa tu JWT token aquí'
        },
      },
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'],

};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.get('/api.json', (req, res) => res.json(specs));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar estado del servidor
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Servidor funcionando
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

const API_PREFIX = '/api/v1';

// ========== RUTAS PÚBLICAS (SIN autenticación) ==========
app.use(`${API_PREFIX}/auth`, require('./routes/routeAuth'));
app.use(`${API_PREFIX}/evento`, require('./routes/routeEvento'));
app.use(`${API_PREFIX}/paraderos`, require('./routes/routeParadero'));
app.use(`${API_PREFIX}/rutas`, require('./routes/routeRuta'));
app.use(`${API_PREFIX}/reportes`, require('./routes/routeReportes'));
app.use(`${API_PREFIX}/ubicaciones`, require('./routes/routeUbicacion'));
app.use(`${API_PREFIX}/buses`, require('./routes/routeBuses'));

// ========== RUTAS PROTEGIDAS (CON autenticación) ==========
app.use(`${API_PREFIX}/usuarios`, verificarToken, require('./routes/routeUsuarios'));
app.use(`${API_PREFIX}/notificaciones`, verificarToken, require('./routes/routeNotificaciones'));
app.use(`${API_PREFIX}/valoraciones`, verificarToken, require('./routes/routeValoraciones'));
app.use(`${API_PREFIX}/votos`, verificarToken, require('./routes/routeVotos'));
app.use(`${API_PREFIX}/configuracion`, verificarToken, require('./routes/routeConfiguracion'));

// ========== RUTAS DE TELEMETRÍA Y CLUSTERING ==========
app.use(`${API_PREFIX}/telemetria`, require('./routes/routeTelemetria'));
app.use(`${API_PREFIX}/cluster`, require('./routes/routeCluster'));

// ========== INICIAR SCHEDULER DE LIMPIEZA DE CLUSTERS ==========
require('./services/clusteringService');
console.log('✅ ClusteringService cargado - Scheduler de limpieza activo');

// ========== RESPONSE FORMATTER ==========
app.use(require('./middleware/responseformatter'));

// ========== 404 HANDLER ==========
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method,
    message: `${req.method} ${req.path} no existe en esta API`,
  });
});

// ========== ERROR HANDLER (SIEMPRE AL FINAL) ==========
app.use(require('./middleware/errorhandle'));

if (process.env.ENABLE_SCHEDULER === 'true') {
  const { startReportesScheduler } = require('./services/SchedulerReportes');
  startReportesScheduler();
}

module.exports = app;
