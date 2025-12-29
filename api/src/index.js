// api/src/index.js
require('dotenv').config();

const https = require('https');
const http = require('http');
const app = require('./app');
const { getTLSOptions, getTLSOptionsCompatible, checkTLSSupport } = require('./config/tls');

const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'false';
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const TLS_STRICT = process.env.TLS_STRICT !== 'false'; // TLS 1.3 only por defecto

console.log(`📦 Environment: ${NODE_ENV}`);
console.log(`🔌 Puerto: ${PORT}`);

// ════════════════════════════════════════════════════════════════
// MODO DUAL: MOCK DATA vs POSTGRESQL
// ════════════════════════════════════════════════════════════════

let pool = null;

if (USE_MOCK_DATA) {
  console.log('\n🔵 MODO: Mock Data (Testing)');
  console.log('   Usando datos simulados en memoria');
  console.log('   No se requiere base de datos\n');
} else {
  console.log('\n🟢 MODO: PostgreSQL RDS (Producción)');
  console.log(`   Base de datos: ${process.env.DB_NAME || 'postgres'}`);
  console.log(`   Host: ${process.env.DB_HOST}\n`);

  try {
    pool = require('./config/database');

    console.log('🔍 Probando conexión a PostgreSQL...');
    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
        process.exit(1);
      } else {
        console.log('✅ PostgreSQL conectado correctamente\n');
      }
    });
  } catch (err) {
    console.error('❌ Error cargando configuración de BD:', err.message);
    process.exit(1);
  }
}

// ════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR (HTTP o HTTPS con TLS 1.3)
// ════════════════════════════════════════════════════════════════

let server;
let httpsServer;

if (ENABLE_HTTPS) {
  // Verificar soporte TLS
  console.log('\n🔐 Configurando HTTPS con TLS...');
  const hasTLS13 = checkTLSSupport();
  
  if (!hasTLS13) {
    console.warn('⚠️  TLS 1.3 no disponible, usando TLS 1.2+');
  }

  // Obtener opciones TLS
  const tlsOptions = TLS_STRICT ? getTLSOptions() : getTLSOptionsCompatible();
  
  if (tlsOptions) {
    // Servidor HTTPS con TLS 1.3
    httpsServer = https.createServer(tlsOptions, app);
    
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`\n🔒 Servidor HTTPS corriendo en puerto ${HTTPS_PORT}`);
      console.log(`   TLS Version: ${TLS_STRICT ? 'TLS 1.3 only' : 'TLS 1.2+'}`);
      console.log(`📍 Base URL: https://localhost:${HTTPS_PORT}`);
      console.log(`📚 Documentación: https://localhost:${HTTPS_PORT}/api-docs`);
      console.log(`🏥 Health Check: https://localhost:${HTTPS_PORT}/health\n`);
    });

    // Servidor HTTP que redirige a HTTPS (opcional)
    if (process.env.REDIRECT_HTTP === 'true') {
      server = http.createServer((req, res) => {
        const host = req.headers.host?.split(':')[0] || 'localhost';
        res.writeHead(301, { 
          'Location': `https://${host}:${HTTPS_PORT}${req.url}`,
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
        });
        res.end();
      });
      
      server.listen(PORT, () => {
        console.log(`🔄 Servidor HTTP (redirect) en puerto ${PORT} → HTTPS:${HTTPS_PORT}`);
      });
    }
  } else {
    console.error('❌ No se encontraron certificados SSL');
    console.error('   Genera certificados con: npm run generate-certs');
    console.error('   O desactiva HTTPS: ENABLE_HTTPS=false');
    process.exit(1);
  }
} else {
  // Servidor HTTP normal (desarrollo)
  server = app.listen(PORT, () => {
    console.log(`\n⚠️  Servidor HTTP (sin TLS) corriendo en puerto ${PORT}`);
    console.log(`   Para habilitar HTTPS: ENABLE_HTTPS=true`);
    console.log(`📍 Base URL: http://localhost:${PORT}`);
    console.log(`📚 Documentación: http://localhost:${PORT}/api-docs`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`📋 OpenAPI: http://localhost:${PORT}/api.json\n`);
  });
}

// ════════════════════════════════════════════════════════════════
// MANEJO DE ERRORES DEL SERVIDOR
// ════════════════════════════════════════════════════════════════

const handleServerError = (error, serverType, port) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Puerto ${port} (${serverType}) ya está en uso`);
    console.error('   Opción 1: Mata todos los node processes:');
    console.error('   Get-Process node | Stop-Process -Force');
    console.error('   Opción 2: Cambia el puerto:');
    console.error(`   $env:${serverType === 'HTTPS' ? 'HTTPS_PORT' : 'PORT'}="3002"; npm run dev`);
    process.exit(1);
  } else {
    console.error(`❌ Error en servidor ${serverType}:`, error.message);
    process.exit(1);
  }
};

if (server) {
  server.on('error', (error) => handleServerError(error, 'HTTP', PORT));
}
if (httpsServer) {
  httpsServer.on('error', (error) => handleServerError(error, 'HTTPS', HTTPS_PORT));
}

// ════════════════════════════════════════════════════════════════
// MANEJO DE ERRORES GLOBALES
// ════════════════════════════════════════════════════════════════

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  if (NODE_ENV === 'production') {
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════════
// CIERRE GRACEFUL
// ════════════════════════════════════════════════════════════════

const gracefulShutdown = (signal) => {
  console.log(`📢 ${signal} recibido, cerrando servidor...`);
  
  const closeServer = (srv, name) => {
    return new Promise((resolve) => {
      if (srv) {
        srv.close(() => {
          console.log(`✅ Servidor ${name} cerrado`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  Promise.all([
    closeServer(server, 'HTTP'),
    closeServer(httpsServer, 'HTTPS')
  ]).then(() => {
    if (pool && !USE_MOCK_DATA) {
      pool.end(() => {
        console.log('✅ Conexiones a BD cerradas');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, httpsServer, pool };
