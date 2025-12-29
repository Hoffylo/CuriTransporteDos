const express = require('express');
const router = express.Router();
const valoracionController = require('../controllers/valoracionController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags: [Valoraciones]
 */
router.get('/ruta/:id_ruta', valoracionController.getValoracionesRuta);
router.get('/:id_valoracion', valoracionController.getValoracionById);
router.post('/', verificarToken, valoracionController.crearValoracion);

module.exports = router;
