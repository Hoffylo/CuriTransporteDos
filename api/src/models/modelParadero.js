// models/modelParaderos.js
class Paradero {
  constructor(
    id_paradero,
    nom_paradero,
    latitud, // O geom para PostGIS
    longitud,
    direccion = '',
    descripcion = ''
  ) {
    this.id_paradero = id_paradero;
    this.nom_paradero = nom_paradero;
    this.latitud = latitud;
    this.longitud = longitud;
    this.direccion = direccion;
    this.descripcion = descripcion;
  }

  // Métodos útiles
  obtenerCoordenadas() {
    return { lat: this.latitud, lng: this.longitud };
  }

  // Calcular distancia simple (Haversine)
  distancia(lat, lng) {
    const R = 6371; // Radio Tierra km
    const dLat = ((lat - this.latitud) * Math.PI) / 180;
    const dLng = ((lng - this.longitud) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((this.latitud * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Retorna en metros
  }
}

module.exports = Paradero;
