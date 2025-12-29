// controllers/ubicacionController.js
const { ubicaciones, usuarios, eventos } = require('../config/database');

// HU-01, HU-03: Obtener todas las ubicaciones (para mapa)
exports.getUbicaciones = (req, res) => {
  // Retornar solo ubicaciones actuales (últimas 30 segundos)
  const ubicacionesActuales = ubicaciones.filter(u => u.esActual(30));

  res.json(ubicacionesActuales);
};

// HU-12: Obtener ubicaciones por bounding box (para cargar mapa)
exports.getUbicacionesPorBbox = (req, res) => {
  const { minLat, maxLat, minLng, maxLng } = req.query;

  if (!minLat || !maxLat || !minLng || !maxLng) {
    return res.status(400).json({
      error: 'Parámetros requeridos: minLat, maxLat, minLng, maxLng',
    });
  }

  const filtradas = ubicaciones.filter(
    u =>
      u.latitud >= parseFloat(minLat) &&
      u.latitud <= parseFloat(maxLat) &&
      u.longitud >= parseFloat(minLng) &&
      u.longitud <= parseFloat(maxLng)
  );

  res.json(filtradas);
};

// HU-03: Crear/actualizar ubicación (protegido)
exports.crearActualizarUbicacion = (req, res) => {
  const { latitud, longitud, velocidad, en_transito, id_ruta } = req.body;
  const userId = req.user?.id || 1;

  if (!latitud || !longitud) {
    return res
      .status(400)
      .json({ error: 'latitud y longitud son requeridas' });
  }

  // Simular inserción/actualización
  const ubicacion = {
    id_ubicacion: ubicaciones.length + 1,
    id_usuario: userId,
    latitud: parseFloat(latitud),
    longitud: parseFloat(longitud),
    velocidad: parseFloat(velocidad) || 0,
    tiempo: new Date(),
    en_transito: en_transito || false,
    id_ruta: id_ruta || null,
  };

  ubicaciones.push(ubicacion);

  res.status(201).json({
    message: 'Ubicación registrada',
    ubicacion,
  });
};

// HU-06: Obtener usuarios en transito (a bordo)
exports.getUsuariosEnTransito = (req, res) => {
  const { id_ruta } = req.query;

  let usuariosTransito = ubicaciones.filter(u => u.en_transito);

  if (id_ruta) {
    usuariosTransito = usuariosTransito.filter(
      u => u.id_ruta === parseInt(id_ruta)
    );
  }

  const detalles = usuariosTransito.map(u => {
    const usuario = usuarios.find(us => us.id_usuario === u.id_usuario);
    return {
      ...u,
      nombre_usuario: usuario ? usuario.obtenerNombre() : 'Anónimo',
    };
  });

  res.json(detalles);
};

// Obtener ubicaciones de un usuario específico
exports.getUbicacionesUsuario = (req, res) => {
  const { id_usuario } = req.params;
  const ubicacionesUser = ubicaciones.filter(
    u => u.id_usuario === parseInt(id_usuario)
  );

  if (ubicacionesUser.length === 0) {
    return res
      .status(404)
      .json({ error: 'No hay ubicaciones para este usuario' });
  }

  res.json(ubicacionesUser);
};

module.exports = exports;
