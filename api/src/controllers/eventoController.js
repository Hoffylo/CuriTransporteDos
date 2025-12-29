// controllers/eventoController.js
const { eventos, usuarios } = require('../config/database');

// HU-01, HU-04: Obtener eventos/avisos activos
exports.getEventos = (req, res) => {
  const { id_ruta, tipo } = req.query;

  let eventosFiltered = eventos;

  if (id_ruta) {
    eventosFiltered = eventosFiltered.filter(
      e => e.id_ruta === parseInt(id_ruta)
    );
  }

  if (tipo) {
    eventosFiltered = eventosFiltered.filter(e => e.id_tipo_evento === parseInt(tipo));
  }

  // Incluir info del usuario
  const eventosConUsuario = eventosFiltered.map(e => {
    const usuario = usuarios.find(u => u.id_usuario === e.id_usuario);
    return {
      ...e,
      usuario_nombre: usuario ? usuario.obtenerNombre() : 'Anónimo',
    };
  });

  res.json(eventosConUsuario);
};

// Obtener evento por ID
exports.getEventoById = (req, res) => {
  const evento = eventos.find(e => e.id_evento === parseInt(req.params.id));

  if (!evento) {
    return res.status(404).json({ error: 'Evento no encontrado' });
  }

  const usuario = usuarios.find(u => u.id_usuario === evento.id_usuario);

  res.json({
    ...evento,
    usuario_nombre: usuario ? usuario.obtenerNombre() : 'Anónimo',
  });
};

// HU-04: Crear evento/aviso (protegido)
exports.crearEvento = (req, res) => {
  const {
    id_tipo_evento,
    descripcion_evento,
    latitud,
    longitud,
    id_ruta,
  } = req.body;
  const userId = req.user?.id || 1;

  if (!id_tipo_evento) {
    return res.status(400).json({ error: 'id_tipo_evento requerido' });
  }

  const evento = {
    id_evento: eventos.length + 1,
    id_usuario: userId,
    id_tipo_evento,
    descripcion_evento: descripcion_evento || '',
    timestamp: new Date(),
    latitud: latitud || null,
    longitud: longitud || null,
    id_ruta: id_ruta || null,
  };

  eventos.push(evento);

  res.status(201).json({
    message: 'Evento registrado',
    evento,
  });
};

// Obtener eventos de un usuario
exports.getEventosUsuario = (req, res) => {
  const { id_usuario } = req.params;
  const eventosUser = eventos.filter(
    e => e.id_usuario === parseInt(id_usuario)
  );

  res.json(eventosUser);
};

module.exports = exports;
