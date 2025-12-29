// models/modelReportes.js
const pool = require('../config/database');

class Reporte {
  
  /**
   * 📝 Crear nuevo reporte
   */
  static async crear(id_usuario, titulo, descripcion, tipo, latitud = null, longitud = null, id_ruta = null, id_paradero = null) {
    const query = `
      INSERT INTO reportes 
        (id_usuario, titulo, descripcion, tipo, latitud, longitud, id_ruta, id_paradero, estado, fecha_creacion, fecha_expiracion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo', NOW(), NOW() + INTERVAL '5 minutes')
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      id_usuario,
      titulo,
      descripcion,
      tipo,
      latitud,
      longitud,
      id_ruta || null,
      id_paradero || null
    ]);
    
    return result.rows[0];
  }

  /**
   * 🔍 Obtener reporte por ID
   */
  static async findById(id_reporte) {
    const query = `
      SELECT 
        r.*,
        u.username,
        u.nombre,
        u.apellido,
        ru.nom_ruta,
        p.nom_paradero,
        COUNT(DISTINCT CASE WHEN vr.tipo = 'positivo' THEN vr.id_voto END) as votos_positivos,
        COUNT(DISTINCT CASE WHEN vr.tipo = 'negativo' THEN vr.id_voto END) as votos_negativos
      FROM reportes r
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      LEFT JOIN ruta ru ON r.id_ruta = ru.id_ruta
      LEFT JOIN paraderos p ON r.id_paradero = p.id_paradero
      LEFT JOIN votos_reportes vr ON r.id_reporte = vr.id_reporte
      WHERE r.id_reporte = $1
      GROUP BY r.id_reporte, u.id_usuario, ru.id_ruta, p.id_paradero
    `;
    
    const result = await pool.query(query, [id_reporte]);
    return result.rows[0] || null;
  }

  /**
   * 📋 Obtener todos los reportes activos (con paginación)
   */
  static async findAllActivos(limit = 20, offset = 0, tipo = null, id_ruta = null) {
    let query = `
      SELECT 
        r.*,
        u.username,
        ru.nom_ruta,
        p.nom_paradero,
        COUNT(DISTINCT CASE WHEN vr.tipo = 'positivo' THEN vr.id_voto END) as votos_positivos,
        COUNT(DISTINCT CASE WHEN vr.tipo = 'negativo' THEN vr.id_voto END) as votos_negativos
      FROM reportes r
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      LEFT JOIN ruta ru ON r.id_ruta = ru.id_ruta
      LEFT JOIN paraderos p ON r.id_paradero = p.id_paradero
      LEFT JOIN votos_reportes vr ON r.id_reporte = vr.id_reporte
      WHERE r.estado = 'activo' AND r.fecha_expiracion > NOW()
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (tipo) {
      query += ` AND r.tipo = $${paramIndex++}`;
      params.push(tipo);
    }
    
    if (id_ruta) {
      query += ` AND r.id_ruta = $${paramIndex++}`;
      params.push(id_ruta);
    }
    
    query += `
      GROUP BY r.id_reporte, u.id_usuario, ru.id_ruta, p.id_paradero
      ORDER BY r.votos_netos DESC, r.fecha_creacion DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * 📍 Obtener reportes cercanos (geolocalización)
   */
  static async findNearby(latitude, longitude, radiusMeters = 2000, limit = 10) {
    const query = `
      SELECT 
        r.*,
        u.username,
        ru.nom_ruta,
        p.nom_paradero,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(r.longitud, r.latitud), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric as distancia_metros,
        COUNT(DISTINCT CASE WHEN vr.tipo = 'positivo' THEN vr.id_voto END) as votos_positivos,
        COUNT(DISTINCT CASE WHEN vr.tipo = 'negativo' THEN vr.id_voto END) as votos_negativos
      FROM reportes r
      LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
      LEFT JOIN ruta ru ON r.id_ruta = ru.id_ruta
      LEFT JOIN paraderos p ON r.id_paradero = p.id_paradero
      LEFT JOIN votos_reportes vr ON r.id_reporte = vr.id_reporte
      WHERE r.estado = 'activo' 
        AND r.fecha_expiracion > NOW()
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(r.longitud, r.latitud), 4326)::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      GROUP BY r.id_reporte, u.id_usuario, ru.id_ruta, p.id_paradero
      ORDER BY distancia_metros ASC
      LIMIT $4
    `;
    
    const result = await pool.query(query, [longitude, latitude, radiusMeters, limit]);
    return result.rows;
  }

  /**
   * 🗳️ Votar en un reporte
   */
  static async votarReporte(id_reporte, id_usuario, tipo) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verificar si ya votó
      const votoExistente = await client.query(
        `SELECT id_voto, tipo as tipo_anterior FROM votos_reportes WHERE id_reporte = $1 AND id_usuario = $2`,
        [id_reporte, id_usuario]
      );
      
      if (votoExistente.rows.length > 0) {
        const voto_anterior = votoExistente.rows[0].tipo_anterior;
        
        // Eliminar voto anterior
        await client.query(
          `DELETE FROM votos_reportes WHERE id_reporte = $1 AND id_usuario = $2`,
          [id_reporte, id_usuario]
        );
        
        // Actualizar votos_netos del reporte (restar el anterior)
        const cambio = voto_anterior === 'positivo' ? -1 : 1;
        await client.query(
          `UPDATE reportes SET votos_netos = votos_netos + $1 WHERE id_reporte = $2`,
          [cambio, id_reporte]
        );
      }
      
      // Insertar nuevo voto
      await client.query(
        `INSERT INTO votos_reportes (id_reporte, id_usuario, tipo) VALUES ($1, $2, $3)`,
        [id_reporte, id_usuario, tipo]
      );
      
      // Actualizar votos_netos (sumar el nuevo)
      const cambioNuevo = tipo === 'positivo' ? 1 : -1;
      await client.query(
        `UPDATE reportes SET votos_netos = votos_netos + $1 WHERE id_reporte = $2`,
        [cambioNuevo, id_reporte]
      );
      
      await client.query('COMMIT');
      
      return { success: true, tipo_voto: tipo };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * ✏️ Actualizar estado de reporte (ADMIN)
   */
  static async updateEstado(id_reporte, estado) {
    const query = `
      UPDATE reportes 
      SET estado = $1 
      WHERE id_reporte = $2 
      RETURNING *
    `;
    
    const result = await pool.query(query, [estado, id_reporte]);
    return result.rows[0];
  }

  /**
   * 🗑️ Eliminar reporte (ADMIN)
   */
  static async eliminar(id_reporte) {
    const query = `
      DELETE FROM reportes 
      WHERE id_reporte = $1 
      RETURNING id_reporte
    `;
    
    const result = await pool.query(query, [id_reporte]);
    return result.rows[0];
  }

  /**
   * 📊 Obtener estadísticas por tipo
   */
  static async getEstadisticasPorTipo() {
    const query = `
      SELECT 
        tipo,
        COUNT(*) as total,
        AVG(votos_netos) as promedio_votos,
        SUM(CASE WHEN estado = 'resuelto' THEN 1 ELSE 0 END) as resueltos
      FROM reportes
      WHERE fecha_expiracion > NOW()
      GROUP BY tipo
      ORDER BY total DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * 🧹 Limpiar reportes expirados
   */
  static async limpiarExpirados() {
    const query = `
      UPDATE reportes 
      SET estado = 'expirado' 
      WHERE fecha_expiracion < NOW() AND estado = 'activo'
      RETURNING id_reporte
    `;
    
    const result = await pool.query(query);
    return result.rowCount;
  }
}

module.exports = Reporte;