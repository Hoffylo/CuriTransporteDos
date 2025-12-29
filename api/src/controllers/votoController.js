// controllers/votoController.js
const { votos, eventos } = require('../config/database');

// Crear voto (HU-01, HU-04: validar evento/aviso)
exports.crearVoto = (req, res) => {
  const { id_evento, tipo_voto, comentario } = req.body;
  const userId = req.user?.id || 1;

  if (!id_evento || !tipo_voto) {
    return res.status(400).json({ error: 'id_evento y tipo_voto requeridos' });
  }

  const voto = {
    id_voto: votos.length + 1,
    id_usuario: userId,
    id_evento,
    tipo_voto, // 'util' | 'no_util' | 'falso' | 'verificado'
    timestamp: new Date(),
    comentario: comentario || '',
  };

  votos.push(voto);
  res.status(201).json({ message: 'Voto registrado', voto });
};

// Obtener votos de un evento (para calcular credibilidad)
exports.getVotosPorEvento = (req, res) => {
  const { id_evento } = req.params;

  const votosEvento = votos.filter(v => v.id_evento === parseInt(id_evento));

  // Calcular puntuación total
  const puntuacion = votosEvento.reduce((acc, v) => {
    const pesos = { util: 1, no_util: -1, falso: -2, verificado: 3 };
    return acc + (pesos[v.tipo_voto] || 0);
  }, 0);

  res.json({
    id_evento,
    total_votos: votosEvento.length,
    puntuacion_credibilidad: puntuacion,
    votos: votosEvento,
  });
};

// Listar votos del usuario (para estadísticas personales)
exports.getVotosUsuario = (req, res) => {
  const userId = req.params.id_usuario;
  const votosUser = votos.filter(v => v.id_usuario === parseInt(userId));
  res.json(votosUser);
};

module.exports = exports;
