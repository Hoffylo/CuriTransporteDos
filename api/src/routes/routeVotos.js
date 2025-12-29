const express = require('express');
const router = express.Router();
const votoController = require('../controllers/votoController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags: [Votos]
 */
router.post('/', verificarToken, votoController.crearVoto);
router.get('/evento/:id_evento', votoController.getVotosPorEvento);
router.get('/usuario/:id_usuario', votoController.getVotosUsuario);

module.exports = router;
