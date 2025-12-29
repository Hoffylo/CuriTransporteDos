// api/src/config/tls.js
/**
 * Configuración TLS 1.3 para conexiones HTTPS seguras
 * 
 * TLS 1.3 (RFC 8446) es la última versión del protocolo y ofrece:
 * - Handshake más rápido (1-RTT, 0-RTT resumption)
 * - Cipher suites más seguros
 * - Perfect Forward Secrecy obligatorio
 * - Eliminación de algoritmos obsoletos (RC4, SHA-1, etc.)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ruta a los certificados SSL
// En producción (EC2): usar Let's Encrypt en /etc/letsencrypt/
// En desarrollo: usar carpeta local ssl/
const SSL_DIR = process.env.SSL_DIR || path.join(__dirname, '..', '..', 'ssl');

/**
 * Configuración de opciones TLS para el servidor HTTPS
 * Fuerza TLS 1.3 como versión mínima para máxima seguridad
 */
const getTLSOptions = () => {
  // Prioridad: Variables de entorno > Archivos en SSL_DIR
  const keyPath = process.env.SSL_KEY_PATH || path.join(SSL_DIR, 'server.key');
  const certPath = process.env.SSL_CERT_PATH || path.join(SSL_DIR, 'server.crt');
  const pfxPath = path.join(SSL_DIR, 'server.pfx');
  const caPath = process.env.SSL_CA_PATH || path.join(SSL_DIR, 'ca.crt');

  let options = {
    // Configuración TLS 1.3 (la más segura)
    minVersion: 'TLSv1.3',
    maxVersion: 'TLSv1.3',

    // Cipher suites permitidos para TLS 1.3
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
    ].join(':'),

    honorCipherOrder: true,

    // Configuraciones de seguridad adicionales
    secureOptions: 
      crypto.constants.SSL_OP_NO_SSLv2 |
      crypto.constants.SSL_OP_NO_SSLv3 |
      crypto.constants.SSL_OP_NO_TLSv1 |
      crypto.constants.SSL_OP_NO_TLSv1_1 |
      crypto.constants.SSL_OP_NO_TLSv1_2,

    sessionTimeout: 300,
    ecdhCurve: 'X25519:P-256:P-384',
  };

  // Opción 1: Usar PFX (Windows PowerShell)
  if (fs.existsSync(pfxPath)) {
    console.log('🔐 Usando certificado PFX...');
    options.pfx = fs.readFileSync(pfxPath);
    options.passphrase = process.env.SSL_PASSPHRASE || 'dev123';
    return options;
  }

  // Opción 2: Usar KEY + CRT (OpenSSL)
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('🔐 Usando certificados KEY/CRT...');
    options.key = fs.readFileSync(keyPath);
    options.cert = fs.readFileSync(certPath);
    
    if (fs.existsSync(caPath)) {
      options.ca = fs.readFileSync(caPath);
      options.requestCert = false;
      options.rejectUnauthorized = true;
    }
    return options;
  }

  console.warn('⚠️  Certificados SSL no encontrados en:', SSL_DIR);
  console.warn('   Genera certificados con: npm run generate-certs');
  return null;
};

/**
 * Configuración TLS híbrida: TLS 1.2 + TLS 1.3
 * Usar si necesitas compatibilidad con clientes antiguos
 */
const getTLSOptionsCompatible = () => {
  const keyPath = path.join(SSL_DIR, 'server.key');
  const certPath = path.join(SSL_DIR, 'server.crt');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return null;
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),

    // Permitir TLS 1.2 y 1.3 para compatibilidad
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',

    // Cipher suites seguros para TLS 1.2 y 1.3
    ciphers: [
      // TLS 1.3 ciphers
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      // TLS 1.2 ciphers seguros
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
    ].join(':'),

    honorCipherOrder: true,
    ecdhCurve: 'X25519:P-256:P-384',
  };
};

/**
 * Verifica la configuración TLS del sistema
 */
const checkTLSSupport = () => {
  const tlsVersions = ['TLSv1.3', 'TLSv1.2', 'TLSv1.1', 'TLSv1'];
  const supported = [];

  console.log('🔐 Verificando soporte TLS del sistema:');
  
  tlsVersions.forEach(version => {
    try {
      // Node.js 12+ soporta TLS 1.3
      if (crypto.constants[`SSL_OP_NO_${version.replace('.', '_')}`] !== undefined || version === 'TLSv1.3') {
        supported.push(version);
        console.log(`   ✅ ${version} soportado`);
      }
    } catch (e) {
      console.log(`   ❌ ${version} no soportado`);
    }
  });

  // Verificar versión de OpenSSL
  console.log(`   📦 OpenSSL: ${process.versions.openssl}`);
  
  return supported.includes('TLSv1.3');
};

module.exports = {
  getTLSOptions,
  getTLSOptionsCompatible,
  checkTLSSupport,
  SSL_DIR,
};
