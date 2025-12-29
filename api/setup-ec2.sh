#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CURITRANSPORTE API - Script de Configuración EC2 Ubuntu 24.04
# ═══════════════════════════════════════════════════════════════
# Ejecutar como: chmod +x setup-ec2.sh && ./setup-ec2.sh
# ═══════════════════════════════════════════════════════════════

set -e  # Salir si hay error

echo "═══════════════════════════════════════════════════════════════"
echo "  CURITRANSPORTE API - Configuración EC2 Ubuntu 24.04"
echo "═══════════════════════════════════════════════════════════════"

# Actualizar sistema
echo ""
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20 LTS
echo ""
echo "📦 Instalando Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "   Node.js: $(node -v)"
echo "   npm: $(npm -v)"

# Instalar PM2 globalmente
echo ""
echo "📦 Instalando PM2..."
sudo npm install -g pm2

# Instalar dependencias del proyecto
echo ""
echo "📦 Instalando dependencias del proyecto..."
npm install --production

# Verificar que existe .env
echo ""
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado"
    echo "   Copiando .env.production como base..."
    cp .env.production .env
    echo ""
    echo "   ⚠️  IMPORTANTE: Edita .env con tus valores reales:"
    echo "   nano .env"
    echo ""
    read -p "   Presiona Enter cuando hayas editado .env..."
fi

# Verificar variables críticas
echo ""
echo "🔍 Verificando configuración..."
source .env 2>/dev/null || true

if [ "$DB_HOST" = "tu-rds-instance.xxxxxxx.us-east-1.rds.amazonaws.com" ]; then
    echo "   ❌ DB_HOST no configurado"
    echo "   Edita .env y configura la conexión a tu base de datos"
    exit 1
fi

if [ "$JWT_SECRET" = "cambia-esto-por-una-clave-muy-larga-y-segura-de-al-menos-64-caracteres" ]; then
    echo "   ⚠️  Generando JWT_SECRET..."
    NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env
    echo "   ✅ JWT_SECRET generado automáticamente"
fi

echo "   ✅ Configuración verificada"

# Iniciar con PM2
echo ""
echo "🚀 Iniciando servidor con PM2..."
pm2 delete curitransporte-api 2>/dev/null || true
pm2 start src/index.js --name "curitransporte-api" --env production

# Guardar configuración PM2
echo ""
echo "💾 Guardando configuración PM2..."
pm2 save

# Configurar inicio automático
echo ""
echo "⚡ Configurando inicio automático..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ INSTALACIÓN COMPLETADA"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  📍 Tu API está corriendo en: http://TU-IP-ELASTICA:3001"
echo ""
echo "  Comandos útiles:"
echo "    pm2 status              - Ver estado"
echo "    pm2 logs                - Ver logs"
echo "    pm2 restart all         - Reiniciar"
echo "    pm2 monit               - Monitor en tiempo real"
echo ""
echo "  Para probar:"
echo "    curl http://localhost:3001/health"
echo ""
echo "═══════════════════════════════════════════════════════════════"
