#!/bin/sh
set -e

echo "[exi] Comprobando variables de entorno..."

# Quitar comillas/espacios que a veces pega Coolify
if [ -n "${DATABASE_URL:-}" ]; then
  DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  export DATABASE_URL
fi
if [ -n "${BOOTSTRAP_DATABASE_URL:-}" ]; then
  BOOTSTRAP_DATABASE_URL=$(printf '%s' "$BOOTSTRAP_DATABASE_URL" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  export BOOTSTRAP_DATABASE_URL
fi

db_len=${#DATABASE_URL}
echo "[exi] DATABASE_URL length=${db_len}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[exi] ERROR: DATABASE_URL está vacía o no definida en Runtime." >&2
  echo "[exi] En Coolify → Environment Variables:" >&2
  echo "[exi]  1) Key: DATABASE_URL" >&2
  echo "[exi]  2) Value: pegar la URL completa (no dejar el valor en blanco)" >&2
  echo "[exi]  3) Runtime Variable = ON  |  Build Variable = OFF (recomendado)" >&2
  echo "[exi]  4) Guardar y Redeploy" >&2
  echo "[exi] Claves presentes (valores ocultos):" >&2
  env | grep -E '^(DATABASE|POSTGRES|PG|BOOTSTRAP|APP_|DEBUG|CORS)' | while IFS= read -r line; do
    key=${line%%=*}
    val=${line#*=}
    echo "[exi]   ${key} length=${#val}" >&2
  done || true
  exit 1
fi

case "$DATABASE_URL" in
  *://*@localhost:*|*://*@127.0.0.1:*|*://localhost:*|*://127.0.0.1:*)
    echo "[exi] ERROR: DATABASE_URL apunta a localhost/127.0.0.1." >&2
    echo "[exi] Usa el host interno de Coolify (p.ej. lcpp4fhc8vzq2i8vwbq5p3pc)." >&2
    exit 1
    ;;
esac

python - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("DATABASE_URL", "")
u = urlparse(url.replace("postgresql+psycopg2://", "postgresql://", 1))
print(f"[exi] DATABASE_URL host={u.hostname!r} db={(u.path or '').lstrip('/')!r} user={u.username!r}")
boot = os.environ.get("BOOTSTRAP_DATABASE_URL", "")
if boot:
    b = urlparse(boot.replace("postgresql+psycopg2://", "postgresql://", 1))
    print(f"[exi] BOOTSTRAP host={b.hostname!r} db={(b.path or '').lstrip('/')!r}")
else:
    print("[exi] BOOTSTRAP_DATABASE_URL vacía (se probará listaviva/postgres/template1 en el mismo host)")
PY

echo "[exi] Creando base de datos si hace falta..."
python /app/backend/ensure_database.py

echo "[exi] Esperando PostgreSQL (base destino)..."
python /app/backend/wait_for_db.py

echo "[exi] Aplicando esquema si hace falta..."
python /app/backend/init_schema.py

echo "[exi] Arrancando API..."
exec "$@"
