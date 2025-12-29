// api/src/routes/routeRuta.js
const express = require('express');
const router = express.Router();
const rutaController = require('../controllers/rutaController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Rutas
 *     description: Operaciones sobre rutas de transporte Millennium
 */

// ========== RUTAS PÚBLICAS (GET) ==========

/**
 * @swagger
 * /api/v1/rutas:
 *   get:
 *     tags: [Rutas]
 *     summary: Obtener todas las rutas
 *     description: Retorna lista completa de rutas de buses disponibles
 *     responses:
 *       200:
 *         description: Lista de rutas obtenida exitosamente
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
router.get('/', rutaController.getTodasRutas);

/**
 * @swagger
 * /api/v1/rutas/{id}:
 *   get:
 *     tags: [Rutas]
 *     summary: Obtener ruta con sus paraderos
 *     description: Retorna los detalles de una ruta específica con todos sus paraderos en orden
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID de la ruta
 *     responses:
 *       200:
 *         description: Ruta encontrada con paraderos
 *       404:
 *         description: Ruta no encontrada
 */
router.get('/:id', rutaController.getRutaById);

/**
 * @swagger
 * /api/v1/rutas/{id}/paraderos:
 *   get:
 *     tags: [Rutas]
 *     summary: Obtener paraderos de una ruta
 *     description: Retorna todos los paraderos de una ruta en orden de recorrido
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         example: 1
 *         required: true
 *         description: ID de la ruta
 *     responses:
 *       200:
 *         description: Paraderos de la ruta obtenidos exitosamente
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
 *                       id_paradero:
 *                         type: integer
 *                         example: 1
 *                       nom_paradero:
 *                         type: string
 *                         example: "Terminal Central"
 *                       latitud:
 *                         type: number
 *                         example: -34.9011
 *                       longitud:
 *                         type: number
 *                         example: -71.2310
 *                       direccion:
 *                         type: string
 *                         example: "Calle Principal 123"
 *       404:
 *         description: No hay paraderos para esta ruta
 *       500:
 *         description: Error en el servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Error de base de datos"
 *                 details:
 *                   type: string
 *                   example: "Table 'ruta_paradero' doesn't exist"
 */
router.get('/:id/paraderos', rutaController.getParaderosRuta);
/**
 * @swagger
 * /api/v1/rutas/{id}/proximo/{id_paradero_actual}:
 *   get:
 *     tags: [Rutas]
 *     summary: Obtener próximo paradero en la ruta
 *     description: Retorna el próximo paradero después del paradero actual
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID de la ruta
 *       - in: path
 *         name: id_paradero_actual
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID del paradero actual
 *     responses:
 *       200:
 *         description: Próximo paradero
 *       404:
 *         description: Paradero no está en esta ruta
 */
router.get('/:id/proximo/:id_paradero_actual', rutaController.getProximoParadero);

// ========== RUTAS PROTEGIDAS (POST/PUT/DELETE - Solo Admin) ==========

/**
 * @swagger
 * /api/v1/rutas:
 *   post:
 *     tags: [Rutas]
 *     summary: Crear nueva ruta (Solo Admin)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre_ruta
 *               - parada_inicio
 *               - parada_fin
 *             properties:
 *               nombre_ruta:
 *                 type: string
 *                 example: "Ruta 1 - Centro"
 *               descripcion:
 *                 type: string
 *                 example: "Recorrido por el centro de la ciudad"
 *               parada_inicio:
 *                 type: string
 *                 example: "Terminal"
 *               parada_fin:
 *                 type: string
 *                 example: "San Vicente"
 *               distancia_km:
 *                 type: number
 *                 example: 12.5
 *               tiempo_estimado_minutos:
 *                 type: integer
 *                 example: 45
 *               horario_inicio:
 *                 type: string
 *                 format: time
 *                 example: "06:00"
 *               horario_fin:
 *                 type: string
 *                 format: time
 *                 example: "22:00"
 *     responses:
 *       201:
 *         description: Ruta creada exitosamente
 *       400:
 *         description: Validación fallida
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Solo administradores pueden crear rutas
 */
router.post('/', verificarToken, esAdmin, rutaController.crearRuta);

/**
 * @swagger
 * /api/v1/rutas/{id}:
 *   put:
 *     tags: [Rutas]
 *     summary: Editar ruta (Solo Admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID de la ruta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre_ruta:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               parada_inicio:
 *                 type: string
 *               parada_fin:
 *                 type: string
 *               distancia_km:
 *                 type: number
 *               tiempo_estimado_minutos:
 *                 type: integer
 *               horario_inicio:
 *                 type: string
 *               horario_fin:
 *                 type: string
 *               activa:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ruta actualizada exitosamente
 *       404:
 *         description: Ruta no encontrada
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Solo administradores pueden editar rutas
 */
router.put('/:id', verificarToken, esAdmin, rutaController.editarRuta);

/**
 * @swagger
 * /api/v1/rutas/{id}:
 *   delete:
 *     tags: [Rutas]
 *     summary: Eliminar ruta (Solo Admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *           example: 1
 *         required: true
 *         description: ID de la ruta
 *     responses:
 *       200:
 *         description: Ruta eliminada exitosamente
 *       404:
 *         description: Ruta no encontrada
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Solo administradores pueden eliminar rutas
 */
router.delete('/:id', verificarToken, esAdmin, rutaController.eliminarRuta);

module.exports = router;