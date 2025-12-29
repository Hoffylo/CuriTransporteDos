// models/modelConfiguracion.js
class ConfiguracionApp {
  constructor(
    id_configuracion,
    id_usuario,
    preferencia_datos = 'normal', // 'normal' | 'bajo' (HU-08: bajo consumo)
    ajustes_accesibilidad = {
      // HU-07: Accesibilidad
      tamano_texto: 'normal', // 'pequeno' | 'normal' | 'grande'
      contraste: 'normal', // 'normal' | 'alto' (AA)
      modo_oscuro: false,
    },
    modo_privacidad = 'publico', // 'publico' | 'anonimo' (HU-09: invitado)
    notificaciones_habilitadas = true,
    compartir_ubicacion = true
  ) {
    this.id_configuracion = id_configuracion;
    this.id_usuario = id_usuario;
    this.preferencia_datos = preferencia_datos;
    this.ajustes_accesibilidad = ajustes_accesibilidad;
    this.modo_privacidad = modo_privacidad;
    this.notificaciones_habilitadas = notificaciones_habilitadas;
    this.compartir_ubicacion = compartir_ubicacion;
  }

  // Métodos útiles
  esModoBajoDatos() {
    return this.preferencia_datos === 'bajo';
  }

  esAnonimo() {
    return this.modo_privacidad === 'anonimo';
  }

  obtenerTamanoTexto() {
    const tamaños = {
      pequeno: 12,
      normal: 14,
      grande: 18,
    };
    return tamaños[this.ajustes_accesibilidad.tamano_texto] || 14;
  }
}

module.exports = ConfiguracionApp;
