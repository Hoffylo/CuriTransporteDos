// middleware/errorhandler.js
module.exports = (err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Tipos de error
  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';

  // Validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      detalles: err.detalles || err.message,
    });
  }

  // Autenticación
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'No autorizado',
      message,
    });
  }

    // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' });
  }

  // Error de base de datos
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'Base de datos no disponible' });
  }

  // Ruta no encontrada
  if (status === 404) {
    return res.status(404).json({
      error: 'No encontrado',
      message,
    });
  }

  // Error genérico
  res.status(status).json({
    error: 'Error interno',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
