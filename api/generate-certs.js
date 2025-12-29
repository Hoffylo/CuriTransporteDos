#!/usr/bin/env node
/**
 * Script para generar certificados SSL auto-firmados
 * Para desarrollo y testing con TLS 1.3
 * 
 * Uso: npm run generate-certs
 * 
 * NOTA: En producción, usa certificados de una CA real
 * como Let's Encrypt, DigiCert, etc.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SSL_DIR = path.join(__dirname, 'ssl');
const DAYS_VALID = 365;
const KEY_SIZE = 4096; // RSA 4096 bits para mayor seguridad

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

// Verificar que OpenSSL esté instalado
function checkOpenSSL() {
  try {
    const version = execSync('openssl version', { encoding: 'utf8' });
    log.info(`OpenSSL detectado: ${version.trim()}`);
    return true;
  } catch (error) {
    log.error('OpenSSL no está instalado o no está en el PATH');
    log.info('Instala OpenSSL:');
    log.info('  Windows: choco install openssl');
    log.info('  Ubuntu: sudo apt install openssl');
    log.info('  macOS: brew install openssl');
    return false;
  }
}

// Crear directorio SSL si no existe
function ensureSSLDir() {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
    log.success(`Directorio creado: ${SSL_DIR}`);
  }
}

// Generar clave privada RSA
function generatePrivateKey() {
  const keyPath = path.join(SSL_DIR, 'server.key');
  
  log.info(`Generando clave privada RSA ${KEY_SIZE} bits...`);
  
  execSync(`openssl genrsa -out "${keyPath}" ${KEY_SIZE}`, {
    stdio: 'inherit',
  });
  
  log.success(`Clave privada generada: ${keyPath}`);
  return keyPath;
}

// Generar CSR (Certificate Signing Request)
function generateCSR(keyPath) {
  const csrPath = path.join(SSL_DIR, 'server.csr');
  const configPath = path.join(SSL_DIR, 'openssl.cnf');
  
  // Configuración OpenSSL para el certificado
  const opensslConfig = `
[req]
default_bits = ${KEY_SIZE}
prompt = no
default_md = sha384
distinguished_name = dn
req_extensions = req_ext
x509_extensions = v3_ca

[dn]
C = CL
ST = Maule
L = Curico
O = Curitransporte
OU = Development
CN = localhost

[req_ext]
subjectAltName = @alt_names

[v3_ca]
subjectAltName = @alt_names
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = curitransporte.local
DNS.4 = api.curitransporte.local
IP.1 = 127.0.0.1
IP.2 = ::1
`;

  fs.writeFileSync(configPath, opensslConfig);
  log.info('Generando CSR...');
  
  execSync(`openssl req -new -key "${keyPath}" -out "${csrPath}" -config "${configPath}"`, {
    stdio: 'inherit',
  });
  
  log.success(`CSR generado: ${csrPath}`);
  return { csrPath, configPath };
}

// Generar certificado auto-firmado
function generateCertificate(keyPath, configPath) {
  const certPath = path.join(SSL_DIR, 'server.crt');
  
  log.info(`Generando certificado auto-firmado (válido ${DAYS_VALID} días)...`);
  
  execSync(
    `openssl req -x509 -nodes -days ${DAYS_VALID} -key "${keyPath}" -out "${certPath}" -config "${configPath}" -extensions v3_ca`,
    { stdio: 'inherit' }
  );
  
  log.success(`Certificado generado: ${certPath}`);
  return certPath;
}

// Mostrar información del certificado
function showCertInfo(certPath) {
  log.info('\n📋 Información del certificado:');
  
  try {
    const info = execSync(`openssl x509 -in "${certPath}" -text -noout`, {
      encoding: 'utf8',
    });
    
    // Extraer información relevante
    const subject = info.match(/Subject:(.+)/)?.[1]?.trim() || 'N/A';
    const validity = info.match(/Not After :(.+)/)?.[1]?.trim() || 'N/A';
    const signatureAlgo = info.match(/Signature Algorithm:(.+)/)?.[1]?.trim() || 'N/A';
    
    console.log(`   Subject: ${subject}`);
    console.log(`   Válido hasta: ${validity}`);
    console.log(`   Algoritmo: ${signatureAlgo}`);
  } catch (error) {
    log.warn('No se pudo leer la información del certificado');
  }
}

// Función principal
async function main() {
  console.log('\n🔐 Generador de Certificados SSL para TLS 1.3\n');
  console.log('━'.repeat(50));

  // Verificar OpenSSL
  if (!checkOpenSSL()) {
    process.exit(1);
  }

  // Crear directorio
  ensureSSLDir();

  // Verificar si ya existen certificados
  const keyPath = path.join(SSL_DIR, 'server.key');
  const certPath = path.join(SSL_DIR, 'server.crt');
  
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    log.warn('Ya existen certificados en el directorio SSL');
    log.info('Eliminando certificados antiguos...');
    
    fs.unlinkSync(keyPath);
    fs.unlinkSync(certPath);
    
    const csrPath = path.join(SSL_DIR, 'server.csr');
    if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);
  }

  try {
    // Generar clave privada
    const generatedKeyPath = generatePrivateKey();
    
    // Generar CSR y configuración
    const { configPath } = generateCSR(generatedKeyPath);
    
    // Generar certificado
    const generatedCertPath = generateCertificate(generatedKeyPath, configPath);
    
    // Mostrar información
    showCertInfo(generatedCertPath);
    
    console.log('\n' + '━'.repeat(50));
    log.success('¡Certificados SSL generados exitosamente!\n');
    
    console.log('📝 Para usar HTTPS, configura las variables de entorno:');
    console.log('   ENABLE_HTTPS=true');
    console.log('   HTTPS_PORT=3443');
    console.log('   TLS_STRICT=true  # Solo TLS 1.3');
    console.log('');
    console.log('🚀 Luego inicia el servidor:');
    console.log('   npm run dev\n');
    
    log.warn('NOTA: Este certificado es auto-firmado (solo para desarrollo)');
    log.info('En producción, usa certificados de Let\'s Encrypt o similar\n');
    
  } catch (error) {
    log.error(`Error generando certificados: ${error.message}`);
    process.exit(1);
  }
}

main();
