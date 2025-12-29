const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacionController');
const { verificarToken, esAdmin } = require('../middleware/auth');

/**
 * @swagger
 * tags: [Notificaciones]
 */
router.get('/', verificarToken, notificacionController.getNotificaciones);
router.get('/no-leidas', verificarToken, notificacionController.getNotificacionesNoLeidas);
router.post('/', verificarToken, notificacionController.crearNotificacion);
router.patch('/:id_notificacion/leida', verificarToken, notificacionController.marcarComoLeida);
router.delete('/:id_notificacion', verificarToken, notificacionController.eliminarNotificacion);

module.exports = router;
