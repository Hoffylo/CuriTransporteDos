// models/modelVoto.js
class Voto {
  constructor(
    id_voto,
    id_usuario, // Usuario que vota
    id_evento, // Evento/reporte que vota
    tipo_voto, // 'util' | 'no_util' | 'falso' | 'verificado'
    timestamp = new Date(),
    comentario = '' // Opcional: razón del voto
  ) {
    this.id_voto = id_voto;
    this.id_usuario = id_usuario;
    this.id_evento = id_evento;
    this.tipo_voto = tipo_voto;
    this.timestamp = timestamp;
    this.comentario = comentario;
  }

  // Métodos útiles
  esVotoPositivo() {
    return this.tipo_voto === 'util' || this.tipo_voto === 'verificado';
  }

  esVotoNegativo() {
    return this.tipo_voto === 'no_util' || this.tipo_voto === 'falso';
  }

  obtenerPeso() {
    // Para cálculo de "credibilidad" del evento
    const pesos = {
      util: 1,
      no_util: -1,
      falso: -2,
      verificado: 3,
    };
    return pesos[this.tipo_voto] || 0;
  }
}

module.exports = Voto;
