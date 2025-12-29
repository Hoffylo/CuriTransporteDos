// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware para verificar JWT
 */
const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Token no proporcionado' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded; // Guarda info del usuario en req
        next();
    } catch (error) {
        console.error('❌ Error validando token:', error.message);
        return res.status(403).json({ 
            success: false,
            message: 'Token inválido',
            error: error.message
        });
    }
};

/**
 * Middleware para verificar si es administrador
 */
const esAdmin = (req, res, next) => {
    if (!req.usuario || !req.usuario.is_admin) {
        return res.status(403).json({ 
            success: false,
            message: 'Acceso denegado. Solo administradores' 
        });
    }
    next();
};

/**
 * Generar JWT
 */
const generarToken = (usuario) => {
    console.log('✅ Token generado para:', usuario.username);
    return jwt.sign(
        {
            id_usuario: usuario.id_usuario,
            username: usuario.username,
            correo: usuario.correo,
            is_admin: usuario.is_admin
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

// ✅ Exportar SOLO una vez al final
module.exports = {
    verificarToken,
    esAdmin,
    generarToken
};
