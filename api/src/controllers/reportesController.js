// controllers/reportesController.js
const pool = require('../config/database');
const Reporte = require('../models/modelReportes');

/**
 * 📝 Crear nuevo reporte (PROTEGIDO)
 * POST /api/v1/reportes
 */
exports.crearReporte = async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const { titulo, descripcion, tipo, latitud, longitud, id_ruta, id_paradero } = req.body;

    // Validar campos requeridos
    if (!titulo || !descripcion || !tipo) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: titulo, descripcion, tipo'
      });
    }

    // Validar tipo de reporte
    const tipos_validos = ['accidente', 'cierre_calle', 'congestion', 'transito', 'otro'];
    if (!tipos_validos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `Tipo debe ser uno de: ${tipos_validos.join(', ')}`
      });
    }

    const reporte = await Reporte.crear(
      id_usuario,
      titulo,
      descripcion,
      tipo,
      latitud ? parseFloat(latitud) : null,
      longitud ? parseFloat(longitud) : null,
      id_ruta ? parseInt(id_ruta) : null,
      id_paradero ? parseInt(id_paradero) : null
    );

    res.status(201).json({
      success: true,
      message: 'Reporte creado exitosamente',
      data: reporte,
      creado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en crearReporte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🔍 Obtener reporte por ID
 * GET /api/v1/reportes/:id
 */
exports.getReporteById = async (req, res) => {
  try {
    const { id } = req.params;

    const reporte = await Reporte.findById(id);

    if (!reporte) {
      return res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    }

    res.json({
      success: true,
      data: reporte
    });
  } catch (error) {
    console.error('Error en getReporteById:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📋 Obtener todos los reportes activos (con filtros)
 * GET /api/v1/reportes?tipo=congestion&id_ruta=1&limit=20&offset=0
 */
exports.getReportesActivos = async (req, res) => {
  try {
    const { tipo, id_ruta, limit = 20, offset = 0 } = req.query;

    const reportes = await Reporte.findAllActivos(
      parseInt(limit),
      parseInt(offset),
      tipo || null,
      id_ruta ? parseInt(id_ruta) : null
    );

    // Contar total
    const countQuery = `SELECT COUNT(*) as total FROM reportes WHERE estado = 'activo' AND fecha_expiracion > NOW()`;
    const countResult = await pool.query(countQuery);

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: reportes
    });
  } catch (error) {
    console.error('Error en getReportesActivos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📍 Obtener reportes cercanos (geolocalización)
 * GET /api/v1/reportes/cercanos?latitud=-34.92&longitud=-71.23&radio=10000
 */
exports.getReportesCercanos = async (req, res) => {
  try {
    const { latitud, longitud, radio = 20000, limit = 10 } = req.query;

    if (!latitud || !longitud) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: latitud, longitud'
      });
    }

    const reportes = await Reporte.findNearby(
      parseFloat(latitud),
      parseFloat(longitud),
      parseInt(radio),
      parseInt(limit)
    );

    res.json({
      success: true,
      total: reportes.length,
      ubicacion: { latitud: parseFloat(latitud), longitud: parseFloat(longitud), radio_metros: radio },
      data: reportes
    });
  } catch (error) {
    console.error('Error en getReportesCercanos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🗳️ Votar en un reporte (PROTEGIDO)
 * POST /api/v1/reportes/:id/votar
 */
exports.votarReporte = async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const { id } = req.params;
    const { tipo } = req.body;

    // Validar que ID del reporte está presente
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: `ID de reporte inválido: "${id}". Debe ser un número entero. Revisa que el reporte tenga un ID válido en el frontend.`
      });
    }

    if (!tipo || !['positivo', 'negativo'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: "Tipo de voto debe ser 'positivo' o 'negativo'"
      });
    }

    // Verificar que el reporte existe
    const reporte = await Reporte.findById(id);
    if (!reporte) {
      return res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    }

    await Reporte.votarReporte(id, id_usuario, tipo);

    // Obtener reporte actualizado
    const reporteActualizado = await Reporte.findById(id);

    res.json({
      success: true,
      message: `Voto ${tipo} registrado`,
      data: reporteActualizado,
      usuario: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en votarReporte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * ✏️ Actualizar estado de reporte (ADMIN)
 * PUT /api/v1/reportes/:id/estado
 */
exports.actualizarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estados_validos = ['activo', 'resuelto', 'falso', 'expirado'];
    if (!estados_validos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: `Estado debe ser uno de: ${estados_validos.join(', ')}`
      });
    }

    const reporte = await Reporte.updateEstado(id, estado);

    res.json({
      success: true,
      message: 'Estado del reporte actualizado',
      data: reporte,
      actualizado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en actualizarEstado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📊 Obtener estadísticas de reportes
 * GET /api/v1/reportes/stats/tipos
 */
exports.getEstadisticas = async (req, res) => {
  try {
    const stats = await Reporte.getEstadisticasPorTipo();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error en getEstadisticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🗑️ Eliminar reporte (ADMIN)
 * DELETE /api/v1/reportes/:id
 */
exports.eliminarReporte = async (req, res) => {
  try {
    const { id } = req.params;

    const reporte = await Reporte.findById(id);
    if (!reporte) {
      return res.status(404).json({
        success: false,
        error: 'Reporte no encontrado'
      });
    }

    await Reporte.eliminar(id);

    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente',
      eliminado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en eliminarReporte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};