// api/src/routes/routeUsuarios.js
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Usuarios
 *     description: Operaciones sobre usuarios
 */

/**
 * @swagger
 * /api/v1/usuarios:
 *   get:
 *     tags: [Usuarios]
 *     summary: Obtener todos los usuarios
 *     description: Retorna lista de usuarios activos
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 */
router.get('/', verificarToken, usuarioController.getUsuarios);

/**
 * @swagger
 * /api/v1/usuarios/{id}:
 *   get:
 *     tags: [Usuarios]
 *     summary: Obtener usuario por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/:id', verificarToken, usuarioController.getUsuarioById);

/**
 * @swagger
 * /api/v1/usuarios:
 *   post:
 *     tags: [Usuarios]
 *     summary: Crear nuevo usuario (Registro)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - nombre
 *               - apellido
 *               - correo
 *               - contrasena
 *             properties:
 *               username:
 *                 type: string
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               correo:
 *                 type: string
 *               contrasena:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       409:
 *         description: Usuario o correo ya existe
 */
router.post('/', usuarioController.crearUsuario);

/**
 * @swagger
 * /api/v1/usuarios/me:
 *   patch:
 *     tags: [Usuarios]
 *     summary: Actualizar perfil del usuario autenticado
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               config_privacidad:
 *                 type: object
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       401:
 *         description: No autorizado
 */
router.patch('/me', verificarToken, usuarioController.actualizarPerfil);

/**
 * @swagger
 * /api/v1/usuarios/{id}/rango:
 *   get:
 *     tags: [Usuarios]
 *     summary: Obtener rango del usuario
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Rango obtenido
 */
router.get('/:id/rango', usuarioController.obtenerRango);

module.exports = router;
