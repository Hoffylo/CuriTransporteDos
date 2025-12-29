// models/modelRutas.js
class Ruta {
  constructor(
    id_ruta,
    nom_ruta, // Ej: 'Millennium Línea 1'
    descripcion = '',
    paraderos = [] // Array de id_paradero en orden
  ) {
    this.id_ruta = id_ruta;
    this.nom_ruta = nom_ruta;
    this.descripcion = descripcion;
    this.paraderos = paraderos; // [{ id_paradero: 1, orden: 1 }, ...]
  }

  // Métodos útiles
  agregarParadero(id_paradero, orden) {
    this.paraderos.push({ id_paradero, orden });
    this.paraderos.sort((a, b) => a.orden - b.orden);
  }

  obtenerParaderosSorted() {
    return this.paraderos.sort((a, b) => a.orden - b.orden);
  }

  proximoParadero(paraderoActual) {
    const idx = this.paraderos.findIndex(p => p.id_paradero === paraderoActual);
    return idx !== -1 && idx < this.paraderos.length - 1
      ? this.paraderos[idx + 1]
      : null;
  }
}

module.exports = Ruta;
