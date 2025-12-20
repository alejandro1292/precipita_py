from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Precipitacion(db.Model):
    __tablename__ = 'precipitaciones'
    id = db.Column(db.Integer, primary_key=True)
    mes = db.Column(db.String(20), nullable=False)
    anho = db.Column(db.Integer, nullable=False)
    valor = db.Column(db.Float, nullable=True)
    ubicacion = db.Column(db.String(100), nullable=False)

class Estacion(db.Model):
    __tablename__ = 'estaciones'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), unique=True, nullable=False)
    latitud = db.Column(db.Float, nullable=False)
    longitud = db.Column(db.Float, nullable=False)
    departamento = db.Column(db.String(100), nullable=False)
