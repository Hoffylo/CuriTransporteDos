// api/src/routes/routeParadero.js
const express = require('express');
const router = express.Router();
const paraderoController = require('../controllers/paraderoController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Paraderos
 *     description: Operaciones sobre paraderos y geolocalización
 */

/**
 * @swagger
 * /api/v1/paraderos:
 *   get:
 *     tags: [Paraderos]
 *     summary: Obtener todos los paraderos
 *     description: Retorna lista completa de paraderos en Curicó
 *     responses:
 *       200:
 *         description: Lista de paraderos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                 total:
 *                   type: integer
 */
router.get('/', paraderoController.getParaderos);

/**
 * @swagger
 * /api/v1/paraderos/cercanos:
 *   get:
 *     tags: [Paraderos]
 *     summary: Obtener paraderos cercanos (Geolocalización)
 *     description: Retorna paraderos dentro de un radio especificado usando PostGIS
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *           example: -34.9177
 *         required: true
 *         description: Latitud del usuario
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *           example: -71.2453
 *         required: true
 *         description: Longitud del usuario
 *       - in: query
 *         name: radio
 *         schema:
 *           type: integer
 *           default: 1000
 *           example: 1000
 *         description: Radio de búsqueda en metros
 *     responses:
 *       200:
 *         description: Paraderos cercanos encontrados
 *       400:
 *         description: Parámetros lat y lng requeridos
 */
router.get('/cercanos', paraderoController.getParaderosCercanos);

/** 
 * @swagger
 * /api/v1/paraderos/{id}/estadisticas:
 *   get:
 *     tags: [Paraderos]
 *     summary: Obtener estadísticas de un paradero
 *     description: Retorna eventos recientes y valoraciones promedio
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID del paradero
 *     responses:
 *       200:
 *         description: Estadísticas del paradero
 */
router.get('/:id/estadisticas', paraderoController.getEstadisticasParadero);

/**
 * @swagger
 * /api/v1/paraderos/{id}/proximos-buses:
 *   get:
 *     summary: Obtener próximos buses (top N) y su ETA hacia un paradero
 *     tags: [Paraderos]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del paradero
 *       - in: query
 *         name: radio
 *         schema:
 *           type: integer
 *         description: Radio de búsqueda en metros (por defecto 5000)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Cantidad máxima de buses a devolver (por defecto 3)
 *     responses:
 *       200:
 *         description: Lista de buses con ETA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 paradero:
 *                   type: object
 *                 total:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_cluster:
 *                         type: integer
 *                       distancia_metros:
 *                         type: integer
 *                       velocidad_promedio:
 *                         type: number
 *                       eta_seconds:
 *                         type: integer
 *                       eta_minutos:
 *                         type: integer
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Paradero no encontrado
 */

// ========== RUTAS PROTEGIDAS (POST/PUT/DELETE - Solo Admin) ==========

/**
 * @swagger
 * /api/v1/paraderos:
 *   post:
 *     tags: [Paraderos]
 *     summary: Crear nuevo paradero (Solo Admin)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nom_paradero
 *               - latitud
 *               - longitud
 *             properties:
 *               nom_paradero:
 *                 type: string
 *                 example: "Paradero Central"
 *               latitud:
 *                 type: number
 *                 example: -34.9177
 *               longitud:
 *                 type: number
 *                 example: -71.2453
 *               direccion:
 *                 type: string
 *                 example: "Calle Principal 100"
 *               descripcion:
 *                 type: string
 *                 example: "Parada en el centro de la ciudad"
 *     responses:
 *       201:
 *         description: Paradero creado exitosamente
 *       400:
 *         description: Validación fallida
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Solo administradores pueden crear paraderos
 */
router.post('/', verificarToken, esAdmin, paraderoController.crearParadero);

/**
 * @swagger
 * /api/v1/paraderos/{id}:
 *   put:
 *     tags: [Paraderos]
 *     summary: Editar paradero (Solo Admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID del paradero
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom_paradero:
 *                 type: string
 *               latitud:
 *                 type: number
 *               longitud:
 *                 type: number
 *               direccion:
 *                 type: string
 *               descripcion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paradero actualizado exitosamente
 *       404:
 *         description: Paradero no encontrado
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Solo administradores pueden editar paraderos
 */
router.put('/:id', verificarToken, esAdmin, paraderoController.editarParadero);

/**
 * @swagger
 * /api/v1/paraderos/{id}:
 *   delete:
 *     tags: [Paraderos]
 *     summary: Eliminar paradero (Solo Admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID del paradero
 *     responses:
 *       200:
 *         description: Paradero eliminado exitosamente
 *       404:
 *         description: Paradero no encontrado
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Solo administradores pueden eliminar paraderos
 */
router.delete('/:id', verificarToken, esAdmin, paraderoController.eliminarParadero);

module.exports = router;