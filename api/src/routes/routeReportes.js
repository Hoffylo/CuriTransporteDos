// routes/routeReportes.js
const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Reportes
 *     description: Sistema de reportes de incidentes y votación comunitaria
 */

/**
 * @swagger
 * /api/v1/reportes:
 *   post:
 *     summary: Crear nuevo reporte de incidente
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - descripcion
 *               - tipo
 *             properties:
 *               titulo:
 *                 type: string
 *                 example: "Accidente en Calle Principal"
 *               descripcion:
 *                 type: string
 *                 example: "Choque entre dos vehículos"
 *               tipo:
 *                 type: string
 *                 enum: [accidente, cierre_calle, congestion, transito, otro]
 *               latitud:
 *                 type: number
 *                 example: -34.9201
 *               longitud:
 *                 type: number
 *                 example: -71.2355
 *               id_ruta:
 *                 type: integer
 *               id_paradero:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Reporte creado exitosamente
 *       400:
 *         description: Validación fallida
 */
router.post('/', verificarToken, reportesController.crearReporte);

/**
 * @swagger
 * /api/v1/reportes:
 *   get:
 *     summary: Obtener reportes activos con filtros
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *       - in: query
 *         name: id_ruta
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         default: 0
 *     responses:
 *       200:
 *         description: Lista de reportes
 */
router.get('/', reportesController.getReportesActivos);

/**
 * @swagger
 * /api/v1/reportes/cercanos:
 *   get:
 *     summary: Obtener reportes cercanos por geolocalización
 *     tags: [Reportes]
 *     parameters:
 *       - in: query
 *         name: latitud
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitud
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radio
 *         schema:
 *           type: integer
 *         default: 2000
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 10
 *     responses:
 *       200:
 *         description: Reportes cercanos
 */
router.get('/cercanos', reportesController.getReportesCercanos);

/**
 * @swagger
 * /api/v1/reportes/stats/tipos:
 *   get:
 *     summary: Obtener estadísticas por tipo de reporte
 *     tags: [Reportes]
 *     responses:
 *       200:
 *         description: Estadísticas
 */
router.get('/stats/tipos', reportesController.getEstadisticas);

/**
 * @swagger
 * /api/v1/reportes/{id}:
 *   get:
 *     summary: Obtener reporte por ID
 *     tags: [Reportes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reporte encontrado
 *       404:
 *         description: Reporte no encontrado
 */
router.get('/:id', reportesController.getReporteById);

/**
 * @swagger
 * /api/v1/reportes/{id}/votar:
 *   post:
 *     summary: Votar en un reporte (positivo/negativo)
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [positivo, negativo]
 *     responses:
 *       200:
 *         description: Voto registrado
 */
router.post('/:id/votar', verificarToken, reportesController.votarReporte);

/**
 * @swagger
 * /api/v1/reportes/{id}/estado:
 *   put:
 *     summary: Actualizar estado del reporte (ADMIN)
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [activo, resuelto, falso, expirado]
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.put('/:id/estado', verificarToken, esAdmin, reportesController.actualizarEstado);

/**
 * @swagger
 * /api/v1/reportes/{id}:
 *   delete:
 *     summary: Eliminar reporte (ADMIN)
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reporte eliminado
 */
router.delete('/:id', verificarToken, esAdmin, reportesController.eliminarReporte);

module.exports = router;