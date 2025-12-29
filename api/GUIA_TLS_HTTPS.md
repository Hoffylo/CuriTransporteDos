# 🔐 Guía de Implementación TLS 1.3 - Curitransporte API

## Resumen

Esta guía explica cómo configurar **TLS 1.3** (la última versión del protocolo) para asegurar los datos en tránsito en la API de Curitransporte.

## ¿Qué es TLS 1.3?

TLS 1.3 (RFC 8446, agosto 2018) es la versión más reciente y segura del protocolo Transport Layer Security:

| Característica | TLS 1.2 | TLS 1.3 |
|----------------|---------|---------|
| Handshake RTT | 2-RTT | 1-RTT (0-RTT resumption) |
| Cipher Suites | 37+ | Solo 5 (más seguros) |
| Forward Secrecy | Opcional | Obligatorio |
| Algoritmos obsoletos | Permitidos | Eliminados |
| Rendimiento | Base | ~40% más rápido |

---

## 🚀 Guía Rápida

### Paso 1: Generar Certificados (Desarrollo)

**Opción A: Usando mkcert (Recomendado para Windows)**
```powershell
# Instalar mkcert
choco install mkcert

# Instalar CA local
mkcert -install

# Generar certificados
cd api/ssl
mkcert localhost 127.0.0.1 ::1

# Renombrar archivos
mv localhost+2.pem server.crt
mv localhost+2-key.pem server.key
```

**Opción B: Usando OpenSSL**
```powershell
# Instalar OpenSSL
choco install openssl

# Generar certificados
npm run generate-certs
```

**Opción C: Certificados de prueba rápidos (PowerShell)**
```powershell
# Crear certificado auto-firmado en Windows
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1)

# Exportar clave privada y certificado
$pwd = ConvertTo-SecureString -String "password123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "api\ssl\server.pfx" -Password $pwd
```

### Paso 2: Configurar Variables de Entorno

Crea o edita el archivo `.env`:
```env
# Habilitar HTTPS
ENABLE_HTTPS=true
HTTPS_PORT=3443

# Solo TLS 1.3 (máxima seguridad)
TLS_STRICT=true

# Redirigir HTTP a HTTPS
REDIRECT_HTTP=true
```

### Paso 3: Iniciar el Servidor

```powershell
# Modo desarrollo con HTTPS
npm run start:https

# O con TLS estricto (solo 1.3)
npm run start:https:strict
```

---

## 📁 Estructura de Archivos

```
api/
├── ssl/                          # Certificados SSL
│   ├── server.key               # Clave privada
│   ├── server.crt               # Certificado
│   └── ca.crt                   # CA (opcional)
├── src/
│   ├── config/
│   │   └── tls.js               # Configuración TLS
│   ├── app.js                   # Express con Helmet
│   └── index.js                 # Servidor HTTP/HTTPS
├── .env.example                 # Ejemplo de configuración
└── generate-certs.js            # Script generador
```

---

## 🔧 Configuración Detallada

### Archivo: `src/config/tls.js`

Este archivo contiene la configuración TLS:

```javascript
// Configuración TLS 1.3 estricta
const options = {
  key: fs.readFileSync('ssl/server.key'),
  cert: fs.readFileSync('ssl/server.crt'),
  
  // Solo TLS 1.3
  minVersion: 'TLSv1.3',
  maxVersion: 'TLSv1.3',
  
  // Cipher suites de TLS 1.3
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ].join(':'),
  
  // ECDH curves para Perfect Forward Secrecy
  ecdhCurve: 'X25519:P-256:P-384',
};
```

### Cipher Suites en TLS 1.3

| Cipher Suite | Descripción | Uso |
|--------------|-------------|-----|
| `TLS_AES_256_GCM_SHA384` | AES-256 con GCM | Máxima seguridad |
| `TLS_CHACHA20_POLY1305_SHA256` | ChaCha20-Poly1305 | Mejor para móviles |
| `TLS_AES_128_GCM_SHA256` | AES-128 con GCM | Balance rendimiento/seguridad |

---

## 🛡️ Headers de Seguridad (Helmet)

La configuración incluye headers HTTP de seguridad:

```javascript
app.use(helmet({
  // HSTS - Fuerza HTTPS
  strictTransportSecurity: {
    maxAge: 31536000,        // 1 año
    includeSubDomains: true,
    preload: true
  },
  // CSP - Previene XSS
  contentSecurityPolicy: true,
  // Otros headers de seguridad
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));
```

---

## 🏭 Configuración para Producción

### Opción 1: Let's Encrypt (Gratis)

```bash
# Instalar Certbot
sudo apt install certbot

# Obtener certificado
sudo certbot certonly --standalone -d api.tudominio.com

# Los certificados estarán en:
# /etc/letsencrypt/live/api.tudominio.com/privkey.pem
# /etc/letsencrypt/live/api.tudominio.com/fullchain.pem
```

Configuración `.env`:
```env
ENABLE_HTTPS=true
SSL_KEY_PATH=/etc/letsencrypt/live/api.tudominio.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/api.tudominio.com/fullchain.pem
```

### Opción 2: AWS ALB/CloudFront (Recomendado)

Si despliegas en AWS, puedes usar **AWS Certificate Manager (ACM)** gratuitamente:

1. Solicita un certificado en ACM
2. Valida el dominio por DNS o email
3. Asocia el certificado al ALB o CloudFront
4. Tu aplicación Node.js puede correr en HTTP internamente

```
                     TLS 1.3
Usuario ──────────► ALB/CloudFront ──────► Node.js (HTTP interno)
                    (con ACM cert)
```

### Opción 3: Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name api.tudominio.com;
    
    # Certificados
    ssl_certificate /etc/letsencrypt/live/api.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tudominio.com/privkey.pem;
    
    # TLS 1.3 only
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🧪 Verificar Configuración TLS

### Usando curl
```bash
# Verificar versión TLS
curl -v --tlsv1.3 https://localhost:3443/health

# Debería mostrar:
# * SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
```

### Usando OpenSSL
```bash
# Verificar protocolo y cipher
openssl s_client -connect localhost:3443 -tls1_3

# Ver certificado
openssl s_client -connect localhost:3443 -showcerts
```

### Usando nmap
```bash
nmap --script ssl-enum-ciphers -p 3443 localhost
```

### Test Online (Producción)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
- [Qualys SSL Test](https://www.ssllabs.com/ssltest/analyze.html)

---

## 📱 Configuración Cliente Flutter

Para que tu app Flutter se conecte al servidor HTTPS:

```dart
// lib/core/config/api_config.dart
class ApiConfig {
  // Desarrollo (con certificado auto-firmado)
  static const String baseUrl = 'https://localhost:3443/api/v1';
  
  // Producción
  // static const String baseUrl = 'https://api.curitransporte.cl/api/v1';
}
```

Para desarrollo con certificado auto-firmado:
```dart
// Permitir certificados auto-firmados (SOLO DESARROLLO)
class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

// En main.dart (SOLO DESARROLLO)
void main() {
  HttpOverrides.global = MyHttpOverrides();
  runApp(MyApp());
}
```

⚠️ **NUNCA** uses `badCertificateCallback = true` en producción.

---

## 🔍 Troubleshooting

### Error: "Certificados no encontrados"
```
❌ Certificados SSL no encontrados en: api/ssl
```
**Solución:** Genera los certificados con `npm run generate-certs`

### Error: "TLS 1.3 no soportado"
```
⚠️ TLS 1.3 no disponible
```
**Solución:** Actualiza Node.js a v12+ y OpenSSL a v1.1.1+

### Error: "Puerto en uso"
```
❌ Puerto 3443 (HTTPS) ya está en uso
```
**Solución:** 
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3443).OwningProcess | Stop-Process -Force
```

### Error: "Certificado no confiable" en navegador
**Solución (desarrollo):** 
- Chrome: Escribe `thisisunsafe` en la página de advertencia
- O usa mkcert para generar certificados confiables localmente

---

## 📚 Referencias

- [RFC 8446 - TLS 1.3](https://tools.ietf.org/html/rfc8446)
- [Node.js TLS Documentation](https://nodejs.org/api/tls.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)

---

## ✅ Checklist de Seguridad

- [ ] TLS 1.3 habilitado
- [ ] Certificados válidos instalados
- [ ] HSTS configurado
- [ ] HTTP redirige a HTTPS
- [ ] Cipher suites seguros
- [ ] Perfect Forward Secrecy activo
- [ ] Headers de seguridad (Helmet)
- [ ] Certificados renovados antes de expirar
