#!/bin/bash

# Abortar el script si alguno de los comandos falla
set -e

# Esperar opcionalmente la disponibilidad de la BD si es necesario, 
# aunque Railway ya maneja dependencias de servicio.

echo "Ejecutando migraciones de base de datos..."
alembic upgrade head

# Iniciar la aplicación usando uvicorn. 
# Railway define la variable de entorno $PORT automáticamente.
# Usamos 0.0.0.0 para que el contenedor sea accesible desde fuera.
echo "Iniciando BAGFM Backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
