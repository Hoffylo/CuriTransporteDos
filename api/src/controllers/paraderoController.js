// api/src/controllers/paraderoController.js
const pool = require('../config/database');
const Paradero = require('../models/modelParadero');

// ════════════════════════════════════════════════════════════════
// GET: Obtener todos los paraderos
// ════════════════════════════════════════════════════════════════
exports.getParaderos = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_paradero, nom_paradero, latitud, longitud, 
              direccion, descripcion FROM paraderos ORDER BY nom_paradero`
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    console.error('Error obteniendo paraderos:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo paraderos',
      details: err.message 
    });
  }
};

// ════════════════════════════════════════════════════════════════
// GET: Obtener paraderos cercanos (Geolocalización con PostGIS)
// ════════════════════════════════════════════════════════════════
exports.getParaderosCercanos = async (req, res) => {
  try {
    const { lat, lng, radio = 20000 } = req.query; // radio en metros

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parámetros lat y lng requeridos' 
      });
    }

    // Convertir a números
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radioNum = parseInt(radio);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Lat y lng deben ser números válidos' 
      });
    }

    // Usar PostGIS para buscar paraderos dentro del radio
    const result = await pool.query(
      `SELECT 
        id_paradero, 
        nom_paradero, 
        latitud, 
        longitud, 
        direccion, 
        descripcion,
        ST_Distance(geom, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326)::geography) as distancia_metros
       FROM paraderos
       WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326)::geography, $3)
       ORDER BY distancia_metros ASC`,
      [lngNum, latNum, radioNum]
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      ubicacion: { latitud: latNum, longitud: lngNum, radio_metros: radioNum },
    });
  } catch (err) {
    console.error('Error obteniendo paraderos cercanos:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo paraderos cercanos',
      details: err.message 
    });
  }
};

// ════════════════════════════════════════════════════════════════
// GET: Obtener paradero por ID
// ════════════════════════════════════════════════════════════════
exports.getParaderoById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id_paradero, nom_paradero, latitud, longitud, direccion, descripcion 
       FROM paraderos WHERE id_paradero = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Paradero no encontrado' 
      });
    }

    res.json({ 
      success: true,
      data: result.rows[0] 
    });
  } catch (err) {
    console.error('Error obteniendo paradero:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo paradero',
      details: err.message 
    });
  }
};

// ════════════════════════════════════════════════════════════════
// GET: Obtener estadísticas de un paradero
// ════════════════════════════════════════════════════════════════
exports.getEstadisticasParadero = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id_paradero, nom_paradero FROM paraderos WHERE id_paradero = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Paradero no encontrado' 
      });
    }

    res.json({
      success: true,
      data: {
        id_paradero: result.rows[0].id_paradero,
        nombre: result.rows[0].nom_paradero,
        usuarios_esperando: Math.floor(Math.random() * 15),
        micros_proximas: Math.floor(Math.random() * 3),
        tiempo_espera_promedio_min: Math.floor(Math.random() * 30) + 5,
      }
    });
  } catch (err) {
    console.error('Error obteniendo estadísticas:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Error obteniendo estadísticas',
      details: err.message 
    });
  }
};

// ════════════════════════════════════════════════════════════════
// POST: Crear nuevo paradero (ADMIN)
// ════════════════════════════════════════════════════════════════
exports.crearParadero = async (req, res) => {
  try {
    const { nom_paradero, latitud, longitud, direccion, descripcion } = req.body;

    // Validar campos requeridos
    if (!nom_paradero || latitud === undefined || longitud === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: nom_paradero, latitud, longitud'
      });
    }

    // Validar que coordenadas sean números
    const lat = parseFloat(latitud);
    const lng = parseFloat(longitud);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: 'latitud y longitud deben ser números válidos'
      });
    }

    // Validar rangos de coordenadas
    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        error: 'latitud debe estar entre -90 y 90'
      });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'longitud debe estar entre -180 y 180'
      });
    }

    // El trigger actualizará geom automáticamente
    const result = await pool.query(
      `INSERT INTO paraderos 
       (nom_paradero, latitud, longitud, direccion, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_paradero, nom_paradero, latitud, longitud, direccion, descripcion`,
      [nom_paradero, lat, lng, direccion || null, descripcion || null]
    );

    res.status(201).json({
      success: true,
      message: 'Paradero creado exitosamente',
      data: result.rows[0],
      creado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Error creando paradero:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error creando paradero',
      details: err.message
    });
  }
};

// ════════════════════════════════════════════════════════════════
// PUT: Editar paradero (ADMIN)
// ════════════════════════════════════════════════════════════════
exports.editarParadero = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom_paradero, latitud, longitud, direccion, descripcion } = req.body;

    // Verificar que el paradero existe
    const existe = await pool.query(
      'SELECT id_paradero FROM paraderos WHERE id_paradero = $1',
      [id]
    );

    if (existe.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paradero no encontrado'
      });
    }

    // Si no hay cambios, retornar error
    if (!nom_paradero && latitud === undefined && longitud === undefined && !direccion && !descripcion) {
      return res.status(400).json({
        success: false,
        error: 'Al menos un campo debe ser proporcionado para actualizar'
      });
    }

    // Validar coordenadas si se proporcionan
    if (latitud !== undefined || longitud !== undefined) {
      if (latitud !== undefined) {
        const lat = parseFloat(latitud);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          return res.status(400).json({
            success: false,
            error: 'latitud inválida (debe estar entre -90 y 90)'
          });
        }
      }
      if (longitud !== undefined) {
        const lng = parseFloat(longitud);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          return res.status(400).json({
            success: false,
            error: 'longitud inválida (debe estar entre -180 y 180)'
          });
        }
      }
    }

    // Construir consulta dinámica
    let updateQuery = 'UPDATE paraderos SET ';
    let values = [];
    let paramCount = 1;

    if (nom_paradero !== undefined) {
      updateQuery += `nom_paradero = $${paramCount++}, `;
      values.push(nom_paradero);
    }
    if (latitud !== undefined) {
      updateQuery += `latitud = $${paramCount++}, `;
      values.push(parseFloat(latitud));
    }
    if (longitud !== undefined) {
      updateQuery += `longitud = $${paramCount++}, `;
      values.push(parseFloat(longitud));
    }
    if (direccion !== undefined) {
      updateQuery += `direccion = $${paramCount++}, `;
      values.push(direccion);
    }
    if (descripcion !== undefined) {
      updateQuery += `descripcion = $${paramCount++}, `;
      values.push(descripcion);
    }

    // Remover última coma
    updateQuery = updateQuery.slice(0, -2);
    updateQuery += ` WHERE id_paradero = $${paramCount} RETURNING id_paradero, nom_paradero, latitud, longitud, direccion, descripcion`;
    values.push(id);

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Paradero actualizado exitosamente',
      data: result.rows[0],
      actualizado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Error actualizando paradero:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error actualizando paradero',
      details: err.message
    });
  }
};

// ════════════════════════════════════════════════════════════════
// DELETE: Eliminar paradero (ADMIN)
// ════════════════════════════════════════════════════════════════
exports.eliminarParadero = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el paradero existe
    const paradero = await pool.query(
      'SELECT id_paradero, nom_paradero FROM paraderos WHERE id_paradero = $1',
      [id]
    );

    if (paradero.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paradero no encontrado'
      });
    }

    const result = await pool.query(
      'DELETE FROM paraderos WHERE id_paradero = $1 RETURNING id_paradero, nom_paradero',
      [id]
    );

    res.json({
      success: true,
      message: 'Paradero eliminado exitosamente',
      data: result.rows[0],
      eliminado_por: req.usuario.username,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Error eliminando paradero:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error eliminando paradero',
      details: err.message
    });
  }
};

// GET /api/v1/paraderos/:id/proximos-buses
exports.getProximosBuses = async (req, res) => {
  try {
    const { id } = req.params;
    const { radio = 20000, limit = 3, id_ruta: idRutaQuery, sentido: sentidoQuery } = req.query; // radio en metros

    // Obtener paradero y su geom
    const paraderoRes = await pool.query(
      `SELECT id_paradero, nom_paradero, latitud, longitud, geom
       FROM paraderos WHERE id_paradero = $1`,
      [id]
    );

    if (paraderoRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Paradero no encontrado' });
    }
    const paradero = paraderoRes.rows[0];

    // Obtener rutas asociadas al paradero CON su sentido
    const rutasRes = await pool.query(
      `SELECT r.id_ruta, r.sentido_ruta 
       FROM ruta_paradero rp
       JOIN ruta r ON rp.id_ruta = r.id_ruta
       WHERE rp.id_paradero = $1`,
      [paradero.id_paradero]
    );

    if (rutasRes.rows.length === 0) {
      // Si el paradero no está asociado a ninguna ruta, retornar vacío
      return res.json({
        success: true,
        paradero: { id_paradero: paradero.id_paradero, nombre: paradero.nom_paradero },
        total: 0,
        data: []
      });
    }

    // Agrupar rutas por sentido para filtrar clusters correctamente
    const rutasIda = rutasRes.rows.filter(r => r.sentido_ruta === true).map(r => r.id_ruta);
    const rutasVuelta = rutasRes.rows.filter(r => r.sentido_ruta === false).map(r => r.id_ruta);
    let rutaIds = rutasRes.rows.map(r => r.id_ruta);

    // Si el front envía id_ruta, forzar a esa ruta (y su sentido) para no mezclar ida/vuelta
    let sentidoRuta = null;
    if (idRutaQuery) {
      const idRutaInt = parseInt(idRutaQuery);
      const rutaMatch = rutasRes.rows.find(r => r.id_ruta === idRutaInt);
      if (rutaMatch) {
        rutaIds = [idRutaInt];
        sentidoRuta = rutaMatch.sentido_ruta;
      } else {
        return res.status(400).json({
          success: false,
          error: `El paradero ${id} no pertenece a la ruta ${idRutaQuery}`
        });
      }
    } else {
      // Sin id_ruta explícito: filtrar por sentido si solo hay uno de los dos
      if (rutasIda.length > 0 && rutasVuelta.length === 0) {
        sentidoRuta = true; // Solo ruta ida
      } else if (rutasVuelta.length > 0 && rutasIda.length === 0) {
        sentidoRuta = false; // Solo ruta vuelta
      }
      // Si tiene ambos sentidos, sentidoRuta = null (mostrar todos)
    }

    // Permitir override manual de sentido (opcional) si el front lo envía como query
    if (sentidoQuery === 'true') sentidoRuta = true;
    if (sentidoQuery === 'false') sentidoRuta = false;

    console.log(`[PARADERO DEBUG] Paradero ${id}: rutasIda=${JSON.stringify(rutasIda)}, rutasVuelta=${JSON.stringify(rutasVuelta)}, rutaIdsUsadas=${JSON.stringify(rutaIds)}, sentido=${sentidoRuta}`);

    // Calcular ETAs en batch vía EtaService para eficiencia
    const EtaService = require('../services/etaService');
    const FALLBACK_KMH = parseFloat(process.env.FALLBACK_SPEED_KMH) || 15; // 15 km/h por defecto

    console.log(`[PARADERO DEBUG] getProximosBuses: paradero=${id}, sentido_filtro=${sentidoRuta}, rutas=${JSON.stringify(rutaIds)}, radio=${radio}m`);

    const clustersWithEta = await EtaService.computeEtasForParadero(
      pool,
      rutaIds,
      paradero.geom,
      parseInt(radio),
      parseInt(limit),
      FALLBACK_KMH,
      sentidoRuta
    );

    console.log(`[PARADERO DEBUG] Encontrados ${clustersWithEta.length} clusters (filtrados por sentido=${sentidoRuta}) para paradero ${id}`);

    res.json({
      success: true,
      paradero: { id_paradero: paradero.id_paradero, nombre: paradero.nom_paradero },
      total: clustersWithEta.length,
      data: clustersWithEta
    });

  } catch (err) {
    console.error('Error en getProximosBuses:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
