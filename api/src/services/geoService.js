// src/services/geoService.js

const geolib = require('geolib');

class GeoService {
  // DISTANCIA Y PROXIMIDAD

  /**
   * Calcular distancia entre dos coordenadas (metros)
   * Usa la fórmula de Haversine
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const distance = geolib.getDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    );
    return distance; // En metros
  }

  /**
   * Calcular distancia en kilómetros
   */
  static calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const meters = this.calculateDistance(lat1, lon1, lat2, lon2);
    return (meters / 1000).toFixed(2);
  }

  /**
   * Verificar si dos puntos están dentro de un radio
   */
  static isWithinRadius(lat1, lon1, lat2, lon2, radiusMeters) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    return distance <= radiusMeters;
  }

  // PUNTOS Y POLÍGONOS

  /**
   * Calcular centro geométrico de múltiples puntos
   */
  static calculateCenter(points) {
    if (points.length === 0) return null;

    const center = geolib.getCenter(
      points.map(p => ({
        latitude: p.latitud || p.latitude,
        longitude: p.longitud || p.longitude
      }))
    );

    return {
      latitude: center.latitude,
      longitude: center.longitude
    };
  }

  /**
   * Crear bounding box (rectángulo) alrededor de puntos
   */
  static calculateBoundingBox(points) {
    if (points.length === 0) return null;

    const bounds = geolib.getBounds(
      points.map(p => ({
        latitude: p.latitud || p.latitude,
        longitude: p.longitud || p.longitude
      }))
    );

    return {
      north: bounds.latitude[1],
      south: bounds.latitude[0],
      east: bounds.longitude[1],
      west: bounds.longitude[0]
    };
  }

  /**
   * Crear círculo alrededor de un punto
   * Retorna puntos en el perímetro del círculo
   */
  static createCircle(centerLat, centerLon, radiusMeters, points = 8) {
    const circle = [];

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * (2 * Math.PI);
      const lat = centerLat + (radiusMeters / 111000) * Math.cos(angle);
      const lon = centerLon + (radiusMeters / (111000 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle);

      circle.push({
        latitude: lat,
        longitude: lon
      });
    }

    return circle;
  }

  /**
   * Verificar si un punto está dentro de un polígono
   */
  static isPointInPolygon(point, polygon) {
    const lat = point.latitude || point.latitud;
    const lon = point.longitude || point.longitud;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;

      const intersect = ((yi > lon) !== (yj > lon)) &&
        (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  }

  // DIRECCIÓN Y BRÚJULA

  /**
   * Calcular bearing (dirección en grados) entre dos puntos
   * 0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste
   */
  static calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const toDeg = (x) => (x * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));

    // Normalizar a 0-360
    bearing = (bearing + 360) % 360;

    return Math.round(bearing);
  }

  /**
   * Obtener dirección cardinal desde bearing (0-360)
   */
  static getBearingName(bearing) {
    const directions = [
      'N',    // 0°
      'NNE',  // 22.5°
      'NE',   // 45°
      'ENE',  // 67.5°
      'E',    // 90°
      'ESE',  // 112.5°
      'SE',   // 135°
      'SSE',  // 157.5°
      'S',    // 180°
      'SSO',  // 202.5°
      'SO',   // 225°
      'OSO',  // 247.5°
      'O',    // 270°
      'ONO',  // 292.5°
      'NO',   // 315°
      'NNO'   // 337.5°
    ];

    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  }

  /**
   * Calcular dirección promedio entre múltiples bearings
   * Maneja correctamente valores circulares (0° ≈ 360°)
   */
  static calculateAverageBearing(bearings) {
    if (bearings.length === 0) return 0;

    const toRad = (x) => (x * Math.PI) / 180;
    const toDeg = (x) => (x * 180) / Math.PI;

    let sinSum = 0;
    let cosSum = 0;

    for (const bearing of bearings) {
      sinSum += Math.sin(toRad(bearing));
      cosSum += Math.cos(toRad(bearing));
    }

    let avgBearing = toDeg(Math.atan2(sinSum / bearings.length, cosSum / bearings.length));

    // Normalizar a 0-360
    avgBearing = (avgBearing + 360) % 360;

    return Math.round(avgBearing);
  }

  // VELOCIDAD Y MOVIMIENTO

  /**
   * Calcular velocidad entre dos puntos
   * lat1, lon1, lat2, lon2: coordenadas
   * time1, time2: timestamps en segundos
   * Retorna velocidad en km/h
   */
  static calculateSpeed(lat1, lon1, lat2, lon2, time1, time2) {
    const distanceMeters = this.calculateDistance(lat1, lon1, lat2, lon2);

    const distanceKm = distanceMeters / 1000;
  }

  /**
   * Detectar si usuario está estacionado (velocidad < threshold)
   */
  static isStationary(speed, thresholdKmh = 1) {
    return speed < thresholdKmh;
  }

  /**
   * Detectar si usuario está acelerando, desacelerando o manteniendo velocidad
   */
  static getSpeedTrend(previousSpeed, currentSpeed) {
    const diff = currentSpeed - previousSpeed;
    const threshold = 2; // km/h

    if (Math.abs(diff) < threshold) {
      return 'estable';
    } else if (diff > threshold) {
      return 'acelerando';
    } else {
      return 'desacelerando';
    }
  }

  // ÁREA Y COBERTURA

  /**
   * Calcular área de un polígono (en km²)
   */
  static calculatePolygonArea(points) {
    if (points.length < 3) return 0;

    const area = geolib.getAreaOfPolygon(
      points.map(p => ({
        latitude: p.latitud || p.latitude,
        longitude: p.longitud || p.longitude
      }))
    );

    return (area / 1e6).toFixed(2); // Convertir m² a km²
  }

  /**
   * Obtener puntos dentro de un radio desde un punto central
   */
  static getPointsInRadius(centerLat, centerLon, points, radiusMeters) {
    return points.filter(point => {
      const distance = this.calculateDistance(
        centerLat,
        centerLon,
        point.latitud || point.latitude,
        point.longitud || point.longitude
      );

      return distance <= radiusMeters;
    });
  }

  /**
   * Ordenar puntos por distancia desde un punto central (más cercano primero)
   */
  static sortPointsByDistance(centerLat, centerLon, points) {
    return points.sort((a, b) => {
      const distA = this.calculateDistance(
        centerLat,
        centerLon,
        a.latitud || a.latitude,
        a.longitud || a.longitude
      );

      const distB = this.calculateDistance(
        centerLat,
        centerLon,
        b.latitud || b.latitude,
        b.longitud || b.longitude
      );

      return distA - distB;
    });
  }

  // RUTAS Y TRAYECTORIAS

  /**
   * Simplificar ruta eliminando puntos innecesarios (algoritmo Ramer-Douglas-Peucker)
   * Útil para reducir datos cuando hay muchos puntos GPS
   */
  static simplifyRoute(points, tolerance = 10) {
    if (points.length < 3) return points;

    const toLatLon = (p) => ({
      latitude: p.latitud || p.latitude,
      longitude: p.longitud || p.longitude
    });

    // Implementar RDP simplificado
    const firstPoint = toLatLon(points[0]);
    const lastPoint = toLatLon(points[points.length - 1]);

    let maxDistance = 0;
    let maxIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const point = toLatLon(points[i]);
      const distance = this.perpendicularDistance(point, firstPoint, lastPoint);

      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance) {
      const leftPoints = this.simplifyRoute(
        points.slice(0, maxIndex + 1),
        tolerance
      );

      const rightPoints = this.simplifyRoute(
        points.slice(maxIndex),
        tolerance
      );

      return [...leftPoints.slice(0, -1), ...rightPoints];
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * Calcular distancia perpendicular desde un punto a una línea
   */
  static perpendicularDistance(point, lineStart, lineEnd) {
    const lat1 = lineStart.latitude;
    const lon1 = lineStart.longitude;
    const lat2 = lineEnd.latitude;
    const lon2 = lineEnd.longitude;
    const lat = point.latitude;
    const lon = point.longitude;

    const num = Math.abs(
      (lat2 - lat1) * lon - (lon2 - lon1) * lat + lon2 * lat1 - lat2 * lon1
    );

    const den = Math.sqrt(
      Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)
    );

    return num / den;
  }

  /**
   * Calcular distancia total de una ruta (suma de segmentos)
   */
  static calculateRouteDistance(points) {
    if (points.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.calculateDistance(
        points[i].latitud || points[i].latitude,
        points[i].longitud || points[i].longitude,
        points[i + 1].latitud || points[i + 1].latitude,
        points[i + 1].longitud || points[i + 1].longitude
      );

      totalDistance += distance;
    }

    return totalDistance;
  }

  /**
   * Calcular duración y distancia promedio de una ruta
   */
  static getRouteStats(points, speeds) {
    const distance = this.calculateRouteDistance(points);
    const avgSpeed = speeds.length > 0
      ? (speeds.reduce((a, b) => a + b, 0) / speeds.length)
      : 0;

    const timeMinutes = avgSpeed > 0
      ? Math.ceil((distance / 1000) / avgSpeed * 60)
      : 0;

    return {
      distanceMeters: Math.round(distance),
      distanceKm: (distance / 1000).toFixed(2),
      timeMinutes,
      avgSpeedKmh: avgSpeed.toFixed(2)
    };
  }

  // DETECCIÓN DE ANOMALÍAS
  /**
   * Detectar saltos sospechosos en ubicación (posible error GPS)
   */
  static detectLocationJump(lat1, lon1, lat2, lon2, speed, timeSeconds) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2);
    const maxExpectedDistance = (speed * 3.6) * (timeSeconds / 3600) * 1.5; // 50% de margen

    return distance > maxExpectedDistance;
  }

  /**
   * Detectar si la velocidad es anómalamente alta (>200 km/h = probablemente error)
   */
  static isUnrealisticSpeed(speedKmh, maxSpeed = 200) {
    return speedKmh > maxSpeed;
  }

  /**
   * Filtrar puntos GPS ruidosos
   * Compara con vecinos para detectar outliers
   */
  static filterGPSNoise(points, tolerance = 50) {
    if (points.length < 3) return points;

    const filtered = [];

    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1) {
        filtered.push(points[i]);
        continue;
      }

      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const distPrev = this.calculateDistance(
        prev.latitud || prev.latitude,
        prev.longitud || prev.longitude,
        curr.latitud || curr.latitude,
        curr.longitud || curr.longitude
      );

      const distNext = this.calculateDistance(
        curr.latitud || curr.latitude,
        curr.longitud || curr.longitude,
        next.latitud || next.latitude,
        next.longitud || next.longitude
      );

      // Si las distancias son similares, el punto es válido
      if (Math.abs(distPrev - distNext) < tolerance) {
        filtered.push(curr);
      }
    }

    return filtered;
  }

  // FORMATO Y CONVERSIÓN

  /**
   * Convertir coordenadas a formato legible
   */
  static formatCoordinates(latitude, longitude, decimals = 4) {
    return `${latitude.toFixed(decimals)}, ${longitude.toFixed(decimals)}`;
  }

  /**
   * Convertir velocidad m/s a km/h
   */
  static msToKmh(ms) {
    return (ms * 3.6).toFixed(2);
  }

  /**
   * Convertir velocidad km/h a m/s
   */
  static kmhToMs(kmh) {
    return (kmh / 3.6).toFixed(2);
  }

  /**
   * Convertir radianes a grados
   */
  static radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
  }

  /**
   * Convertir grados a radianes
   */
  static degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  // BÚSQUEDA BINARIA ESPACIAL

  /**
   * Búsqueda rápida: encontrar N puntos más cercanos (K-Nearest Neighbors)
   */
  static findNearestPoints(centerLat, centerLon, points, k = 5) {
    const withDistance = points.map(p => ({
      ...p,
      distance: this.calculateDistance(
        centerLat,
        centerLon,
        p.latitud || p.latitude,
        p.longitud || p.longitude
      )
    }));

    return withDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map(p => {
        const { distance, ...rest } = p;
        return rest;
      });
  }

  /**
   * Búsqueda en cuadrícula: dividir área en celdas para búsquedas más rápidas
   */
  static gridSearch(points, gridSize = 0.01) {
    const grid = {};

    for (const point of points) {
      const lat = Math.floor((point.latitud || point.latitude) / gridSize) * gridSize;
      const lon = Math.floor((point.longitud || point.longitude) / gridSize) * gridSize;
      const key = `${lat},${lon}`;

      if (!grid[key]) {
        grid[key] = [];
      }

      grid[key].push(point);
    }

    return grid;
  }

  /**
   * Obtener celdas adyacentes (búsqueda más grande)
   */
  static getAdjacentCells(lat, lon, gridSize = 0.01) {
    const cells = [];

    for (let dlat = -1; dlat <= 1; dlat++) {
      for (let dlon = -1; dlon <= 1; dlon++) {
        const cellLat = (Math.floor(lat / gridSize) + dlat) * gridSize;
        const cellLon = (Math.floor(lon / gridSize) + dlon) * gridSize;
        cells.push(`${cellLat},${cellLon}`);
      }
    }

    return cells;
  }
}

module.exports = GeoService;
