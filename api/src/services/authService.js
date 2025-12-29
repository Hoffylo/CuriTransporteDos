const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  /**
   * Hashear contraseña
   */
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verificar contraseña
   */
  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generar JWT
   */
  static generateToken(userId, username, correo, isAdmin = false) {
    return jwt.sign(
      { 
        id: userId,
        id_usuario: userId,
        username,
        correo,
        is_admin: isAdmin
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }  // ← Corregido: JWT_EXPIRE (sin S)
    );
  }


  /**
   * Verificar JWT
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Token inválido');
    }
  }

  /**
   * Refresh token
   */
  static async refreshToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET,
        { ignoreExpiration: true } // Permitir tokens expirados
      );

      // Si pasaron menos de 7 días, generar nuevo token
      if (decoded.exp - Math.floor(Date.now() / 1000) > -604800) { // 7 días en segundos
        return this.generateToken(decoded.id_usuario, decoded.username, decoded.correo, decoded.is_admin);
      }

      throw new Error('Token demasiado antiguo');
    } catch (error) {
      throw new Error('No se puede renovar el token');
    }
  }
}

module.exports = AuthService;
