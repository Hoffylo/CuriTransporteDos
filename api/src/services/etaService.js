const GeoService = require('./geoService');

const DEFAULT_FALLBACK_KMH = parseFloat(process.env.FALLBACK_SPEED_KMH) || 15;

class EtaService {
  /**
   * Calcula segundos de ETA dado distancia (metros) y velocidad (km/h).
   */
  static calculateEtaSeconds(distanceMeters, velocidadKmh, fallbackKmh = DEFAULT_FALLBACK_KMH) {
    let kmh = velocidadKmh;
    if (!kmh || kmh <= 0) kmh = fallbackKmh;

    const mps = (kmh * 1000) / 3600; // metros por segundo
    if (!mps || mps <= 0) return null;

    const seconds = Math.round(distanceMeters / mps);
    return seconds;
  }

  /**
   * Usando PostGIS, calcula la distancia a lo largo de la geometría de la ruta
   * entre dos puntos (cluster y paradero). Retorna null si no puede proyectar.
   * Parámetros de entrada en orden: clusterLon, clusterLat, paraderoLon, paraderoLat
   */
  static async getAlongRouteDistance(pool, idRuta, clusterLon, clusterLat, paraderoLon, paraderoLat) {
    const query = `
      WITH r AS (
        SELECT geom FROM ruta WHERE id_ruta = $5
      ), pc AS (
        SELECT
          ST_LineLocatePoint(r.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS pos_cluster,
          ST_LineLocatePoint(r.geom, ST_SetSRID(ST_MakePoint($3, $4), 4326)) AS pos_paradero,
          r.geom
        FROM r
      )
      SELECT pos_cluster, pos_paradero,
        CASE WHEN pos_cluster IS NULL OR pos_paradero IS NULL THEN NULL
             ELSE ST_Length(ST_LineSubstring(geom::geometry, LEAST(pos_cluster, pos_paradero), GREATEST(pos_cluster, pos_paradero))::geography)::numeric END AS distancia_along_metros
      FROM pc
    `;

    const params = [parseFloat(clusterLon), parseFloat(clusterLat), parseFloat(paraderoLon), parseFloat(paraderoLat), parseInt(idRuta)];
    const result = await pool.query(query, params);
    if (!result || !result.rows || result.rows.length === 0) return null;

    const val = result.rows[0].distancia_along_metros;
    if (val === null || val === undefined) return null;
    return parseFloat(val);
  }

  /**
   * Calcular ETA para un cluster hacia un paradero. Usa distancia a lo largo de la ruta
   * si está disponible; si no, usa distancia geodésica.
   * cluster: { latitud_centro, longitud_centro, velocidad_promedio }
   * paradero: { latitud, longitud } OR raw coords
   */
  static async computeEtaForCluster(pool, idRuta, cluster, paradero, fallbackKmh = DEFAULT_FALLBACK_KMH) {
    const clusterLat = parseFloat(cluster.latitud_centro || cluster.latitud || cluster.lat);
    const clusterLon = parseFloat(cluster.longitud_centro || cluster.longitud || cluster.lng);
    const parLat = parseFloat(paradero.latitud || paradero.lat);
    const parLon = parseFloat(paradero.longitud || paradero.lon || paradero.lng);

    // intentar distancia along-route
    let along = null;
    try {
      along = await this.getAlongRouteDistance(pool, idRuta, clusterLon, clusterLat, parLon, parLat);
    } catch (err) {
      // ignorar y fallback
      along = null;
    }

    let distanceMeters;
    if (along !== null) {
      distanceMeters = along;
    } else {
      distanceMeters = GeoService.calculateDistance(clusterLat, clusterLon, parLat, parLon);
    }

    // Obtener velocidad real de usuarios activos (últimos 30s)
    const velocidadRealQuery = await pool.query(
      `SELECT AVG(velocidad)::numeric as velocidad_real
       FROM ubicacion 
       WHERE id_cluster = $1 
         AND esta_en_bus = TRUE 
         AND tiempo > NOW() - INTERVAL '30 seconds'
         AND velocidad > 0`,
      [cluster.id_cluster]
    );

    const velocidadReal = velocidadRealQuery.rows[0]?.velocidad_real;
    const velocidadCluster = cluster.velocidad_promedio;

    // Usar velocidad real > velocidad cluster > fallback, siempre > 0
    let velocidad = fallbackKmh;
    if (velocidadReal !== null && velocidadReal > 0) {
      velocidad = parseFloat(velocidadReal);
    } else if (velocidadCluster !== null && velocidadCluster > 0) {
      velocidad = parseFloat(velocidadCluster);
    }

    const eta_seconds = this.calculateEtaSeconds(distanceMeters, velocidad, fallbackKmh);
    const eta_min = eta_seconds !== null && eta_seconds > 0 ? Math.round(eta_seconds / 60) : 0;

    console.log(`[ETA DEBUG] computeEtaForCluster: cluster=${cluster.id_cluster}, vel_real=${velocidadReal}, vel_cluster=${velocidadCluster}, vel_usar=${velocidad}, dist=${Math.round(distanceMeters)}m, eta=${eta_seconds}s`);

    return {
      id_cluster: cluster.id_cluster,
      distancia_along_metros: along,
      distancia_metros: Math.round(distanceMeters),
      velocidad_kmh: parseFloat(velocidad.toFixed(2)),
      velocidad_promedio: parseFloat(velocidad.toFixed(2)),
      eta_seconds: eta_seconds || 0,
      eta_minutos: eta_min,
      eta_llegada: eta_seconds && eta_seconds > 0 ? new Date(Date.now() + eta_seconds * 1000).toISOString() : null
    };
  }

  /**
   * Calcular ETAs para múltiples clusters asociados a rutas (batch SQL).
   * - `rutaIds` es un array de enteros
   * - `paraderoGeom` es el valor `geom` del paradero (tipo geometry/geography)
   */
  static async computeEtasForParadero(pool, rutaIds, paraderoGeom, radioMeters = 20000, limit = 3, fallbackKmh = DEFAULT_FALLBACK_KMH, sentidoRuta = null) {
    if (!Array.isArray(rutaIds) || rutaIds.length === 0) return [];

    console.log(`[ETA DEBUG] computeEtasForParadero: rutaIds=${JSON.stringify(rutaIds)}, sentido=${sentidoRuta}, radio=${radioMeters}m, limit=${limit}, fallback=${fallbackKmh}km/h`);

    const sql = `
      SELECT
        c.id_cluster,
        c.latitud_centro,
        c.longitud_centro,
        c.cantidad_usuarios,
        c.velocidad_promedio,
        c.direccion_promedio,
        r.sentido_ruta,
        ST_Distance(c.geom, $1::geography)::numeric AS distancia_recta_metros,
        pos_c.pos_rel AS pos_rel_cluster,
        pos_p.pos_rel AS pos_rel_paradero,
        CASE WHEN pos_c.pos_rel IS NULL OR pos_p.pos_rel IS NULL THEN NULL
             ELSE ST_Length(ST_LineSubstring(r.geom::geometry, LEAST(pos_c.pos_rel, pos_p.pos_rel), GREATEST(pos_c.pos_rel, pos_p.pos_rel))::geography)::numeric END AS distancia_along_metros,
        -- Calcular velocidad promedio real de miembros activos (últimos 30s)
        (SELECT AVG(velocidad)::numeric FROM ubicacion 
         WHERE id_cluster = c.id_cluster 
           AND esta_en_bus = TRUE 
           AND tiempo > NOW() - INTERVAL '30 seconds'
           AND velocidad > 0) AS velocidad_real_promedio,
        -- ETA en segundos calculada en DB usando velocidad real o fallback
        ROUND(
          ( COALESCE(
              CASE WHEN pos_c.pos_rel IS NULL OR pos_p.pos_rel IS NULL THEN NULL
                   ELSE ST_Length(ST_LineSubstring(r.geom::geometry, LEAST(pos_c.pos_rel, pos_p.pos_rel), GREATEST(pos_c.pos_rel, pos_p.pos_rel))::geography)::numeric END,
              ST_Distance(c.geom, $1::geography)::numeric
            )::double precision
          ) / ( 
            GREATEST(
              COALESCE(
                (SELECT AVG(velocidad)::numeric FROM ubicacion WHERE id_cluster = c.id_cluster AND esta_en_bus = TRUE AND tiempo > NOW() - INTERVAL '30 seconds' AND velocidad > 0),
                NULLIF(c.velocidad_promedio, 0), 
                $5
              )::double precision,
              0.1
            ) * 1000.0 / 3600.0 
          )
        )::int AS eta_seconds
      FROM clusters c
      JOIN ruta r ON c.id_ruta = r.id_ruta
      CROSS JOIN LATERAL (
        SELECT ST_LineLocatePoint(r.geom, ST_SetSRID(ST_MakePoint(c.longitud_centro, c.latitud_centro), 4326)) AS pos_rel
      ) AS pos_c
      CROSS JOIN LATERAL (
        SELECT ST_LineLocatePoint(r.geom, $1) AS pos_rel
      ) AS pos_p
      WHERE c.esta_activo = TRUE
        AND c.id_ruta = ANY($4::int[])
        AND ST_DWithin(c.geom, $1::geography, $2)
        ${sentidoRuta !== null ? 'AND r.sentido_ruta = $6' : ''}
      ORDER BY eta_seconds ASC NULLS LAST
      LIMIT $3
    `;

    const params = sentidoRuta !== null 
      ? [paraderoGeom, parseInt(radioMeters), parseInt(limit) * 3, rutaIds, fallbackKmh, sentidoRuta]
      : [paraderoGeom, parseInt(radioMeters), parseInt(limit) * 3, rutaIds, fallbackKmh];
    
    console.log(`[ETA DEBUG] SQL params count: ${params.length}`);
    const result = await pool.query(sql, params);

    // Mapear y normalizar
    const mapped = (result.rows || []).map(r => {
      const velocidad_usar = r.velocidad_real_promedio !== null ? parseFloat(r.velocidad_real_promedio) : 
                             (r.velocidad_promedio !== null ? parseFloat(r.velocidad_promedio) : fallbackKmh);
      
      const distancia_metros = r.distancia_along_metros !== null ? parseFloat(r.distancia_along_metros) : parseFloat(r.distancia_recta_metros);
      const eta_sec = r.eta_seconds !== null && r.eta_seconds > 0 ? parseInt(r.eta_seconds) : 0;
      const eta_min = eta_sec > 0 ? Math.round(eta_sec / 60) : 0;
      
      const obj = {
        id_cluster: r.id_cluster,
        latitud_centro: parseFloat(r.latitud_centro),
        longitud_centro: parseFloat(r.longitud_centro),
        cantidad_usuarios: parseInt(r.cantidad_usuarios),
        velocidad_kmh: parseFloat(velocidad_usar.toFixed(2)),
        velocidad_promedio: parseFloat(velocidad_usar.toFixed(2)),
        sentido_ruta: r.sentido_ruta,
        distancia_metros: Math.round(distancia_metros),
        distancia_recta_metros: r.distancia_recta_metros !== null ? Math.round(parseFloat(r.distancia_recta_metros)) : null,
        distancia_along_metros: r.distancia_along_metros !== null ? Math.round(parseFloat(r.distancia_along_metros)) : null,
        eta_seconds: eta_sec,
        eta_minutos: eta_min,
        eta_llegada: eta_sec > 0 ? new Date(Date.now() + eta_sec * 1000).toISOString() : null,
        pos_rel_cluster: r.pos_rel_cluster !== null ? parseFloat(r.pos_rel_cluster.toFixed(4)) : null,
        pos_rel_paradero: r.pos_rel_paradero !== null ? parseFloat(r.pos_rel_paradero.toFixed(4)) : null
      };
      
      console.log(`[ETA DEBUG] Cluster ${obj.id_cluster}: sentido=${obj.sentido_ruta}, vel_real=${r.velocidad_real_promedio}, vel_cluster=${r.velocidad_promedio}, vel_usar=${velocidad_usar}km/h, dist_along=${obj.distancia_along_metros}m, dist_recta=${obj.distancia_recta_metros}m, eta=${obj.eta_seconds}s (${obj.eta_minutos}min), pos_cluster=${obj.pos_rel_cluster}, pos_paradero=${obj.pos_rel_paradero}`);
      
      return obj;
    });
    
    console.log(`[ETA DEBUG] Retornando ${mapped.length} clusters con ETA`);
    return mapped;
  }
}

module.exports = EtaService;

