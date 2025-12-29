// Script para agregar credenciales WiFi a buses existentes
require('dotenv').config();
const pool = require('./src/config/database');

// 🔧 CONFIGURACIÓN: Edita estas credenciales según tus necesidades
const BUSES_CREDENTIALS = [
  { patente: 'ABC123', ssid: 'BUS_WIFI_ABC123', password: 'Pass1234!' },
  { patente: 'XYZ789', ssid: 'BUS_WIFI_XYZ789', password: 'Secure456!' },
  // Agrega más buses aquí...
];

// O usa esta opción para generar automáticamente para TODOS los buses
const USE_AUTO_GENERATE = true; // Cambiar a false para usar BUSES_CREDENTIALS

async function injectCredentials() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Conectado a la base de datos\n');
    
    if (USE_AUTO_GENERATE) {
      console.log('🤖 Generando credenciales automáticamente para todos los buses activos...\n');
      
      const result = await client.query(`
        UPDATE buses 
        SET 
          ssid = CONCAT('BUS_WIFI_', patente), 
          password = 'DefaultPass123!' 
        WHERE activo = true 
        RETURNING patente, ssid, password
      `);
      
      console.log(`✅ ${result.rows.length} buses actualizados:\n`);
      result.rows.forEach(bus => {
        console.log(`  🚌 ${bus.patente}:`);
        console.log(`     SSID: ${bus.ssid}`);
        console.log(`     Password: ${bus.password}\n`);
      });
      
    } else {
      console.log('📝 Agregando credenciales personalizadas...\n');
      
      for (const bus of BUSES_CREDENTIALS) {
        const result = await client.query(
          `UPDATE buses 
           SET ssid = $1, password = $2 
           WHERE patente = $3 AND activo = true
           RETURNING patente, ssid, password`,
          [bus.ssid, bus.password, bus.patente.toUpperCase()]
        );
        
        if (result.rows.length > 0) {
          console.log(`  ✅ ${bus.patente} actualizado`);
        } else {
          console.log(`  ⚠️  ${bus.patente} no encontrado o inactivo`);
        }
      }
    }
    
    console.log('\n🎉 Proceso completado!');
    console.log('🔍 Puedes verificar con: SELECT patente, ssid, password FROM buses;\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

injectCredentials().catch(console.error);
