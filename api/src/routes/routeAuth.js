// routes/routeAuth.js
const express = require('express');
const AuthController = require('../controllers/authController');
const validate = require('../middleware/validator');
const { loginSchema, registroSchema } = require('../validators/authSchemas');
const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login de usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *               - password
 *             properties:
 *               correo:
 *                 type: string
 *                 format: email
 *                 example: "felipe@email.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *               usuario_anonimo_id:
 *                 type: string
 *                 nullable: true
 *                 description: "ID anónimo previo para consolidar datos (prefijo anon_)"
 *                 example: "anon_550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Login exitoso
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
 *                   example: "Login exitoso"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id_usuario:
 *                       type: integer
 *                     nombre:
 *                       type: string
 *                     apellido:
 *                       type: string
 *                     username:
 *                       type: string
 *                     correo:
 *                       type: string
 *                     is_admin:
 *                       type: boolean
 *       400:
 *         description: Error - Correo y contraseña requeridos
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /api/v1/auth/registro:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
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
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "felipe_h"
 *               nombre:
 *                 type: string
 *                 example: "Felipe"
 *               apellido:
 *                 type: string
 *                 example: "Hernández"
 *               correo:
 *                 type: string
 *                 format: email
 *                 example: "felipe@email.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *               usuario_anonimo_id:
 *                 type: string
 *                 nullable: true
 *                 description: "ID anónimo previo para vincular datos (prefijo anon_)"
 *                 example: "anon_550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
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
 *                   example: "Usuario registrado exitosamente"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id_usuario:
 *                       type: integer
 *                     nombre:
 *                       type: string
 *                     apellido:
 *                       type: string
 *                     username:
 *                       type: string
 *                     correo:
 *                       type: string
 *       400:
 *         description: Error en el registro (correo o username duplicado)
 */
router.post('/registro', validate(registroSchema), AuthController.registro);


module.exports = router;
