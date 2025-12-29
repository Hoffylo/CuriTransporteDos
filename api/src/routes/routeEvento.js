const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags: [Eventos]
 */
router.get('/', eventoController.getEventos);
router.get('/:id', eventoController.getEventoById);
router.get('/usuario/:id_usuario', eventoController.getEventosUsuario);


module.exports = router;
