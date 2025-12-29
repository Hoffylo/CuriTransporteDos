// controllers/rutaController.js
const pool = require('../config/database');

// ========== RUTAS PÚBLICAS ==========

/**
 * Obtener todas las rutas (PÚBLICO)
 */
exports.getTodasRutas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id_ruta,
        nom_ruta,
        descripcion,
        color_hex
      FROM ruta
      ORDER BY nom_ruta ASC
    `);

    res.json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error en getTodasRutas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener ruta por ID (PÚBLICO)
 */
exports.getRutaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        id_ruta,
        nom_ruta,
        descripcion,
        sentido_ruta,
        color_hex,
        ST_AsGeoJSON(geom) as geom
      FROM ruta 
      WHERE id_ruta = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
/**
 * Obtener paraderos de una ruta (PÚBLICO)
 */
exports.getParaderosRuta = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT p.id_paradero, p.nom_paradero, p.latitud, p.longitud, p.direccion
      FROM ruta_paradero rp
      JOIN paraderos p ON rp.id_paradero = p.id_paradero
      WHERE rp.id_ruta = $1
      ORDER BY rp.orden_ruta ASC
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay paraderos para esta ruta'
      });
    }

    res.json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Error en getParaderosRuta:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
/**
 * Obtener próximo paradero en la ruta (PÚBLICO)
 */
exports.getProximoParadero = async (req, res) => {
  try {
    const { id, id_paradero_actual } = req.params;

    // Obtener orden actual del paradero
    const currentResult = await pool.query(`
      SELECT orden_ruta FROM ruta_paradero 
      WHERE id_ruta = $1 AND id_paradero = $2
    `, [id, id_paradero_actual]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paradero no está en esta ruta'
      });
    }

    const ordenActual = currentResult.rows[0].orden_ruta;

    // Obtener siguiente paradero
    const result = await pool.query(`
      SELECT p.id_paradero, p.nom_paradero, p.latitud, p.longitud, p.direccion, rp.orden_ruta
      FROM ruta_paradero rp
      JOIN paraderos p ON rp.id_paradero = p.id_paradero
      WHERE rp.id_ruta = $1 AND rp.orden_ruta = $2
      LIMIT 1
    `, [id, ordenActual + 1]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay próximo paradero'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error en getProximoParadero:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ========== RUTAS ADMIN ==========

/**
 * Crear nueva ruta (ADMIN)
 */
exports.crearRuta = async (req, res) => {
  try {
    const { nom_ruta, descripcion, color_hex } = req.body;

    // Validar campos requeridos
    if (!nom_ruta) {
      return res.status(400).json({
        success: false,
        error: 'Campo requerido: nom_ruta'
      });
    }

    const result = await pool.query(`
      INSERT INTO ruta 
      (nom_ruta, descripcion, color_hex)
      VALUES ($1, $2, $3)
      RETURNING id_ruta, nom_ruta, descripcion, color_hex
    `, [nom_ruta, descripcion || null, color_hex || null]);

    res.status(201).json({
      success: true,
      message: 'Ruta creada exitosamente',
      data: result.rows[0],
      creado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en crearRuta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Editar ruta (ADMIN)
 */
exports.editarRuta = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom_ruta, descripcion, color_hex } = req.body;

    // Verificar que la ruta existe
    const existe = await pool.query('SELECT id_ruta FROM ruta WHERE id_ruta = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    }

    const result = await pool.query(`
      UPDATE ruta 
      SET 
        nom_ruta = COALESCE($1, nom_ruta),
        descripcion = COALESCE($2, descripcion),
        color_hex = COALESCE($3, color_hex)
      WHERE id_ruta = $4
      RETURNING id_ruta, nom_ruta, descripcion, color_hex
    `, [nom_ruta, descripcion, color_hex, id]);

    res.json({
      success: true,
      message: 'Ruta actualizada exitosamente',
      data: result.rows[0],
      actualizado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en editarRuta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Eliminar ruta (ADMIN)
 */
exports.eliminarRuta = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la ruta existe
    const existe = await pool.query('SELECT id_ruta, nom_ruta FROM ruta WHERE id_ruta = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
      });
    }

    // Eliminar asociaciones de paraderos primero (si existen)
    await pool.query('DELETE FROM ruta_paradero WHERE id_ruta = $1', [id]);

    // Luego eliminar la ruta
    const result = await pool.query(`
      DELETE FROM ruta WHERE id_ruta = $1 RETURNING id_ruta, nom_ruta
    `, [id]);

    res.json({
      success: true,
      message: 'Ruta eliminada exitosamente',
      data: result.rows[0],
      eliminado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en eliminarRuta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
