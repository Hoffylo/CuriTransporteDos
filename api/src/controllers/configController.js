// controllers/configController.js
const { configuraciones } = require('../config/database');

// Obtener configuración del usuario (protegido)
exports.getConfiguracion = (req, res) => {
  const userId = req.user?.id || 1;

  const config = configuraciones.find(c => c.id_usuario === userId);

  if (!config) {
    return res.json({
      id_usuario: userId,
      preferencia_datos: 'normal',
      ajustes_accesibilidad: {
        tamano_texto: 'normal',
        contraste: 'normal',
        modo_oscuro: false,
      },
      modo_privacidad: 'publico',
      notificaciones_habilitadas: true,
      compartir_ubicacion: true,
    });
  }

  res.json(config);
};

// Actualizar configuración (protegido)
exports.actualizarConfiguracion = (req, res) => {
  const userId = req.user?.id || 1;
  const {
    preferencia_datos,
    ajustes_accesibilidad,
    modo_privacidad,
    notificaciones_habilitadas,
    compartir_ubicacion,
  } = req.body;

  let config = configuraciones.find(c => c.id_usuario === userId);

  if (!config) {
    // Crear nueva configuración
    config = {
      id_configuracion: configuraciones.length + 1,
      id_usuario: userId,
      preferencia_datos: preferencia_datos || 'normal',
      ajustes_accesibilidad: ajustes_accesibilidad || {
        tamano_texto: 'normal',
        contraste: 'normal',
        modo_oscuro: false,
      },
      modo_privacidad: modo_privacidad || 'publico',
      notificaciones_habilitadas: notificaciones_habilitadas !== false,
      compartir_ubicacion: compartir_ubicacion !== false,
    };
    configuraciones.push(config);
  } else {
    // Actualizar existente
    if (preferencia_datos) config.preferencia_datos = preferencia_datos;
    if (ajustes_accesibilidad)
      config.ajustes_accesibilidad = ajustes_accesibilidad;
    if (modo_privacidad) config.modo_privacidad = modo_privacidad;
    if (notificaciones_habilitadas !== undefined)
      config.notificaciones_habilitadas = notificaciones_habilitadas;
    if (compartir_ubicacion !== undefined)
      config.compartir_ubicacion = compartir_ubicacion;
  }

  res.json({
    message: 'Configuración actualizada',
    config,
  });
};

// Obtener preferencia de datos (HU-08: bajo consumo)
exports.getPreferenciaDatos = (req, res) => {
  const userId = req.user?.id || 1;

  const config = configuraciones.find(c => c.id_usuario === userId);

  res.json({
    id_usuario: userId,
    modo_bajo_datos: config?.esModoBajoDatos() || false,
    prefererencia_datos: config?.preferencia_datos || 'normal',
  });
};

// Obtener accesibilidad (HU-07)
exports.getAccesibilidad = (req, res) => {
  const userId = req.user?.id || 1;

  const config = configuraciones.find(c => c.id_usuario === userId);

  res.json({
    id_usuario: userId,
    ajustes: config?.ajustes_accesibilidad || {
      tamano_texto: 'normal',
      contraste: 'normal',
      modo_oscuro: false,
    },
  });
};

module.exports = exports;
