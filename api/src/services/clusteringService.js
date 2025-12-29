// src/services/clusteringService.js

const Cluster = require('../models/modelCluster');
const pool = require('../config/database');
const geolib = require('geolib');

class ClusteringService {
  constructor() {
    this.PROXIMITY_THRESHOLD = parseInt(process.env.PROXIMITY_THRESHOLD) || 50;
    this.MIN_USERS_FOR_BUS = parseInt(process.env.MIN_USERS_FOR_BUS) || 1;
    this.CLUSTER_MAX_AGE_MINUTES = parseInt(process.env.CLUSTER_INACTIVE_MINUTES) || 2;
    
    // Variables de auto-cleanup
    this.CLEANUP_INTERVAL = parseInt(process.env.CLUSTER_CLEANUP_INTERVAL) || 60;
    this.MAX_AGE_SECONDS = parseInt(process.env.CLUSTER_MAX_AGE_SECONDS) || 60;
    
    console.log(`⏱️ ClusteringService: Limpieza cada ${this.CLEANUP_INTERVAL}s, max edad ${this.MAX_AGE_SECONDS}s`);
    
    // Iniciar limpieza automática
    this.startAutoCleanup();
  }

  // 🔑 MÉTODO PRINCIPAL: Procesar ubicación del usuario

  /**
   * ORQUESTA TODO EL PROCESO DE CLUSTERING
   * 
   * Este es el flujo principal que se llama desde el controller
   */
  async processUserLocation(userId, latitude, longitude, speed, accuracy, heading) {
    try {
      console.log(`📍 Procesando ubicación de usuario ${userId} en (${latitude}, ${longitude})`);

      // PASO 1: Validar entrada

      if (!this.validateCoordinates(latitude, longitude)) {
        throw new Error('Coordenadas inválidas');
      }

      // PASO 2: Buscar cluster cercano
      const nearbyCluster = await Cluster.findNearbyCluster(
        latitude,
        longitude,
        this.PROXIMITY_THRESHOLD
      );

      if (nearbyCluster) {
        console.log(`✅ Usuario ${userId} se unió a cluster ${nearbyCluster.id_cluster}`);
        return await this.handleUserJoinsCluster(
          userId,
          nearbyCluster,
          latitude,
          longitude,
          speed,
          accuracy,
          heading
        );
      }

      // PASO 3: Buscar otros usuarios cercanos

      const nearbyUsers = await Cluster.findNearbyUsers(
        userId,
        latitude,
        longitude,
        this.PROXIMITY_THRESHOLD,
        1 // Última ubicación de hace 1 minuto
      );

      console.log(`👥 Encontrados ${nearbyUsers.length} usuarios cercanos`);

      // PASO 4: ¿Hay suficientes usuarios para formar bus?

      if (nearbyUsers.length >= this.MIN_USERS_FOR_BUS - 1) {
        console.log(`🚌 Creando nuevo cluster (bus) con ${nearbyUsers.length + 1} usuarios`);
        return await this.handleCreateNewCluster(
          userId,
          nearbyUsers,
          latitude,
          longitude,
          speed,
          heading
        );
      }

      // PASO 5: Usuario está solo

      console.log(`👤 Usuario ${userId} está viajando solo`);
      return await this.handleUserAlone(
        userId,
        latitude,
        longitude,
        speed,
        accuracy,
        heading,
        nearbyUsers.length
      );

    } catch (error) {
      console.error('❌ Error en processUserLocation:', error);
      throw error;
    }
  }

  // HANDLERS: Casos específicos

  /**
   * Manejar cuando usuario se une a cluster existente
   */
  async handleUserJoinsCluster(userId, cluster, lat, lng, speed, heading, idRuta) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO ubicacion (
          id_usuario, latitud, longitud, velocidad, precision_metros,
          direccion, esta_en_bus, id_cluster, id_ruta, tiempo, geom
        )
        VALUES (
          $1, $2, $3, $4, 10, $5, TRUE, $6, $7, NOW(),
          ST_SetSRID(ST_MakePoint($3, $2), 4326)
        )
      `, [userId, lat, lng, speed, heading, cluster.id_cluster, idRuta]);

      await this.recalculateClusterStats(client, cluster.id_cluster);

      await client.query('COMMIT');

      return {
        status: 'success',
        enBus: true,
        clusterId: cluster.id_cluster,
        idRuta: idRuta,
        accion: 'USUARIO_UNIDO'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manejar creación de nuevo cluster
   */
  async handleCreateNewCluster(userId, nearbyUsers, lat, lng, speed, heading, idRuta, idBus = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 🛡️ VALIDACIÓN ESTRICTA: Patente OBLIGATORIA
      if (!idBus) {
        await client.query('ROLLBACK');
        throw new Error('No se puede crear un cluster sin especificar la patente del bus.');
      }

      // 🛡️ VALIDACIÓN: Verificar que no exista cluster activo con este bus
      if (idBus) {
        const existingCluster = await client.query(`
          SELECT id_cluster, cantidad_usuarios 
          FROM clusters 
          WHERE id_bus = $1 AND esta_activo = TRUE
          LIMIT 1
        `, [idBus]);

        if (existingCluster.rows.length > 0) {
          await client.query('ROLLBACK');
          const clusterId = existingCluster.rows[0].id_cluster;
          console.warn(`⚠️ Ya existe cluster activo ${clusterId} para bus ${idBus}`);
          throw new Error(`Ya existe un cluster activo (ID: ${clusterId}) para este bus. Un bus solo puede tener un cluster activo.`);
        }
      }

      const totalUsers = nearbyUsers.length + 1;
      
      const clusterResult = await client.query(`
        INSERT INTO clusters (
          latitud_centro, longitud_centro,
          usuarios_activos_count, cantidad_usuarios,
          velocidad_promedio,
          id_ruta,
          id_bus,
          esta_activo, fecha_creacion, ultima_actualizacion, actualizado_at,
          geom
        )
        VALUES (
          $1, $2, $3, $3, $4, $5, $6, TRUE, NOW(), NOW(), NOW(),
          ST_SetSRID(ST_MakePoint($2, $1), 4326)
        )
        RETURNING id_cluster
      `, [lat, lng, totalUsers, speed, idRuta, idBus]);

      const clusterId = clusterResult.rows[0]?.id_cluster;

      await client.query(`
        INSERT INTO ubicacion (
          id_usuario, latitud, longitud, velocidad, precision_metros,
          direccion, esta_en_bus, id_cluster, id_ruta, tiempo, geom
        )
        VALUES (
          $1, $2, $3, $4, 10, $5, TRUE, $6, $7, NOW(),
          ST_SetSRID(ST_MakePoint($3, $2), 4326)
        )
      `, [userId, lat, lng, speed, heading, clusterId, idRuta]);

      for (const user of nearbyUsers) {
        await client.query(`
          INSERT INTO ubicacion (
            id_usuario, latitud, longitud, velocidad,
            direccion, esta_en_bus, id_cluster, id_ruta, tiempo, geom
          )
          VALUES (
            $1, $2, $3, $4, 0, TRUE, $5, $6, NOW(),
            ST_SetSRID(ST_MakePoint($3, $2), 4326)
          )
        `, [user.id_usuario, user.latitud, user.longitud, user.velocidad, clusterId, idRuta]);
      }

      await client.query('COMMIT');

      return {
        status: 'success',
        enBus: true,
        clusterId: clusterId,
        idRuta: idRuta,
        cantidadUsuarios: totalUsers,
        accion: 'CLUSTER_CREADO',
        usuariosIntegrados: nearbyUsers.length
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ✅ CREAR CLUSTER CON 1 USUARIO
  async handleCreateSingleUserCluster(userId, lat, lng, speed, heading, idRuta, idBus = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 🛡️ VALIDACIÓN ESTRICTA: Patente OBLIGATORIA
      if (!idBus) {
        await client.query('ROLLBACK');
        throw new Error('No se puede crear un cluster sin especificar la patente del bus.');
      }

      // 🛡️ VALIDACIÓN: Verificar que no exista cluster activo con este bus
      if (idBus) {
        const existingCluster = await client.query(`
          SELECT id_cluster, cantidad_usuarios 
          FROM clusters 
          WHERE id_bus = $1 AND esta_activo = TRUE
          LIMIT 1
        `, [idBus]);

        if (existingCluster.rows.length > 0) {
          await client.query('ROLLBACK');
          const clusterId = existingCluster.rows[0].id_cluster;
          console.warn(`⚠️ Ya existe cluster activo ${clusterId} para bus ${idBus}`);
          throw new Error(`Ya existe un cluster activo (ID: ${clusterId}) para este bus. Un bus solo puede tener un cluster activo.`);
        }
      }

      const clusterResult = await client.query(`
        INSERT INTO clusters (
          latitud_centro, longitud_centro, 
          usuarios_activos_count, cantidad_usuarios,
          velocidad_promedio,
          id_ruta,
          id_bus,
          esta_activo, fecha_creacion, ultima_actualizacion, actualizado_at,
          geom
        )
        VALUES (
          $1, $2, 1, 1, $3, $4, $5, TRUE, NOW(), NOW(), NOW(),
          ST_SetSRID(ST_MakePoint($2, $1), 4326)
        )
        RETURNING id_cluster
      `, [lat, lng, speed, idRuta, idBus]);

      const clusterId = clusterResult.rows[0]?.id_cluster;

      await client.query(`
        INSERT INTO ubicacion (
          id_usuario, latitud, longitud, velocidad, precision_metros,
          direccion, esta_en_bus, id_cluster, id_ruta, tiempo, geom
        )
        VALUES (
          $1, $2, $3, $4, 10, $5, TRUE, $6, $7, NOW(),
          ST_SetSRID(ST_MakePoint($3, $2), 4326)
        )
      `, [userId, lat, lng, speed, heading, clusterId, idRuta]);

      await client.query('COMMIT');

      return {
        status: 'success',
        enBus: true,
        clusterId: clusterId,
        idRuta: idRuta,
        cantidadUsuarios: 1,
        accion: 'CLUSTER_CREADO'
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manejar usuario viajando solo
   */
  async handleUserAlone(userId, lat, lng, speed, accuracy, heading, usuariosCercanos) {
    try {
      // Insertar ubicación sin cluster
      await pool.query(
        `INSERT INTO ubicacion 
          (id_usuario, latitud, longitud, velocidad, precision_metros, 
           direccion, esta_en_bus, id_cluster, tiempo)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL, NOW())`,
        [userId, lat, lng, speed, accuracy, heading]
      );

      const faltanParaFormarBus = this.MIN_USERS_FOR_BUS - usuariosCercanos - 1;

      return {
        status: 'success',
        enBus: false,
        accion: 'USUARIO_SOLO',
        usuariosCercanos: usuariosCercanos,
        proximosParaFormarBus: Math.max(0, faltanParaFormarBus),
        mensaje: `Necesita ${Math.max(0, faltanParaFormarBus)} más usuarios cercanos para detectar bus`
      };

    } catch (error) {
      throw error;
    }
  }

  // UTILIDADES Y VALIDACIONES

  /**
   * Validar que las coordenadas sean válidas
   */
  validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return false;
    }

    if (latitude < -90 || latitude > 90) {
      return false;
    }

    if (longitude < -180 || longitude > 180) {
      return false;
    }

    return true;
  }

  // LIMPIEZA AUTOMÁTICA

  /**
   * Iniciar limpieza automática de clusters inactivos
   */
  startAutoCleanup() {
    // Limpieza cada X segundos (configurables por .env)
    setInterval(async () => {
      try {
        // Eliminar clusters con +X segundos sin actualizar
        const deleted = await Cluster.deleteClustersBySeconds(this.MAX_AGE_SECONDS);

        // Marcar como inactivos clusters sin usuarios
        const inactive = await Cluster.cleanupInactiveClusters(this.CLUSTER_MAX_AGE_MINUTES);
        
        if (inactive.inactivados > 0) {
          console.log(`⏸️  ${inactive.inactivados} clusters marcados como inactivos`);
        }
      } catch (error) {
        console.error('❌ Error en limpieza automática:', error);
      }
    }, this.CLEANUP_INTERVAL * 1000);
  }

  /**
   * Obtener estadísticas del sistema
   */
  async getSystemStats() {
    const activeClusters = await Cluster.findAllActive();
    const totalUsers = await pool.query('SELECT COUNT(*) FROM usuarios WHERE is_active = TRUE');
    const usersOnBus = await pool.query(
      'SELECT COUNT(DISTINCT id_usuario) FROM ubicacion WHERE esta_en_bus = TRUE AND tiempo > NOW() - INTERVAL \'5 minutes\''
    );

    return {
      clustersActivos: activeClusters.length,
      usuariosActivos: totalUsers.rows[0].count,
      usuariosEnBus: usersOnBus.rows[0].count,
      proximidadThreshold: this.PROXIMITY_THRESHOLD,
      usuariosMinimos: this.MIN_USERS_FOR_BUS,
      edadMaximaCluster: this.CLUSTER_MAX_AGE_MINUTES
    };
  }

  /**
   * 🔍 Buscar cluster cercano EN LA MISMA RUTA
   */
  async findNearbyClusterInRoute(latitude, longitude, idRuta, radiusMeters) {
    try {
      const query = `
        SELECT
          c.id_cluster,
          c.latitud_centro,
          c.longitud_centro,
          c.usuarios_activos_count,
          c.velocidad_promedio,
          c.id_ruta,
          r.nom_ruta,
          r.sentido_ruta,
          ST_Distance(
            c.geom,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          )::numeric as distancia_metros
        FROM clusters c
        LEFT JOIN ruta r ON c.id_ruta = r.id_ruta
        WHERE c.esta_activo = TRUE
          AND c.id_ruta = $3
          AND c.ultima_actualizacion > NOW() - INTERVAL '10 minutes'
          AND ST_DWithin(
            c.geom,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $4
          )
        ORDER BY c.usuarios_activos_count DESC
        LIMIT 1
      `;

      const result = await pool.query(query, [longitude, latitude, idRuta, radiusMeters]);
      return result.rows || null;
    } catch (error) {
      console.error('❌ Error en findNearbyClusterInRoute:', error);
      throw error;
    }
  }

  /**
   * 👥 Buscar usuarios cercanos EN LA MISMA RUTA
   */
  async findNearbyUsersInRoute(userId, latitude, longitude, idRuta, radiusMeters) {
    try {
      const query = `
        SELECT DISTINCT ON (u.id_usuario)
          u.id_usuario,
          ul.latitud,
          ul.longitud,
          ul.velocidad,
          ul.id_ruta
        FROM ubicacion ul
        JOIN usuarios u ON u.id_usuario = ul.id_usuario
        WHERE ul.id_usuario != $1
          AND ul.esta_en_bus = TRUE
          AND ul.id_ruta = $2
          AND ul.tiempo > NOW() - INTERVAL '2 minutes'
          AND ST_DWithin(
            ul.geom,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
            $5
          )
        ORDER BY u.id_usuario, ul.tiempo DESC
      `;

      const result = await pool.query(query, [userId, idRuta, longitude, latitude, radiusMeters]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error en findNearbyUsersInRoute:', error);
      throw error;
    }
  }

  /**
   * 🔄 Sincronizar TODOS los clusters activos
   */
  async syncAllActiveClusters() {
    try {
      console.log('⏰ Ejecutando sincronización de clusters...');
      
      const result = await pool.query(`
        SELECT id_cluster FROM clusters 
        WHERE esta_activo = TRUE
        AND ultima_actualizacion > NOW() - INTERVAL '15 minutes'
      `);

      for (const { id_cluster } of result.rows) {
        await this.recalculateClusterStats(null, id_cluster);
      }

      console.log(`✅ Sincronización completada (${result.rows.length} clusters)`);
    } catch (error) {
      console.error('❌ Error en syncAllActiveClusters:', error);
    }
  }

  /**
   * 📊 Recalcular estadísticas de un cluster
   */
  async recalculateClusterStats(client, clusterId) {
    const isExternal = !client;
    if (isExternal) {
      client = await pool.connect();
    }

    try {
      const usersResult = await client.query(`
        SELECT 
          COUNT(*) as user_count,
          AVG(velocidad) as avg_speed,
          ST_Centroid(ST_Collect(geom)) as center
        FROM ubicacion
        WHERE id_cluster = $1
          AND esta_en_bus = TRUE
          AND tiempo > NOW() - INTERVAL '2 minutes'
      `, [clusterId]);

      const row = usersResult.rows[0] || {};
      const user_count = parseInt(row.user_count || 0);
      const avg_speed = row.avg_speed || null;
      const center = row.center || null;

      if (user_count > 0 && center) {
        await client.query(`
          UPDATE clusters
          SET 
            usuarios_activos_count = $1,
            velocidad_promedio = COALESCE($2, velocidad_promedio),
            latitud_centro = ST_Y($3::geometry),
            longitud_centro = ST_X($3::geometry),
            geom = $3,
            actualizado_at = NOW(),
            ultima_actualizacion = NOW()
          WHERE id_cluster = $4
        `, [user_count, avg_speed, center, clusterId]);
      } else {
        await client.query(`
          UPDATE clusters
          SET esta_activo = FALSE, actualizado_at = NOW()
          WHERE id_cluster = $1
        `, [clusterId]);
      }
    } finally {
      if (isExternal) {
        client.release();
      }
    }
  }

  /**
   * 🗑️ Remover usuario del cluster
   */
  async removeUserFromCluster(client, userId, clusterId) {
    const isExternal = !client;
    if (isExternal) {
      client = await pool.connect();
    }

    try {
      await client.query(`
        UPDATE ubicacion
        SET esta_en_bus = FALSE
        WHERE id_usuario = $1 AND id_cluster = $2
      `, [userId, clusterId]);

      await this.recalculateClusterStats(client, clusterId);
    } finally {
      if (isExternal) {
        client.release();
      }
    }
  }
}

// Singleton - crear una única instancia
module.exports = new ClusteringService();
