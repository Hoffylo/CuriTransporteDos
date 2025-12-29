// models/modelNotificacion.js
class Notificacion {
  constructor(
    id_notificacion,
    id_usuario,
    titulo,
    contenido,
    tipo_notificacion = 'info', // 'alerta' | 'info' | 'desvio'
    estado = 'no_leida', // 'leida' | 'no_leida'
    fecha_envio = new Date(),
    relacionado_evento = null // id_evento si es por evento
  ) {
    this.id_notificacion = id_notificacion;
    this.id_usuario = id_usuario;
    this.titulo = titulo;
    this.contenido = contenido;
    this.tipo_notificacion = tipo_notificacion;
    this.estado = estado;
    this.fecha_envio = fecha_envio;
    this.relacionado_evento = relacionado_evento;
  }

  // Métodos útiles
  marcarComoLeida() {
    this.estado = 'leida';
  }

  esAlerta() {
    return this.tipo_notificacion === 'alerta';
  }

  obtenerEdad() {
    return Math.floor((new Date() - this.fecha_envio) / 1000); // segundos
  }
}

module.exports = Notificacion;
