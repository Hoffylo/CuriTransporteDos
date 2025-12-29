// controllers/valoracionController.js
const { valoraciones, usuarios, rutas } = require('../config/database');

// Obtener valoraciones de una ruta
exports.getValoracionesRuta = (req, res) => {
  const { id_ruta } = req.params;

  const valoracionesRuta = valoraciones.filter(
    v => v.id_ruta === parseInt(id_ruta)
  );

  if (valoracionesRuta.length === 0) {
    return res.json({
      id_ruta,
      total_valoraciones: 0,
      promedio: 0,
      valoraciones: [],
    });
  }

  const promedio =
    valoracionesRuta.reduce((acc, v) => acc + v.puntuacion, 0) /
    valoracionesRuta.length;

  res.json({
    id_ruta,
    total_valoraciones: valoracionesRuta.length,
    promedio: promedio.toFixed(1),
    distribucion: {
      cinco_estrellas: valoracionesRuta.filter(v => v.puntuacion === 5).length,
      cuatro_estrellas: valoracionesRuta.filter(v => v.puntuacion === 4).length,
      tres_estrellas: valoracionesRuta.filter(v => v.puntuacion === 3).length,
      dos_estrellas: valoracionesRuta.filter(v => v.puntuacion === 2).length,
      una_estrella: valoracionesRuta.filter(v => v.puntuacion === 1).length,
    },
    valoraciones: valoracionesRuta,
  });
};

// Crear valoración (protegido)
exports.crearValoracion = (req, res) => {
  const { id_ruta, puntuacion, comentario } = req.body;
  const userId = req.user?.id || 1;

  if (!id_ruta || !puntuacion) {
    return res.status(400).json({
      error: 'id_ruta y puntuacion son requeridos',
    });
  }

  if (puntuacion < 1 || puntuacion > 5) {
    return res.status(400).json({
      error: 'puntuacion debe estar entre 1 y 5',
    });
  }

  const valoracion = {
    id_valoracion: valoraciones.length + 1,
    id_usuario: userId,
    id_ruta: parseInt(id_ruta),
    puntuacion: parseInt(puntuacion),
    comentario: comentario || '',
    timestamp: new Date(),
  };

  valoraciones.push(valoracion);

  res.status(201).json({
    message: 'Valoración registrada',
    valoracion,
  });
};

// Obtener valoración por ID
exports.getValoracionById = (req, res) => {
  const { id_valoracion } = req.params;

  const valoracion = valoraciones.find(
    v => v.id_valoracion === parseInt(id_valoracion)
  );

  if (!valoracion) {
    return res.status(404).json({ error: 'Valoración no encontrada' });
  }

  res.json(valoracion);
};

module.exports = exports;
