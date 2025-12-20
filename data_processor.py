import csv
import os
from models import db, Precipitacion, Estacion

MESES_MAP = {
    'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4, 'Mayo': 5, 'Junio': 6,
    'Julio': 7, 'Agosto': 8, 'Setiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
}

COORDENADAS_MAP = {
    'Aeropuerto Internacional Guarani': (-25.4542, -54.8431, 'Alto Paraná'),
    'Aeropuerto Internacional Silvio Pettirossi': (-25.2403, -57.5192, 'Central'),
    'Caazapa': (-26.1833, -56.3667, 'Caazapá'),
    'Capitan Meza': (-26.9167, -55.4, 'Itapúa'),
    'Cnel. Oviedo': (-25.45, -56.45, 'Caaguazú'),
    'Concepcion': (-23.4167, -57.4333, 'Concepción'),
    'Encarnacio': (-27.3333, -55.8667, 'Itapúa'),
    'General Bruguez': (-24.75, -58.8333, 'Presidente Hayes'),
    'Mcal. Estigarribia': (-22.0167, -60.6167, 'Boquerón'),
    'Paraguari': (-25.6167, -57.15, 'Paraguarí'),
    'Pedro Juan Caballero': (-22.55, -55.7333, 'Amambay'),
    'Pilar': (-26.8667, -58.3, 'Ñeembucú'),
    'Pozo Colorado': (-23.4833, -58.8, 'Presidente Hayes'),
    'Puerto Casado': (-22.2833, -57.9333, 'Alto Paraguay'),
    'Quyquyho': (-25.9333, -56.9333, 'Paraguarí'),
    'Salto del Guaira': (-24.0667, -54.3, 'Canindeyú'),
    'San Estanislao': (-24.65, -56.4333, 'San Pedro'),
    'San Juan Bautista': (-26.6667, -57.15, 'Misiones'),
    'San Pedro': (-24.0833, -57.0833, 'San Pedro'),
    'Villarrica': (-25.75, -56.4333, 'Guairá')
}

import unicodedata
import re

def normalizar_nombre(nombre):
    """Normaliza un nombre: quita acentos, mayúsculas y caracteres no visibles."""
    if not nombre:
        return ""
    # Quitar acentos y convertir a minúsculas
    nombre = ''.join(c for c in unicodedata.normalize('NFD', nombre)
                     if unicodedata.category(c) != 'Mn').lower()
    # Quitar caracteres no alfanuméricos y espacios extra
    nombre = re.sub(r'[^a-z0-9]', '', nombre)
    return nombre

def buscar_coordenadas(nombre_buscado, depto_default='Desconocido'):
    """Busca coordenadas en COORDENADAS_MAP usando coincidencia parcial de nombres normalizados."""
    norm_buscado = normalizar_nombre(nombre_buscado)
    if not norm_buscado:
        return None, None, depto_default
        
    for key, coords in COORDENADAS_MAP.items():
        norm_key = normalizar_nombre(key)
        if norm_key in norm_buscado or norm_buscado in norm_key:
            return coords
    return None, None, depto_default

def poblar_estaciones():
    """Puebla la tabla de estaciones basándose en las ubicaciones únicas del CSV."""
    ubicaciones = db.session.query(Precipitacion.ubicacion).distinct().all()
    
    # Cache de estaciones existentes
    estaciones_existentes = {normalizar_nombre(e.nombre): e for e in Estacion.query.all()}
    
    for (nombre,) in ubicaciones:
        norm_nombre = normalizar_nombre(nombre)
        if norm_nombre not in estaciones_existentes:
            lat, lng, depto = buscar_coordenadas(nombre)
            estacion = Estacion(
                nombre=nombre,
                latitud=lat,
                longitud=lng,
                departamento=depto
            )
            db.session.add(estacion)
            estaciones_existentes[norm_nombre] = estacion
    db.session.commit()

def importar_csv(file_path):
    """Importa datos desde un archivo CSV a la base de datos."""
    try:
        f = open(file_path, mode='r', encoding='utf-8-sig')
        content = f.read()
        f.close()
    except UnicodeDecodeError:
        f = open(file_path, mode='r', encoding='latin-1')
        content = f.read()
        f.close()

    lines = content.splitlines()
    if not lines:
        return

    # Detectar delimitador (punto y coma, coma o punto)
    first_line = lines[0]
    delimiters = [';', ',']
    delimiter = ',' # Default
    max_count = -1
    
    for d in delimiters:
        count = first_line.count(d)
        if count > max_count:
            max_count = count
            delimiter = d
            
    reader = csv.DictReader(lines, delimiter=delimiter)
    
    # Cache de estaciones y registros existentes (mapeando a objetos para actualización)
    estaciones_existentes = {normalizar_nombre(e.nombre): e for e in Estacion.query.all()}
    registros_existentes = {(p.mes, p.anho, normalizar_nombre(p.ubicacion)): p for p in Precipitacion.query.all()}
    
    for row in reader:
        try:
            row = {k.strip(): v for k, v in row.items()}
            valor_str = row.get('Precipitacion', '0').replace(',', '.')
            valor = float(valor_str) if valor_str != '-' else None
            
            ubicacion_nombre = row.get('Ubicacion') or row.get('Departamento')
            if not ubicacion_nombre:
                continue
            
            ubicacion_nombre = ubicacion_nombre.strip()
            norm_nombre = normalizar_nombre(ubicacion_nombre)
            mes = row['Mes'].strip()
            anho = int(row['Anho'])
            
            # Si el registro ya existe, actualizar el valor
            key = (mes, anho, norm_nombre)
            if key in registros_existentes:
                registros_existentes[key].valor = valor
                continue

            # Si la estación no existe, crearla
            if norm_nombre not in estaciones_existentes:
                lat, lng, depto = buscar_coordenadas(ubicacion_nombre, row.get('Departamento', 'Desconocido').strip())
                nueva_estacion = Estacion(
                    nombre=ubicacion_nombre,
                    latitud=lat,
                    longitud=lng,
                    departamento=depto
                )
                db.session.add(nueva_estacion)
                db.session.flush()
                estaciones_existentes[norm_nombre] = nueva_estacion

            precip = Precipitacion(
                mes=mes,
                anho=anho,
                valor=valor,
                ubicacion=ubicacion_nombre
            )
            db.session.add(precip)
            # Actualizar cache de registros para esta sesión
            registros_existentes[key] = precip
        except (ValueError, KeyError) as e:
            print(f"Error procesando fila: {row} - {e}")
    db.session.commit()

import numpy as np

def obtener_serie_temporal(ubicacion, hasta_anho=None):
    """Obtiene la serie temporal continua de precipitaciones para una ubicación."""
    norm_ubicacion = normalizar_nombre(ubicacion)
    datos = Precipitacion.query.all()
    datos_filtrados = [d for d in datos if normalizar_nombre(d.ubicacion) == norm_ubicacion]
    
    if hasta_anho:
        datos_filtrados = [d for d in datos_filtrados if d.anho < hasta_anho]
        
    if not datos_filtrados:
        return []

    meses_lista = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
    
    # Encontrar rango de años
    anhos = [d.anho for d in datos_filtrados]
    min_anho, max_anho = min(anhos), max(anhos)
    
    # Crear un mapa para búsqueda rápida
    mapa_datos = {(d.anho, d.mes): d.valor for d in datos_filtrados}
    
    serie = []
    for anho in range(min_anho, max_anho + 1):
        for mes in meses_lista:
            valor = mapa_datos.get((anho, mes))
            # Si el valor es None, usamos el promedio del mes para no sesgar la FFT con ceros
            if valor is None:
                valores_mes = [d.valor for d in datos_filtrados if d.mes == mes and d.valor is not None]
                valor = sum(valores_mes) / len(valores_mes) if valores_mes else 0.0
            serie.append(float(valor))
            
    return serie

def predecir_precipitacion(mes, anho, ubicacion):
    """
    Predice la probabilidad de lluvia utilizando promedios ponderados y FFT.
    """
    norm_ubicacion = normalizar_nombre(ubicacion)
    serie = obtener_serie_temporal(ubicacion, hasta_anho=anho)
    
    meses_lista = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
    
    # Obtener datos históricos para el mes, limitados a los 5 años anteriores al año solicitado
    datos_mes = [d for d in Precipitacion.query.all() if normalizar_nombre(d.ubicacion) == norm_ubicacion and d.mes.lower() == mes.lower() and (anho - 5 <= d.anho < anho)]
    
    # Si no hay datos en los últimos 5 años, ampliar la búsqueda a todo lo anterior
    if not datos_mes:
        datos_mes = [d for d in Precipitacion.query.all() if normalizar_nombre(d.ubicacion) == norm_ubicacion and d.mes.lower() == mes.lower() and d.anho < anho]

    if not datos_mes:
        return None, 0.0, "N/A", "❓"

    valores_est = [d.valor for d in datos_mes if d.valor is not None]
    
    # Promedio Ponderado (más peso a los últimos 5 años)
    max_anho = max(d.anho for d in datos_mes)
    pesos_valores = []
    for d in datos_mes:
        if d.valor is not None:
            peso = 2.0 if (max_anho - d.anho) <= 5 else 1.0
            pesos_valores.append((d.valor, peso))
    
    promedio_est = sum(v * p for v, p in pesos_valores) / sum(p for v, p in pesos_valores) if pesos_valores else 0.0

    if not serie or len(serie) < 24:
        promedio = promedio_est
    else:
        # --- Lógica FFT ---
        fft_vals = np.fft.fft(serie)
        fft_filtrada = np.zeros_like(fft_vals)
        fft_filtrada[0] = fft_vals[0] # DC
        
        # Mantener top 10% de componentes o al menos 3
        n_comp = max(3, int(len(serie) * 0.1))
        magnitudes = np.abs(fft_vals)
        indices_picos = np.argsort(magnitudes)[-n_comp:]
        for idx in indices_picos:
            fft_filtrada[idx] = fft_vals[idx]
            
        serie_reconstruida = np.fft.ifft(fft_filtrada).real
        mes_idx = meses_lista.index(mes)
        valores_mes_fft = [serie_reconstruida[i] for i in range(len(serie_reconstruida)) if i % 12 == mes_idx]
        promedio_fft = sum(valores_mes_fft) / len(valores_mes_fft) if valores_mes_fft else serie_reconstruida[-1]
        
        # Combinar 50/50
        promedio = (promedio_fft * 0.5) + (promedio_est * 0.5)

    # Probabilidad de lluvia (Heurística de probabilidad diaria basada en volumen mensual)
    # En Paraguay, un mes de 150mm suele tener ~8-10 días de lluvia.
    # Probabilidad diaria estimada = (Días de lluvia / 30)
    dias_estimados = (promedio * 0.05) + 3 # Heurística: 100mm -> 8 días, 200mm -> 13 días
    probabilidad = min(95, (dias_estimados / 30) * 100)
    
    # Ajuste por variabilidad (si el mes es muy inestable, bajar probabilidad)
    if len(valores_est) > 5:
        desv = np.std(valores_est)
        cv = desv / (sum(valores_est)/len(valores_est)) if sum(valores_est)>0 else 0
        if cv > 0.8: # Alta variabilidad
            probabilidad *= 0.8

    # Clasificación por intensidad (ajustada)
    if promedio < 20:
        intensidad = "Escasa"
        emoji = "☀️"
    elif promedio < 70:
        intensidad = "Moderada"
        emoji = "☁️"
    elif promedio < 150:
        intensidad = "Abundante"
        emoji = "🌦️"
    elif promedio < 300:
        intensidad = "Muy Abundante"
        emoji = "🌧️"
    else:
        intensidad = "Torrencial"
        emoji = "⛈️"
        probabilidad = min(100, probabilidad + 15)

    return float(promedio), float(probabilidad), intensidad, emoji

def contrastar_prediccion(mes, anho, ubicacion, prediccion_valor):
    """Contrasta una predicción con el valor real si existe en la BD."""
    norm_ubicacion = normalizar_nombre(ubicacion)
    real = Precipitacion.query.filter(
        Precipitacion.mes.ilike(mes),
        Precipitacion.anho == anho
    ).all()
    
    real = [r for r in real if normalizar_nombre(r.ubicacion) == norm_ubicacion]
    
    if real and real[0].valor is not None:
        valor_real = real[0].valor
        error = abs(valor_real - prediccion_valor)
        return valor_real, error
    return None, None
