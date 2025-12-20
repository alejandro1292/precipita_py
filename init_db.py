import os
from app import app, db
from data_processor import importar_csv, poblar_estaciones

def init_database():
    """Borra la base de datos actual y la recrea desde cero."""
    db_path = os.path.join(app.instance_path, 'precipitaciones.db')
    
    print("--- Iniciando Re-inicialización de la Base de Datos ---")
    
    if os.path.exists(db_path):
        print(f"Eliminando base de datos existente en: {db_path}")
        os.remove(db_path)
    
    with app.app_context():
        print("Creando tablas...")
        db.create_all()
        
        csv_path = os.path.join(os.path.dirname(__file__), 'precipitaciones.csv')
        if os.path.exists(csv_path):
            print(f"Importando datos desde {csv_path}...")
            importar_csv(csv_path)
            print("Poblando estaciones...")
            poblar_estaciones()
            print("¡Importación completada!")
        else:
            print("Advertencia: No se encontró el archivo precipitaciones.csv")
            
    print("--- Proceso finalizado con éxito ---")

if __name__ == "__main__":
    init_database()
