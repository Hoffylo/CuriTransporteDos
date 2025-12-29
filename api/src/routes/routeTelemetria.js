// routes/routeTelemetria.js

const express = require('express');
const router = express.Router();
const telemetriaController = require('../controllers/telemetriaController');

/**
 * @swagger
 * tags:
 *   - name: Telemetría
 *     description: Registro y seguimiento de ubicación de usuarios (PÚBLICO)
 */

/**
 * @swagger
 * /api/v1/telemetria/registrar:
 *   post:
 *     summary: Registrar ubicación del usuario (PÚBLICO con validación JWT opcional)
 *     tags: [Telemetría]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Lógica de autenticación:
 *       1. Si hay JWT en header (Authorization: Bearer <token>) → extrae id_usuario del token (usuario registrado)
 *       2. Si NO hay JWT → requiere usuario_id anónimo en body (formato: anon_<UUID>)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitud
 *               - longitud
 *             properties:
 *               usuario_id:
 *                 type: string
 *                 description: "SOLO si NO hay token JWT. Formato: anon_<UUID>"
 *                 example: "anon_550e8400-e29b-41d4-a716-446655440000"
 *               latitud:
 *                 type: number
 *                 example: -34.9201
 *               longitud:
 *                 type: number
 *                 example: -71.2355
 *               velocidad:
 *                 type: number
 *                 description: En km/h
 *                 example: 45.5
 *               precision_metros:
 *                 type: number
 *                 default: 10
 *               direccion:
 *                 type: number
 *                 description: En grados (0-360)
 *               esta_en_bus:
 *                 type: boolean
 *                 description: Si el usuario está en un bus
 *               confirmado_usuario:
 *                 type: boolean
 *               id_ruta:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Ubicación registrada exitosamente
 *       400:
 *         description: Validación fallida (usuario_id inválido, coordenadas inválidas)
 *       403:
 *         description: Token JWT inválido o expirado
 */
router.post('/registrar', telemetriaController.registrarUbicacion);

/**
 * @swagger
 * /api/v1/telemetria/detener:
 *   post:
 *     summary: Detener telemetría y desvincularse del cluster
 *     tags: [Telemetría]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Lógica de autenticación:
 *       1. Si hay JWT en header (Authorization: Bearer <token>) → extrae id_usuario del token
 *       2. Si NO hay JWT → requiere usuario_id anónimo en body (formato: anon_<UUID>)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario_id:
 *                 type: string
 *                 description: "SOLO si NO hay token JWT. Formato: anon_<UUID>"
 *                 example: "anon_550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Telemetría detenida, usuario desvinculado del cluster
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
 *                     usuario_id:
 *                       type: string
 *                     cluster_id:
 *                       type: integer
 *                     cluster_estado:
 *                       type: string
 *                       enum: [eliminado, inactivo, activo]
 *       400:
 *         description: usuario_id faltante o inválido
 *       403:
 *         description: Token JWT inválido o expirado
 */
router.post('/detener', telemetriaController.detenerTelemetria);

/**
 * @swagger
 * /api/v1/telemetria/limpiar-clusters:
 *   post:
 *     summary: Limpiar clusters inactivos (TTL automático)
 *     tags: [Telemetría]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minutos_inactividad:
 *                 type: integer
 *                 default: 10
 *                 description: Minutos sin actividad para considerar cluster inactivo
 *     responses:
 *       200:
 *         description: Limpieza completada
 */
router.post('/limpiar-clusters', telemetriaController.limpiarClustersInactivos);

/**
 * @swagger
 * /api/v1/telemetria/ultima-ubicacion:
 *   get:
 *     summary: Obtener última ubicación (PÚBLICO)
 *     tags: [Telemetría]
 *     responses:
 *       200:
 *         description: Última ubicación
 */
router.get('/ultima-ubicacion', telemetriaController.getUltimaUbicacion);

/**
 * @swagger
 * /api/v1/telemetria/historial:
 *   get:
 *     summary: Obtener historial de ubicaciones (PÚBLICO)
 *     tags: [Telemetría]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Historial de ubicaciones
 */
router.get('/historial', telemetriaController.getHistorialUbicaciones);

/**
 * @swagger
 * /api/v1/telemetria/usuarios-cercanos:
 *   get:
 *     summary: Obtener usuarios cercanos (PÚBLICO)
 *     tags: [Telemetría]
 *     parameters:
 *       - in: query
 *         name: radio
 *         schema:
 *           type: integer
 *           default: 500
 *         description: Radio en metros
 *     responses:
 *       200:
 *         description: Usuarios cercanos
 */
router.get('/usuarios-cercanos', telemetriaController.getUsuariosCercanos);

/**
 * @swagger
 * /api/v1/telemetria/bus-actual:
 *   get:
 *     summary: Obtener información del bus actual (PÚBLICO)
 *     tags: [Telemetría]
 *     responses:
 *       200:
 *         description: Información del bus
 */
router.get('/bus-actual', telemetriaController.getBusActual);

module.exports = router;