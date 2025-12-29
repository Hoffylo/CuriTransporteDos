// models/modelValoracion.js
class Valoracion {
  constructor(
    id_valoracion,
    id_usuario,
    id_ruta,
    puntuacion, // 1-5 estrellas
    comentario = '',
    timestamp = new Date()
  ) {
    this.id_valoracion = id_valoracion;
    this.id_usuario = id_usuario;
    this.id_ruta = id_ruta;
    this.puntuacion = Math.min(5, Math.max(1, puntuacion)); // 1-5
    this.comentario = comentario;
    this.timestamp = timestamp;
  }

  // Métodos útiles
  obtenerEstrellas() {
    return '⭐'.repeat(this.puntuacion);
  }

  esPositiva() {
    return this.puntuacion >= 4;
  }
}

module.exports = Valoracion;
