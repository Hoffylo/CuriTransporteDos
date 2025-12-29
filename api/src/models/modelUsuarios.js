// models/modelUsuarios.js

class Usuario {
  constructor(
    id_usuario,
    username,
    nombre,
    apellido,
    correo,
    contrasena_hash,
    fecha_registro = new Date(),
    rango = 0,
    is_admin = false,
    is_active = true,
    correo_verificado = false,
    config_privacidad = {
      compartir_ubicacion: true,
      visible_en_mapa: true,
      notificaciones_push: true,
      compartir_estadisticas: false
    }
  ) {
    this.id_usuario = id_usuario;
    this.username = username; // ✅ NUEVO: username único
    this.nombre = nombre;
    this.apellido = apellido;
    this.correo = correo;
    this.contrasena_hash = contrasena_hash;
    this.fecha_registro = fecha_registro;
    this.rango = rango; // Nivel de credibilidad/reportes
    this.is_admin = is_admin; // ✅ ACTUALIZADO: es booleano
    this.is_active = is_active; // ✅ NUEVO: estado del usuario
    this.correo_verificado = correo_verificado; // ✅ NUEVO: validación de email
    this.config_privacidad = config_privacidad; // ✅ ACTUALIZADO: con más opciones
  }

  // ============================================
  // MÉTODOS ÚTILES
  // ============================================

  /**
   * Verifica si el usuario es administrador
   */
  esAdmin() {
    return this.is_admin === true;
  }

  /**
   * Verifica si el usuario está activo
   */
  estaActivo() {
    return this.is_active === true;
  }

  /**
   * Obtiene el nombre completo (respeta privacidad)
   */
  obtenerNombreCompleto() {
    if (this.config_privacidad.compartir_ubicacion === false) {
      return `${this.username} (Privado)`;
    }
    return `${this.nombre} ${this.apellido}`;
  }

  /**
   * Obtiene el username para mostrar públicamente
   */
  obtenerUsername() {
    return this.username;
  }

  /**
   * Verifica si debe aparecer en el mapa
   */
  debeAparecerEnMapa() {
    return this.is_active && this.config_privacidad.visible_en_mapa;
  }

  /**
   * Verifica si las notificaciones push están habilitadas
   */
  notificacionesHabilitadas() {
    return this.config_privacidad.notificaciones_push;
  }

  /**
   * Valida que el usuario tenga los campos requeridos
   */
  esValido() {
    return (
      this.username &&
      this.nombre &&
      this.apellido &&
      this.correo &&
      this.contrasena_hash &&
      this.rango >= 0 &&
      typeof this.is_admin === 'boolean' &&
      typeof this.is_active === 'boolean' &&
      typeof this.correo_verificado === 'boolean'
    );
  }

  /**
   * Convierte el usuario a objeto JSON (sin contrasena)
   */
  toJSON() {
    return {
      id_usuario: this.id_usuario,
      username: this.username,
      nombre: this.nombre,
      apellido: this.apellido,
      correo: this.correo,
      fecha_registro: this.fecha_registro,
      rango: this.rango,
      is_admin: this.is_admin,
      is_active: this.is_active,
      correo_verificado: this.correo_verificado,
      config_privacidad: this.config_privacidad
    };
  }

  /**
   * Obtiene los datos públicos del usuario (visible para otros usuarios)
   */
  datosPublicos() {
    return {
      id_usuario: this.id_usuario,
      username: this.username,
      nombre: this.nombre,
      apellido: this.apellido,
      rango: this.rango,
      fecha_registro: this.fecha_registro,
      // Solo compartir ubicación si está permitido
      visible_en_mapa: this.config_privacidad.visible_en_mapa
    };
  }
}

module.exports = Usuario;