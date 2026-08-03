"""Crea la base destino de DATABASE_URL si aún no existe.

Prueba varias bases de bootstrap (env + listaviva + postgres + template1)
para no fallar por un typo en Coolify (p.ej. listaviv vs listaviva).
"""
from __future__ import annotations

import os
import sys
from urllib.parse import urlparse, urlunparse

import psycopg2
from psycopg2 import sql
from psycopg2.extensions import connection as PgConnection

from app.config import settings


def _to_psycopg(url: str) -> str:
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def _swap_database(url: str, database: str) -> str:
    parsed = urlparse(_to_psycopg(url))
    return urlunparse(parsed._replace(path=f"/{database}"))


def _database_name(url: str) -> str:
    path = urlparse(_to_psycopg(url)).path.lstrip("/")
    if not path:
        raise ValueError("La URL no incluye nombre de base de datos")
    return path.split("?")[0]


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        name = item.strip()
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(name)
    return out


def _bootstrap_urls(target_url: str, target_db: str) -> list[str]:
    urls: list[str] = []

    explicit = os.getenv("BOOTSTRAP_DATABASE_URL", "").strip()
    if explicit:
        urls.append(_to_psycopg(explicit))

    env_dbs = os.getenv("BOOTSTRAP_DB", "").strip()
    names = [n for n in env_dbs.split(",") if n.strip()] if env_dbs else []
    # Fallbacks comunes en Coolify / Postgres
    names.extend(["listaviva", "postgres", "template1"])

    for name in _unique(names):
        if name == target_db:
            continue
        urls.append(_swap_database(target_url, name))

    # Deduplicar URLs por path de DB
    seen_db: set[str] = set()
    result: list[str] = []
    for url in urls:
        db = _database_name(url)
        if db in seen_db:
            continue
        seen_db.add(db)
        result.append(url)
    return result


def _ensure_database(conn: PgConnection, target_db: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
        if cur.fetchone():
            print(f"[exi] La base '{target_db}' ya existe.")
            return

        # Sin OWNER: en PostgreSQL el creador queda como owner.
        cur.execute(
            sql.SQL("CREATE DATABASE {} ENCODING 'UTF8'").format(sql.Identifier(target_db))
        )
    print(f"[exi] Base '{target_db}' creada.")


def main() -> int:
    target_url = _to_psycopg(settings.database_url)
    target_db = _database_name(target_url)
    candidates = _bootstrap_urls(target_url, target_db)

    print(f"[exi] Asegurando base '{target_db}'. Probando bootstrap: {[ _database_name(u) for u in candidates ]}")

    errors: list[str] = []
    for admin_url in candidates:
        bootstrap_db = _database_name(admin_url)
        try:
            conn = psycopg2.connect(admin_url)
            conn.autocommit = True
            try:
                print(f"[exi] Conectado a bootstrap '{bootstrap_db}'.")
                _ensure_database(conn, target_db)
                return 0
            finally:
                conn.close()
        except Exception as exc:  # noqa: BLE001
            msg = f"{bootstrap_db}: {exc}"
            print(f"[exi] Bootstrap '{bootstrap_db}' no usable: {exc}")
            errors.append(msg)

    print(f"[exi] No se pudo crear/verificar la base '{target_db}'.", file=sys.stderr)
    for err in errors:
        print(f"[exi]  - {err}", file=sys.stderr)
    print(
        "[exi] Revisa BOOTSTRAP_DB=listaviva (completo) o ejecuta database/create_exi_db.sql",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
