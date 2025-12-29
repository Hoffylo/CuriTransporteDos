// models/modelEvento.js
class Evento {
  constructor(
    id_evento,
    id_usuario,
    id_tipo_evento,
    descripcion_evento = '',
    timestamp = new Date(),
    latitud = null, // Dónde ocurrió
    longitud = null,
    id_ruta = null
  ) {
    this.id_evento = id_evento;
    this.id_usuario = id_usuario;
    this.id_tipo_evento = id_tipo_evento;
    this.descripcion_evento = descripcion_evento;
    this.timestamp = timestamp;
    this.latitud = latitud;
    this.longitud = longitud;
    this.id_ruta = id_ruta;
  }

  // Métodos útiles
  obtenerTipoEventoNombre() {
    const tipos = {
      1: 'a_bordo',
      2: 'desvio',
      3: 'problema',
      4: 'baje',
      5: 'alerta',
    };
    return tipos[this.id_tipo_evento] || 'desconocido';
  }

  esAlerta() {
    return this.id_tipo_evento === 5;
  }

  obtenerCoordenadas() {
    if (this.latitud && this.longitud) {
      return { lat: this.latitud, lng: this.longitud };
    }
    return null;
  }
}

module.exports = Evento;
