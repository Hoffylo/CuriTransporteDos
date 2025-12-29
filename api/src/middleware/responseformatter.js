// middleware/responseFormatter.js
module.exports = (req, res, next) => {
  res.sendSuccess = (data, status = 200, message = 'Éxito') => {
    res.status(status).json({
      success: true,
      message,
      data,
      timestamp: new Date(),
    });
  };

  res.sendError = (message, status = 400, error = null) => {
    res.status(status).json({
      success: false,
      message,
      error,
      timestamp: new Date(),
    });
  };

  next();
};
