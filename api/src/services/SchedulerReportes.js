// src/services/schedulerReportes.js
const cron = require('node-cron');
const Reporte = require('../models/modelReportes');

// Ejecutar cada minuto
function startReportesScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const count = await Reporte.limpiarExpirados();
      if (count > 0) {
        console.log(`[scheduler] ${count} reportes marcados como expirados`);
      }
    } catch (err) {
      console.error('[scheduler] Error limpiando reportes expirados:', err);
    }
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
  });
}

module.exports = { startReportesScheduler };