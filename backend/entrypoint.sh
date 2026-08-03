#!/bin/sh
set -e

echo "[exi] Creando base de datos si hace falta..."
python /app/backend/ensure_database.py

echo "[exi] Esperando PostgreSQL (base destino)..."
python /app/backend/wait_for_db.py

echo "[exi] Aplicando esquema si hace falta..."
python /app/backend/init_schema.py

echo "[exi] Arrancando API..."
exec "$@"
