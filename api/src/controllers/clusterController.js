// controllers/clusterController.js
const pool = require('../config/database');
const Cluster = require('../models/modelCluster');
const { ubicaciones, usuarios, eventos, rutas } = require('../config/database');

/**
 * 📊 Obtener todos los buses activos (clusters) PARA EL MAPA
 * GET /api/v1/cluster/buses-activos
 * Solo muestra clusters activos con usuarios
 */
exports.getBusesActivos = async (req, res) => {
  try {
    const clusters = await Cluster.findAllActive();

    res.json({
      success: true,
      total: clusters.length,
      data: clusters
    });
  } catch (error) {
    console.error('Error en getBusesActivos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🚏 Obtener clusters PARA PARADEROS (incluye histórico reciente)
 * GET /api/v1/cluster/paraderos
 * Muestra clusters activos + inactivos de la última hora
 */
exports.getClustersParaParaderos = async (req, res) => {
  try {
    const clusters = await Cluster.findAllForStops();

    res.json({
      success: true,
      total: clusters.length,
      data: clusters
    });
  } catch (error) {
    console.error('Error en getClustersParaParaderos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📍 Obtener buses cercanos a una ubicación
 * GET /api/v1/cluster/cercanos?latitud=-34.92&longitud=-71.23&radio=10000
 */
exports.getBusesCercanos = async (req, res) => {
  try {
    const { latitud, longitud, radio = 20000 } = req.query;

    if (!latitud || !longitud) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: latitud, longitud'
      });
    }

    const buses = await Cluster.findNearbyClusters(
      parseFloat(latitud),
      parseFloat(longitud),
      parseInt(radio)
    );

    res.json({
      success: true,
      total: buses.length,
      radio_metros: radio,
      data: buses
    });
  } catch (error) {
    console.error('Error en getBusesCercanos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🚌 Obtener información detallada de un bus (cluster)
 * GET /api/v1/cluster/:id
 */
exports.getClusterDetalle = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await Cluster.getStats(id);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Bus no encontrado'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error en getClusterDetalle:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 👥 Obtener miembros de un bus (cluster)
 * GET /api/v1/cluster/:id/miembros
 */
exports.getClusterMiembros = async (req, res) => {
  try {
    const { id } = req.params;

    const miembros = await Cluster.getClusterMembers(id);

    res.json({
      success: true,
      total: miembros.length,
      data: miembros
    });
  } catch (error) {
    console.error('Error en getClusterMiembros:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📊 Obtener eventos/reportes de un bus
 * GET /api/v1/cluster/:id/eventos
 */
exports.getClusterEventos = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const eventos = await Cluster.getClusterEvents(id, parseInt(limit));

    res.json({
      success: true,
      total: eventos.length,
      data: eventos
    });
  } catch (error) {
    console.error('Error en getClusterEventos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🗑️ Eliminar un cluster por ID
 * DELETE /api/v1/cluster/:id
 */
exports.deleteCluster = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el cluster existe
    const cluster = await Cluster.findById(id);
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: 'Cluster no encontrado'
      });
    }

    // Eliminar el cluster
    await Cluster.deleteCluster(id);

    res.json({
      success: true,
      message: `Cluster ${id} eliminado correctamente`,
      data: { id_cluster: parseInt(id) }
    });
  } catch (error) {
    console.error('Error en deleteCluster:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * ⭐ Obtener calidad de reportes de un bus
 * GET /api/v1/cluster/:id/calidad
 */
exports.getClusterCalidad = async (req, res) => {
  try {
    const { id } = req.params;

    const calidad = await Cluster.getEventsQuality(id);

    res.json({
      success: true,
      data: calidad
    });
  } catch (error) {
    console.error('Error en getClusterCalidad:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📈 Obtener histórico de velocidad de un bus
 * GET /api/v1/cluster/:id/velocidad-historial
 */
exports.getVelocityHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await Cluster.getVelocityHistory(id);

    res.json({
      success: true,
      total: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error en getVelocityHistory:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 📊 Obtener estadísticas globales del sistema
 * GET /api/v1/cluster/stats/global
 */
exports.getEstadisticasGlobales = async (req, res) => {
  try {
    const buscesActivos = await pool.query(`
      SELECT COUNT(*) as total FROM clusters WHERE esta_activo = TRUE
    `);

    const usuariosEnBus = await pool.query(`
      SELECT COUNT(DISTINCT id_usuario) as total 
      FROM ubicacion 
      WHERE esta_en_bus = TRUE AND tiempo > NOW() - INTERVAL '1 minute'
    `);

    const usuariosActivos = await pool.query(`
      SELECT COUNT(DISTINCT id_usuario) as total 
      FROM ubicacion 
      WHERE tiempo > NOW() - INTERVAL '5 minutes'
    `);

    const eventosRecientes = await pool.query(`
      SELECT COUNT(*) as total 
      FROM eventos_usuario 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);

    res.json({
      success: true,
      data: {
        buses_activos: parseInt(buscesActivos.rows[0].total),
        usuarios_en_bus: parseInt(usuariosEnBus.rows[0].total),
        usuarios_activos: parseInt(usuariosActivos.rows[0].total),
        eventos_24h: parseInt(eventosRecientes.rows[0].total),
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error en getEstadisticasGlobales:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🧹 Limpiar clusters inactivos (ADMIN)
 * POST /api/v1/cluster/mantenimiento/limpiar
 */
exports.limpiarClustersInactivos = async (req, res) => {
  try {
    const { maxAgeMinutes = 10 } = req.body;

    const eliminados = await Cluster.cleanupInactiveClusters(maxAgeMinutes);

    res.json({
      success: true,
      message: `${eliminados.length} clusters marcados como inactivos`,
      data: eliminados
    });
  } catch (error) {
    console.error('Error en limpiarClustersInactivos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🚌 Obtener ETA (tiempo estimado de llegada) de un bus a un paradero
 * GET /api/v1/cluster/:id/eta/:paradero_id
 */
exports.getBusETA = async (req, res) => {
  try {
    const { id, paradero_id } = req.params;

    // 1. OBTENER CLUSTER
    const clusterRes = await pool.query(
      `SELECT id_cluster, latitud_centro, longitud_centro, velocidad_promedio, id_ruta, geom
       FROM clusters WHERE id_cluster = $1 AND esta_activo = TRUE`,
      [id]
    );

    if (clusterRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bus no encontrado' });
    }

    const cluster = clusterRes.rows[0];

    // 2. OBTENER PARADERO
    const paraderoRes = await pool.query(
      `SELECT id_paradero, nom_paradero, latitud, longitud, geom
       FROM paraderos WHERE id_paradero = $1`,
      [paradero_id]
    );

    if (paraderoRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Paradero no encontrado' });
    }

    const paradero = paraderoRes.rows[0];

    // 3+4. CALCULAR ETA usando EtaService (intenta distancia a lo largo de la ruta y hace fallback)
    const EtaService = require('../services/etaService');
    const FALLBACK_KMH = parseFloat(process.env.FALLBACK_SPEED_KMH) || 15;

    console.log(`[CLUSTER ETA DEBUG] Calculando ETA: cluster=${id}, paradero=${paradero_id}, ruta=${cluster.id_ruta}, vel_cluster=${cluster.velocidad_promedio}`);

    const etaInfo = await EtaService.computeEtaForCluster(
      pool,
      cluster.id_ruta,
      cluster,
      { latitud: paradero.latitud, longitud: paradero.longitud },
      FALLBACK_KMH
    );

    console.log(`[CLUSTER ETA DEBUG] Resultado: dist_along=${etaInfo.distancia_along_metros}m, dist_total=${etaInfo.distancia_metros}m, vel=${etaInfo.velocidad_kmh}km/h, eta=${etaInfo.eta_seconds}s (${etaInfo.eta_minutos}min)`);

    return res.json({
      success: true,
      data: {
        id_cluster: cluster.id_cluster,
        id_ruta: cluster.id_ruta,
        velocidad_kmh: etaInfo.velocidad_kmh,
        velocidad_promedio: etaInfo.velocidad_promedio,
        distancia_metros: etaInfo.distancia_metros,
        distancia_along_metros: etaInfo.distancia_along_metros,
        eta_seconds: etaInfo.eta_seconds,
        eta_minutos: etaInfo.eta_minutos,
        eta_llegada: etaInfo.eta_llegada,
        paradero: {
          id_paradero: paradero.id_paradero,
          nombre: paradero.nom_paradero,
          latitud: parseFloat(paradero.latitud),
          longitud: parseFloat(paradero.longitud)
        }
      }
    });

  } catch (err) {
    console.error('[ETA] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Obtener estadísticas globales (para dashboard admin)
exports.getEstadisticas = (req, res) => {
  res.json({
    total_usuarios: usuarios.length,
    usuarios_activos: usuarios.filter(u => u.ultimo_acceso).length,
    total_rutas: rutas.length,
    total_eventos: eventos.length,
    usuarios_en_transito: ubicaciones.filter(u => u.en_transito).length,
    eventos_recientes: eventos.length > 0 ? eventos.slice(-5) : [],
  });
};

// Obtener usuarios por zona (para análisis de congestión)
exports.getUsuariosPorZona = (req, res) => {
  const { minLat, maxLat, minLng, maxLng } = req.query;

  if (!minLat || !maxLat || !minLng || !maxLng) {
    return res.status(400).json({
      error: 'Parámetros requeridos: minLat, maxLat, minLng, maxLng',
    });
  }

  const usuariosZona = ubicaciones.filter(
    u =>
      u.latitud >= parseFloat(minLat) &&
      u.latitud <= parseFloat(maxLat) &&
      u.longitud >= parseFloat(minLng) &&
      u.longitud <= parseFloat(maxLng)
  );

  res.json({
    zona: { minLat, maxLat, minLng, maxLng },
    total_usuarios: usuariosZona.length,
    usuarios_en_transito: usuariosZona.filter(u => u.en_transito).length,
    ubicaciones: usuariosZona,
  });
};

// Obtener eventos por ruta (análisis)
exports.getEventosPorRuta = (req, res) => {
  const { id_ruta } = req.params;

  const eventosRuta = eventos.filter(e => e.id_ruta === parseInt(id_ruta));

  res.json({
    id_ruta,
    total_eventos: eventosRuta.length,
    por_tipo: {
      a_bordo: eventosRuta.filter(e => e.id_tipo_evento === 1).length,
      desvio: eventosRuta.filter(e => e.id_tipo_evento === 2).length,
      problema: eventosRuta.filter(e => e.id_tipo_evento === 3).length,
    },
    eventos: eventosRuta,
  });
};

// Obtener actividad de usuario
exports.getActividadUsuario = (req, res) => {
  const { id_usuario } = req.params;

  const usuarioEventos = eventos.filter(e => e.id_usuario === parseInt(id_usuario));
  const usuarioUbicaciones = ubicaciones.filter(
    u => u.id_usuario === parseInt(id_usuario)
  );

  res.json({
    id_usuario,
    total_eventos_reportados: usuarioEventos.length,
    ultima_ubicacion: usuarioUbicaciones[usuarioUbicaciones.length - 1] || null,
    total_ubicaciones: usuarioUbicaciones.length,
  });
};

/**
 * 🆕 Crear cluster por patente validada
 * POST /api/v1/cluster/crear-por-patente
 * body: { patente, latitud, longitud, id_ruta?, velocidad? }
 */
exports.createClusterPorPatente = async (req, res) => {
  try {
    const { patente, latitud, longitud, id_ruta = null, velocidad = 0 } = req.body || {};

    if (!patente || latitud === undefined || longitud === undefined) {
      return res.status(400).json({ success: false, error: 'Parámetros requeridos: patente, latitud, longitud' });
    }

    const Bus = require('../models/modelBus');
    const bus = await Bus.findByPatente(patente);
    if (!bus || bus.activo === false) {
      return res.status(404).json({ success: false, error: 'Patente no encontrada o inactiva' });
    }

    // Evitar duplicar: si ya hay un cluster activo con este bus
    const existing = await pool.query(
      'SELECT id_cluster FROM clusters WHERE id_bus = $1 AND esta_activo = TRUE ORDER BY ultima_actualizacion DESC LIMIT 1',
      [bus.id_bus]
    );
    if (existing.rows[0]) {
      return res.status(200).json({ success: true, message: 'Cluster ya activo para esta patente', data: { id_cluster: existing.rows[0].id_cluster } });
    }

    // Crear cluster con referencia al bus (con 1 usuario inicial)
    const insert = await pool.query(
      `INSERT INTO clusters (latitud_centro, longitud_centro, cantidad_usuarios, velocidad_promedio, esta_activo, id_ruta, id_bus, fecha_creacion, ultima_actualizacion)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, NOW(), NOW())
       RETURNING id_cluster`,
      [parseFloat(latitud), parseFloat(longitud), 1, parseFloat(velocidad) || 0, id_ruta, bus.id_bus]
    );

    const idCluster = insert.rows[0].id_cluster;

    // Opcional: asignar paradero cercano
    try {
      const nearest = await pool.query(
        `SELECT id_paradero
         FROM paraderos
         ORDER BY ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC
         LIMIT 1`,
        [parseFloat(longitud), parseFloat(latitud)]
      );
      if (nearest.rows[0]) {
        await pool.query('UPDATE clusters SET id_paradero_cercano = $1 WHERE id_cluster = $2', [nearest.rows[0].id_paradero, idCluster]);
      }
    } catch (e) {
      // silencioso: si falla, no bloquea la creación
      console.warn('Paradero cercano no asignado:', e.message);
    }

    return res.status(201).json({ success: true, data: { id_cluster: idCluster, id_bus: bus.id_bus, patente: bus.patente } });
  } catch (error) {
    console.error('Error en createClusterPorPatente:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * � Listar todas las patentes de buses disponibles
 * GET /api/v1/cluster/buses/patentes
 */
exports.listarPatentes = async (req, res) => {
  try {
    const { activo } = req.query;
    
    let query = 'SELECT id_bus, patente, activo, created_at FROM buses';
    const params = [];
    
    if (activo !== undefined) {
      query += ' WHERE activo = $1';
      params.push(activo === 'true');
    }
    
    query += ' ORDER BY patente ASC';
    
    const result = await pool.query(query, params);
    
    return res.json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error en listarPatentes:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * �🚌 Inyectar patente de bus (agregar bus válido)
 * POST /api/v1/cluster/buses/inyectar
 * body: { patente, activo? }
 */
exports.inyectarPatente = async (req, res) => {
  try {
    const { patente, activo = true } = req.body || {};

    if (!patente || patente.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Parámetro requerido: patente (no vacío)' });
    }

    const Bus = require('../models/modelBus');
    
    // Validar si ya existe
    const existing = await Bus.findByPatente(patente.toUpperCase());
    if (existing) {
      return res.status(409).json({ success: false, error: 'Patente ya existe en la base de datos', data: existing });
    }

    // Crear nueva patente
    const newBus = await Bus.create(patente.toUpperCase(), activo);

    return res.status(201).json({ success: true, message: 'Patente inyectada exitosamente', data: newBus });
  } catch (error) {
    console.error('Error en inyectarPatente:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 📶 Obtener credenciales WiFi de un bus por patente
 * GET /api/v1/cluster/buses/:patente/credenciales
 */
exports.obtenerCredencialesBus = async (req, res) => {
  try {
    const { patente } = req.params;
    
    if (!patente || patente.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro requerido: patente'
      });
    }

    const result = await pool.query(
      'SELECT ssid, password FROM buses WHERE patente = $1 AND activo = true',
      [patente.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron credenciales para esta patente'
      });
    }
    
    const { ssid, password } = result.rows[0];
    
    if (!ssid || !password) {
      return res.status(404).json({
        success: false,
        message: 'Este bus no tiene credenciales WiFi configuradas'
      });
    }
    
    res.json({
      success: true,
      data: { ssid, password }
    });
    
  } catch (error) {
    console.error('Error al obtener credenciales WiFi:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener credenciales WiFi'
    });
  }
};

/**
 * 🚌 Obtener clusters por patente de bus
 * GET /api/v1/cluster/patente/:patente
 */
exports.getClusterPorPatente = async (req, res) => {
  try {
    const { patente } = req.params;

    if (!patente || patente.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro requerido: patente'
      });
    }

    // Buscar bus por patente
    const busResult = await pool.query(
      'SELECT id_bus, patente, activo FROM buses WHERE UPPER(patente) = UPPER($1)',
      [patente]
    );

    if (busResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Patente no encontrada'
      });
    }

    const idBus = busResult.rows[0].id_bus;

    // Obtener todos los clusters asociados a esta patente
    const clustersResult = await pool.query(`
      SELECT 
        c.id_cluster,
        c.latitud_centro,
        c.longitud_centro,
        c.cantidad_usuarios,
        c.velocidad_promedio,
        c.direccion_promedio,
        c.id_paradero_cercano,
        c.id_ruta,
        c.id_bus,
        b.patente,
        c.esta_activo,
        c.fecha_creacion,
        c.ultima_actualizacion,
        EXTRACT(EPOCH FROM (NOW() - c.ultima_actualizacion)) as segundos_sin_actualizar
      FROM clusters c
      LEFT JOIN buses b ON c.id_bus = b.id_bus
      WHERE c.id_bus = $1
      ORDER BY c.ultima_actualizacion DESC
    `, [idBus]);

    res.json({
      success: true,
      total: clustersResult.rows.length,
      data: {
        patente: busResult.rows[0].patente,
        activo: busResult.rows[0].activo,
        clusters: clustersResult.rows
      }
    });

  } catch (error) {
    console.error('Error en getClusterPorPatente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener clusters por patente'
    });
  }
};

/**
 * 📊 [DEBUG] Obtener cola de eliminación de clusters
 * GET /api/v1/cluster/debug/cleanup-queue
 */
exports.getCleanupQueue = async (req, res) => {
  try {
    const maxAgeSeconds = req.query.maxAge || 60;
    
    const query = `
      SELECT 
        id_cluster,
        cantidad_usuarios,
        ultima_actualizacion,
        EXTRACT(EPOCH FROM (NOW() - ultima_actualizacion))::integer as segundos_sin_actualizar,
        CASE 
          WHEN EXTRACT(EPOCH FROM (NOW() - ultima_actualizacion)) > $1 THEN 'PARA ELIMINAR'
          ELSE 'ACTIVO'
        END as estado
      FROM clusters
      ORDER BY ultima_actualizacion DESC
    `;

    const result = await pool.query(query, [maxAgeSeconds]);
    const paraEliminar = result.rows.filter(r => r.estado === 'PARA ELIMINAR').length;
    
    res.json({
      success: true,
      maxAgeSeconds: parseInt(maxAgeSeconds),
      total: result.rows.length,
      paraEliminar: paraEliminar,
      mensaje: `${paraEliminar} de ${result.rows.length} clusters listos para eliminar`,
      data: result.rows
    });

  } catch (error) {
    console.error('Error en getCleanupQueue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🧹 [ADMIN] Forzar limpieza inmediata de clusters antiguos
 * POST /api/v1/cluster/admin/force-cleanup
 */
exports.forceClusterCleanup = async (req, res) => {
  try {
    console.log(`🚨 LIMPIEZA FORZADA SOLICITADA por ${req.ip}`);
    
    const maxAgeSeconds = req.query.maxAge || 60;
    const deleted = await Cluster.deleteClustersBySeconds(maxAgeSeconds);
    
    // Obtener estadísticas después de limpiar
    const remaining = await pool.query(`
      SELECT COUNT(*) as total FROM clusters WHERE esta_activo = TRUE
    `);
    
    res.json({
      success: true,
      message: `Limpieza forzada completada`,
      deleted: deleted,
      remainingClusters: remaining.rows[0].total,
      stats: {
        clustersEliminados: deleted,
        clustersRestantes: remaining.rows[0].total,
        maxAgeSeconds: parseInt(maxAgeSeconds)
      }
    });
  } catch (error) {
    console.error('Error en forceClusterCleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;
