// controllers/telemetriaController.js
const pool = require('../config/database');
const Cluster = require('../models/modelCluster');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ════════════════════════════════════════════════════════════════
// DEDUPLICACIÓN: Cache temporal para evitar requests duplicados
// ════════════════════════════════════════════════════════════════
const requestCache = new Map();
const CACHE_TTL_MS = 3000; // 3 segundos

function getRequestKey(userId, lat, lng) {
  return `${userId}_${lat.toFixed(6)}_${lng.toFixed(6)}`;
}

function isDuplicateRequest(userId, lat, lng) {
  const key = getRequestKey(userId, lat, lng);
  const cached = requestCache.get(key);
  
  if (cached && Date.now() - cached < CACHE_TTL_MS) {
    return true; // Duplicado
  }
  
  // Registrar request y limpiar cache antigua
  requestCache.set(key, Date.now());
  
  // Limpieza periódica (cada 100 requests)
  if (requestCache.size > 100) {
    const now = Date.now();
    for (const [k, timestamp] of requestCache.entries()) {
      if (now - timestamp > CACHE_TTL_MS) {
        requestCache.delete(k);
      }
    }
  }
  
  return false;
}

/**
 * 📍 Registrar ubicación de usuario (PUNTO PRINCIPAL)
 * POST /api/v1/telemetria/registrar
 * 
 * Flujo:
 * 1. Verifica si hay JWT en header
 *    - Si SÍ → extrae id_usuario del token (usuario registrado)
 *    - Si NO → valida que usuario_id tenga formato anon_<UUID>
 * 2. Registra en tabla ubicacion
 * 3. Llama a processUserLocation (modelCluster)
 * 4. Retorna si está en bus o no
 */
exports.registrarUbicacion = async (req, res) => {
  try {
    const { latitud, longitud, velocidad = 0, precision_metros = 10, direccion = 0, esta_en_bus = false, confirmado_usuario = false, id_ruta = null, patente = null } = req.body;

    // 🔑 PASO 1: Verificar JWT en header
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token
    let usuario_id = null;
    let es_registrado = false;

    if (token) {
      // ✅ Token presente → Usuario autenticado
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        usuario_id = decoded.id || decoded.id_usuario; // Usar 'id' o fallback 'id_usuario'
        es_registrado = true;
        console.log(`✅ [TELEMETRÍA] Usuario registrado identificado: ${usuario_id}`);
      } catch (error) {
        console.error(`❌ [TELEMETRÍA] Token inválido: ${error.message}`);
        return res.status(403).json({ 
          success: false, 
          error: 'Token JWT inválido o expirado' 
        });
      }
    } else {
      // ❌ Sin token → Esperar usuario_id anónimo en body
      usuario_id = req.body.usuario_id;
      es_registrado = false;
      
      if (!usuario_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Se requiere: JWT token (header Authorization) O usuario_id anónimo (body)' 
        });
      }
    }

    // 🔍 LOG DEBUG: Ver qué velocidad recibe el servidor
    if (esta_en_bus) {
      console.log(`🚀 [VELOCIDAD DEBUG] Usuario ${usuario_id}: velocidad recibida=${velocidad} km/h, tipo=${typeof velocidad}`);
    }

    // Validaciones de identidad
    let identidad = null;
    let registrado = Boolean(es_registrado);

    if (registrado) {
      const idNum = parseInt(usuario_id);
      if (isNaN(idNum)) {
        return res.status(400).json({ success: false, error: 'ID de usuario debe ser numérico para usuarios registrados' });
      }
      identidad = idNum; // id_usuario numérico
    } else {
      if (typeof usuario_id !== 'string' || !usuario_id.startsWith('anon_') || usuario_id.length < 10) {
        return res.status(400).json({ success: false, error: 'usuario_id anónimo inválido. Formato esperado: anon_<UUID>' });
      }
      identidad = usuario_id; // usuario_anonimo_id string
    }

    // Validar coordenadas
    if (latitud === undefined || longitud === undefined) {
      return res.status(400).json({ success: false, error: 'Campos requeridos: latitud, longitud' });
    }
    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, error: 'Coordenadas inválidas' });
    }

    // ════════════════════════════════════════════════════════════════
    // DEDUPLICACIÓN: Ignorar requests duplicados del mismo usuario
    // ════════════════════════════════════════════════════════════════
    if (isDuplicateRequest(usuario_id, lat, lng)) {
      console.warn(`⚠️ [TELEMETRÍA] Request duplicado ignorado: ${usuario_id} en (${lat}, ${lng})`);
      return res.status(429).json({ 
        success: false, 
        error: 'Request duplicado - por favor espere antes de enviar otra ubicación',
        deduplicado: true 
      });
    }

    // Validar ruta si corresponde
    if (esta_en_bus && id_ruta) {
      const rutaResult = await pool.query('SELECT id_ruta FROM ruta WHERE id_ruta = $1', [id_ruta]);
      if (rutaResult.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Ruta no encontrada' });
      }
    }

    // 🚌 Validar y obtener id_bus de la patente si se proporciona
    let id_bus = null;
    if (patente) {
      const patenteUpper = patente.toString().trim().toUpperCase();
      const busResult = await pool.query(
        'SELECT id_bus FROM buses WHERE patente = $1 AND activo = TRUE',
        [patenteUpper]
      );
      
      if (busResult.rows.length === 0) {
        console.warn(`⚠️ [TELEMETRÍA] Patente no válida o inactiva: ${patenteUpper}`);
        return res.status(400).json({ 
          success: false, 
          error: `Patente '${patenteUpper}' no está registrada o no está activa` 
        });
      }
      
      id_bus = busResult.rows[0].id_bus;
      console.log(`✅ [TELEMETRÍA] Patente validada: ${patenteUpper} → id_bus=${id_bus}`);
    }

    // Procesar clustering con reintentos automáticos (conflictos de concurrencia)
    let resultado;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        resultado = await Cluster.processUserLocation(
          identidad,
          lat,
          lng,
          parseFloat(velocidad),
          parseFloat(precision_metros),
          parseFloat(direccion),
          esta_en_bus,
          confirmado_usuario,
          id_ruta,
          registrado,
          id_bus
        );
        break; // Éxito, salir del loop
      } catch (error) {
        lastError = error;
        // Reintentar si es conflicto de serialización (código 40001)
        if (error.code === '40001' && attempt < 3) {
          const backoffMs = 50 * Math.pow(2, attempt - 1);
          console.warn(`⚠️ [RETRY] Conflicto de concurrencia, reintentando en ${backoffMs}ms (intento ${attempt}/3)`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          throw error;
        }
      }
    }

    // ════════════════════════════════════════════════════════════════
    // MANEJO DE DESVÍOS: Devolver HTTP 200 con success: false
    // para que el frontend pueda mostrar diálogos sin errores de consola
    // ════════════════════════════════════════════════════════════════
    const accionesDesvio = ['FUERA_DE_RUTA', 'DESVIO_DETECTADO', 'CLUSTER_DESVIADO', 'DESVIO_AL_CREAR_CLUSTER'];
    
    if (resultado && accionesDesvio.includes(resultado.accion)) {
      console.warn('⚠️ [TELEMETRÍA] Desvío detectado:', { 
        accion: resultado.accion, 
        identidad, 
        id_ruta, 
        lat, 
        lng, 
        motivo: resultado.motivo 
      });
      
      return res.status(200).json({ 
        success: false, 
        message: resultado.motivo || 'Desvío de ruta detectado',
        data: resultado 
      });
    }

    // Usuario en bus o sin bus (normal)
    res.json({ success: true, message: 'Ubicación registrada', data: resultado });

  } catch (error) {
    console.error('❌ [TELEMETRÍA] Error en registrarUbicacion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🛑 Detener telemetría y desvincularse del cluster
 * POST /api/v1/telemetria/detener
 * 
 * Flujo:
 * 1. Verifica si hay JWT en header
 *    - Si SÍ → extrae id_usuario del token
 *    - Si NO → valida que usuario_id tenga formato anon_<UUID>
 * 2. Marca al usuario como no en bus
 * 3. Desvincula del cluster
 * 4. Si cluster queda vacío, lo marca como inactivo
 * 5. Retorna estado final
 */
exports.detenerTelemetria = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token
    let usuario_id = null;
    let es_registrado = false;

    if (token) {
      // ✅ Token presente → Usuario autenticado
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        usuario_id = decoded.id || decoded.id_usuario;
        es_registrado = true;
        console.log(`✅ [TELEMETRÍA] Deteniendo telemetría de usuario registrado: ${usuario_id}`);
      } catch (error) {
        console.error(`❌ [TELEMETRÍA] Token inválido: ${error.message}`);
        return res.status(403).json({ 
          success: false, 
          error: 'Token JWT inválido o expirado' 
        });
      }
    } else {
      // ❌ Sin token → Esperar usuario_id anónimo en body
      usuario_id = req.body.usuario_id;
      es_registrado = false;
      
      if (!usuario_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Se requiere: JWT token (header Authorization) O usuario_id anónimo (body)' 
        });
      }
    }

    // Validaciones de identidad
    let identidad = null;
    let registrado = Boolean(es_registrado);

    if (registrado) {
      const idNum = parseInt(usuario_id);
      if (isNaN(idNum)) {
        return res.status(400).json({ success: false, error: 'ID de usuario debe ser numérico para usuarios registrados' });
      }
      identidad = idNum; // id_usuario numérico
    } else {
      if (typeof usuario_id !== 'string' || !usuario_id.startsWith('anon_') || usuario_id.length < 10) {
        return res.status(400).json({ success: false, error: 'usuario_id anónimo inválido. Formato esperado: anon_<UUID>' });
      }
      identidad = usuario_id; // usuario_anonimo_id string
    }

    // Detener telemetría
    const resultado = await Cluster.removeUserFromBus(identidad, registrado);

    res.json({
      success: true,
      message: 'Telemetría detenida',
      data: resultado
    });

  } catch (error) {
    console.error('❌ [TELEMETRÍA] Error en detenerTelemetria:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🧹 Limpiar clusters inactivos (TTL automático)
 * POST /api/v1/telemetria/limpiar-clusters
 * 
 * Elimina clusters sin usuarios activos hace más de X minutos
 */
exports.limpiarClustersInactivos = async (req, res) => {
  try {
    const { minutos_inactividad = 10 } = req.body;

    const resultado = await Cluster.cleanupInactiveClusters(minutos_inactividad);

    res.json({
      success: true,
      message: 'Limpieza completada',
      data: resultado
    });

  } catch (error) {
    console.error('❌ [TELEMETRÍA] Error en limpiarClustersInactivos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
/**
 * 🗺️ Obtener clusters activos DE UNA RUTA
 * GET /api/v1/telemetria/clusters-por-ruta?lat=X&lng=Y&id_ruta=5
 */
exports.getClusteresPorRuta = async (req, res) => {
  try {
    const { lat, lng, radio = 20000, id_ruta } = req.query;

    if (!lat || !lng || !id_ruta) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros requeridos: lat, lng, id_ruta'
      });
    }

    // Obtener clusters de esa ruta
    const resultado = await pool.query(`
      SELECT 
        c.id_cluster, 
        c.latitud_centro, 
        c.longitud_centro,
        c.usuarios_activos_count, 
        c.velocidad_promedio,
        r.nom_ruta,
        r.sentido_ruta,
        ST_Distance(
          c.geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric as distancia_metros
      FROM clusters c
      LEFT JOIN ruta r ON c.id_ruta = r.id_ruta
      WHERE c.esta_activo = TRUE
        AND c.id_ruta = $3            -- ✅ FILTRAR POR RUTA
        AND ST_DWithin(
          c.geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $4
        )
      ORDER BY c.usuarios_activos_count DESC
    `, [parseFloat(lng), parseFloat(lat), parseInt(id_ruta), parseInt(radio)]);

    res.json({
      success: true,
      total: resultado.rows.length,
      id_ruta: id_ruta,
      radio_metros: radio,
      data: resultado.rows
    });

  } catch (error) {
    console.error('Error en getClusteresPorRuta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener última ubicación del usuario
 * GET /api/v1/telemetria/ultima-ubicacion
 */
exports.getUltimaUbicacion = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;

    const result = await pool.query(`
      SELECT 
        id_ubicacion,
        latitud,
        longitud,
        velocidad,
        precision_metros,
        direccion,
        esta_en_bus,
        id_cluster,
        tiempo
      FROM ubicacion
      WHERE id_usuario = $1
      ORDER BY tiempo DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay ubicación registrada'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error en getUltimaUbicacion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener histórico de ubicaciones del usuario (últimas 24 horas)
 * GET /api/v1/telemetria/historial
 */
exports.getHistorialUbicaciones = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT 
        id_ubicacion,
        latitud,
        longitud,
        velocidad,
        precision_metros,
        direccion,
        esta_en_bus,
        id_cluster,
        tiempo
      FROM ubicacion
      WHERE id_usuario = $1
        AND tiempo > NOW() - INTERVAL '24 hours'
      ORDER BY tiempo DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM ubicacion
      WHERE id_usuario = $1
        AND tiempo > NOW() - INTERVAL '24 hours'
    `, [userId]);

    res.json({
      success: true,
      total: parseInt(countResult.rows[0].total),
      data: result.rows
    });

  } catch (error) {
    console.error('Error en getHistorialUbicaciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener usuarios cercanos (a cierto radio)
 * GET /api/v1/telemetria/usuarios-cercanos?radio=10000
 */
exports.getUsuariosCercanos = async (req, res) => {
  try {
    const userId = req.usuario.id_usuario;
    const { radio = 20000 } = req.query; // en metros

    // Obtener ubicación actual del usuario
    const miUbicacion = await pool.query(`
      SELECT latitud, longitud
      FROM ubicacion
      WHERE id_usuario = $1
      ORDER BY tiempo DESC
      LIMIT 1
    `, [userId]);

    if (miUbicacion.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay ubicación registrada para el usuario'
      });
    }

    const { latitud, longitud } = miUbicacion.rows[0];

    // Buscar usuarios cercanos (excluir al usuario actual)
    const result = await pool.query(`
      SELECT DISTINCT ON (u.id_usuario)
        u.id_usuario,
        u.username,
        u.nombre,
        u.apellido,
        ub.latitud,
        ub.longitud,
        ub.velocidad,
        ub.tiempo,
        ST_Distance(
          ub.geom,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
        )::numeric as distancia_metros
      FROM ubicacion ub
      JOIN usuarios u ON u.id_usuario = ub.id_usuario
      WHERE ub.id_usuario != $1
        AND ub.tiempo > NOW() - INTERVAL '5 minutes'
        AND ST_DWithin(
          ub.geom,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      ORDER BY u.id_usuario, ub.tiempo DESC
    `, [userId, longitud, latitud, parseInt(radio)]);

    res.json({
      success: true,
      total: result.rows.length,
      radio_metros: radio,
      data: result.rows
    });

  } catch (error) {
    console.error('Error en getUsuariosCercanos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Obtener información del bus donde está el usuario (si está en bus)
 * GET /api/v1/telemetria/bus-actual
 */
exports.getBusActual = async (req, res) => {
  try {
    // Obtener id de usuario desde token (req.usuario) o desde query/body como fallback
    let userId = req.usuario?.id_usuario;
    if (!userId && req.query.usuario_id) userId = parseInt(req.query.usuario_id);
    if (!userId && req.body?.usuario_id) userId = parseInt(req.body.usuario_id);

    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'usuario_id requerido (token o query/body)'
      });
    }

    // Obtener última ubicación del usuario
    const ubicacionResult = await pool.query(`
      SELECT id_cluster, esta_en_bus
      FROM ubicacion
      WHERE id_usuario = $1
      ORDER BY tiempo DESC
      LIMIT 1
    `, [userId]);

    if (ubicacionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No hay ubicación registrada'
      });
    }

    const { id_cluster, esta_en_bus } = ubicacionResult.rows[0];

    if (!esta_en_bus || !id_cluster) {
      return res.json({
        success: true,
        enBus: false,
        data: null
      });
    }

    // Obtener información del cluster/bus
    const busResult = await pool.query(`
      SELECT 
        c.id_cluster,
        c.latitud_centro,
        c.longitud_centro,
        c.cantidad_usuarios,
        c.velocidad_promedio,
        c.direccion_promedio,
        c.id_paradero_cercano,
        p.nom_paradero,
        p.latitud as paradero_lat,
        p.longitud as paradero_lng,
        ST_Distance(
          c.geom,
          p.geom
        )::numeric as distancia_a_paradero
      FROM clusters c
      LEFT JOIN paraderos p ON c.id_paradero_cercano = p.id_paradero
      WHERE c.id_cluster = $1 AND c.esta_activo = TRUE
    `, [id_cluster]);

    if (busResult.rows.length === 0) {
      return res.json({
        success: true,
        enBus: false,
        data: null
      });
    }

    // Obtener miembros del cluster
    const miembrosResult = await pool.query(`
      SELECT COUNT(DISTINCT id_usuario) as total
      FROM ubicacion
      WHERE id_cluster = $1 AND esta_en_bus = TRUE AND tiempo > NOW() - INTERVAL '1 minute'
    `, [id_cluster]);

    const bus = busResult.rows[0];
    bus.usuarios_activos = miembrosResult.rows[0].total;

    res.json({
      success: true,
      enBus: true,
      data: bus
    });

  } catch (error) {
    console.error('Error en getBusActual:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = exports;