# PrecipitaPy - Sistema de Predicción de Precipitaciones

Sistema avanzado de análisis y predicción de precipitaciones para Paraguay, con atención especial a robustez frente a datos ruidosos y eventos extremos.

## Resumen
- Predicción híbrida: FFT + promedio histórico robusto.
- Limpieza y normalización automática de meses y nombres de estaciones al importar CSV.
- Manejo de outliers: winsorización, clipping antes de FFT y ajuste "tail-aware" para eventos extremos.
- APIs REST para predicción, histórico, estacionalidad y validación.

## Características Principales
- **Predicción Robusta**: Combina FFT con un promedio ponderado **robusto** (winsorizado 5–95%) y una mezcla que adapta la influencia de patrones periódicos según la variabilidad de la serie.
- **Ajuste de Eventos Extremos (tail-aware)**: Si en los datos históricos existen eventos extremos (por ejemplo >200 mm o por encima del percentil 95), el modelo puede aumentar la estimación para reducir la subestimación sistemática en eventos fuertes.
- **Normalización de Meses**: Existe una única lista de meses (`MESES_LISTA`) y una función `canonicalizar_mes` que acepta nombres, abreviaturas (3 letras) o números (1–12). El importador normaliza los meses y descarta filas con meses no reconocidos (se registra un warning).
- **Visualización Histórica**: Gráficos interactivos con Chart.js (histórico, estacionalidad, validación).
- **Mapa Interactivo**: Localización y gestión de estaciones con Leaflet.js.
- **Importación Inteligente (upsert)**: `importar_csv` hace upsert por `(mes, anho, ubicacion)` y crea estaciones cuando no existen.

## Esquema y API pública (funciones principales en `data_processor.py`)
- `MESES_LISTA`: constante con los 12 meses en orden canónico.
- `MESES_MAP`: mapeo mes → número.
- `canonicalizar_mes(mes)`: normaliza entradas de mes (número, nombre, abreviatura) y devuelve el valor canónico o `None`.
- `normalizar_nombre(nombre)`: normaliza nombres (quita acentos y caracteres, pasa a minúsculas) para comparar ubicaciones/estaciones.
- `importar_csv(file_path)`: importa CSV (columnas esperadas: `Mes`, `Anho`, `Precipitacion`, `Ubicacion` o `Departamento`) — normaliza `Mes` y hace upsert en la BD.
- `poblar_estaciones()`: crea `Estacion` basándose en ubicaciones encontradas en la tabla `Precipitacion`.
- `obtener_serie_temporal(ubicacion, hasta_anho=None)`: devuelve la serie mensual continua (con imputación por promedio del mes cuando faltan valores) para uso en FFT.
- `predecir_precipitacion(mes, anho, ubicacion)`: devuelve `(promedio, probabilidad, intensidad, emoji)` — integra promedio robusto, FFT, clipping y ajuste tail-aware.
- `contrastar_prediccion(mes, anho, ubicacion, prediccion_valor)`: busca valor real en BD y devuelve `(valor_real, error)` si existe.

## Formato CSV aceptado
- Columnas mínimas: `Mes`, `Anho`, `Precipitacion`, `Ubicacion` (o `Departamento` como alternativa).
- `Mes` puede ser: `Enero`, `enero`, `ENE`, `1`, `01` — se canonicaliza.
- `Precipitacion` acepta separador `,` o `.` (ej. `12,3` o `12.3`). Valores `-` se interpretan como missing.
- Filas con `Mes` no reconocible se ignoran y se loguea una advertencia.

## Manejo de outliers y robustez (detalles técnicos)
- Antes de calcular promedios históricos se aplica **winsorización** (percentiles por defecto 5–95) para reducir el efecto de outliers aislados.
- Antes de la FFT la serie es **clipped** (1–99 percentiles) para evitar que picos extremos dominen las frecuencias.
- El peso de la componente FFT se adapta según la cantidad de observaciones reconstruidas por mes y la **coeficiente de variación** (CV) de la serie — si la serie es muy variable se reduce el peso de la FFT.
- Si existen eventos extremos (umbral práctico 200 mm o > p95), se aplica un ajuste **tail-aware** que mezcla la predicción base con la media de eventos extremos, aumentando la estimación en proporción a la frecuencia y recencia de tales eventos.
- Todas las acciones relevantes (winsorización, clipping, ajustes tail-aware) se registran mediante `logger` para auditoría y calibración.

## Comandos y utilidades útiles
- Inicializar BD y cargar CSV:
```bash
python init_db.py
# o subir un CSV desde la interfaz web
```
- Normalizar los meses que ya están en la BD (script rápido, ejecutar desde shell de Python con app context o crear un archivo `scripts/normalize_months.py`):
```py
from data_processor import canonicalizar_mes
from models import Precipitacion, db

for p in Precipitacion.query.all():
    mes_can = canonicalizar_mes(p.mes)
    if mes_can and p.mes != mes_can:
        p.mes = mes_can
db.session.commit()
```
- Para activar logs informativos (desarrollo), configurar el logger de Flask/Python a nivel `INFO`.

## Validación y QA
- Existe un endpoint de validación (`/api/validacion`) que devuelve pares (real, predicho) y métricas (RMSE, R²) para un mes/ubicación sobre los últimos 5 años.
- Recomendación: ejecutar validación por deciles o por rango (>200 mm) para verificar mejoras en colas tras ajustar los parámetros de winsorización y `tail_boost`.
