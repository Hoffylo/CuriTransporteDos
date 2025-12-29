const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags: [Configuración]
 */
router.get('/', verificarToken, configController.getConfiguracion);
router.patch('/', verificarToken, configController.actualizarConfiguracion);
router.get('/preferencia-datos', verificarToken, configController.getPreferenciaDatos);
router.get('/accesibilidad', verificarToken, configController.getAccesibilidad);

module.exports = router;
