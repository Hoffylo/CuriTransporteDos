const pool = require('../config/database');

class Bus {
  static async findByPatente(patente) {
    const res = await pool.query(
      'SELECT id_bus, patente, activo FROM buses WHERE patente = $1',
      [patente]
    );
    return res.rows[0] || null;
  }

  static async create(patente, activo = true) {
    const res = await pool.query(
      'INSERT INTO buses (patente, activo) VALUES ($1, $2) RETURNING id_bus, patente, activo',
      [patente, activo]
    );
    return res.rows[0];
  }
}

module.exports = Bus;
