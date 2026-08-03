"""Aplica database/tables.sql si las tablas aún no existen."""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg2
from psycopg2.extensions import connection as PgConnection

from app.config import settings

SQL_PATH = Path(__file__).resolve().parents[1] / "database" / "tables.sql"


def _dsn() -> str:
    url = settings.database_url
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql://", 1)
    return url


def _schema_exists(conn: PgConnection) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'exi_usuarios'
            """
        )
        return cur.fetchone() is not None


def main() -> int:
    if not SQL_PATH.is_file():
        print(f"[exi] No se encontró {SQL_PATH}", file=sys.stderr)
        return 1

    conn = psycopg2.connect(_dsn())
    conn.autocommit = True
    try:
        if _schema_exists(conn):
            print("[exi] Esquema ya presente; no se reaplica.")
            return 0

        sql = SQL_PATH.read_text(encoding="utf-8")
        with conn.cursor() as cur:
            cur.execute(sql)
        print("[exi] Esquema y datos de prueba aplicados.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
