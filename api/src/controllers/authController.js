// controllers/authController.js
const pool = require('../config/database');
const AuthService = require('../services/authService');
require('dotenv').config();

// ════════════════════════════════════════════════════════════════════════════════
// 1️⃣ REGISTRO - Crear nuevo usuario en BD
// ════════════════════════════════════════════════════════════════════════════════

exports.registro = async (req, res) => {
  try {
    const { nombre, apellido, correo, username, password, usuario_anonimo_id } = req.validatedBody || req.body;

    const existeCorreo = await pool.query('SELECT 1 FROM usuarios WHERE correo = $1', [correo]);
    if (existeCorreo.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo ya está registrado' });
    }

    const existeUsername = await pool.query('SELECT 1 FROM usuarios WHERE username = $1', [username]);
    if (existeUsername.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El username ya está registrado' });
    }

    const hashedPassword = await AuthService.hashPassword(password);

    const insertQuery = `
      INSERT INTO usuarios (nombre, apellido, username, correo, contrasena_hash, is_active, is_admin)
      VALUES ($1, $2, $3, $4, $5, true, false)
      RETURNING id_usuario, nombre, apellido, username, correo, is_admin
    `;

    const result = await pool.query(insertQuery, [nombre, apellido, username, correo, hashedPassword]);
    const nuevoUsuario = result.rows[0];

    // Vincular datos anónimos si se incluye usuario_anonimo_id
    if (usuario_anonimo_id && typeof usuario_anonimo_id === 'string' && usuario_anonimo_id.startsWith('anon_')) {
      console.log(`🔄 Consolidando datos anónimos: ${usuario_anonimo_id} → ${nuevoUsuario.id_usuario}`);
      
      // Actualizar ubicaciones
      await pool.query(
        `UPDATE ubicacion
         SET id_usuario = $1, es_registrado = TRUE
         WHERE usuario_anonimo_id = $2`,
        [nuevoUsuario.id_usuario, usuario_anonimo_id]
      );
      
      // Actualizar reportes (si tienes tabla de reportes)
      await pool.query(
        `UPDATE reportes
         SET usuario_id = $1
         WHERE usuario_id = $2`,
        [nuevoUsuario.id_usuario, usuario_anonimo_id]
      ).catch(() => console.log('⚠️  Tabla reportes no existe'));
      
      // Actualizar votos
      await pool.query(
        `UPDATE votos_reportes
         SET usuario_id = $1
         WHERE usuario_id = $2`,
        [nuevoUsuario.id_usuario, usuario_anonimo_id]
      ).catch(() => console.log('⚠️  Tabla votos_reportes no existe'));
      
      console.log(`✅ Consolidación completada para usuario ${nuevoUsuario.id_usuario}`);
    }

    // Generar token JWT
    const token = AuthService.generateToken(
      nuevoUsuario.id_usuario,
      nuevoUsuario.username,
      nuevoUsuario.correo,
      nuevoUsuario.is_admin
    );

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id_usuario: nuevoUsuario.id_usuario,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
        username: nuevoUsuario.username,
        correo: nuevoUsuario.correo
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, error: 'Error en el servidor', details: error.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// 2️⃣ LOGIN - Autenticar usuario y generar JWT
// ════════════════════════════════════════════════════════════════════════════════

exports.login = async (req, res) => {
  try {
    const { correo, password, usuario_anonimo_id } = req.validatedBody || req.body;

    const query = 'SELECT * FROM usuarios WHERE correo = $1';
    const result = await pool.query(query, [correo]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    const usuario = result.rows[0];

    if (!usuario.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Usuario inactivo. Contacta al administrador'
      });
    }

    const passwordValida = await AuthService.comparePassword(password, usuario.contrasena_hash);

    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Consolidar datos anónimos si se incluye usuario_anonimo_id
    if (usuario_anonimo_id && typeof usuario_anonimo_id === 'string' && usuario_anonimo_id.startsWith('anon_')) {
      console.log(`🔄 Consolidando datos anónimos en login: ${usuario_anonimo_id} → ${usuario.id_usuario}`);
      
      await pool.query(
        `UPDATE ubicacion
         SET id_usuario = $1, es_registrado = TRUE
         WHERE usuario_anonimo_id = $2`,
        [usuario.id_usuario, usuario_anonimo_id]
      );
      
      await pool.query(
        `UPDATE reportes SET usuario_id = $1 WHERE usuario_id = $2`,
        [usuario.id_usuario, usuario_anonimo_id]
      ).catch(() => {});
      
      await pool.query(
        `UPDATE votos_reportes SET usuario_id = $1 WHERE usuario_id = $2`,
        [usuario.id_usuario, usuario_anonimo_id]
      ).catch(() => {});
      
      console.log(`✅ Consolidación en login completada`);
    }

    const token = AuthService.generateToken(
      usuario.id_usuario,
      usuario.username,
      usuario.correo,
      usuario.is_admin
    );

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        username: usuario.username,
        correo: usuario.correo,
        is_admin: usuario.is_admin
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      error: 'Error en el servidor',
      details: error.message
    });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// 3️⃣ GET PERFIL - Obtener datos del usuario autenticado
// ════════════════════════════════════════════════════════════════════════════════

exports.getPerfil = async (req, res) => {
  try {
    const id_usuario = req.usuario?.id_usuario;

    if (!id_usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const query = `
      SELECT 
        id_usuario,
        nombre,
        apellido,
        username,
        correo,
        is_admin,
        is_active,
        fecha_registro
      FROM usuarios
      WHERE id_usuario = $1
    `;

    const result = await pool.query(query, [id_usuario]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const usuario = result.rows[0];

    res.status(200).json({
      success: true,
      usuario
    });

  } catch (error) {
    console.error('Error en getPerfil:', error);
    res.status(500).json({
      success: false,
      error: 'Error en el servidor',
      details: error.message
    });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// 4️⃣ LOGOUT (opcional)
// ════════════════════════════════════════════════════════════════════════════════

exports.logout = (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logout exitoso. Descarta el token en el cliente.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error en logout'
    });
  }
};

module.exports = exports;
