const pool = require('../config/database');
const geolib = require('geolib');

class Cluster {

  // UTILIDADES

  /**
   * Reintentar operación si hay conflicto de serialización (código 40001)
   * PostgreSQL devuelve este error cuando hay concurrent updates
   */
  static async withRetry(operation, maxRetries = 3, delayMs = 100) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // Código 40001 = serialization_failure en PostgreSQL
        if (error.code === '40001' && attempt < maxRetries) {
          const backoffMs = delayMs * Math.pow(2, attempt - 1); // exponential backoff
          console.warn(`⚠️ [RETRY] Conflicto de serialización, reintentando en ${backoffMs}ms (intento ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          throw error;
        }
      }
    }
  }

  // CREAR CLUSTER
 

  /**
   * Crear nuevo cluster (nuevo bus detectado)
   * Cuando N usuarios están juntos en una zona
   */
  static async create(clusterId, latitude, longitude, cantidadUsuarios, velocidadPromedio) {
    const query = `
      INSERT INTO clusters (
        latitud_centro,
        longitud_centro,
        cantidad_usuarios,
        velocidad_promedio,
        esta_activo,
        fecha_creacion,
        ultima_actualizacion
      )
      VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      latitude,
      longitude,
      cantidadUsuarios,
      velocidadPromedio
    ]);

    return result.rows[0];
  }

  // OBTENER CLUSTERS

  /**
   * Obtener todos los clusters activos PARA EL MAPA
   * Solo muestra clusters con usuarios activos
   */
  static async findAllActive() {
    const query = `
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
        b.patente as placa,
        c.esta_activo,
        c.fecha_creacion,
        c.ultima_actualizacion,
        EXTRACT(EPOCH FROM (NOW() - c.ultima_actualizacion)) as segundos_sin_actualizar
      FROM clusters c
      LEFT JOIN buses b ON c.id_bus = b.id_bus
      WHERE c.esta_activo = TRUE
        AND c.cantidad_usuarios > 0
        AND EXTRACT(EPOCH FROM (NOW() - c.ultima_actualizacion)) < 120
      ORDER BY c.ultima_actualizacion DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Obtener clusters PARA PARADEROS (incluye histórico reciente)
   * Muestra clusters activos + inactivos de la última hora
   */
  static async findAllForStops() {
    const query = `
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
        b.patente as placa,
        c.esta_activo,
        c.fecha_creacion,
        c.ultima_actualizacion,
        EXTRACT(EPOCH FROM (NOW() - c.ultima_actualizacion)) as segundos_sin_actualizar
      FROM clusters c
      LEFT JOIN buses b ON c.id_bus = b.id_bus
      WHERE c.ultima_actualizacion > NOW() - INTERVAL '1 hour'
      ORDER BY c.ultima_actualizacion DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Obtener cluster por ID
   */
  static async findById(clusterId) {
    const query = `
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
        b.patente as placa,
        c.esta_activo,
        c.fecha_creacion,
        c.ultima_actualizacion
      FROM clusters c
      LEFT JOIN buses b ON c.id_bus = b.id_bus
      WHERE c.id_cluster = $1
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows[0];
  }

  /**
   * Obtener clusters cercanos a una coordenada (buses cerca)
   */
  static async findNearbyClusters(latitude, longitude, radiusMeters = 1000) {
    const query = `
      SELECT 
        c.id_cluster,
        c.latitud_centro,
        c.longitud_centro,
        c.cantidad_usuarios,
        c.velocidad_promedio,
        c.direccion_promedio,
        c.id_ruta,
        c.id_bus,
        b.patente as placa,
        c.ultima_actualizacion,
        ST_Distance(
          c.geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric as distancia_metros
      FROM clusters c
      LEFT JOIN buses b ON c.id_bus = b.id_bus
      WHERE c.esta_activo = TRUE
        AND ST_DWithin(
          c.geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      ORDER BY distancia_metros ASC
    `;

    const result = await pool.query(query, [longitude, latitude, radiusMeters]);
    return result.rows;
  }

  // ACTUALIZAR CLUSTER

  /**
   * Actualizar centro y estadísticas del cluster
   * Se llama cuando usuarios se mueven
   */
  static async updateClusterCenter(clusterId, newLatitude, newLongitude, newVelocity, newDirection) {
    const query = `
      UPDATE clusters
      SET 
        latitud_centro = $1,
        longitud_centro = $2,
        velocidad_promedio = $3,
        direccion_promedio = $4,
        ultima_actualizacion = NOW()
      WHERE id_cluster = $1
      RETURNING *
    `;

    const result = await pool.query(query, [
      clusterId,
      newLatitude,
      newLongitude,
      newVelocity,
      newDirection
    ]);

    return result.rows[0];
  }

  /**
   * Actualizar cantidad de usuarios en el cluster
   */
  static async updateUserCount(clusterId, newCount) {
    const query = `
      UPDATE clusters
      SET 
        cantidad_usuarios = $1,
        ultima_actualizacion = NOW()
      WHERE id_cluster = $2
      RETURNING cantidad_usuarios
    `;

    const result = await pool.query(query, [newCount, clusterId]);
    return result.rows[0];
  }

  /**
   * Actualizar paradero cercano del cluster
   */
  static async updateNearestStop(clusterId, paraderoId) {
    const query = `
      UPDATE clusters
      SET 
        id_paradero_cercano = $1,
        ultima_actualizacion = NOW()
      WHERE id_cluster = $2
      RETURNING id_paradero_cercano
    `;

    const result = await pool.query(query, [paraderoId, clusterId]);
    return result.rows[0];
  }

  /**
   * Marcar cluster como inactivo (bus ya no existe)
   */
  static async markInactive(clusterId) {
    const query = `
      UPDATE clusters
      SET 
        esta_activo = FALSE,
        ultima_actualizacion = NOW()
      WHERE id_cluster = $1
      RETURNING id_cluster, esta_activo
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows[0];
  }

  /**
   * Eliminar cluster físicamente (DELETE)
   */
  static async deleteCluster(clusterId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Primero, desvincular ubicaciones del cluster
      await client.query(`
        UPDATE ubicacion
        SET id_cluster = NULL, esta_en_bus = FALSE
        WHERE id_cluster = $1
      `, [clusterId]);

      // Eliminar el cluster
      const result = await client.query(`
        DELETE FROM clusters
        WHERE id_cluster = $1
        RETURNING id_cluster
      `, [clusterId]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🛑 Remover usuario del bus y limpiar cluster si queda vacío
   */
  static async removeUserFromBus(identidad, es_registrado) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Obtener el cluster actual del usuario
      let query, params;
      if (es_registrado) {
        query = `
          SELECT id_cluster FROM ubicacion
          WHERE id_usuario = $1 AND esta_en_bus = TRUE
          ORDER BY tiempo DESC LIMIT 1
        `;
        params = [parseInt(identidad)];
      } else {
        query = `
          SELECT id_cluster FROM ubicacion
          WHERE usuario_anonimo_id = $1 AND esta_en_bus = TRUE
          ORDER BY tiempo DESC LIMIT 1
        `;
        params = [identidad];
      }

      const clusterResult = await client.query(query, params);
      const clusterId = clusterResult.rows[0]?.id_cluster;

      // Marcar todas las ubicaciones del usuario como NO en bus
      if (es_registrado) {
        await client.query(`
          UPDATE ubicacion
          SET esta_en_bus = FALSE, id_cluster = NULL
          WHERE id_usuario = $1
        `, [parseInt(identidad)]);
      } else {
        await client.query(`
          UPDATE ubicacion
          SET esta_en_bus = FALSE, id_cluster = NULL
          WHERE usuario_anonimo_id = $1
        `, [identidad]);
      }

      let clusterEstado = 'activo';

      // Si el usuario estaba en un cluster, recalcular
      if (clusterId) {
        // Contar usuarios activos restantes en el cluster
        const countResult = await client.query(`
          SELECT COUNT(DISTINCT COALESCE(id_usuario::text, usuario_anonimo_id)) as count
          FROM ubicacion
          WHERE id_cluster = $1 AND esta_en_bus = TRUE
        `, [clusterId]);

        const usuariosRestantes = parseInt(countResult.rows[0]?.count || 0);

        console.log(`🛑 Usuario removido. Cluster ${clusterId}: ${usuariosRestantes} usuarios restantes`);

        if (usuariosRestantes === 0) {
          // Actualizar cantidad a 0 pero mantener activo (será marcado inactivo por cleanup tras 2 min)
          await client.query(`
            UPDATE clusters
            SET cantidad_usuarios = 0,
                usuarios_activos_count = 0,
                velocidad_promedio = 0,
                ultima_actualizacion = NOW()
            WHERE id_cluster = $1
          `, [clusterId]);
          clusterEstado = 'activo_sin_usuarios';
          console.log(`⏸️ Cluster ${clusterId} actualizado (cantidad_usuarios = 0, aún visible por 2 min)`);
        } else {
          // Recalcular centro del cluster
          const usersResult = await client.query(`
            SELECT DISTINCT ON (COALESCE(id_usuario::text, usuario_anonimo_id))
              latitud, longitud, velocidad
            FROM ubicacion
            WHERE id_cluster = $1 AND esta_en_bus = TRUE
            ORDER BY COALESCE(id_usuario::text, usuario_anonimo_id), tiempo DESC
          `, [clusterId]);

          if (usersResult.rows.length > 0) {
            const newCenter = this.calculateClusterCenter(usersResult.rows);
            const newVelocity = this.calculateAverageVelocity(usersResult.rows.map(u => u.velocidad));

            await client.query(`
              UPDATE clusters
              SET latitud_centro = $1,
                  longitud_centro = $2,
                  cantidad_usuarios = $3,
                  velocidad_promedio = $4,
                  ultima_actualizacion = NOW()
              WHERE id_cluster = $5
            `, [newCenter.latitude, newCenter.longitude, usersResult.rows.length, newVelocity, clusterId]);

            console.log(`✅ Cluster ${clusterId} recalculado: ${usersResult.rows.length} usuarios, nuevo centro=(${newCenter.latitude}, ${newCenter.longitude})`);
          }
        }
      }

      await client.query('COMMIT');

      return {
        usuario_id: identidad,
        cluster_id: clusterId || null,
        cluster_estado: clusterEstado,
        mensaje: `Usuario desvinculado. Cluster ${clusterId || 'N/A'} ${clusterEstado === 'inactivo' ? 'marcado como inactivo' : 'recalculado'}`
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 🧹 Limpiar clusters sin usuarios activos hace más de X minutos
   */
  static async cleanupInactiveClusters(minutosInactividad = 10) {
    try {
      // Obtener clusters sin usuarios activos hace X minutos
      const clustersToClean = await pool.query(`
        SELECT c.id_cluster
        FROM clusters c
        WHERE c.esta_activo = TRUE
          AND c.ultima_actualizacion < NOW() - INTERVAL '${minutosInactividad} minutes'
          AND NOT EXISTS (
            SELECT 1 FROM ubicacion u
            WHERE u.id_cluster = c.id_cluster
              AND u.esta_en_bus = TRUE
              AND u.tiempo > NOW() - INTERVAL '${minutosInactividad} minutes'
          )
      `);

      const clustersIds = clustersToClean.rows.map(r => r.id_cluster);
      let eliminados = 0;
      let inactivados = 0;

      for (const clusterId of clustersIds) {
        const userCount = await pool.query(`
          SELECT COUNT(DISTINCT COALESCE(id_usuario::text, usuario_anonimo_id)) as count
          FROM ubicacion
          WHERE id_cluster = $1 AND esta_en_bus = TRUE
        `, [clusterId]);

        const remaining = parseInt(userCount.rows[0]?.count || 0);

        // Marcar como inactivo (no borrar aquí); eliminación ocurre en deleteOldClusters() tras 2 minutos
        // NO actualizar ultima_actualizacion para que deleteOldClusters() lo elimine en la misma corrida
        await pool.query(`
          UPDATE clusters 
          SET esta_activo = FALSE,
              cantidad_usuarios = $2,
              usuarios_activos_count = $2,
              velocidad_promedio = CASE WHEN $2 = 0 THEN 0 ELSE velocidad_promedio END
          WHERE id_cluster = $1
        `, [clusterId, remaining]);
        inactivados++;
        console.log(`⏸️ Cluster ${clusterId} marcado como inactivo (${remaining} usuarios)`);
      }

      return {
        clusters_revisados: clustersIds.length,
        eliminados,
        inactivados,
        minutos_inactividad: minutosInactividad
      };

    } catch (error) {
      throw error;
    }
  }

  // OBTENER USUARIOS EN CLUSTER

  /**
   * Obtener todos los usuarios en un cluster
   */
  static async getClusterMembers(clusterId) {
    const query = `
      SELECT 
        u.id_usuario,
        u.username,
        u.nombre,
        u.apellido,
        ul.latitud,
        ul.longitud,
        ul.velocidad,
        ul.tiempo,
        COUNT(DISTINCT e.id_evento) as reportes_del_usuario
      FROM ubicacion ul
      JOIN usuarios u ON u.id_usuario = ul.id_usuario
      LEFT JOIN eventos_usuario e ON e.id_usuario = u.id_usuario
      WHERE ul.id_cluster = $1
        AND ul.esta_en_bus = TRUE
        AND ul.tiempo > NOW() - INTERVAL '1 minute'
      GROUP BY u.id_usuario, u.username, u.nombre, u.apellido, 
               ul.latitud, ul.longitud, ul.velocidad, ul.tiempo
      ORDER BY ul.tiempo DESC
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows;
  }

  /**
   * Contar usuarios activos en cluster
   */
  static async countActiveMembers(clusterId) {
    const query = `
      SELECT COUNT(DISTINCT id_usuario) as cantidad
      FROM ubicacion
      WHERE id_cluster = $1
        AND esta_en_bus = TRUE
        AND tiempo > NOW() - INTERVAL '1 minute'
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows[0].cantidad;
  }

  // OBTENER REPORTES DEL CLUSTER

  /**
   * Obtener eventos/reportes recientes del cluster
   * Qué dicen los usuarios sobre este bus
   */
  static async getClusterEvents(clusterId, limit = 20) {
    const query = `
      SELECT 
        e.id_evento,
        e.descripcion_evento,
        te.nombre_tipo,
        te.categoria,
        te.color_hex,
        u.username,
        e.votos_utiles,
        e.votos_inutiles,
        e.timestamp,
        e.esta_visible
      FROM eventos_usuario e
      JOIN tipo_evento te ON te.id_tipo_evento = e.id_tipo_evento
      JOIN usuarios u ON u.id_usuario = e.id_usuario
      WHERE e.id_cluster = $1
        AND e.esta_visible = TRUE
        AND e.timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY e.votos_utiles DESC, e.timestamp DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [clusterId, limit]);
    return result.rows;
  }

  /**
   * Obtener promedio de utilidad de reportes del cluster
   */
  static async getEventsQuality(clusterId) {
    const query = `
      SELECT 
        COUNT(e.id_evento) as total_eventos,
        AVG(CASE 
          WHEN (e.votos_utiles + e.votos_inutiles) > 0 
          THEN e.votos_utiles::float / (e.votos_utiles + e.votos_inutiles)
          ELSE 0.5
        END) as calidad_promedio
      FROM eventos_usuario e
      WHERE e.id_cluster = $1
        AND e.timestamp > NOW() - INTERVAL '24 hours'
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows[0];
  }

  // OBTENER PARADERO MÁS CERCANO

  /**
   * Encontrar paradero más cercano al cluster
   */
static async findNearestStop(latitude, longitude) {
  const query = `
    SELECT
      id_paradero,
      nom_paradero,
      latitud,
      longitud,
      ST_Distance(
        geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )::numeric as distancia_metros
    FROM paraderos
    ORDER BY distancia_metros ASC
    LIMIT 1
  `;

    const result = await pool.query(query, [longitude, latitude]);
    return result.rows[0];
  }

  // LIMPIAR CLUSTERS INACTIVOS

  // NOTA: cleanupInactiveClusters() está definida más arriba (línea ~356)
  // Esta función duplicada se eliminó para evitar sobrescritura

  /**
  * Eliminar clusters antiguos (después de 1 hora sin actualizar)
   * Para limpiar base de datos
   */
  static async deleteOldClusters(maxAgeMinutes = 60) {
    const query = `
      DELETE FROM clusters
      WHERE ultima_actualizacion < NOW() - INTERVAL '${maxAgeMinutes} minutes'
      RETURNING id_cluster
    `;

    const result = await pool.query(query);
    
    if (result.rowCount > 0) {
      console.log(`🗑️ [LIMPIEZA] ${result.rowCount} clusters eliminados (sin actualizar por ${maxAgeMinutes}+ minutos)`);
    }
    
    return result.rowCount;
  }

  // ESTADÍSTICAS DE CLUSTER

  /**
   * Obtener estadísticas completas del cluster
   */
  static async getStats(clusterId) {
    const query = `
      SELECT 
        c.id_cluster,
        c.cantidad_usuarios,
        c.velocidad_promedio,
        c.direccion_promedio,
        COUNT(DISTINCT u.id_usuario) as usuarios_activos,
        AVG(u.velocidad) as velocidad_promedio_real,
        COUNT(DISTINCT e.id_evento) as total_reportes,
        COUNT(DISTINCT CASE WHEN e.esta_visible = TRUE THEN e.id_evento END) as reportes_visibles,
        p.nom_paradero as paradero_cercano,
        ST_Distance(
          c.geom,
          p.geom
        )::numeric as distancia_a_paradero,
        EXTRACT(EPOCH FROM (NOW() - c.ultima_actualizacion)) as segundos_sin_actualizar
      FROM clusters c
      LEFT JOIN ubicacion u ON u.id_cluster = c.id_cluster AND u.esta_en_bus = TRUE AND u.tiempo > NOW() - INTERVAL '1 minute'
      LEFT JOIN usuarios usr ON usr.id_usuario = u.id_usuario
      LEFT JOIN eventos_usuario e ON e.id_cluster = c.id_cluster
      LEFT JOIN paraderos p ON p.id_paradero = c.id_paradero_cercano
      WHERE c.id_cluster = $1
      GROUP BY c.id_cluster, c.cantidad_usuarios, c.velocidad_promedio, 
               c.direccion_promedio, p.nom_paradero, c.geom, p.geom, c.ultima_actualizacion
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows[0];
  }

  /**
   * Obtener histórico de velocidad del cluster (últimas 10 actualizaciones)
   */
  static async getVelocityHistory(clusterId) {
    const query = `
      SELECT 
        ul.velocidad,
        ul.tiempo,
        COUNT(DISTINCT ul.id_usuario) as usuarios_en_ese_momento
      FROM ubicacion ul
      WHERE ul.id_cluster = $1
        AND ul.tiempo > NOW() - INTERVAL '30 minutes'
      GROUP BY ul.velocidad, ul.tiempo
      ORDER BY ul.tiempo DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [clusterId]);
    return result.rows;
  }

  // LOGICA DE DETECCIÓN: Encontrar usuario en bus

  /**
   * Buscar cluster cercano para un usuario
   * (¿Está en un bus que ya fue detectado?)
   */
  static async findNearbyCluster(latitude, longitude, radiusMeters = 50) {
    const query = `
      SELECT 
        id_cluster,
        latitud_centro,
        longitud_centro,
        cantidad_usuarios,
        velocidad_promedio,
        ST_Distance(
          geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        )::numeric as distancia_metros
      FROM clusters
      WHERE esta_activo = TRUE
        AND ultima_actualizacion > NOW() - INTERVAL '10 minutes'
        AND ST_DWithin(
          geom,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          $3
        )
      ORDER BY distancia_metros ASC
      LIMIT 1
    `;

    const result = await pool.query(query, [longitude, latitude, radiusMeters]);
    return result.rows[0];
  }

  /**
   * Buscar otros usuarios cercanos (para formar un nuevo cluster)
   */
  static async findNearbyUsers(userId, latitude, longitude, radiusMeters = 50, maxAge = 1) {
    const query = `
      SELECT DISTINCT ON (ul.id_usuario)
        ul.id_usuario,
        ul.latitud,
        ul.longitud,
        ul.velocidad,
        ul.tiempo
      FROM ubicacion ul
      WHERE ul.id_usuario != $1
        AND ul.tiempo > NOW() - INTERVAL '${maxAge} minute'
        AND ul.esta_en_bus = FALSE
        AND ST_DWithin(
          ul.geom,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      ORDER BY ul.id_usuario, ul.tiempo DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [userId, longitude, latitude, radiusMeters]);
    return result.rows;
  }

  // ════════════════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES
  // ════════════════════════════════════════════════════════════════

  /**
   * Calcular centro geométrico de múltiples puntos
   */
  static calculateClusterCenter(points) {
    if (points.length === 0) return null;

    const center = geolib.getCenter(points.map(p => ({
      latitude: p.latitud || p.latitude,
      longitude: p.longitud || p.longitude
    })));

    return center;
  }

  /**
   * Calcular velocidad promedio
   */
  static calculateAverageVelocity(velocities) {
    const filtered = velocities.filter(v => v !== null && v !== undefined && v >= 0);
    if (filtered.length === 0) return 0;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
  }

  /**
   * Calcular dirección promedio (bearing)
   */
  static calculateAverageDirection(directions) {
    const filtered = directions.filter(d => d !== null && d !== undefined);
    if (filtered.length === 0) return 0;

    // Convertir a radianes
    const radians = filtered.map(d => (d * Math.PI) / 180);
    
    // Calcular componentes X y Y
    const x = radians.reduce((sum, r) => sum + Math.cos(r), 0) / radians.length;
    const y = radians.reduce((sum, r) => sum + Math.sin(r), 0) / radians.length;
    
    // Convertir de vuelta a grados
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    return angle;
  }

  // ════════════════════════════════════════════════════════════════
// 🔑 MÉTODO PRINCIPAL: PROCESAR UBICACIÓN DEL USUARIO
// ════════════════════════════════════════════════════════════════

/**
 * LÓGICA PRINCIPAL DE DETECCIÓN
 * 
 * Flujo:
 * 1. Usuario envía su ubicación GPS
 * 2. Buscamos si hay un cluster cercano (bus ya detectado)
 * 3. Si sí → Usuario se une al cluster
 * 4. Si no → Buscamos otros usuarios cercanos
 * 5. Si hay 3+ usuarios → Creamos nuevo cluster (nuevo bus)
 * 6. Si no hay suficientes → Usuario está solo (no en bus)
 */
static async processUserLocation(
  identidad,
  latitude,
  longitude,
  speed = 0,
  accuracy = 10,
  heading = 0,
  esta_en_bus = false,
  confirmado_usuario = false,
  id_ruta = null,
  es_registrado = false,
  id_bus = null
) {
  const client = await pool.connect();
  try {
    // Usar READ COMMITTED para evitar conflictos de serialización con concurrent updates
    // Es suficiente para prevenir dirty reads y proporciona mejor rendimiento
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');

    const MIN_USERS_FOR_BUS = parseInt(process.env.MIN_USERS_FOR_BUS) || 1;
    const PROXIMITY_THRESHOLD = parseInt(process.env.PROXIMITY_THRESHOLD) || 50;
    const MAX_ROUTE_OFFSET = parseInt(process.env.ROUTE_OFFSET_METERS) || 80;
    const MAX_HEADING_DELTA = parseInt(process.env.ROUTE_HEADING_DELTA) || 120;

    let routeCheck = null;
    let rutaFinal = id_ruta; // Ruta a usar (puede ser corregida)
    
    if (id_ruta) {
      try {
        routeCheck = await this.assertPointOnRouteWithClient(
          client,
          id_ruta,
          latitude,
          longitude,
          heading,
          MAX_ROUTE_OFFSET,
          MAX_HEADING_DELTA
        );
        
        // Si se encontró una mejor ruta, significa que el usuario se desvió
        // DETENER el cluster actual para mantener fiabilidad de datos
        if (routeCheck && routeCheck.ruta_corregida) {
          console.warn(`🚨 [DESVÍO] Usuario se desvió de ruta ${id_ruta} → ${routeCheck.id_ruta}. Deteniendo cluster actual.`);
          
          // Buscar si el usuario tiene un cluster activo en la ruta original
          let existingCluster = null;
          if (es_registrado) {
            const clusterCheck = await client.query(`
              SELECT c.id_cluster, c.id_ruta
              FROM clusters c
              JOIN ubicacion u ON c.id_cluster = u.id_cluster
              WHERE u.id_usuario = $1
                AND u.esta_en_bus = TRUE
                AND c.esta_activo = TRUE
                AND c.id_ruta = $2
                AND u.tiempo > NOW() - INTERVAL '5 minutes'
              LIMIT 1
            `, [parseInt(identidad), id_ruta]);
            existingCluster = clusterCheck.rows[0];
          } else {
            const clusterCheck = await client.query(`
              SELECT c.id_cluster, c.id_ruta
              FROM clusters c
              JOIN ubicacion u ON c.id_cluster = u.id_cluster
              WHERE u.usuario_anonimo_id = $1
                AND u.esta_en_bus = TRUE
                AND c.esta_activo = TRUE
                AND c.id_ruta = $2
                AND u.tiempo > NOW() - INTERVAL '5 minutes'
              LIMIT 1
            `, [identidad, id_ruta]);
            existingCluster = clusterCheck.rows[0];
          }
          
          if (existingCluster) {
            console.log(`🛑 [DESVÍO] Desvinculando usuario del cluster ${existingCluster.id_cluster} (ruta ${id_ruta})`);
            
            // Desvincular usuario del cluster
            if (es_registrado) {
              await client.query(`
                UPDATE ubicacion 
                SET esta_en_bus = FALSE, id_cluster = NULL
                WHERE id_usuario = $1 AND id_cluster = $2
              `, [parseInt(identidad), existingCluster.id_cluster]);
            } else {
              await client.query(`
                UPDATE ubicacion 
                SET esta_en_bus = FALSE, id_cluster = NULL
                WHERE usuario_anonimo_id = $1 AND id_cluster = $2
              `, [identidad, existingCluster.id_cluster]);
            }
            
            // Verificar si quedan usuarios en el cluster
            const remainingUsers = await client.query(`
              SELECT COUNT(*) as count
              FROM ubicacion
              WHERE id_cluster = $1 AND esta_en_bus = TRUE
            `, [existingCluster.id_cluster]);
            
            if (parseInt(remainingUsers.rows[0].count) === 0) {
              // Actualizar cantidad a 0 pero mantener activo
              await client.query(`
                UPDATE clusters
                SET cantidad_usuarios = 0,
                    usuarios_activos_count = 0,
                    velocidad_promedio = 0,
                    ultima_actualizacion = NOW()
                WHERE id_cluster = $1
              `, [existingCluster.id_cluster]);
              console.log(`🗑️ [DESVÍO] Cluster ${existingCluster.id_cluster} actualizado (cantidad_usuarios = 0, aún visible por 2 min)`);
            }
          }
          
          // Registrar ubicación pero marcar como NO en bus (desvío detectado)
          const colsDesvio = es_registrado 
            ? '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)'
            : '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)';
          const valsDesvio = es_registrado 
            ? [parseInt(identidad), null, true, latitude, longitude, speed, accuracy, heading, false, null]
            : [null, identidad, false, latitude, longitude, speed, accuracy, heading, false, null];
          
          await client.query(
            `INSERT INTO ubicacion ${colsDesvio}
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            valsDesvio
          );
          
          await client.query('COMMIT');
          return { 
            enBus: false, 
            accion: 'DESVIO_DETECTADO', 
            ruta_original: id_ruta,
            ruta_detectada: routeCheck.id_ruta,
            motivo: `Usuario se desvió de la ruta ${id_ruta}. Cluster detenido para mantener fiabilidad de datos.`,
            cluster_desactivado: existingCluster?.id_cluster || null
          };
        }
      } catch (routeErr) {
        await client.query('ROLLBACK');
        return { enBus: false, accion: 'FUERA_DE_RUTA', motivo: routeErr.message };
      }
    }

    console.log(`📍 [CLUSTER] Procesando usuario: ${es_registrado ? 'ID=' + identidad : identidad}, ruta=${rutaFinal}${rutaFinal !== id_ruta ? ` (corregida desde ${id_ruta})` : ''}, pos=(${latitude}, ${longitude})`);

    // ════════════════════════════════════════════════════════════════
    // PASO 1: ¿Hay un cluster cercano?
    // ════════════════════════════════════════════════════════════════

    let nearbyCluster = await this.findNearbyClusterWithClient(
      client,
      latitude,
      longitude,
      PROXIMITY_THRESHOLD,
      rutaFinal
    );
    
    if (nearbyCluster) {
      console.log(`✅ [CLUSTER] Cluster cercano encontrado: ID=${nearbyCluster.id_cluster}, ruta=${nearbyCluster.id_ruta}, usuarios=${nearbyCluster.cantidad_usuarios}, distancia=${Math.round(nearbyCluster.distancia_metros)}m`);
    } else {
      console.log(`❌ [CLUSTER] No hay clusters cercanos en radio ${PROXIMITY_THRESHOLD}m para ruta ${rutaFinal}`);
    }

    if (nearbyCluster) {
      // 🛡️ VALIDACIÓN ESTRICTA: Patente OBLIGATORIA para clusters
      
      // Validación 1: Usuario DEBE enviar patente
      if (!id_bus) {
        await client.query('ROLLBACK');
        console.warn(`⚠️ [PATENTE] Usuario intenta unirse sin patente a cluster ${nearbyCluster.id_cluster}`);
        return {
          enBus: false,
          accion: 'PATENTE_REQUERIDA',
          clusterId: nearbyCluster.id_cluster,
          motivo: 'Debes proporcionar la patente del bus para unirte a un cluster.'
        };
      }

      // Validación 2: Cluster DEBE tener patente (integridad de datos)
      if (!nearbyCluster.id_bus) {
        await client.query('ROLLBACK');
        console.error(`❌ [PATENTE] Cluster ${nearbyCluster.id_cluster} existe sin patente (datos inconsistentes)`);
        return {
          enBus: false,
          accion: 'CLUSTER_SIN_PATENTE',
          clusterId: nearbyCluster.id_cluster,
          motivo: 'Error: cluster sin patente detectado. Contacta al administrador.'
        };
      }

      // Validación 3: Las patentes DEBEN coincidir
      if (id_bus !== nearbyCluster.id_bus) {
        await client.query('ROLLBACK');
        console.warn(`⚠️ [PATENTE] Usuario intenta unirse con bus ${id_bus} pero cluster ${nearbyCluster.id_cluster} pertenece a bus ${nearbyCluster.id_bus}`);
        return {
          enBus: false,
          accion: 'PATENTE_NO_COINCIDE',
          clusterId: nearbyCluster.id_cluster,
          patente_cluster: nearbyCluster.id_bus,
          patente_enviada: id_bus,
          motivo: 'No puedes unirte a un cluster de un bus diferente. Verifica la patente del bus.'
        };
      }

      console.log(`✅ [PATENTE] Validación exitosa: usuario y cluster pertenecen al bus ${id_bus}`);

      // ✅ Usuario se une a cluster existente (es el bus que ya estaba)
      const cols = es_registrado 
        ? '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)'
        : '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)';
      const vals = es_registrado 
        ? [parseInt(identidad), null, true, latitude, longitude, speed, accuracy, heading, true, nearbyCluster.id_cluster]
        : [null, identidad, false, latitude, longitude, speed, accuracy, heading, true, nearbyCluster.id_cluster];

      await client.query(
        `INSERT INTO ubicacion ${cols}
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`
        , vals
      );

      // Actualizar centro del cluster con la última ubicación de cada usuario
      const allUsers = await this.getClusterMembersWithClient(client, nearbyCluster.id_cluster);

      if (allUsers.length === 0) {
        // Si no hay usuarios (por tiempo), usar la ubicación actual
        allUsers.push({ latitud: latitude, longitud: longitude, velocidad: speed });
      }

      const newCenter = this.calculateClusterCenter(allUsers);
      const newVelocity = this.calculateAverageVelocity(allUsers.map(u => u.velocidad));

      if (rutaFinal) {
        try {
          routeCheck = await this.assertPointOnRouteWithClient(
            client,
            rutaFinal,
            newCenter.latitude,
            newCenter.longitude,
            heading,
            MAX_ROUTE_OFFSET,
            MAX_HEADING_DELTA
          );
          // Si el centro del cluster se desvió de la ruta, desactivar cluster
          if (routeCheck && routeCheck.ruta_corregida) {
            console.warn(`🚨 [DESVÍO] Cluster ${nearbyCluster.id_cluster} se desvió de ruta ${rutaFinal}. Desactivando cluster.`);
            
            // Marcar cluster como inactivo
            await client.query(`
              UPDATE clusters
              SET esta_activo = FALSE,
                  ultima_actualizacion = NOW()
              WHERE id_cluster = $1
            `, [nearbyCluster.id_cluster]);
            
            // Desvincular todos los usuarios
            await client.query(`
              UPDATE ubicacion
              SET esta_en_bus = FALSE,
                  id_cluster = NULL
              WHERE id_cluster = $1
            `, [nearbyCluster.id_cluster]);
            
            await client.query('COMMIT');
            return { 
              enBus: false, 
              accion: 'CLUSTER_DESVIADO', 
              cluster_id: nearbyCluster.id_cluster,
              motivo: 'Cluster desactivado por desvío de ruta'
            };
          }
        } catch (routeErr) {
          await client.query('ROLLBACK');
          return { enBus: false, accion: 'FUERA_DE_RUTA', motivo: routeErr.message };
        }
      }
      
      console.log(`🔄 Actualizando cluster ${nearbyCluster.id_cluster}: centro=(${newCenter.latitude}, ${newCenter.longitude}), usuarios=${allUsers.length}, velocidad=${newVelocity}`);

      // Actualizar con el conteo REAL de usuarios activos (no incrementar)
      await client.query(
        `UPDATE clusters
         SET latitud_centro = $1,
             longitud_centro = $2,
             cantidad_usuarios = $3,
             velocidad_promedio = $4,
             ultima_actualizacion = NOW()
         WHERE id_cluster = $5`,
        [newCenter.latitude, newCenter.longitude, allUsers.length, newVelocity, nearbyCluster.id_cluster]
      );

      const nearestStop = await this.findNearestStopWithClient(client, newCenter.latitude, newCenter.longitude);
      if (nearestStop) {
        await client.query('UPDATE clusters SET id_paradero_cercano = $1 WHERE id_cluster = $2', [nearestStop.id_paradero, nearbyCluster.id_cluster]);
      }

      await client.query('COMMIT');
      return { enBus: true, clusterId: nearbyCluster.id_cluster, cantidadUsuarios: allUsers.length, accion: 'UNIDO_A_CLUSTER', paraderosCercano: nearestStop, ruta: routeCheck, id_ruta: rutaFinal };
    }

    // ════════════════════════════════════════════════════════════════
    // PASO 1.5: ¿El usuario YA tiene un cluster activo propio?
    // (Para desarrollo con MIN_USERS_FOR_BUS=1)
    // ════════════════════════════════════════════════════════════════

    let existingUserCluster = null;
    if (es_registrado) {
      const clusterCheck = await client.query(`
        SELECT DISTINCT ON (c.id_cluster) 
               c.id_cluster, c.latitud_centro, c.longitud_centro, c.cantidad_usuarios,
               ST_Distance(
                 c.geom,
                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
               )::numeric as distancia_metros,
               u.tiempo
        FROM clusters c
        JOIN ubicacion u ON c.id_cluster = u.id_cluster
        WHERE u.id_usuario = $1
          AND u.esta_en_bus = TRUE
          AND c.esta_activo = TRUE
          AND c.id_ruta = $4
          AND u.tiempo > NOW() - INTERVAL '5 minutes'
        ORDER BY c.id_cluster, u.tiempo DESC
        LIMIT 1
      `, [parseInt(identidad), longitude, latitude, rutaFinal]);
      existingUserCluster = clusterCheck.rows[0];
    } else {
      const clusterCheck = await client.query(`
        SELECT DISTINCT ON (c.id_cluster) 
               c.id_cluster, c.latitud_centro, c.longitud_centro, c.cantidad_usuarios,
               ST_Distance(
                 c.geom,
                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
               )::numeric as distancia_metros,
               u.tiempo
        FROM clusters c
        JOIN ubicacion u ON c.id_cluster = u.id_cluster
        WHERE u.usuario_anonimo_id = $1
          AND u.esta_en_bus = TRUE
          AND c.esta_activo = TRUE
          AND c.id_ruta = $4
          AND u.tiempo > NOW() - INTERVAL '5 minutes'
        ORDER BY c.id_cluster, u.tiempo DESC
        LIMIT 1
      `, [identidad, longitude, latitude, rutaFinal]);
      existingUserCluster = clusterCheck.rows[0];
    }

    if (existingUserCluster) {
      console.log(`♻️ [CLUSTER] Usuario YA tiene cluster activo: ID=${existingUserCluster.id_cluster}, distancia=${Math.round(existingUserCluster.distancia_metros)}m`);
      
      // Si el cluster está muy lejos (>500m), el usuario se movió mucho - desvincularlo
      if (existingUserCluster.distancia_metros > 500) {
        console.log(`⚠️ [CLUSTER] Usuario se alejó del cluster ${existingUserCluster.id_cluster} (${Math.round(existingUserCluster.distancia_metros)}m) - desvincular`);
        
        // Remover del cluster antiguo
        if (es_registrado) {
          await client.query(`
            UPDATE ubicacion SET esta_en_bus = FALSE, id_cluster = NULL
            WHERE id_usuario = $1 AND id_cluster = $2
          `, [parseInt(identidad), existingUserCluster.id_cluster]);
        } else {
          await client.query(`
            UPDATE ubicacion SET esta_en_bus = FALSE, id_cluster = NULL
            WHERE usuario_anonimo_id = $1 AND id_cluster = $2
          `, [identidad, existingUserCluster.id_cluster]);
        }
        
        // Marcar cluster como inactivo si queda vacío
        const remaining = await client.query(`
          SELECT COUNT(*) as count FROM ubicacion
          WHERE id_cluster = $1 AND esta_en_bus = TRUE
        `, [existingUserCluster.id_cluster]);
        
        if (parseInt(remaining.rows[0].count) === 0) {
          await client.query(`
            UPDATE clusters 
            SET cantidad_usuarios = 0,
                usuarios_activos_count = 0,
                velocidad_promedio = 0,
                ultima_actualizacion = NOW()
            WHERE id_cluster = $1
          `, [existingUserCluster.id_cluster]);
          console.log(`🗑️ [CLUSTER] Cluster ${existingUserCluster.id_cluster} actualizado (cantidad_usuarios = 0, aún visible por 2 min)`);
        }
        
        // Continuar con el flujo normal (crear nuevo cluster o unirse a otro)
        existingUserCluster = null;
      } else {
        // Usuario sigue cerca de su cluster - reutilizarlo
        nearbyCluster = existingUserCluster;
        
        // Insertar nueva ubicación
        const cols = es_registrado 
          ? '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)'
          : '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)';
        const vals = es_registrado 
          ? [parseInt(identidad), null, true, latitude, longitude, speed, accuracy, heading, true, existingUserCluster.id_cluster]
          : [null, identidad, false, latitude, longitude, speed, accuracy, heading, true, existingUserCluster.id_cluster];

        await client.query(`INSERT INTO ubicacion ${cols} VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`, vals);

        // ✅ CORRECCIÓN: Recalcular centro con TODOS los usuarios
        const allUsers = await this.getClusterMembersWithClient(client, existingUserCluster.id_cluster);
        if (allUsers.length === 0) {
          allUsers.push({ latitud: latitude, longitud: longitude, velocidad: speed });
        }
        const newCenter = this.calculateClusterCenter(allUsers);
        const newVelocity = this.calculateAverageVelocity(allUsers.map(u => u.velocidad));

        // ✅ CORRECCIÓN: Validar ruta después de actualizar
        if (rutaFinal) {
          try {
            routeCheck = await this.assertPointOnRouteWithClient(
              client,
              rutaFinal,
              newCenter.latitude,
              newCenter.longitude,
              heading,
              MAX_ROUTE_OFFSET,
              MAX_HEADING_DELTA
            );
            if (routeCheck && routeCheck.ruta_corregida) {
              console.warn(`🚨 [DESVÍO] Cluster ${existingUserCluster.id_cluster} se desvió de ruta ${rutaFinal}. Desactivando cluster.`);
              await client.query(`
                UPDATE clusters 
                SET esta_activo = FALSE, 
                    cantidad_usuarios = 0,
                    usuarios_activos_count = 0,
                    velocidad_promedio = 0,
                    ultima_actualizacion = NOW() 
                WHERE id_cluster = $1
              `, [existingUserCluster.id_cluster]);
              await client.query(`UPDATE ubicacion SET esta_en_bus = FALSE, id_cluster = NULL WHERE id_cluster = $1`, [existingUserCluster.id_cluster]);
              await client.query('COMMIT');
              return { enBus: false, accion: 'CLUSTER_DESVIADO', cluster_id: existingUserCluster.id_cluster, motivo: 'Cluster desactivado por desvío de ruta' };
            }
          } catch (routeErr) {
            await client.query('ROLLBACK');
            return { enBus: false, accion: 'FUERA_DE_RUTA', motivo: routeErr.message };
          }
        }

        // Actualizar cluster
        await client.query(`
          UPDATE clusters
          SET latitud_centro = $1,
              longitud_centro = $2,
              cantidad_usuarios = $3,
              velocidad_promedio = $4,
              ultima_actualizacion = NOW()
          WHERE id_cluster = $5
        `, [newCenter.latitude, newCenter.longitude, allUsers.length, newVelocity, existingUserCluster.id_cluster]);

        // ✅ CORRECCIÓN: Buscar paradero cercano
        const nearestStop = await this.findNearestStopWithClient(client, newCenter.latitude, newCenter.longitude);
        if (nearestStop) {
          await client.query('UPDATE clusters SET id_paradero_cercano = $1 WHERE id_cluster = $2', [nearestStop.id_paradero, existingUserCluster.id_cluster]);
        }

        console.log(`🔄 [CLUSTER] Cluster ${existingUserCluster.id_cluster} actualizado: centro=(${newCenter.latitude}, ${newCenter.longitude}), usuarios=${allUsers.length}, velocidad=${newVelocity}`);

        await client.query('COMMIT');
        return { enBus: true, clusterId: existingUserCluster.id_cluster, cantidadUsuarios: allUsers.length, accion: 'ACTUALIZADO', paraderosCercano: nearestStop, ruta: routeCheck, id_ruta: rutaFinal };
      }
    }

    // ════════════════════════════════════════════════════════════════
    // PASO 2: ¿Hay otros usuarios cercanos?
    // ════════════════════════════════════════════════════════════════

    const identityStr = es_registrado ? String(parseInt(identidad)) : String(identidad);
    const nearbyUsers = await this.findNearbyUsersWithClient(
      client,
      identityStr,
      latitude,
      longitude,
      PROXIMITY_THRESHOLD
    );

    if (nearbyUsers.length >= MIN_USERS_FOR_BUS - 1) {
      // ════════════════════════════════════════════════════════════════
      // DOBLE VERIFICACIÓN: Buscar clusters en radio más amplio (100m)
      // para evitar crear clusters duplicados muy cercanos
      // ════════════════════════════════════════════════════════════════
      const widerCluster = await this.findNearbyClusterWithClient(
        client,
        latitude,
        longitude,
        100, // Radio ampliado a 100m
        rutaFinal
      );
      
      if (widerCluster) {
        console.log(`⚠️ [CLUSTER] Cluster ${widerCluster.id_cluster} encontrado a ${Math.round(widerCluster.distancia_metros)}m (radio ampliado). Verificando patente...`);
        
        // 🛡️ VALIDACIÓN DE PATENTE PARA WIDER CLUSTER
        if (!id_bus) {
          await client.query('ROLLBACK');
          console.warn(`⚠️ [PATENTE] Usuario intenta unirse a widerCluster ${widerCluster.id_cluster} sin patente`);
          return {
            enBus: false,
            accion: 'PATENTE_REQUERIDA',
            clusterId: widerCluster.id_cluster,
            motivo: 'Debes proporcionar la patente del bus para unirte a un cluster.'
          };
        }

        if (!widerCluster.id_bus) {
          await client.query('ROLLBACK');
          console.error(`❌ [PATENTE] WiderCluster ${widerCluster.id_cluster} sin patente (datos inconsistentes)`);
          return {
            enBus: false,
            accion: 'CLUSTER_SIN_PATENTE',
            clusterId: widerCluster.id_cluster,
            motivo: 'Error: cluster sin patente detectado. Contacta al administrador.'
          };
        }

        if (id_bus !== widerCluster.id_bus) {
          // No es el mismo bus, NO unirse a este cluster, continuar para crear nuevo
          console.warn(`⚠️ [PATENTE] WiderCluster ${widerCluster.id_cluster} pertenece a bus ${widerCluster.id_bus}, usuario envía ${id_bus}. Continuando para crear nuevo cluster.`);
          // NO retornar error, dejar que continúe el flujo para crear un cluster nuevo
        } else {
          // Patente coincide, unirse al cluster
          console.log(`✅ [PATENTE] Validación exitosa para widerCluster: usuario y cluster pertenecen al bus ${id_bus}`);
        
          const cols = es_registrado 
            ? '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)'
            : '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)';
          const vals = es_registrado 
            ? [parseInt(identidad), null, true, latitude, longitude, speed, accuracy, heading, true, widerCluster.id_cluster]
            : [null, identidad, false, latitude, longitude, speed, accuracy, heading, true, widerCluster.id_cluster];

          await client.query(`INSERT INTO ubicacion ${cols} VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`, vals);

          const allUsers = await this.getClusterMembersWithClient(client, widerCluster.id_cluster);
          if (allUsers.length === 0) {
            allUsers.push({ latitud: latitude, longitud: longitude, velocidad: speed });
          }
          const newCenter = this.calculateClusterCenter(allUsers);
          const newVelocity = this.calculateAverageVelocity(allUsers.map(u => u.velocidad));

          // ✅ CORRECCIÓN: Validar ruta después de actualizar
          if (rutaFinal) {
            try {
              routeCheck = await this.assertPointOnRouteWithClient(
                client,
                rutaFinal,
                newCenter.latitude,
                newCenter.longitude,
                heading,
                MAX_ROUTE_OFFSET,
                MAX_HEADING_DELTA
              );
              if (routeCheck && routeCheck.ruta_corregida) {
                console.warn(`🚨 [DESVÍO] Cluster ${widerCluster.id_cluster} se desvió de ruta ${rutaFinal}. Desactivando cluster.`);
                await client.query(`
                  UPDATE clusters 
                  SET esta_activo = FALSE, 
                      cantidad_usuarios = 0,
                      usuarios_activos_count = 0,
                      velocidad_promedio = 0,
                      ultima_actualizacion = NOW() 
                  WHERE id_cluster = $1
                `, [widerCluster.id_cluster]);
                await client.query(`UPDATE ubicacion SET esta_en_bus = FALSE, id_cluster = NULL WHERE id_cluster = $1`, [widerCluster.id_cluster]);
                await client.query('COMMIT');
                return { enBus: false, accion: 'CLUSTER_DESVIADO', cluster_id: widerCluster.id_cluster, motivo: 'Cluster desactivado por desvío de ruta' };
              }
            } catch (routeErr) {
              await client.query('ROLLBACK');
              return { enBus: false, accion: 'FUERA_DE_RUTA', motivo: routeErr.message };
            }
          }

          await client.query(`UPDATE clusters SET latitud_centro = $1, longitud_centro = $2, cantidad_usuarios = $3, velocidad_promedio = $4, ultima_actualizacion = NOW() WHERE id_cluster = $5`, [newCenter.latitude, newCenter.longitude, allUsers.length, newVelocity, widerCluster.id_cluster]);

          // ✅ CORRECCIÓN: Buscar paradero cercano
          const nearestStop = await this.findNearestStopWithClient(client, newCenter.latitude, newCenter.longitude);
          if (nearestStop) {
            await client.query('UPDATE clusters SET id_paradero_cercano = $1 WHERE id_cluster = $2', [nearestStop.id_paradero, widerCluster.id_cluster]);
          }

          // ✅ CORRECCIÓN: Verificar duplicados y consolidar (mismo bus y ruta)
          const duplicateCheck = await client.query(`
            SELECT id_cluster, fecha_creacion
            FROM clusters
            WHERE id_ruta = $3
              AND id_bus = $5
              AND esta_activo = TRUE
              AND id_cluster != $4
              AND fecha_creacion > NOW() - INTERVAL '10 seconds'
              AND ST_DWithin(
                geom,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                100
              )
            ORDER BY fecha_creacion ASC
            LIMIT 1
          `, [longitude, latitude, rutaFinal, widerCluster.id_cluster, widerCluster.id_bus || id_bus]);

          if (duplicateCheck.rows.length > 0) {
            const olderCluster = duplicateCheck.rows[0];
            console.warn(`⚠️ [CLUSTER] Detectado cluster duplicado ${olderCluster.id_cluster}. Consolidando...`);
            await client.query(`UPDATE ubicacion SET id_cluster = $1 WHERE id_cluster = $2`, [olderCluster.id_cluster, widerCluster.id_cluster]);
            await client.query(`
              UPDATE clusters 
              SET cantidad_usuarios = 0,
                  usuarios_activos_count = 0,
                  velocidad_promedio = 0,
                  ultima_actualizacion = NOW()
              WHERE id_cluster = $1
            `, [widerCluster.id_cluster]);
            await client.query('COMMIT');
            return { enBus: true, clusterId: olderCluster.id_cluster, cantidadUsuarios: allUsers.length, accion: 'CLUSTER_CONSOLIDADO', consolidado_desde: widerCluster.id_cluster, paraderosCercano: nearestStop, ruta: routeCheck, id_ruta: rutaFinal };
          }

          await client.query('COMMIT');
          return { enBus: true, clusterId: widerCluster.id_cluster, cantidadUsuarios: allUsers.length, accion: 'UNIDO_A_CLUSTER_AMPLIADO', paraderosCercano: nearestStop, ruta: routeCheck, id_ruta: rutaFinal };
        }
        // Si patente no coincide, sale del if(widerCluster) y continúa para crear nuevo cluster
      }
      
      // ✅ Crear nuevo cluster (solo si no se encontró ninguno en 100m)
      
      // 🛡️ VALIDACIÓN ESTRICTA: Patente OBLIGATORIA para crear cluster
      if (!id_bus) {
        await client.query('ROLLBACK');
        console.warn(`⚠️ [PATENTE] Intento de crear cluster sin patente rechazado`);
        return {
          enBus: false,
          accion: 'PATENTE_REQUERIDA_CREAR',
          motivo: 'No se puede crear un cluster sin especificar la patente del bus.'
        };
      }

      // 🛡️ VALIDACIÓN PRIMERA: Verificar que no exista cluster activo con este bus
      // IMPORTANTE: Esta validación DEBE ir ANTES de cualquier otra operación
      // NOTA: NO filtramos por ruta porque un bus físico solo puede estar en UNA ruta a la vez
      const existingClusterForBus = await client.query(`
        SELECT id_cluster, cantidad_usuarios, latitud_centro, longitud_centro, id_ruta,
               ST_Distance(
                 geom,
                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
               )::numeric as distancia_metros
        FROM clusters 
        WHERE id_bus = $1 AND esta_activo = TRUE
        LIMIT 1
      `, [id_bus, longitude, latitude]);

      if (existingClusterForBus.rows.length > 0) {
        const existingCluster = existingClusterForBus.rows[0];
        const enOtraRuta = existingCluster.id_ruta !== rutaFinal;
        
        console.warn(`⚠️ [CLUSTER] Ya existe cluster activo ${existingCluster.id_cluster} para bus ${id_bus} en ruta ${existingCluster.id_ruta} a ${Math.round(existingCluster.distancia_metros)}m`);
        
        await client.query('ROLLBACK');
        return {
          enBus: false,
          accion: 'BUS_YA_TIENE_CLUSTER',
          clusterId: existingCluster.id_cluster,
          distancia_metros: Math.round(existingCluster.distancia_metros),
          ruta_cluster_existente: existingCluster.id_ruta,
          ruta_solicitada: rutaFinal,
          en_otra_ruta: enOtraRuta,
          motivo: enOtraRuta 
            ? `El bus ${id_bus} ya tiene un cluster activo en la RUTA ${existingCluster.id_ruta} (ID: ${existingCluster.id_cluster}). Un bus solo puede estar en una ruta a la vez.`
            : `El bus ${id_bus} ya tiene un cluster activo (ID: ${existingCluster.id_cluster}). Debes unirte a ese cluster en lugar de crear uno nuevo.`
        };
      }
      
      console.log(`🚌 [CLUSTER] Creando NUEVO cluster: ${nearbyUsers.length + 1} usuarios cercanos, ruta=${rutaFinal}, bus=${id_bus}`);
      const allPoints = [ { latitud: latitude, longitud: longitude, velocidad: speed }, ...nearbyUsers ];
      const center = this.calculateClusterCenter(allPoints);
      
      // CORREGIR: usar velocidad del único usuario en desarrollo, no promedio vacío
      let avgVelocity = this.calculateAverageVelocity(allPoints.map(p => p.velocidad));
      if (allPoints.length === 1 && speed > 0) {
        avgVelocity = speed; // usar velocidad del único usuario
        console.log(`🚌 [CLUSTER DEBUG] Cluster con 1 usuario: usando velocidad=${avgVelocity} km/h (no promedio)`);
      } else {
        console.log(`🚌 [CLUSTER DEBUG] Cluster con ${allPoints.length} usuarios: velocidad_promedio=${avgVelocity} km/h`);
      }

      if (rutaFinal) {
        try {
          routeCheck = await this.assertPointOnRouteWithClient(
            client,
            rutaFinal,
            center.latitude,
            center.longitude,
            heading,
            MAX_ROUTE_OFFSET,
            MAX_HEADING_DELTA
          );
          // Si se detecta desvío al crear cluster, no crear y retornar error
          if (routeCheck && routeCheck.ruta_corregida) {
            console.warn(`🚨 [DESVÍO] Intento de crear cluster con desvío de ruta ${rutaFinal} → ${routeCheck.id_ruta}. Cancelando creación.`);
            await client.query('ROLLBACK');
            return { 
              enBus: false, 
              accion: 'DESVIO_AL_CREAR_CLUSTER', 
              ruta_original: rutaFinal,
              ruta_detectada: routeCheck.id_ruta,
              motivo: 'No se puede crear cluster con desvío de ruta detectado'
            };
          }
        } catch (routeErr) {
          await client.query('ROLLBACK');
          return { enBus: false, accion: 'FUERA_DE_RUTA', motivo: routeErr.message };
        }
      }

      const clusterResult = await client.query(
        `INSERT INTO clusters
         (latitud_centro, longitud_centro, cantidad_usuarios, velocidad_promedio, esta_activo, id_ruta, id_bus, fecha_creacion, ultima_actualizacion)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6, NOW(), NOW())
         RETURNING id_cluster`,
        [center.latitude, center.longitude, allPoints.length, avgVelocity, rutaFinal, id_bus]
      );
      const newClusterId = clusterResult.rows[0].id_cluster;

      // Insertar usuario actual en ubicacion
      const colsCreate = es_registrado 
        ? '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)'
        : '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)';
      const valsCreate = es_registrado 
        ? [parseInt(identidad), null, true, latitude, longitude, speed, accuracy, heading, true, newClusterId]
        : [null, identidad, false, latitude, longitude, speed, accuracy, heading, true, newClusterId];
      await client.query(`INSERT INTO ubicacion ${colsCreate} VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`, valsCreate);

      // Marcar usuarios cercanos como "en bus" (registrados y anónimos)
      for (const user of nearbyUsers) {
        if (user.id_usuario) {
          await client.query(
            `INSERT INTO ubicacion (id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, esta_en_bus, id_cluster, tiempo)
             VALUES ($1, NULL, TRUE, $2, $3, $4, TRUE, $5, NOW())`,
            [user.id_usuario, user.latitud, user.longitud, user.velocidad, newClusterId]
          );
        } else if (user.usuario_anonimo_id) {
          await client.query(
            `INSERT INTO ubicacion (id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, esta_en_bus, id_cluster, tiempo)
             VALUES (NULL, $1, FALSE, $2, $3, $4, TRUE, $5, NOW())`,
            [user.usuario_anonimo_id, user.latitud, user.longitud, user.velocidad, newClusterId]
          );
        }
      }

      const nearestStop = await this.findNearestStopWithClient(client, center.latitude, center.longitude);
      if (nearestStop) {
        await client.query('UPDATE clusters SET id_paradero_cercano = $1 WHERE id_cluster = $2', [nearestStop.id_paradero, newClusterId]);
      }

      // ════════════════════════════════════════════════════════════════
      // VERIFICACIÓN POST-CREACIÓN: Buscar clusters duplicados creados
      // simultáneamente y consolidar al más antiguo (mismo bus y ruta)
      // ════════════════════════════════════════════════════════════════
      const duplicateCheck = await client.query(`
        SELECT id_cluster, fecha_creacion, id_bus,
          ST_Distance(
            geom,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          )::numeric as distancia_metros
        FROM clusters
        WHERE id_ruta = $3
          AND id_bus = $5
          AND esta_activo = TRUE
          AND id_cluster != $4
          AND fecha_creacion > NOW() - INTERVAL '10 seconds'
          AND ST_DWithin(
            geom,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            100
          )
        ORDER BY fecha_creacion ASC
        LIMIT 1
      `, [longitude, latitude, rutaFinal, newClusterId, id_bus]);

      if (duplicateCheck.rows.length > 0) {
        const olderCluster = duplicateCheck.rows[0];
        console.warn(`⚠️ [CLUSTER] Detectado cluster duplicado ${olderCluster.id_cluster} creado ${Math.round(duplicateCheck.rows[0].distancia_metros)}m cerca. Consolidando...`);
        
        // Reasignar todas las ubicaciones al cluster más antiguo
        await client.query(`
          UPDATE ubicacion
          SET id_cluster = $1
          WHERE id_cluster = $2
        `, [olderCluster.id_cluster, newClusterId]);

        // Marcar el nuevo cluster como inactivo
        await client.query(`
          UPDATE clusters
          SET esta_activo = FALSE
          WHERE id_cluster = $1
        `, [newClusterId]);

        await client.query('COMMIT');
        console.log(`✅ [CLUSTER] Consolidado a cluster ${olderCluster.id_cluster} (descartando ${newClusterId})`);
        return { enBus: true, clusterId: olderCluster.id_cluster, cantidadUsuarios: allPoints.length, accion: 'CLUSTER_CONSOLIDADO', consolidado_desde: newClusterId, paraderosCercano: nearestStop, ruta: routeCheck, id_ruta: rutaFinal };
      }

      await client.query('COMMIT');
      return { enBus: true, clusterId: newClusterId, cantidadUsuarios: allPoints.length, accion: 'CLUSTER_CREADO', nuevo: true, paraderosCercano: nearestStop, ruta: routeCheck, id_ruta: rutaFinal };
    }

    // PASO 3: Usuario está SOLO (no en bus)
    const colsSolo = es_registrado 
      ? '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)'
      : '(id_usuario, usuario_anonimo_id, es_registrado, latitud, longitud, velocidad, precision_metros, direccion, esta_en_bus, id_cluster, tiempo)';
    const valsSolo = es_registrado 
      ? [parseInt(identidad), null, true, latitude, longitude, speed, accuracy, heading, false, null]
      : [null, identidad, false, latitude, longitude, speed, accuracy, heading, false, null];

    await client.query(`INSERT INTO ubicacion ${colsSolo} VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`, valsSolo);

    await client.query('COMMIT');
    return { enBus: false, cantidadUsuariosCercanos: nearbyUsers.length, accion: 'USUARIO_SOLO', proximosParaFormarBus: MIN_USERS_FOR_BUS - nearbyUsers.length - 1, ruta: routeCheck, id_ruta: rutaFinal };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en processUserLocation:', error);
    throw error;
  } finally {
    client.release();
  }
}

// MÉTODOS HELPER CON CLIENT (para transacciones)

/**
 * Buscar cluster cercano (usada dentro de transacción)
 */
static async findNearbyClusterWithClient(client, latitude, longitude, radiusMeters, idRuta = null) {
  // Si se especifica ruta, filtrar por ella; sino buscar cualquier cluster
  const rutaFilter = idRuta ? 'AND (id_ruta = $4 OR id_ruta IS NULL)' : '';
  const params = idRuta ? [longitude, latitude, radiusMeters, idRuta] : [longitude, latitude, radiusMeters];
  
  const query = `
    SELECT 
      id_cluster,
      latitud_centro,
      longitud_centro,
      cantidad_usuarios,
      velocidad_promedio,
      id_ruta,
      id_bus,
      ST_Distance(
        geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )::numeric as distancia_metros
    FROM clusters
    WHERE esta_activo = TRUE
      AND cantidad_usuarios > 0
      AND ultima_actualizacion > NOW() - INTERVAL '10 minutes'
      AND ST_DWithin(
        geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ${rutaFilter}
    ORDER BY distancia_metros ASC
    LIMIT 1
  `;

  const result = await client.query(query, params);
  
  if (result.rows[0]) {
    console.log(`🔍 [FINDCLUSTER] Encontrado cluster ${result.rows[0].id_cluster} a ${Math.round(result.rows[0].distancia_metros)}m, ruta=${result.rows[0].id_ruta}, bus=${result.rows[0].id_bus || 'sin patente'}, usuarios=${result.rows[0].cantidad_usuarios}`);
  }
  
  return result.rows[0] || null;
}

/**
 * Buscar usuarios cercanos (usada dentro de transacción)
 * NOTA: Busca SOLO usuarios en estado "no en bus" (esta_en_bus = FALSE)
 * porque si ya estaban en un bus, deberían haber sido capturados por findNearbyClusterWithClient
 */
static async findNearbyUsersWithClient(client, identityStr, latitude, longitude, radiusMeters) {
  const query = `
    SELECT DISTINCT ON (COALESCE(CAST(ul.id_usuario AS TEXT), ul.usuario_anonimo_id))
      ul.id_usuario,
      ul.usuario_anonimo_id,
      ul.latitud,
      ul.longitud,
      ul.velocidad,
      ul.tiempo
    FROM ubicacion ul
    WHERE ul.tiempo > NOW() - INTERVAL '90 seconds'
      AND ul.esta_en_bus = FALSE
      AND COALESCE(CAST(ul.id_usuario AS TEXT), ul.usuario_anonimo_id) != $1
      AND ST_DWithin(
        ul.geom,
        ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
        $4
      )
    ORDER BY COALESCE(CAST(ul.id_usuario AS TEXT), ul.usuario_anonimo_id), ul.tiempo DESC
    LIMIT 10
  `;

  const result = await client.query(query, [identityStr, longitude, latitude, radiusMeters]);
  return result.rows;
}

/**
 * Buscar la mejor ruta que coincida con el punto y dirección del usuario
 * Útil cuando hay múltiples rutas en la misma calle (ida/vuelta)
 */
static async findBestMatchingRouteWithClient(client, latitude, longitude, heading, maxDesvioM = 80, maxHeadingDelta = 120) {
  const result = await client.query(
    `
    WITH data AS (
      SELECT
        r.id_ruta,
        r.sentido_ruta,
        r.geom,
        ST_LineLocatePoint(r.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS pos_rel,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          r.geom::geography
        ) AS dist_m
      FROM ruta r
      WHERE ST_DWithin(
        r.geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    ),
    bearing AS (
      SELECT
        id_ruta,
        sentido_ruta,
        dist_m,
        pos_rel,
        ST_LineInterpolatePoint(geom, GREATEST(0, pos_rel - 1e-4)) AS p1,
        ST_LineInterpolatePoint(geom, LEAST(1, pos_rel + 1e-4)) AS p2
      FROM data
    )
    SELECT
      id_ruta,
      sentido_ruta,
      dist_m,
      pos_rel,
      DEGREES(ST_Azimuth(p1, p2)) AS bearing_ruta
    FROM bearing
    ORDER BY dist_m ASC
    `,
    [longitude, latitude, maxDesvioM]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const normalizedHeading = ((heading % 360) + 360) % 360;
  
  // Evaluar cada ruta y encontrar la mejor coincidencia
  let bestRoute = null;
  let bestScore = Infinity;

  for (const row of result.rows) {
    const distMeters = parseFloat(row.dist_m || 0);
    
    // Calcular bearing de la ruta considerando sentido
    let routeBearing = parseFloat(row.bearing_ruta || 0);

    // Calcular delta de heading (siempre entre 0 y 180)
    let delta = Math.abs(normalizedHeading - routeBearing);
    if (delta > 180) {
      delta = 360 - delta;
    }
    
    // Validar que delta sea válido
    if (!Number.isFinite(delta) || delta < 0 || delta > 180) {
      console.warn(`⚠️ [RUTA] Delta inválido en findBestMatchingRoute: ${delta}, heading=${normalizedHeading}, bearing=${routeBearing}`);
      continue; // Saltar esta ruta
    }

    // Score: combinación de distancia y delta de heading
    // Menor score = mejor coincidencia
    const distanceScore = distMeters; // metros
    const headingScore = delta > maxHeadingDelta ? 1000 : delta; // penalizar si excede maxHeadingDelta
    const score = distanceScore + headingScore;

    if (score < bestScore) {
      bestScore = score;
      bestRoute = {
        id_ruta: row.id_ruta,
        sentido_ruta: row.sentido_ruta,
        dist_m: distMeters,
        pos_rel: parseFloat(row.pos_rel),
        bearing_ruta: routeBearing,
        heading_usuario: normalizedHeading,
        delta_heading: delta,
        score: score
      };
    }
  }

  // Si la mejor ruta tiene delta > maxHeadingDelta, aún así la aceptamos si está muy cerca
  // (para manejar casos donde el GPS tiene error de heading pero el punto está en el corredor)
  if (bestRoute && bestRoute.dist_m <= maxDesvioM) {
    // Si está muy cerca (< 20m), ser más permisivo con el heading
    const headingTolerance = bestRoute.dist_m < 20 ? maxHeadingDelta + 60 : maxHeadingDelta;
    
    if (bestRoute.delta_heading <= headingTolerance) {
      return bestRoute;
    }
  }

  return bestRoute;
}

/**
 * Validar que un punto esté sobre el corredor de la ruta y con rumbo coherente
 * Si la ruta especificada no coincide, intenta buscar la mejor ruta alternativa
 */
static async assertPointOnRouteWithClient(client, idRuta, latitude, longitude, heading, maxDesvioM = 80, maxHeadingDelta = 120) {
  // Primero intentar validar contra la ruta especificada
  const result = await client.query(
    `
    WITH data AS (
      SELECT
        r.sentido_ruta,
        r.geom,
        ST_LineLocatePoint(r.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS pos_rel,
        ST_Distance(
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          r.geom::geography
        ) AS dist_m
      FROM ruta r
      WHERE r.id_ruta = $3
    ),
    bearing AS (
      SELECT
        sentido_ruta,
        dist_m,
        pos_rel,
        ST_LineInterpolatePoint(geom, GREATEST(0, pos_rel - 1e-4)) AS p1,
        ST_LineInterpolatePoint(geom, LEAST(1, pos_rel + 1e-4)) AS p2
      FROM data
    )
    SELECT
      sentido_ruta,
      dist_m,
      pos_rel,
      DEGREES(ST_Azimuth(p1, p2)) AS bearing_ruta
    FROM bearing
    `,
    [longitude, latitude, idRuta]
  );

  const row = result.rows[0];
  const context = {
    id_ruta: idRuta,
    latitude,
    longitude,
    heading,
    db_row: row
  };

  if (!row) {
    console.error('❌ [RUTA] Ruta no encontrada', context);
    throw new Error('Ruta no encontrada');
  }

  const distMeters = row.dist_m === null ? null : parseFloat(row.dist_m);
  if (distMeters === null || distMeters > maxDesvioM) {
    console.error('❌ [RUTA] Punto fuera de corredor de ruta', { ...context, dist_m: distMeters, maxDesvioM });
    throw new Error(`Fuera de corredor de ruta (${distMeters === null ? 'distancia desconocida' : Math.round(distMeters) + 'm'} > ${maxDesvioM}m)`);
  }

  let routeBearing = parseFloat(row.bearing_ruta || 0);
  // No invertir por sentido aquí: el bearing local del segmento ya refleja
  // la dirección geométrica. La validación estricta se hará con inicio/fin.

  const normalizedHeading = ((heading % 360) + 360) % 360;
  const normalizedRouteBearing = ((routeBearing % 360) + 360) % 360;
  
  // Calcular diferencia angular (siempre entre 0 y 180)
  let delta = Math.abs(normalizedHeading - normalizedRouteBearing);
  if (delta > 180) {
    delta = 360 - delta;
  }

  if (!Number.isFinite(delta) || delta < 0 || delta > 180) {
    console.error('❌ [RUTA] Delta heading no es numérico o inválido', { ...context, routeBearing, normalizedRouteBearing, normalizedHeading, delta });
    throw new Error('Dirección inválida');
  }

  // ════════════════════════════════════════════════════════════════
  // VALIDACIÓN MEJORADA: Basada en inicio/fin de la ruta
  // ════════════════════════════════════════════════════════════════
  let directionValidation = null;
  let useStrictValidation = false;
  
  try {
    directionValidation = await this.validateClusterDirectionWithClient(
      client,
      idRuta,
      latitude,
      longitude,
      heading,
      row.sentido_ruta
    );

    // Si la validación mejorada falla, usar como criterio adicional
    // PERO: Si el delta es muy grande (>150°), probablemente el usuario está en la ruta opuesta
    // y deberíamos buscar ruta alternativa en lugar de rechazar
    if (directionValidation && !directionValidation.valid) {
      const deltaVal = directionValidation.delta || 0;
      // Validar que delta sea un número válido
      if (Number.isFinite(deltaVal) && deltaVal >= 0 && deltaVal <= 180) {
        console.warn(`⚠️ [RUTA] Dirección no válida según inicio/fin de ruta: Δ=${Math.round(deltaVal)}° (max=${directionValidation.max_delta}°), pos_rel=${directionValidation.pos_rel.toFixed(3)}, dirección_esperada=${directionValidation.expected_direction}`);
        
        // Solo usar validación estricta si el delta es moderado (90-150°)
        // Si delta > 150°, probablemente está en ruta opuesta - NO usar validación estricta
        // para permitir que findBestMatchingRoute encuentre la ruta correcta
        if (deltaVal > 90 && deltaVal <= 150) {
          useStrictValidation = true;
        } else if (deltaVal > 150) {
          // Delta muy grande: probablemente está en ruta opuesta, buscar alternativa
          console.log(`ℹ️ [RUTA] Delta muy grande (${Math.round(deltaVal)}°), probablemente ruta opuesta. Buscando alternativa...`);
        }
      } else {
        console.error(`❌ [RUTA] Delta inválido en validación: ${deltaVal}`);
      }
    }
  } catch (validationError) {
    // Si falla la validación mejorada, continuar con validación básica
    console.warn(`⚠️ [RUTA] Error en validación mejorada (continuando con validación básica):`, validationError.message);
    directionValidation = null;
  }

  // Si la ruta especificada no coincide bien (validación básica o mejorada), buscar ruta alternativa
  // PERO: Si el delta es muy grande (>150°), probablemente está en ruta opuesta, buscar alternativa
  const shouldSearchAlternative = delta > maxHeadingDelta || useStrictValidation || 
    (directionValidation && !directionValidation.valid && directionValidation.delta > 150);
  
  if (shouldSearchAlternative) {
    const reason = useStrictValidation ? ', validación inicio/fin falló' : 
                   (directionValidation && directionValidation.delta > 150) ? ', delta muy grande (ruta opuesta)' : '';
    console.warn(`⚠️ [RUTA] Ruta ${idRuta} no coincide bien (Δ=${Math.round(delta)}°${reason}). Buscando ruta alternativa...`, context);
    
    const bestRoute = await this.findBestMatchingRouteWithClient(
      client,
      latitude,
      longitude,
      heading,
      maxDesvioM,
      maxHeadingDelta
    );

    if (bestRoute && bestRoute.id_ruta !== idRuta) {
      console.log(`✅ [RUTA] Encontrada mejor ruta: ${bestRoute.id_ruta} (en lugar de ${idRuta}). Delta=${Math.round(bestRoute.delta_heading)}°, dist=${Math.round(bestRoute.dist_m)}m`);
      // Retornar la mejor ruta encontrada (el sistema usará esta ruta en lugar de la especificada)
      return {
        ...bestRoute,
        ruta_corregida: true,
        ruta_original: idRuta
      };
    }
    
    // Si no se encontró mejor ruta, aplicar tolerancia más flexible si está muy cerca
    if (distMeters < 20 && !useStrictValidation) {
      const flexibleTolerance = maxHeadingDelta + 60;
      if (delta <= flexibleTolerance) {
        console.log(`⚠️ [RUTA] Aplicando tolerancia flexible (Δ=${Math.round(delta)}° <= ${flexibleTolerance}°) porque está muy cerca (${Math.round(distMeters)}m)`);
        return {
          sentido_ruta: row.sentido_ruta,
          dist_m: distMeters,
          pos_rel: parseFloat(row.pos_rel),
          bearing_ruta: routeBearing,
          heading_usuario: normalizedHeading,
          delta_heading: delta,
          tolerancia_flexible: true,
          direction_validation: directionValidation
        };
      }
    }

    console.error('❌ [RUTA] Dirección no coincide con sentido de ruta', { ...context, routeBearing, normalizedHeading, delta, maxHeadingDelta, direction_validation: directionValidation });
    throw new Error(`Dirección no coincide con el sentido de la ruta (Δ=${Math.round(delta)}°)${useStrictValidation ? ' - Validación inicio/fin falló' : ''}`);
  }

  // Validación exitosa
  return {
    sentido_ruta: row.sentido_ruta,
    dist_m: distMeters,
    pos_rel: parseFloat(row.pos_rel),
    bearing_ruta: routeBearing,
    heading_usuario: normalizedHeading,
    delta_heading: delta,
    direction_validation: directionValidation
  };
}

/**
 * Obtener miembros del cluster (usada dentro de transacción)
 */
static async getClusterMembersWithClient(client, clusterId) {
  // Obtener la ÚLTIMA ubicación de cada usuario activo en el cluster
  // Ventana de 2 minutos para búsqueda, pero solo usuarios activos en últimos 30 segundos
  // Esto permite polling cada 10 seg del frontend sin usar ubicaciones obsoletas
  const query = `
    WITH latest_per_user AS (
      SELECT DISTINCT ON (COALESCE(id_usuario::text, usuario_anonimo_id))
        latitud,
        longitud,
        velocidad,
        tiempo
      FROM ubicacion
      WHERE id_cluster = $1
        AND esta_en_bus = TRUE
        AND tiempo > NOW() - INTERVAL '2 minutes'
      ORDER BY COALESCE(id_usuario::text, usuario_anonimo_id), tiempo DESC
    )
    SELECT 
      latitud,
      longitud,
      velocidad
    FROM latest_per_user
    WHERE tiempo > NOW() - INTERVAL '30 seconds'
  `;

  const result = await client.query(query, [clusterId]);
  return result.rows;
}

/**
 * Obtener inicio y fin de una ruta basándose en los paraderos ordenados
 */
static async getRouteStartEndWithClient(client, idRuta) {
  // Usar la geometría PostGIS para extraer coordenadas (más confiable)
  const query = `
    SELECT 
      p.id_paradero,
      ST_Y(p.geom::geometry) as latitud,
      ST_X(p.geom::geometry) as longitud,
      rp.orden_ruta,
      p.geom
    FROM ruta_paradero rp
    JOIN paraderos p ON rp.id_paradero = p.id_paradero
    WHERE rp.id_ruta = $1
    ORDER BY rp.orden_ruta ASC
  `;
  
  const result = await client.query(query, [idRuta]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const paraderos = result.rows;
  const inicio = paraderos[0];
  const fin = paraderos[paraderos.length - 1];
  
  return {
    inicio: {
      id_paradero: inicio.id_paradero,
      latitud: parseFloat(inicio.latitud),
      longitud: parseFloat(inicio.longitud),
      orden: inicio.orden_ruta
    },
    fin: {
      id_paradero: fin.id_paradero,
      latitud: parseFloat(fin.latitud),
      longitud: parseFloat(fin.longitud),
      orden: fin.orden_ruta
    },
    total_paraderos: paraderos.length
  };
}

/**
 * Calcular dirección esperada basándose en la posición relativa en la ruta
 * Si está cerca del inicio, debería moverse hacia el fin
 * Si está cerca del fin, debería moverse hacia el inicio (si es vuelta)
 */
static async calculateExpectedDirectionWithClient(client, idRuta, latitude, longitude, sentidoRuta) {
  let routeEnds;
  try {
    // Obtener inicio y fin de la ruta
    routeEnds = await this.getRouteStartEndWithClient(client, idRuta);
    if (!routeEnds) {
      console.warn(`⚠️ [RUTA] No se encontraron paraderos para ruta ${idRuta}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ [RUTA] Error obteniendo inicio/fin de ruta ${idRuta}:`, error.message);
    return null; // Retornar null en lugar de lanzar error para no bloquear el flujo
  }
  
  // Calcular posición relativa en la ruta
  const posResult = await client.query(
    `SELECT ST_LineLocatePoint(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS pos_rel
     FROM ruta WHERE id_ruta = $3`,
    [longitude, latitude, idRuta]
  );
  
  if (posResult.rows.length === 0 || posResult.rows[0].pos_rel === null) {
    return null;
  }
  
  const posRel = parseFloat(posResult.rows[0].pos_rel);
  
  // ════════════════════════════════════════════════════════════════
  // SIEMPRE usar la dirección de la ruta en el punto actual
  // No calcular bearing hacia paraderos lejanos (puede ser incorrecto)
  // ════════════════════════════════════════════════════════════════
  
  // Calcular dirección del segmento de ruta en el punto actual
  // Usar un segmento pequeño adelante para obtener la dirección de movimiento
  const forwardPos = Math.min(1, posRel + 0.01); // 1% adelante en la ruta
  const backwardPos = Math.max(0, posRel - 0.01); // 1% atrás en la ruta
  
  const bearingResult = await client.query(
    `SELECT DEGREES(ST_Azimuth(
      ST_LineInterpolatePoint(geom, $1),
      ST_LineInterpolatePoint(geom, $2)
    )) AS bearing
    FROM ruta WHERE id_ruta = $3`,
    [backwardPos, forwardPos, idRuta]
  );
  
  if (bearingResult.rows.length === 0 || bearingResult.rows[0].bearing === null) {
    return null;
  }
  
  let routeBearing = parseFloat(bearingResult.rows[0].bearing);
  
  // Determinar dirección esperada basándose en posición relativa
  let expectedDirection;
  if (posRel < 0.1) {
    expectedDirection = 'hacia_fin';
  } else if (posRel > 0.9) {
    expectedDirection = sentidoRuta ? 'hacia_fin' : 'hacia_inicio';
  } else {
    expectedDirection = 'seguir_ruta';
  }
  
  // La dirección esperada se basa en inicio/fin:
  // - hacia_fin/seguir_ruta: usar bearing del segmento
  // - hacia_inicio: invertir 180°
  const expectedBearing = expectedDirection === 'hacia_inicio'
    ? (routeBearing + 180) % 360
    : routeBearing;
  
  return {
    expected_bearing: expectedBearing,
    pos_rel: posRel,
    expected_direction: expectedDirection,
    sentido_ruta: sentidoRuta
  };
}

/**
 * Validar dirección del cluster basándose en inicio/fin de la ruta
 * Esta función es más robusta que solo validar heading porque considera
 * la posición relativa en la ruta
 */
static async validateClusterDirectionWithClient(client, idRuta, latitude, longitude, heading, sentidoRuta) {
  const expectedDir = await this.calculateExpectedDirectionWithClient(
    client,
    idRuta,
    latitude,
    longitude,
    sentidoRuta
  );
  
  if (!expectedDir) {
    // Si no se puede calcular, usar validación básica
    return null;
  }
  
  const normalizedHeading = ((heading % 360) + 360) % 360;
  const expectedBearing = ((expectedDir.expected_bearing % 360) + 360) % 360;
  
  // Validar que los valores sean números válidos
  if (!Number.isFinite(normalizedHeading) || !Number.isFinite(expectedBearing)) {
    console.error(`❌ [RUTA] Valores inválidos en validación: heading=${heading}, expected=${expectedDir.expected_bearing}`);
    return null;
  }
  
  // Calcular diferencia angular (siempre entre 0 y 180)
  // Fórmula correcta para diferencia circular
  let delta = Math.abs(normalizedHeading - expectedBearing);
  if (delta > 180) {
    delta = 360 - delta;
  }
  
  // Validar que delta sea válido (debe estar entre 0 y 180)
  if (!Number.isFinite(delta) || delta < 0 || delta > 180) {
    console.error(`❌ [RUTA] Delta inválido calculado: ${delta} (heading=${normalizedHeading}, expected=${expectedBearing})`);
    return null;
  }
  
  // Tolerancia más estricta cuando está cerca de inicio/fin
  let maxDelta = 120; // grados
  if (expectedDir.pos_rel < 0.15 || expectedDir.pos_rel > 0.85) {
    maxDelta = 90; // Más estricto cerca de los extremos
  }
  
  return {
    valid: delta <= maxDelta,
    delta: delta,
    max_delta: maxDelta,
    expected_bearing: expectedBearing,
    actual_heading: normalizedHeading,
    pos_rel: expectedDir.pos_rel,
    expected_direction: expectedDir.expected_direction,
    sentido_ruta: sentidoRuta
  };
}

/**
 * Encontrar paradero cercano (usada dentro de transacción)
 */
static async findNearestStopWithClient(client, latitude, longitude) {
  const query = `
    SELECT
      id_paradero,
      nom_paradero,
      latitud,
      longitud,
      ST_Distance(
        geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )::numeric as distancia_metros
    FROM paraderos
    ORDER BY distancia_metros ASC
    LIMIT 1
  `;

  const result = await client.query(query, [longitude, latitude]);
  return result.rows[0] || null;
}

  /**
   * 🗑️ Eliminar clusters que llevan más de X segundos sin actualizar
   * Se ejecuta cada 60 segundos para mantener la BD limpia
   */
  static async deleteClustersBySeconds(maxAgeSeconds = 60) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Obtener clusters a eliminar
      const clustersQuery = `
        SELECT 
          id_cluster, 
          cantidad_usuarios,
          EXTRACT(EPOCH FROM (NOW() - ultima_actualizacion))::integer as segundos_sin_actualizar
        FROM clusters
        WHERE EXTRACT(EPOCH FROM (NOW() - ultima_actualizacion)) > $1
      `;
      
      const clustersResult = await client.query(clustersQuery, [maxAgeSeconds]);
      const clusterIds = clustersResult.rows.map(r => r.id_cluster);

      if (clusterIds.length === 0) {
        await client.query('COMMIT');
        return 0; // finally se encargará de release
      }

      // ⭐ LOGGING DETALLADO
      console.log(`
╔════════════════════════════════════════════════════════╗
║        🗑️  INICIANDO LIMPIEZA DE CLUSTERS             ║
╚════════════════════════════════════════════════════════╝
📊 Clusters a eliminar: ${clusterIds.length}
${clustersResult.rows.map(r => 
  `  • Cluster ${r.id_cluster}: ${r.segundos_sin_actualizar}s inactivo (${r.cantidad_usuarios} usuarios)`
).join('\n')}
      `);

      // Desvincular ubicaciones
      const locDeleteResult = await client.query(`
        UPDATE ubicacion
        SET id_cluster = NULL, esta_en_bus = FALSE
        WHERE id_cluster = ANY($1::bigint[])
      `, [clusterIds]);

      console.log(`  ✅ ${locDeleteResult.rowCount} ubicaciones desvinculadas`);

      // Eliminar clusters
      const deleteResult = await client.query(`
        DELETE FROM clusters
        WHERE id_cluster = ANY($1::bigint[])
        RETURNING id_cluster
      `, [clusterIds]);

      await client.query('COMMIT');
      
      console.log(`  ✅ ${deleteResult.rowCount} clusters eliminados de BD`);
      console.log(`╚════════════════════════════════════════════════════════╝`);
      
      return deleteResult.rowCount;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error en deleteClustersBySeconds:', error);
      throw error;
    } finally {
      client.release();
    }
  }

}

module.exports = Cluster;
