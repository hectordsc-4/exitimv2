FROM python:3.12-slim

# No meter DATABASE_URL como ARG/ENV aquí: en el build suele llegar vacío
# y deja DATABASE_URL="" en la imagen, rompiendo el arranque.
# Coolify debe inyectar las variables en Runtime.

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY frontend /app/frontend
COPY database /app/database

WORKDIR /app/backend

RUN chmod +x /app/backend/entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/app/backend/entrypoint.sh"]
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
