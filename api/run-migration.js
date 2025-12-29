// Script para ejecutar la migración de WiFi credentials
require('dotenv').config();
const pool = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Conectado a la base de datos');
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'db', 'migrations', '2025-12-23-buses-wifi-credentials.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Ejecutando migración: 2025-12-23-buses-wifi-credentials.sql\n');
    
    // Ejecutar el SQL
    await client.query(sql);
    
    console.log('✅ Migración ejecutada exitosamente!');
    console.log('\n📊 Verificando estructura de tabla buses...\n');
    
    // Verificar las columnas
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'buses' AND column_name IN ('ssid', 'password')
      ORDER BY column_name
    `);
    
    if (result.rows.length > 0) {
      console.log('Columnas agregadas:');
      result.rows.forEach(row => {
        console.log(`  ✓ ${row.column_name} (${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''})`);
      });
    }
    
    // Verificar índice
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'buses' AND indexname = 'idx_buses_patente'
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('\n  ✓ Índice idx_buses_patente creado');
    }
    
    console.log('\n🎯 Próximo paso: Agregar credenciales a tus buses existentes');
    console.log('   Puedes usar el script: inject-bus-credentials.js\n');
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
