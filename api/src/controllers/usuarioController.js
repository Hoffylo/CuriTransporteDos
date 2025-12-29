// api/src/controllers/usuarioController.js
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ════════════════════════════════════════════════════════════════
// GET: Obtener todos los usuarios
// ════════════════════════════════════════════════════════════════
exports.getUsuarios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_usuario, username, nombre, apellido, correo, rango, is_admin, is_active,
       fecha_registro FROM usuarios WHERE is_active = TRUE ORDER BY fecha_registro DESC`
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    console.error('Error obteniendo usuarios:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo usuarios',
      details: err.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// GET: Obtener usuario por ID
// ════════════════════════════════════════════════════════════════
exports.getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id_usuario, username, nombre, apellido, correo, rango, is_admin,
       is_active, fecha_registro, config_privacidad
       FROM usuarios WHERE id_usuario = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error obteniendo usuario:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo usuario',
      details: err.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// POST: Crear nuevo usuario (REGISTRO)
// ════════════════════════════════════════════════════════════════
exports.crearUsuario = async (req, res) => {
  try {
    const { username, nombre, apellido, correo, contrasena } = req.body;

    // Validaciones básicas
    if (!username || !nombre || !apellido || !correo || !contrasena) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos',
        required: ['username', 'nombre', 'apellido', 'correo', 'contrasena'],
      });
    }

    // Verificar si el usuario o correo ya existe
    const existingUser = await pool.query(
      'SELECT id_usuario FROM usuarios WHERE username = $1 OR correo = $2',
      [username, correo]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Usuario o correo ya existe',
      });
    }

    // Encriptar contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const contrasena_hash = await bcrypt.hash(contrasena, salt);

    // Insertar en BD
    const result = await pool.query(
      `INSERT INTO usuarios (username, nombre, apellido, correo, contrasena_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_usuario, username, nombre, apellido, correo, fecha_registro`,
      [username, nombre, apellido, correo, contrasena_hash]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error creando usuario:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error creando usuario',
      details: err.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// PATCH: Actualizar perfil del usuario
// ════════════════════════════════════════════════════════════════
exports.actualizarPerfil = async (req, res) => {
  try {
    const userId = req.user?.id; // Del JWT middleware
    const { nombre, apellido, config_privacidad } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }

    // Construir query dinámico
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (nombre) {
      updateFields.push(`nombre = $${paramCount}`);
      values.push(nombre);
      paramCount++;
    }

    if (apellido) {
      updateFields.push(`apellido = $${paramCount}`);
      values.push(apellido);
      paramCount++;
    }

    if (config_privacidad) {
      updateFields.push(`config_privacidad = $${paramCount}`);
      values.push(JSON.stringify(config_privacidad));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar',
      });
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id_usuario = $${paramCount}
       RETURNING id_usuario, username, nombre, apellido, correo, config_privacidad`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Error actualizando perfil:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error actualizando perfil',
      details: err.message,
    });
  }
};

// ════════════════════════════════════════════════════════════════
// GET: Obtener rango del usuario
// ════════════════════════════════════════════════════════════════
exports.obtenerRango = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id_usuario, rango, is_admin FROM usuarios WHERE id_usuario = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      data: {
        id_usuario: result.rows[0].id_usuario,
        rango: result.rows[0].rango,
        is_admin: result.rows[0].is_admin,
      },
    });
  } catch (err) {
    console.error('Error obteniendo rango:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo rango',
      details: err.message,
    });
  }
};