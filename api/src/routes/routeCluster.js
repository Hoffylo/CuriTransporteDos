const express = require('express');
const router = express.Router();
const clusterController = require('../controllers/clusterController');

/**
 * @swagger
 * tags:
 *   - name: Clustering
 *     description: Gestión de buses detectados (clusters)
 */

/**
 * @swagger
 * /api/v1/cluster/buses-activos:
 *   get:
 *     summary: Obtener todos los buses activos para el mapa
 *     tags: [Clustering]
 *     description: Devuelve todos los clusters (buses) activos con usuarios actualmente conectados
 *     responses:
 *       200:
 *         description: Lista completa de buses activos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 5
 *                   description: Cantidad total de buses activos
 *                 data:
 *                   type: array
 *                   description: Lista de todos los buses activos
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_cluster:
 *                         type: integer
 *                         example: 1
 *                       latitud_centro:
 *                         type: number
 *                         example: -34.9211
 *                       longitud_centro:
 *                         type: number
 *                         example: -71.2310
 *                       cantidad_usuarios:
 *                         type: integer
 *                         example: 5
 *                       velocidad_promedio:
 *                         type: number
 *                         example: 15.5
 *                       direccion_promedio:
 *                         type: number
 *                         nullable: true
 *                         example: 180.0
 *                       id_paradero_cercano:
 *                         type: integer
 *                         nullable: true
 *                         example: 10
 *                       id_ruta:
 *                         type: integer
 *                         nullable: true
 *                         example: 1
 *                       id_bus:
 *                         type: integer
 *                         nullable: true
 *                         example: 1
 *                       placa:
 *                         type: string
 *                         nullable: true
 *                         example: "ABC123"
 *                         description: Patente del bus (si está registrada)
 *                       esta_activo:
 *                         type: boolean
 *                         example: true
 *                       fecha_creacion:
 *                         type: string
 *                         format: date-time
 *                       ultima_actualizacion:
 *                         type: string
 *                         format: date-time
 *                       segundos_sin_actualizar:
 *                         type: integer
 *                         example: 45
 *                         description: Segundos desde la última actualización de ubicación
 *       500:
 *         description: Error del servidor
 */
router.get('/buses-activos', clusterController.getBusesActivos);

/**
 * @swagger
 * /api/v1/cluster/paraderos:
 *   get:
 *     summary: Obtener clusters para paraderos (incluye histórico reciente)
 *     tags: [Clustering]
 *     description: Devuelve clusters activos e inactivos de la última hora para visualización en paraderos
 *     responses:
 *       200:
 *         description: Lista de clusters para paraderos
 */
router.get('/paraderos', clusterController.getClustersParaParaderos);

/**
 * @swagger
 * /api/v1/cluster/cercanos:
 *   get:
 *     summary: Obtener buses cercanos a una ubicación o paradero
 *     tags: [Clustering]
 *     parameters:
 *       - in: query
 *         name: latitud
 *         schema:
 *           type: number
 *         description: Latitud del punto de origen (requerido si no se envía id_paradero)
 *       - in: query
 *         name: longitud
 *         schema:
 *           type: number
 *         description: Longitud del punto de origen (requerido si no se envía id_paradero)
 *       - in: query
 *         name: id_paradero
 *         schema:
 *           type: integer
 *         description: ID del paradero (requerido si no se envían coordenadas)
 *       - in: query
 *         name: radio
 *         schema:
 *           type: integer
 *           default: 1000
 *         description: Radio de búsqueda en metros
 *     responses:
 *       200:
 *         description: Buses cercanos con id_ruta incluido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 total:
 *                   type: integer
 *                 radio_metros:
 *                   type: integer
 *                 origen:
 *                   type: object
 *                   properties:
 *                     tipo:
 *                       type: string
 *                       enum: [paradero, coordenadas]
 *                     id_paradero:
 *                       type: integer
 *                     latitud:
 *                       type: number
 *                     longitud:
 *                       type: number
 *                 mas_cercano:
 *                   type: object
 *                   properties:
 *                     id_cluster:
 *                       type: integer
 *                     id_ruta:
 *                       type: integer
 *                     latitud_centro:
 *                       type: number
 *                     longitud_centro:
 *                       type: number
 *                     distancia_metros:
 *                       type: number
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/cercanos', clusterController.getBusesCercanos);

/**
 * @swagger
 * /api/v1/cluster/stats/global:
 *   get:
 *     summary: Obtener estadísticas globales del sistema
 *     tags: [Clustering]
 *     responses:
 *       200:
 *         description: Estadísticas globales
 */
router.get('/stats/global', clusterController.getEstadisticasGlobales);

/**
 * @swagger
 * /api/v1/cluster/buses/patentes:
 *   get:
 *     summary: Listar todas las patentes de buses disponibles
 *     tags: [Clustering]
 *     description: Obtener lista de patentes válidas registradas en la BD
 *     parameters:
 *       - in: query
 *         name: activo
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filtrar por estado activo (opcional)
 *         example: "true"
 *     responses:
 *       200:
 *         description: Lista de patentes obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_bus:
 *                         type: integer
 *                         example: 1
 *                       patente:
 *                         type: string
 *                         example: "BXJK12"
 *                       activo:
 *                         type: boolean
 *                         example: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Error del servidor
 */
router.get('/buses/patentes', clusterController.listarPatentes);

/**
 * @swagger
 * /api/v1/cluster/buses/{patente}/credenciales:
 *   get:
 *     summary: Obtener credenciales WiFi de un bus
 *     tags: [Clustering]
 *     description: Retorna SSID y contraseña del WiFi configurado en un bus específico
 *     parameters:
 *       - in: path
 *         name: patente
 *         required: true
 *         schema:
 *           type: string
 *         description: Patente del bus
 *         example: "ABC123"
 *     responses:
 *       200:
 *         description: Credenciales obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     ssid:
 *                       type: string
 *                       example: "BUS_WIFI_ABC123"
 *                     password:
 *                       type: string
 *                       example: "Pass1234!"
 *       400:
 *         description: Patente no proporcionada
 *       404:
 *         description: Bus no encontrado o sin credenciales configuradas
 *       500:
 *         description: Error del servidor
 */
router.get('/buses/:patente/credenciales', clusterController.obtenerCredencialesBus);

/**
 * @swagger
 * /api/v1/cluster/patente/{patente}:
 *   get:
 *     summary: Obtener clusters por patente de bus
 *     tags: [Clustering]
 *     description: Obtiene todos los clusters (activos e inactivos) asociados a una patente específica
 *     parameters:
 *       - in: path
 *         name: patente
 *         required: true
 *         schema:
 *           type: string
 *         description: Patente del bus
 *         example: "ABC123"
 *     responses:
 *       200:
 *         description: Clusters obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 2
 *                 data:
 *                   type: object
 *                   properties:
 *                     patente:
 *                       type: string
 *                       example: "ABC123"
 *                     activo:
 *                       type: boolean
 *                       example: true
 *                     clusters:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_cluster:
 *                             type: integer
 *                             example: 1
 *                           latitud_centro:
 *                             type: number
 *                             example: -34.9211
 *                           longitud_centro:
 *                             type: number
 *                             example: -71.2310
 *                           cantidad_usuarios:
 *                             type: integer
 *                             example: 5
 *                           velocidad_promedio:
 *                             type: number
 *                             example: 15.5
 *                           direccion_promedio:
 *                             type: number
 *                             example: 180.0
 *                           id_ruta:
 *                             type: integer
 *                             example: 1
 *                           esta_activo:
 *                             type: boolean
 *                             example: true
 *                           fecha_creacion:
 *                             type: string
 *                             format: date-time
 *                           ultima_actualizacion:
 *                             type: string
 *                             format: date-time
 *                           segundos_sin_actualizar:
 *                             type: number
 *                             example: 120
 *       400:
 *         description: Validación fallida (patente no proporcionada)
 *       404:
 *         description: Patente no encontrada
 *       500:
 *         description: Error del servidor
 */
router.get('/patente/:patente', clusterController.getClusterPorPatente);

/**
 * @swagger
 * /api/v1/cluster/{id}:
 *   get:
 *     summary: Obtener información detallada de un bus
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Información del bus
 *   delete:
 *     summary: Eliminar un cluster por ID
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cluster a eliminar
 *     responses:
 *       200:
 *         description: Cluster eliminado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_cluster:
 *                       type: integer
 *       404:
 *         description: Cluster no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:id', clusterController.getClusterDetalle);
router.delete('/:id', clusterController.deleteCluster);

/**
 * @swagger
 * /api/v1/cluster/{id}/miembros:
 *   get:
 *     summary: Obtener miembros de un bus
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Miembros del bus
 */
router.get('/:id/miembros', clusterController.getClusterMiembros);

/**
 * @swagger
 * /api/v1/cluster/{id}/eventos:
 *   get:
 *     summary: Obtener eventos/reportes de un bus
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 20
 *     responses:
 *       200:
 *         description: Eventos del bus
 */
router.get('/:id/eventos', clusterController.getClusterEventos);

/**
 * @swagger
 * /api/v1/cluster/{id}/calidad:
 *   get:
 *     summary: Obtener calidad de reportes de un bus
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Calidad de reportes
 */
router.get('/:id/calidad', clusterController.getClusterCalidad);

/**
 * @swagger
 * /api/v1/cluster/{id}/velocidad-historial:
 *   get:
 *     summary: Obtener histórico de velocidad de un bus
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Histórico de velocidad
 */
router.get('/:id/velocidad-historial', clusterController.getVelocityHistory);

/**
 * @swagger
 * /api/v1/cluster/buses/inyectar:
 *   post:
 *     summary: Inyectar patente de bus (agregar bus válido a la BD)
 *     tags: [Clustering]
 *     description: Crear una nueva patente válida en la tabla de buses. Solo para administración.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patente
 *             properties:
 *               patente:
 *                 type: string
 *                 example: "BXJK12"
 *                 description: Patente del bus (se convierte a mayúsculas automáticamente)
 *               activo:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Si el bus está activo
 *     responses:
 *       201:
 *         description: Patente inyectada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Patente inyectada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_bus:
 *                       type: integer
 *                       example: 1
 *                     patente:
 *                       type: string
 *                       example: "BXJK12"
 *                     activo:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Validación fallida (patente vacía)
 *       409:
 *         description: Patente ya existe
 *       500:
 *         description: Error del servidor
 */
router.post('/buses/inyectar', clusterController.inyectarPatente);

/**
 * @swagger
 * /api/v1/cluster/crear-por-patente:
 *   post:
 *     summary: Crear cluster por patente validada
 *     tags: [Clustering]
 *     description: Crear un nuevo cluster (bus detectado) usando una patente que ya existe en la BD
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patente
 *               - latitud
 *               - longitud
 *             properties:
 *               patente:
 *                 type: string
 *                 example: "BXJK12"
 *                 description: Patente del bus (debe existir en la tabla buses)
 *               latitud:
 *                 type: number
 *                 example: -34.9211
 *                 description: Latitud del centro del cluster
 *               longitud:
 *                 type: number
 *                 example: -71.2310
 *                 description: Longitud del centro del cluster
 *               id_ruta:
 *                 type: integer
 *                 nullable: true
 *                 example: 1
 *                 description: ID de la ruta (opcional)
 *               velocidad:
 *                 type: number
 *                 example: 15.5
 *                 default: 0
 *                 description: Velocidad promedio en km/h (opcional)
 *     responses:
 *       201:
 *         description: Cluster creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_cluster:
 *                       type: integer
 *                       example: 5
 *                     id_bus:
 *                       type: integer
 *                       example: 1
 *                     patente:
 *                       type: string
 *                       example: "BXJK12"
 *       200:
 *         description: Cluster ya activo para esta patente
 *       400:
 *         description: Validación fallida (parámetros requeridos)
 *       404:
 *         description: Patente no encontrada o inactiva
 *       500:
 *         description: Error del servidor
 */
router.post('/crear-por-patente', clusterController.createClusterPorPatente);

/**
 * @swagger
 * /api/v1/cluster/{id}/eta/{paradero_id}:
 *   get:
 *     summary: Obtener ETA estimada de un bus (cluster) hacia un paradero específico
 *     tags: [Clustering]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del cluster (bus)
 *       - in: path
 *         name: paradero_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del paradero destino
 *     responses:
 *       200:
 *         description: ETA calculada con información completa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id_cluster:
 *                       type: integer
 *                     id_ruta:
 *                       type: integer
 *                       description: ID de la ruta del cluster
 *                     velocidad_kmh:
 *                       type: number
 *                       description: Velocidad en km/h
 *                     distancia_metros:
 *                       type: integer
 *                       description: Distancia al paradero en metros
 *                     eta_seconds:
 *                       type: integer
 *                       description: Tiempo estimado en segundos
 *                     eta_minutos:
 *                       type: integer
 *                       description: Tiempo estimado en minutos
 *                     eta_llegada:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp ISO de llegada estimada
 *                     paradero:
 *                       type: object
 *                       properties:
 *                         id_paradero:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *                         latitud:
 *                           type: number
 *                         longitud:
 *                           type: number
 *       404:
 *         description: Cluster o paradero no encontrado
 */
router.get('/:id/eta/:paradero_id', clusterController.getBusETA);

/**
 * @swagger
 * /api/v1/cluster/debug/cleanup-queue:
 *   get:
 *     summary: 📊 [DEBUG] Ver clusters a punto de ser eliminados
 *     tags: [Clustering]
 *     description: Muestra qué clusters serán eliminados en la próxima limpieza automática. Útil para monitoreo.
 *     parameters:
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *           default: 60
 *         description: Máximo de segundos sin actualizar para mostrar en la cola de eliminación
 *     responses:
 *       200:
 *         description: Lista de clusters a eliminar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 maxAgeSeconds:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 paraEliminar:
 *                   type: integer
 *                   description: Cantidad de clusters listos para eliminar
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_cluster:
 *                         type: integer
 *                       cantidad_usuarios:
 *                         type: integer
 *                       ultima_actualizacion:
 *                         type: string
 *                         format: date-time
 *                       segundos_sin_actualizar:
 *                         type: integer
 *                       estado:
 *                         type: string
 *                         enum: [PARA ELIMINAR, ACTIVO]
 *       500:
 *         description: Error del servidor
 */
router.get('/debug/cleanup-queue', clusterController.getCleanupQueue);

/**
 * @swagger
 * /api/v1/cluster/admin/force-cleanup:
 *   post:
 *     summary: 🧹 [ADMIN] Forzar limpieza inmediata de clusters antiguos
 *     tags: [Clustering]
 *     description: Ejecutar limpieza de clusters AHORA (no esperar próximo intervalo automático). Útil para administración.
 *     parameters:
 *       - in: query
 *         name: maxAge
 *         schema:
 *           type: integer
 *           default: 60
 *         description: Máximo de segundos sin actualizar para considerar un cluster como "antiguo"
 *     responses:
 *       200:
 *         description: Limpieza ejecutada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Limpieza forzada completada"
 *                 deleted:
 *                   type: integer
 *                   example: 5
 *                   description: Cantidad de clusters eliminados
 *                 remainingClusters:
 *                   type: integer
 *                   example: 10
 *                   description: Clusters que aún están activos
 *                 stats:
 *                   type: object
 *                   properties:
 *                     clustersEliminados:
 *                       type: integer
 *                     clustersRestantes:
 *                       type: integer
 *                     maxAgeSeconds:
 *                       type: integer
 *       500:
 *         description: Error del servidor
 */
router.post('/admin/force-cleanup', clusterController.forceClusterCleanup);

module.exports = router;
