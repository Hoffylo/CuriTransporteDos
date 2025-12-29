// Script de diagnóstico para verificar clusters y ubicaciones de ruta IDA
const pool = require('./src/config/database');

async function diagnosticarRuta() {
  try {
    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 DIAGNÓSTICO: RUTA IDA vs RUTA VUELTA');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Verificar información de las rutas
    const rutasQuery = await pool.query(`
      SELECT id_ruta, nom_ruta, sentido_ruta, descripcion
      FROM ruta
      WHERE id_ruta IN (2, 3)
      ORDER BY id_ruta
    `);

    console.log('📋 RUTAS CONFIGURADAS:');
    rutasQuery.rows.forEach(r => {
      console.log(`  - Ruta ${r.id_ruta}: ${r.nom_ruta}`);
      console.log(`    Sentido: ${r.sentido_ruta ? 'IDA (true)' : 'VUELTA (false)'}`);
      console.log(`    Descripción: ${r.descripcion || 'N/A'}\n`);
    });

    // 2. Clusters activos por ruta
    const clustersQuery = await pool.query(`
      SELECT 
        id_ruta,
        COUNT(*) as total_clusters,
        SUM(cantidad_usuarios) as total_usuarios,
        AVG(velocidad_promedio) as velocidad_promedio
      FROM clusters
      WHERE esta_activo = TRUE AND id_ruta IN (2, 3)
      GROUP BY id_ruta
      ORDER BY id_ruta
    `);

    console.log('🚌 CLUSTERS ACTIVOS:');
    if (clustersQuery.rows.length === 0) {
      console.log('  ❌ No hay clusters activos en ninguna ruta');
    } else {
      clustersQuery.rows.forEach(c => {
        console.log(`  - Ruta ${c.id_ruta}: ${c.total_clusters} clusters, ${c.total_usuarios} usuarios`);
        console.log(`    Velocidad promedio: ${parseFloat(c.velocidad_promedio || 0).toFixed(2)} km/h\n`);
      });
    }

    // 3. Ubicaciones recientes (últimos 5 minutos)
    const ubicacionesQuery = await pool.query(`
      SELECT 
        id_ruta,
        COUNT(*) as total_ubicaciones,
        COUNT(DISTINCT COALESCE(id_usuario, usuario_anonimo_id)) as usuarios_unicos,
        COUNT(CASE WHEN esta_en_bus THEN 1 END) as en_bus,
        MAX(tiempo) as ultima_ubicacion
      FROM ubicacion
      WHERE tiempo > NOW() - INTERVAL '5 minutes'
        AND id_ruta IN (2, 3)
      GROUP BY id_ruta
      ORDER BY id_ruta
    `);

    console.log('📍 UBICACIONES RECIENTES (últimos 5 min):');
    if (ubicacionesQuery.rows.length === 0) {
      console.log('  ❌ No hay ubicaciones recientes en ninguna ruta');
    } else {
      ubicacionesQuery.rows.forEach(u => {
        console.log(`  - Ruta ${u.id_ruta}:`);
        console.log(`    Total ubicaciones: ${u.total_ubicaciones}`);
        console.log(`    Usuarios únicos: ${u.usuarios_unicos}`);
        console.log(`    Marcados "en bus": ${u.en_bus}`);
        console.log(`    Última actualización: ${u.ultima_ubicacion}\n`);
      });
    }

    // 4. Detalle de clusters activos
    const detalleClustersQuery = await pool.query(`
      SELECT 
        c.id_cluster,
        c.id_ruta,
        r.sentido_ruta,
        c.latitud_centro,
        c.longitud_centro,
        c.cantidad_usuarios,
        c.velocidad_promedio,
        c.ultima_actualizacion
      FROM clusters c
      JOIN ruta r ON c.id_ruta = r.id_ruta
      WHERE c.esta_activo = TRUE AND c.id_ruta IN (2, 3)
      ORDER BY c.id_ruta, c.id_cluster
    `);

    console.log('🔍 DETALLE DE CLUSTERS ACTIVOS:');
    if (detalleClustersQuery.rows.length === 0) {
      console.log('  ❌ No hay clusters activos');
    } else {
      detalleClustersQuery.rows.forEach(c => {
        console.log(`  - Cluster ${c.id_cluster} (Ruta ${c.id_ruta} - ${c.sentido_ruta ? 'IDA' : 'VUELTA'})`);
        console.log(`    Ubicación: (${c.latitud_centro}, ${c.longitud_centro})`);
        console.log(`    Usuarios: ${c.cantidad_usuarios}, Velocidad: ${c.velocidad_promedio || 0} km/h`);
        console.log(`    Última actualización: ${c.ultima_actualizacion}\n`);
      });
    }

    // 5. Usuarios activos por ruta
    const usuariosActivosQuery = await pool.query(`
      SELECT 
        u.id_ruta,
        COALESCE(u.id_usuario::text, u.usuario_anonimo_id) as usuario,
        u.esta_en_bus,
        u.id_cluster,
        u.velocidad,
        u.tiempo
      FROM ubicacion u
      WHERE u.tiempo > NOW() - INTERVAL '1 minute'
        AND u.id_ruta IN (2, 3)
      ORDER BY u.id_ruta, u.tiempo DESC
    `);

    console.log('👥 USUARIOS ACTIVOS (último minuto):');
    if (usuariosActivosQuery.rows.length === 0) {
      console.log('  ❌ No hay usuarios activos');
    } else {
      const porRuta = {};
      usuariosActivosQuery.rows.forEach(u => {
        if (!porRuta[u.id_ruta]) porRuta[u.id_ruta] = [];
        porRuta[u.id_ruta].push(u);
      });

      Object.keys(porRuta).forEach(ruta => {
        console.log(`  - Ruta ${ruta}: ${porRuta[ruta].length} ubicaciones`);
        porRuta[ruta].slice(0, 3).forEach(u => {
          console.log(`    ${u.usuario.substring(0, 20)}... | en_bus=${u.esta_en_bus} | cluster=${u.id_cluster || 'null'} | vel=${u.velocidad}km/h | ${u.tiempo.toISOString()}`);
        });
        if (porRuta[ruta].length > 3) {
          console.log(`    ... y ${porRuta[ruta].length - 3} más`);
        }
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════');
    console.log('✅ Diagnóstico completado');
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  } finally {
    await pool.end();
  }
}

diagnosticarRuta();
