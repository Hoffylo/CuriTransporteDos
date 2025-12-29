// routes/routeBuses.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * @swagger
 * tags:
 *   - name: Buses
 *     description: Operaciones sobre buses
 */

/**
 * @swagger
 * /api/v1/buses/{patente}/credenciales:
 *   get:
 *     summary: Obtener credenciales WiFi de un bus
 *     tags: [Buses]
 *     description: Retorna SSID y contraseña del WiFi configurado en un bus específico por su patente
 *     parameters:
 *       - in: path
 *         name: patente
 *         required: true
 *         schema:
 *           type: string
 *         description: Patente del bus
 *         example: "BXJK12"
 *     responses:
 *       200:
 *         description: Credenciales obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     ssid:
 *                       type: string
 *                       example: "BUS_WIFI_BXJK12"
 *                     password:
 *                       type: string
 *                       example: "DefaultPass123!"
 *       400:
 *         description: Patente no proporcionada
 *       404:
 *         description: Bus no encontrado o sin credenciales configuradas
 *       500:
 *         description: Error del servidor
 */
router.get('/:patente/credenciales', async (req, res) => {
  try {
    const { patente } = req.params;
    
    if (!patente || patente.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro requerido: patente'
      });
    }

    console.log(`🔐 Buscando credenciales WiFi para patente: ${patente.toUpperCase()}`);

    const result = await pool.query(
      'SELECT ssid, password FROM buses WHERE patente = $1 AND activo = true',
      [patente.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ No se encontró bus con patente: ${patente.toUpperCase()}`);
      return res.status(404).json({
        success: false,
        message: 'No se encontraron credenciales para esta patente'
      });
    }
    
    const { ssid, password } = result.rows[0];
    
    if (!ssid || !password) {
      console.log(`⚠️ Bus ${patente.toUpperCase()} no tiene credenciales WiFi configuradas`);
      return res.status(404).json({
        success: false,
        message: 'Este bus no tiene credenciales WiFi configuradas'
      });
    }
    
    console.log(`✅ Credenciales encontradas para ${patente.toUpperCase()}: SSID=${ssid}`);
    
    res.json({
      success: true,
      data: { ssid, password }
    });
    
  } catch (error) {
    console.error('❌ Error al obtener credenciales WiFi:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener credenciales WiFi'
    });
  }
});

module.exports = router;
