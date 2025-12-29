# ETA Debugging Guide

## Problemas Corregidos

### 1. ✅ Cálculo de ETA incorrecto
**Causa**: Se usaba `velocidad_promedio` del cluster que puede estar desactualizada  
**Solución**: Ahora se calcula velocidad promedio en tiempo real de usuarios activos (últimos 30 segundos):
```sql
(SELECT AVG(velocidad)::numeric FROM ubicacion 
 WHERE id_cluster = c.id_cluster 
   AND esta_en_bus = TRUE 
   AND tiempo > NOW() - INTERVAL '30 seconds'
   AND velocidad > 0) AS velocidad_real_promedio
```

### 2. ✅ Cluster con 1 usuario usa velocidad 0
**Causa**: `calculateAverageVelocity([speed])` devolvía 0 cuando había un solo usuario  
**Solución**: Si el cluster tiene 1 usuario, usar directamente su velocidad:
```javascript
if (allPoints.length === 1 && speed > 0) {
  avgVelocity = speed; // usar velocidad del único usuario
}
```

### 3. ✅ Buses de ruta opuesta aparecen
**Causa**: No se filtraba por `sentido_ruta`  
**Solución**: Añadido filtro condicional por sentido:
```sql
WHERE c.esta_activo = TRUE
  AND c.id_ruta = ANY($4::int[])
  AND ST_DWithin(c.geom, $1::geography, $2)
  AND r.sentido_ruta = $6  -- ← NUEVO FILTRO
```

## Outputs de Debugging

### Paradero Controller
```
[PARADERO DEBUG] Paradero 123 pertenece a ruta 5 con sentido true
[PARADERO DEBUG] getProximosBuses: paradero=123, rutas=[5], sentido=true, radio=20000m
[PARADERO DEBUG] Encontrados 2 clusters con ETA para paradero 123
```

### ETA Service
```
[ETA DEBUG] computeEtasForParadero: rutaIds=[5], sentido=true, radio=20000m, limit=3, fallback=15km/h
[ETA DEBUG] SQL params count: 6
[ETA DEBUG] Cluster 45: sentido=true, vel_real=25.5, vel_cluster=20, vel_usar=25.5, dist_along=1200m, dist_recta=980m, eta=169s (3min), pos_cluster=0.45, pos_paradero=0.62
[ETA DEBUG] Retornando 2 clusters con ETA
```

### Cluster Controller
```
[CLUSTER ETA DEBUG] Calculando ETA: cluster=45, paradero=123, ruta=5, vel_cluster=20
[CLUSTER ETA DEBUG] Resultado: dist_along=1200m, dist_total=1200m, vel=25.5km/h, eta=169s (3min)
```

### Cluster Creation
```
🚌 [CLUSTER DEBUG] Cluster con 1 usuario: usando velocidad=22 km/h (no promedio)
```

## Verificación Manual

### 1. Probar endpoint paradero
```bash
curl "http://localhost:3000/api/v1/paraderos/123/proximos-buses?radio=20000&limit=3"
```

Verificar en respuesta:
- ✅ `sentido_ruta` coincide con el paradero
- ✅ `velocidad_promedio` > 0 (no null)
- ✅ `distancia_along_metros` presente
- ✅ `eta_seconds` y `eta_minutos` calculados
- ✅ `pos_rel_cluster` y `pos_rel_paradero` entre 0 y 1

### 2. Probar endpoint cluster ETA
```bash
curl "http://localhost:3000/api/v1/cluster/45/eta/123"
```

Verificar:
- ✅ `distancia_along_metros` presente
- ✅ `eta_seconds` correcto (distancia / velocidad)
- ✅ `eta_llegada` en formato ISO

### 3. Verificar logs del servidor
```bash
# En terminal donde corre npm start
# Buscar líneas con [ETA DEBUG] o [PARADERO DEBUG]
```

## Cálculo ETA Esperado

Fórmula:
```
ETA (segundos) = distancia_metros / (velocidad_kmh * 1000 / 3600)
                = distancia_metros / velocidad_m_s
```

Ejemplo:
- Distancia: 1200m
- Velocidad: 25.5 km/h = 7.083 m/s
- ETA: 1200 / 7.083 = 169s ≈ 3 minutos ✅

## Configuración

Variables de entorno en `.env`:
```bash
FALLBACK_SPEED_KMH=15  # velocidad por defecto si no hay dato
```

## Próximos Pasos

- [ ] Añadir cache de ETAs (5-10 segundos TTL)
- [ ] Websocket para updates en tiempo real
- [ ] Historial de precisión de ETAs
- [ ] Alertas cuando ETA cambia significativamente
