# PrecipitaPy - Sistema de Predicción de Precipitaciones

Sistema avanzado de análisis y predicción de precipitaciones para Paraguay, utilizando procesamiento de señales (FFT) y visualización de datos históricos.

## Características Principales

- **Predicción Inteligente**: Combina la Transformada Rápida de Fourier (FFT) con promedios ponderados (priorizando los últimos 10 años) para capturar tendencias climáticas actuales.
- **Visualización Histórica**: Gráficos interactivos con Chart.js que muestran la evolución mensual de los últimos 5 años.
- **Mapa Interactivo**: Localización de estaciones meteorológicas mediante Leaflet.js.
- **Gestión de Estaciones**: ABM completo de estaciones, incluyendo geolocalización mediante clics en el mapa.
- **Importación de Datos**: Procesador de CSV con lógica de "Upsert" para evitar duplicados y normalización de nombres de estaciones.
- **Interfaz Moderna**: Diseño responsivo utilizando Bulma CSS con feedback visual (skeletons) durante la carga.

## Tecnologías Utilizadas

- **Backend**: Python, Flask, SQLAlchemy (SQLite).
- **Procesamiento**: NumPy (FFT), DataProcessor personalizado.
- **Frontend**: JavaScript (Vanilla), Chart.js, Leaflet.js, Bulma CSS.
- **Contenedores**: Docker & Docker Compose.

## Instalación y Uso

### Requisitos
- Python 3.12+
- Pip o Docker

### Ejecución Local
1. Clonar el repositorio.
2. Crear un entorno virtual: `python -m venv .venv`
3. Instalar dependencias: `pip install -r requirements.txt`
4. Ejecutar la aplicación: `python app.py`
5. Acceder a `http://localhost:5002`

### Ejecución con Docker
```bash
docker-compose up --build
```

## Algoritmo de Predicción
El sistema utiliza una combinación de:
1. **FFT**: Para identificar ciclos estacionales (anuales) en la serie temporal.
2. **Promedio Ponderado**: Da un peso de 2.0 a los registros de los últimos 10 años y 1.0 a los anteriores.
3. **Probabilidad Diaria**: Estimación heurística de la probabilidad de lluvia por día basada en el volumen mensual esperado.

---
Desarrollado para el análisis climático y gestión de datos pluviométricos.
