"""Aplica database/tables.sql y repara schema incompleto en exi_db."""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg2
from psycopg2.extensions import connection as PgConnection

from app.config import settings

SQL_PATH = Path(__file__).resolve().parents[1] / "database" / "tables.sql"
MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "database"
REQUIRED_COLUMNS = {
    "usr_codusr",
    "usr_name",
    "usr_pass",
    "usr_tipusr",
    "usr_email",
    "usr_fecbaj",
}


def _dsn() -> str:
    url = settings.database_url
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql://", 1)
    return url


def _table_exists(conn: PgConnection, table: str = "exi_usuarios") -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table,),
        )
        return cur.fetchone() is not None


def _columns_ok(conn: PgConnection) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'exi_usuarios'
            """
        )
        cols = {row[0] for row in cur.fetchall()}
    return REQUIRED_COLUMNS.issubset(cols)


def _apply_sql_file(conn: PgConnection, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)


def _apply_migrations(conn: PgConnection) -> None:
    """Aplica migration_*.sql (ADD COLUMN IF NOT EXISTS, etc.) de forma idempotente."""
    files = sorted(MIGRATIONS_DIR.glob("migration_*.sql"))
    if not files:
        print("[exi] No hay migraciones.")
        return

    for path in files:
        try:
            _apply_sql_file(conn, path)
            print(f"[exi] Migración OK: {path.name}")
        except Exception as exc:  # noqa: BLE001
            # Tabla aún no existe u objeto ya presente: no bloquear el arranque.
            print(f"[exi] Migración omitida {path.name}: {exc}")


def _reset_public_schema(conn: PgConnection) -> None:
    print("[exi] Schema incompleto detectado → reseteando schema public de exi_db...")
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE")
        cur.execute("CREATE SCHEMA public")
        cur.execute("GRANT ALL ON SCHEMA public TO CURRENT_USER")
        cur.execute("GRANT ALL ON SCHEMA public TO public")
        try:
            cur.execute("GRANT ALL ON SCHEMA public TO listaviva")
        except Exception:  # noqa: BLE001
            pass


def _can_read_usuarios(conn: PgConnection) -> tuple[bool, str]:
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT usr_codusr, usr_tipusr FROM exi_usuarios LIMIT 1")
            cur.fetchall()
        return True, ""
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def _ensure_seed(conn: PgConnection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO exi_usuarios
                (usr_codusr, usr_name, usr_usrcre, usr_pass, usr_email, usr_descri, usr_tipusr)
            VALUES
                ('admin', 'Administrador', 'SYSTEM', 'admin123', 'admin@exi.local', 'Usuario administrador', 'SUPERADMIN'),
                ('demo',  'Usuario Demo',  'SYSTEM', 'demo123',  'demo@exi.local',  'Usuario de demostración', 'DIRECTOR')
            ON CONFLICT (usr_codusr) DO NOTHING
            """
        )


def _apply_tables_with_repair(conn: PgConnection) -> None:
    """Aplica tables.sql; si falla por columnas viejas, migra y reintenta o resetea."""
    try:
        _apply_sql_file(conn, SQL_PATH)
        return
    except Exception as first_exc:  # noqa: BLE001
        print(f"[exi] tables.sql falló ({first_exc}); aplicando migraciones y reintentando...")
        _apply_migrations(conn)
        try:
            _apply_sql_file(conn, SQL_PATH)
            return
        except Exception as second_exc:  # noqa: BLE001
            print(f"[exi] Reintento falló ({second_exc}); reseteando schema...")
            _reset_public_schema(conn)
            _apply_sql_file(conn, SQL_PATH)


def main() -> int:
    if not SQL_PATH.is_file():
        print(f"[exi] No se encontró {SQL_PATH}", file=sys.stderr)
        return 1

    conn = psycopg2.connect(_dsn())
    conn.autocommit = True
    try:
        exists = _table_exists(conn)
        cols_ok = _columns_ok(conn) if exists else False

        if not exists:
            print("[exi] Aplicando schema (tables.sql)...")
            _apply_sql_file(conn, SQL_PATH)
            _apply_migrations(conn)
        elif not cols_ok:
            try:
                _reset_public_schema(conn)
                print("[exi] Aplicando tables.sql tras reset...")
                _apply_sql_file(conn, SQL_PATH)
                _apply_migrations(conn)
            except Exception as reset_exc:  # noqa: BLE001
                print(f"[exi] Reset no posible ({reset_exc}); migraciones + tables.sql...")
                _apply_migrations(conn)
                _apply_tables_with_repair(conn)
        else:
            print("[exi] Esquema ya presente → migraciones + tables.sql idempotente...")
            # Primero columnas nuevas (evita COMMENT ON columna inexistente)
            _apply_migrations(conn)
            _apply_tables_with_repair(conn)

        readable, err = _can_read_usuarios(conn)
        if not readable:
            print(f"[exi] No se puede leer exi_usuarios: {err}", file=sys.stderr)
            return 1

        _ensure_seed(conn)
        print("[exi] Schema OK y usuarios seed verificados.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
