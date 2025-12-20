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
    anho = data.get('anho')
    ubicacion = data.get('ubicacion')
    
    promedio, probabilidad, intensidad, emoji = predecir_precipitacion(mes, ubicacion)
    
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
    
    from data_processor import normalizar_nombre
    norm_ubicacion = normalizar_nombre(ubicacion)
    
    datos = Precipitacion.query.all()
    datos_filtrados = [d for d in datos if normalizar_nombre(d.ubicacion) == norm_ubicacion]
    
    if not datos_filtrados:
        return jsonify([])

    # Encontrar los últimos 5 años únicos
    anhos_disponibles = sorted(list(set(d.anho for d in datos_filtrados)))
    ultimos_5_anhos = anhos_disponibles[-5:]
    
    # Filtrar por esos años
    meses_lista = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']
    datos_finales = [d for d in datos_filtrados if d.anho in ultimos_5_anhos]
    datos_finales.sort(key=lambda x: (x.anho, meses_lista.index(x.mes)))
    
    historico = [{
        'label': f"{d.mes[:3]} {str(d.anho)[2:]}",
        'valor': d.valor,
        'anho': d.anho,
        'mes': d.mes
    } for d in datos_finales]
    
    return jsonify(historico)

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
    estacion.latitud = data.get('latitud')
    estacion.longitud = data.get('longitud')
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
    app.run(debug=True, port=5002)
