import os
from flask import Flask, render_template, request, jsonify
from models import db, Precipitacion, Estacion
from data_processor import importar_csv, predecir_precipitacion, contrastar_prediccion, poblar_estaciones

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///precipitaciones.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()
    if not Precipitacion.query.first():
        csv_path = os.path.join(os.path.dirname(__file__), 'precipitaciones.csv')
        if os.path.exists(csv_path):
            importar_csv(csv_path)
    
    # Asegurar que las estaciones estén pobladas
    poblar_estaciones()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/predecir', methods=['POST'])
def api_predecir():
    data = request.json
    mes = data.get('mes')
    anho = int(data.get('anho', 2023))
    ubicacion = data.get('ubicacion')
    
    promedio, probabilidad, intensidad, emoji = predecir_precipitacion(mes, anho, ubicacion)
    
    if promedio is None:
        return jsonify({'error': 'No hay datos para esta ubicación/mes'}), 404
    
    real_valor, error = contrastar_prediccion(mes, anho, ubicacion, promedio)
    
    return jsonify({
        'estimacion': round(promedio, 2),
        'probabilidad': round(probabilidad, 2),
        'intensidad': intensidad,
        'emoji': emoji,
        'real': round(real_valor, 2) if real_valor is not None else None,
        'error': round(error, 2) if error is not None else None
    })


@app.route('/api/historico', methods=['POST'])
def api_historico():
    data = request.json
    ubicacion = data.get('ubicacion')
    anho_objetivo = int(data.get('anho', 2023))
    
    from data_processor import normalizar_nombre, predecir_precipitacion
    norm_ubicacion = normalizar_nombre(ubicacion)
    
    datos = Precipitacion.query.all()
    datos_filtrados = [d for d in datos if normalizar_nombre(d.ubicacion) == norm_ubicacion]
    
    if not datos_filtrados:
        return jsonify([])

    max_anho_real = max(d.anho for d in datos_filtrados)
    
    # Mostrar 5 años terminando en el año objetivo
    anhos_a_mostrar = list(range(anho_objetivo - 4, anho_objetivo + 1))
    
    meses_lista = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
    mapa_reales = {(d.anho, d.mes): d.valor for d in datos_filtrados}
    
    # Calcular umbral de outliers solo con datos reales
    import numpy as np
    valores_reales = [d.valor for d in datos_filtrados if d.valor is not None]
    if valores_reales:
        media = np.mean(valores_reales)
        desv = np.std(valores_reales)
        umbral = media + 2 * desv
    else:
        umbral = 9999

    historico = []
    for anho in anhos_a_mostrar:
        for mes in meses_lista:
            valor = mapa_reales.get((anho, mes))
            es_prediccion = False
            
            if valor is None:
                if anho > max_anho_real:
                    # Generar predicción sintética
                    valor, _, _, _ = predecir_precipitacion(mes, anho, ubicacion)
                    es_prediccion = True
                else:
                    # Dato faltante histórico
                    valor = 0.0
            
            valor_norm = min(valor, umbral) if valor is not None else 0.0
            
            historico.append({
                'label': f"{mes[:3]} {str(anho)[2:]}",
                'valor': valor,
                'valor_normalizado': valor_norm,
                'anho': anho,
                'mes': mes,
                'es_prediccion': es_prediccion
            })
    
    return jsonify(historico)

@app.route('/api/estacionalidad', methods=['POST'])
def api_estacionalidad():
    data = request.json
    ubicacion = data.get('ubicacion')
    
    from data_processor import normalizar_nombre
    norm_ubicacion = normalizar_nombre(ubicacion)
    
    datos = Precipitacion.query.all()
    datos_filtrados = [d for d in datos if normalizar_nombre(d.ubicacion) == norm_ubicacion]
    
    if not datos_filtrados:
        return jsonify([])

    meses_lista = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
    resumen = []
    
    for mes in meses_lista:
        valores = [d.valor for d in datos_filtrados if d.mes == mes and d.valor is not None]
        promedio = sum(valores) / len(valores) if valores else 0
        resumen.append({
            'mes': mes,
            'promedio': round(float(promedio), 2)
        })
    
    return jsonify(resumen)

@app.route('/api/estacionariedad', methods=['POST'])
def api_estacionariedad():
    data = request.json
    ubicacion = data.get('ubicacion')
    
    from data_processor import normalizar_nombre
    norm_ubicacion = normalizar_nombre(ubicacion)
    
    datos = Precipitacion.query.all()
    datos_filtrados = [d for d in datos if normalizar_nombre(d.ubicacion) == norm_ubicacion]
    
    if not datos_filtrados:
        return jsonify([])

    # Ordenar cronológicamente
    meses_lista = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
    datos_filtrados.sort(key=lambda x: (x.anho, meses_lista.index(x.mes)))
    
    valores = [d.valor for d in datos_filtrados if d.valor is not None]
    labels = [f"{d.mes[:3]} {str(d.anho)[2:]}" for d in datos_filtrados if d.valor is not None]
    
    if not valores:
        return jsonify([])

    import numpy as np
    import pandas as pd
    
    series = pd.Series(valores)
    rolling_mean = series.rolling(window=12, min_periods=1).mean()
    rolling_std = series.rolling(window=12, min_periods=1).std()
    
    res = []
    for i in range(len(valores)):
        res.append({
            'label': labels[i],
            'original': float(valores[i]),
            'mean': float(rolling_mean[i]) if not np.isnan(rolling_mean[i]) else None,
            'std': float(rolling_std[i]) if not np.isnan(rolling_std[i]) else None
        })
    
    return jsonify(res)

@app.route('/api/estaciones', methods=['GET', 'POST'])
def api_estaciones():
    if request.method == 'POST':
        data = request.json
        nombre = data.get('nombre')
        
        # Verificar si ya existe una estación con ese nombre
        existente = Estacion.query.filter_by(nombre=nombre).first()
        if existente:
            return jsonify({'error': f'La estación "{nombre}" ya existe.'}), 400

        estacion = Estacion(
            nombre=nombre,
            latitud=data['latitud'],
            longitud=data['longitud'],
            departamento=data['departamento']
        )
        db.session.add(estacion)
        db.session.commit()
        return jsonify({'status': 'success'})
    
    estaciones = Estacion.query.all()
    return jsonify([{
        'id': e.id,
        'nombre': e.nombre,
        'latitud': e.latitud,
        'longitud': e.longitud,
        'departamento': e.departamento
    } for e in estaciones])

@app.route('/api/estaciones/<int:id>', methods=['PUT'])
def api_update_estacion(id):
    estacion = Estacion.query.get_or_404(id)
    data = request.json
    estacion.departamento = data.get('departamento', estacion.departamento)
    estacion.latitud = data.get('latitud', estacion.latitud)
    estacion.longitud = data.get('longitud', estacion.longitud)
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/estaciones/<int:id>', methods=['DELETE'])
def api_delete_estacion(id):
    estacion = Estacion.query.get_or_404(id)
    db.session.delete(estacion)
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/upload', methods=['POST'])
def api_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    temp_path = 'temp_upload.csv'
    file.save(temp_path)
    importar_csv(temp_path)
    os.remove(temp_path)
    
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    # Bind to 0.0.0.0 so the app is accessible from outside the container
    app.run(debug=True, host='0.0.0.0', port=5002)
