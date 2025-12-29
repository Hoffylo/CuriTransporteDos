// controllers/notificacionController.js
const { notificaciones, usuarios } = require('../config/database');

// Obtener notificaciones del usuario (protegido)
exports.getNotificaciones = (req, res) => {
  const userId = req.user?.id || 1;
  const { estado } = req.query;

  let notificacionesUser = notificaciones.filter(
    n => n.id_usuario === userId
  );

  if (estado) {
    notificacionesUser = notificacionesUser.filter(
      n => n.estado === estado
    );
  }

  res.json(notificacionesUser);
};

// Obtener notificaciones no leídas
exports.getNotificacionesNoLeidas = (req, res) => {
  const userId = req.user?.id || 1;

  const noLeidas = notificaciones.filter(
    n => n.id_usuario === userId && n.estado === 'no_leida'
  );

  res.json({
    total_no_leidas: noLeidas.length,
    notificaciones: noLeidas,
  });
};

// Marcar notificación como leída
exports.marcarComoLeida = (req, res) => {
  const { id_notificacion } = req.params;

  const notificacion = notificaciones.find(
    n => n.id_notificacion === parseInt(id_notificacion)
  );

  if (!notificacion) {
    return res.status(404).json({ error: 'Notificación no encontrada' });
  }

  notificacion.marcarComoLeida();

  res.json({
    message: 'Notificación marcada como leída',
    notificacion,
  });
};

// Crear notificación (para admin/sistema)
exports.crearNotificacion = (req, res) => {
  const {
    id_usuario,
    titulo,
    contenido,
    tipo_notificacion,
    relacionado_evento,
  } = req.body;

  if (!id_usuario || !titulo || !contenido) {
    return res.status(400).json({
      error: 'id_usuario, titulo y contenido son requeridos',
    });
  }

  const notificacion = {
    id_notificacion: notificaciones.length + 1,
    id_usuario,
    titulo,
    contenido,
    tipo_notificacion: tipo_notificacion || 'info',
    estado: 'no_leida',
    fecha_envio: new Date(),
    relacionado_evento: relacionado_evento || null,
  };

  notificaciones.push(notificacion);

  res.status(201).json({
    message: 'Notificación creada',
    notificacion,
  });
};

// Eliminar notificación
exports.eliminarNotificacion = (req, res) => {
  const { id_notificacion } = req.params;

  const idx = notificaciones.findIndex(
    n => n.id_notificacion === parseInt(id_notificacion)
  );

  if (idx === -1) {
    return res.status(404).json({ error: 'Notificación no encontrada' });
  }

  const eliminada = notificaciones.splice(idx, 1);

  res.json({
    message: 'Notificación eliminada',
    notificacion: eliminada[0],
  });
};

module.exports = exports;
