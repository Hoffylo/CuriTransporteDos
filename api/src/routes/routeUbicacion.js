const express = require('express');
const router = express.Router();
const ubicacionController = require('../controllers/ubicacionController');
const { verificarToken } = require('../middleware/auth');

/**
 * @swagger
 * tags: [Ubicaciones]
 */
router.get('/', ubicacionController.getUbicaciones);
router.get('/bbox', ubicacionController.getUbicacionesPorBbox);
router.get('/usuario/:id_usuario', ubicacionController.getUbicacionesUsuario);
router.get('/transito', ubicacionController.getUsuariosEnTransito);
router.post('/',  ubicacionController.crearActualizarUbicacion);

module.exports = router;
