// config/database.js
const { Pool } = require('pg');
const fs = require('node:fs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
    //ca: fs.readFileSync(process.env.RDS_CA_PATH), // Ruta a rds-ca.pem
  },
});

module.exports = pool;
// ✅ IMPORTANTE: Establecer el schema al conectar
pool.on('connect', async (client) => {
  const schema = process.env.DB_SCHEMA || 'tesis';
  await client.query(`SET search_path TO ${schema};`);
});

// Manejo de errores
pool.on('error', (err) => {
  console.error('Error inesperado en el pool:', err);
});

// Verificar conexión al iniciar
(async () => {
  try {
    const res = await pool.query('SELECT version();');
    console.log('✅ Conexión a PostgreSQL exitosa');
    console.log(`Schema activo: ${process.env.DB_SCHEMA || 'tesis'}`);
  } catch (err) {
    console.error('❌ Error de conexión a PostgreSQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;


