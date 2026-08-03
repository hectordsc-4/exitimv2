"""Espera a que PostgreSQL acepte conexiones."""
from __future__ import annotations

import sys
import time

from sqlalchemy import create_engine, text

from app.config import settings

RETRIES = 40
SLEEP_SECONDS = 2


def main() -> int:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    last_error: Exception | None = None

    for attempt in range(1, RETRIES + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[exi] PostgreSQL disponible (intento {attempt}).")
            return 0
        except Exception as exc:  # noqa: BLE001 — reintentos de arranque
            last_error = exc
            print(f"[exi] DB no lista ({attempt}/{RETRIES}): {exc}")
            time.sleep(SLEEP_SECONDS)

    print(f"[exi] No se pudo conectar a la base de datos: {last_error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
