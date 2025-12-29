const EtaService = require('../src/services/etaService');
const GeoService = require('../src/services/geoService');

describe('EtaService', () => {
  test('calculateEtaSeconds calcula correctamente', () => {
    // 1000 metros a 36 km/h -> 10 m/s -> 100 segundos
    const secs = EtaService.calculateEtaSeconds(1000, 36);
    expect(secs).toBe(100);
  });

  test('computeEtaForCluster usa distancia along cuando está disponible', async () => {
    const fakePool = {
      query: jest.fn().mockResolvedValue({ rows: [{ distancia_along_metros: '5000' }] })
    };

    const cluster = { id_cluster: 1, latitud_centro: -35.0, longitud_centro: -71.0, velocidad_promedio: 20 };
    const paradero = { latitud: -35.01, longitud: -71.01 };

    const result = await EtaService.computeEtaForCluster(fakePool, 10, cluster, paradero, 15);
    // distancia_along_metros debe ser ~5000
    expect(result.distancia_along_metros).toBeCloseTo(5000);
    // ETA segundos con 20 km/h -> mps = 5.555.. -> 5000/5.555.. = 900s
    expect(result.eta_seconds).toBe(900);
  });

  test('computeEtaForCluster hace fallback a geodesica si along es null', async () => {
    const fakePool = {
      query: jest.fn().mockResolvedValue({ rows: [{ distancia_along_metros: null }] })
    };

    // mockear GeoService.calculateDistance
    const geoSpy = jest.spyOn(GeoService, 'calculateDistance').mockReturnValue(2000);

    const cluster = { id_cluster: 2, latitud_centro: -35.0, longitud_centro: -71.0, velocidad_promedio: 10 };
    const paradero = { latitud: -35.02, longitud: -71.02 };

    const result = await EtaService.computeEtaForCluster(fakePool, 11, cluster, paradero, 15);

    expect(geoSpy).toHaveBeenCalled();
    expect(result.distancia_along_metros).toBeNull();
    expect(result.distancia_metros).toBe(2000);
    // 2000m at 10 km/h -> mps=2.777.. -> secs ≈ 720
    expect(result.eta_seconds).toBe(720);

    geoSpy.mockRestore();
  });
});
