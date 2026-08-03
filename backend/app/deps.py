from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Usuario, PermisoUsuario

SUPERADMIN_CODPER = "SUPERADMIN"
ADMIN_CODPER = "ADMIN"
GENERAL_CODPER = "GENERAL"


def get_current_user(
    x_usr_codusr: str | None = Header(default=None, alias="X-Usr-Codusr"),
    db: Session = Depends(get_db),
) -> Usuario:
    if not x_usr_codusr:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabecera X-Usr-Codusr requerida",
        )
    usuario = db.get(Usuario, x_usr_codusr)
    if usuario is None or usuario.usr_fecbaj is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o usuario dado de baja",
        )
    return usuario


def _tiene_permiso(db: Session, codusr: str, codper: str) -> bool:
    from app.models import Permiso

    return (
        db.query(PermisoUsuario)
        .join(Permiso, Permiso.per_codper == PermisoUsuario.peu_codper)
        .filter(
            PermisoUsuario.peu_codusr == codusr,
            PermisoUsuario.peu_codper == codper,
            PermisoUsuario.peu_fecbaj.is_(None),
            Permiso.per_fecbaj.is_(None),
        )
        .first()
        is not None
    )


def es_superadmin(db: Session, codusr: str) -> bool:
    return _tiene_permiso(db, codusr, SUPERADMIN_CODPER)


def es_admin(db: Session, codusr: str) -> bool:
    """ADMIN o SUPERADMIN (ambos acceden al panel de administración)."""
    return _tiene_permiso(db, codusr, ADMIN_CODPER) or es_superadmin(db, codusr)


def count_superadmins(db: Session) -> int:
    from app.models import Permiso

    return (
        db.query(PermisoUsuario)
        .join(Permiso, Permiso.per_codper == PermisoUsuario.peu_codper)
        .filter(
            PermisoUsuario.peu_codper == SUPERADMIN_CODPER,
            PermisoUsuario.peu_fecbaj.is_(None),
            Permiso.per_fecbaj.is_(None),
        )
        .count()
    )


def require_admin(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Usuario:
    if not es_admin(db, usuario.usr_codusr):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere permiso ADMIN o SUPERADMIN",
        )
    return usuario


def require_superadmin(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Usuario:
    if not es_superadmin(db, usuario.usr_codusr):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere permiso SUPERADMIN",
        )
    return usuario


def require_general(
    usuario: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Usuario:
    """Acceso a mantenimientos generales. ADMIN/SUPERADMIN también entran."""
    ok = (
        _tiene_permiso(db, usuario.usr_codusr, GENERAL_CODPER)
        or es_admin(db, usuario.usr_codusr)
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere permiso GENERAL",
        )
    return usuario


def permisos_de(db: Session, codusr: str) -> list[str]:
    from app.models import Permiso

    filas = (
        db.query(PermisoUsuario.peu_codper)
        .join(Permiso, Permiso.per_codper == PermisoUsuario.peu_codper)
        .filter(
            PermisoUsuario.peu_codusr == codusr,
            PermisoUsuario.peu_fecbaj.is_(None),
            Permiso.per_fecbaj.is_(None),
        )
        .all()
    )
    return [f[0] for f in filas]
