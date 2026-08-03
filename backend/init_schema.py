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


def _table_exists(conn: PgConnection) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'exi_usuarios'
            """
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


def _reset_public_schema(conn: PgConnection) -> None:
    """Schema viejo/incompleto: recrear public y cargar tables.sql limpio."""
    print("[exi] Schema incompleto detectado → reseteando schema public de exi_db...")
    with conn.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE")
        cur.execute("CREATE SCHEMA public")
        cur.execute("GRANT ALL ON SCHEMA public TO CURRENT_USER")
        cur.execute("GRANT ALL ON SCHEMA public TO public")
        cur.execute("GRANT ALL ON SCHEMA public TO listaviva")


def _ensure_tipusr_column(conn: PgConnection) -> None:
    tipusr = MIGRATIONS_DIR / "migration_usr_tipusr.sql"
    email = MIGRATIONS_DIR / "migration_add_email.sql"
    if email.is_file():
        _apply_sql_file(conn, email)
    if tipusr.is_file():
        _apply_sql_file(conn, tipusr)


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
        elif not cols_ok:
            try:
                _reset_public_schema(conn)
                print("[exi] Aplicando tables.sql tras reset...")
                _apply_sql_file(conn, SQL_PATH)
            except Exception as reset_exc:  # noqa: BLE001
                print(f"[exi] Reset no posible ({reset_exc}); intentando migraciones...")
                try:
                    _ensure_tipusr_column(conn)
                    _apply_sql_file(conn, SQL_PATH)
                except Exception as mig_exc:  # noqa: BLE001
                    print(f"[exi] Error reparando schema: {mig_exc}", file=sys.stderr)
                    return 1
        else:
            print("[exi] Esquema ya presente.")
            _apply_sql_file(conn, SQL_PATH)

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
