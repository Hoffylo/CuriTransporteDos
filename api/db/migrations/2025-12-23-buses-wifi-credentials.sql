-- Migración: Agregar credenciales WiFi a la tabla buses
-- Fecha: 2025-12-23
-- Descripción: Agrega columnas ssid y password para almacenar credenciales WiFi de cada bus

-- Agregar columnas para credenciales WiFi
ALTER TABLE buses 
ADD COLUMN ssid VARCHAR(50),
ADD COLUMN password VARCHAR(100);

-- Crear índice en patente para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_buses_patente ON buses(patente);

-- Ejemplo de cómo agregar credenciales a buses existentes:
-- UPDATE buses SET ssid = 'BUS_WIFI_ABC123', password = 'Pass1234!' WHERE patente = 'ABC123';
-- UPDATE buses SET ssid = 'BUS_WIFI_XYZ789', password = 'Secure456!' WHERE patente = 'XYZ789';

-- Para agregar credenciales a todos los buses de forma masiva:
-- UPDATE buses SET ssid = CONCAT('BUS_WIFI_', patente), password = 'DefaultPass123!' WHERE activo = true;

COMMENT ON COLUMN buses.ssid IS 'SSID de la red WiFi del bus';
COMMENT ON COLUMN buses.password IS 'Contraseña de la red WiFi del bus';
