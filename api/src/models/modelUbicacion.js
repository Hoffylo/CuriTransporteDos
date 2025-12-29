// models/modelUbicacion.js
class Ubicacion {
  constructor(
    id_ubicacion,
    id_usuario,
    latitud,
    longitud,
    velocidad = 0,
    tiempo = new Date(),
    en_transito = false, // HU-06: verificar si está en la micro
    id_ruta = null // Si está en transito, qué ruta
  ) {
    this.id_ubicacion = id_ubicacion;
    this.id_usuario = id_usuario;
    this.latitud = latitud;
    this.longitud = longitud;
    this.velocidad = velocidad; // en km/h
    this.tiempo = tiempo;
    this.en_transito = en_transito; // HU-03: ¿Está a bordo?
    this.id_ruta = id_ruta; // Si está en ruta, cuál es
  }

  // Métodos útiles
  obtenerCoordenadas() {
    return { lat: this.latitud, lng: this.longitud };
  }

  // HU-03: Determinar si está en transito (velocidad > 5 km/h)
  estaEnTransito() {
    return this.velocidad > 5;
  }

  // Edad del registro en segundos
  obtenerAntigüedad() {
    return Math.floor((new Date() - this.tiempo) / 1000);
  }

  // HU-12: Verificar si sigue siendo relevante (menos de 30 seg)
  esActual(segundosMax = 30) {
    return this.obtenerAntigüedad() <= segundosMax;
  }
}

module.exports = Ubicacion;
