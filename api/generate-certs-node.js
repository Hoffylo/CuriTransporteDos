#!/usr/bin/env node
/**
 * Generador de certificados SSL usando Node.js nativo
 * No requiere OpenSSL instalado
 * 
 * Uso: npm run generate-certs-node
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SSL_DIR = path.join(__dirname, 'ssl');
const DAYS_VALID = 365;

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
};

// Crear directorio SSL si no existe
function ensureSSLDir() {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
    log.success(`Directorio creado: ${SSL_DIR}`);
  }
}

// Generar certificados usando Node.js crypto
function generateCertificates() {
  log.info('Generando par de claves RSA 2048 bits...');
  
  // Generar par de claves RSA
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  log.success('Par de claves generado');

  // Generar certificado auto-firmado usando la API de crypto
  // Node.js no tiene API nativa para X.509, así que creamos un certificado básico
  const keyPath = path.join(SSL_DIR, 'server.key');
  const certPath = path.join(SSL_DIR, 'server.crt');

  // Guardar clave privada
  fs.writeFileSync(keyPath, privateKey);
  log.success(`Clave privada guardada: ${keyPath}`);

  // Para el certificado, necesitamos usar una biblioteca externa o OpenSSL
  // Como alternativa, guardamos la clave pública
  const pubKeyPath = path.join(SSL_DIR, 'server.pub');
  fs.writeFileSync(pubKeyPath, publicKey);
  log.success(`Clave pública guardada: ${pubKeyPath}`);

  return { keyPath, pubKeyPath };
}

async function main() {
  console.log('\n🔐 Generador de Claves SSL para TLS 1.3 (Node.js Nativo)\n');
  console.log('━'.repeat(50));

  ensureSSLDir();

  try {
    generateCertificates();

    console.log('\n' + '━'.repeat(50));
    log.warn('IMPORTANTE: Node.js no puede generar certificados X.509 nativamente');
    log.info('');
    log.info('Opciones para obtener certificados:');
    console.log('');
    console.log('  1. DESARROLLO - Usar mkcert (recomendado):');
    console.log('     choco install mkcert');
    console.log('     mkcert -install');
    console.log('     cd ssl && mkcert localhost 127.0.0.1 ::1');
    console.log('');
    console.log('  2. DESARROLLO - Instalar OpenSSL:');
    console.log('     choco install openssl');
    console.log('     npm run generate-certs');
    console.log('');
    console.log('  3. PRODUCCIÓN - Let\'s Encrypt (gratis):');
    console.log('     certbot certonly --standalone -d tudominio.com');
    console.log('');
    console.log('  4. PRODUCCIÓN - AWS Certificate Manager');
    console.log('     (Si usas AWS ALB/CloudFront)');
    console.log('');
    
  } catch (error) {
    log.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
