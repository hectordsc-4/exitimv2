from collections import defaultdict
from datetime import datetime, date, time, timedelta
from calendar import monthrange
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    get_current_user,
    permisos_de,
    require_admin,
    require_general,
    es_superadmin,
    count_superadmins,
    SUPERADMIN_CODPER,
    ADMIN_CODPER,
)
from app.models import Usuario, Login, Permiso, PermisoUsuario, Centro, Monitor, MonitorCentro, Nino, NinoCentro, TipoGrupo, TipoGrupoCentro, Evento, Periodo, NinoPeriodo, MonitorPeriodo, NinoAsistencia, Descuento, Precio
from app.mailer import send_password_reminder
from app.schemas import (
    UsuarioCreate,
    UsuarioUpdate,
    UsuarioOut,
    LoginRequest,
    LoginResponse,
    LoginOut,
    LoginDiaOut,
    LoginHoraOut,
    LoginResumenOut,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    PermisoCreate,
    PermisoOut,
    PermisoUsuarioCreate,
    PermisoUsuarioOut,
    CentroCreate,
    CentroUpdate,
    CentroOut,
    MonitorCreate,
    MonitorUpdate,
    MonitorOut,
    MonitorCentroCreate,
    MonitorCentroUpdate,
    MonitorCentroOut,
    NinoCreate,
    NinoUpdate,
    NinoOut,
    NinoCentroCreate,
    NinoCentroUpdate,
    NinoCentroOut,
    TipoGrupoCreate,
    TipoGrupoUpdate,
    TipoGrupoOut,
    TipoGrupoCentroCreate,
    TipoGrupoCentroUpdate,
    TipoGrupoCentroOut,
    EventoCreate,
    EventoUpdate,
    EventoOut,
    PeriodoCreate,
    PeriodoUpdate,
    PeriodoOut,
    NinoPeriodoCreate,
    NinoPeriodoOut,
    NinoPeriodoBulk,
    MonitorPeriodoCreate,
    MonitorPeriodoOut,
    MonitorPeriodoBulk,
    NinoAsistenciaUpsert,
    NinoAsistenciaOut,
    NinoAsistenciaListaItem,
    NinoAsistenciaMensualOut,
    NinoAsistenciaMensualItem,
    NinoAsistenciaDiaMes,
    DescuentoCreate,
    DescuentoUpdate,
    DescuentoOut,
    PrecioCreate,
    PrecioUpdate,
    PrecioOut,
    SqlQueryRequest,
    SqlQueryOut,
)

router = APIRouter()


def _usuario_out(
    usuario: Usuario,
    monitores_by_usr: dict | None = None,
    permisos_by_usr: dict | None = None,
    db: Session | None = None,
) -> UsuarioOut:
    """Enriquece el usuario con monitor asociado y permisos activos."""
    mon = None
    if monitores_by_usr is not None:
        mon = monitores_by_usr.get(usuario.usr_codusr)
    elif db is not None:
        mon = db.query(Monitor).filter(Monitor.mon_codusr == usuario.usr_codusr).first()

    if permisos_by_usr is not None:
        perms = permisos_by_usr.get(usuario.usr_codusr, [])
    elif db is not None:
        perms = permisos_de(db, usuario.usr_codusr)
    else:
        perms = []

    return UsuarioOut(
        usr_codusr=usuario.usr_codusr,
        usr_name=usuario.usr_name,
        usr_email=usuario.usr_email,
        usr_usrcre=usuario.usr_usrcre,
        usr_descri=usuario.usr_descri,
        usr_tipusr=usuario.usr_tipusr,
        user_feccre=usuario.user_feccre,
        usr_fecbaj=usuario.usr_fecbaj,
        mon_codmon=mon.mon_codmon if mon else None,
        mon_nommon=mon.mon_nommon if mon else None,
        permisos=perms,
    )


def _mapas_usuarios(db: Session) -> tuple[dict, dict]:
    monitores_by_usr = {
        m.mon_codusr: m
        for m in db.query(Monitor).filter(Monitor.mon_codusr.isnot(None)).all()
    }
    activos = {
        p.per_codper
        for p in db.query(Permiso).filter(Permiso.per_fecbaj.is_(None)).all()
    }
    permisos_by_usr: dict[str, list[str]] = defaultdict(list)
    for peu in (
        db.query(PermisoUsuario)
        .filter(PermisoUsuario.peu_fecbaj.is_(None))
        .all()
    ):
        if peu.peu_codper in activos:
            permisos_by_usr[peu.peu_codusr].append(peu.peu_codper)
    return monitores_by_usr, permisos_by_usr


def _assert_puede_tocar_usuario(db: Session, actor: Usuario, target_codusr: str):
    """Un ADMIN no puede dar de baja/borrar a un SUPERADMIN."""
    if es_superadmin(db, target_codusr) and not es_superadmin(db, actor.usr_codusr):
        raise HTTPException(
            status_code=403,
            detail="Solo el SUPERADMIN puede gestionar al usuario SUPERADMIN",
        )
    target = db.get(Usuario, target_codusr)
    if (
        target
        and target.usr_tipusr == "SUPERADMIN"
        and not es_superadmin(db, actor.usr_codusr)
        and getattr(actor, "usr_tipusr", None) != "SUPERADMIN"
    ):
        raise HTTPException(
            status_code=403,
            detail="Solo el SUPERADMIN puede gestionar a un usuario de tipo SUPERADMIN",
        )


def _aplicar_tipusr(
    db: Session,
    actor: Usuario,
    tipusr: str,
    *,
    codusr_destino: str,
    tipusr_actual: str | None = None,
) -> str:
    """Valida y aplica reglas de usr_tipusr (SUPERADMIN único)."""
    tip = (tipusr or "").strip().upper()
    if tip not in ("SUPERADMIN", "ADMIN", "DIRECTOR", "MONITOR"):
        raise HTTPException(
            status_code=400,
            detail="usr_tipusr debe ser SUPERADMIN, ADMIN, DIRECTOR o MONITOR",
        )
    actor_es_sa = es_superadmin(db, actor.usr_codusr) or actor.usr_tipusr == "SUPERADMIN"
    if tip == "SUPERADMIN":
        if not actor_es_sa:
            raise HTTPException(
                status_code=403,
                detail="Solo el SUPERADMIN puede asignar el tipo SUPERADMIN",
            )
        # Solo uno: el resto deja de ser SUPERADMIN en tipusr
        otros = (
            db.query(Usuario)
            .filter(
                Usuario.usr_tipusr == "SUPERADMIN",
                Usuario.usr_codusr != codusr_destino,
            )
            .all()
        )
        for o in otros:
            o.usr_tipusr = "ADMIN"
    if tipusr_actual == "SUPERADMIN" and tip != "SUPERADMIN":
        if not actor_es_sa:
            raise HTTPException(
                status_code=403,
                detail="Solo el SUPERADMIN puede quitar el tipo SUPERADMIN",
            )
        quedan = (
            db.query(Usuario)
            .filter(
                Usuario.usr_tipusr == "SUPERADMIN",
                Usuario.usr_codusr != codusr_destino,
            )
            .count()
        )
        if quedan < 1 and tip != "SUPERADMIN":
            # Permitir cambiar solo si ya hay otro SUPERADMIN, o si estamos transfiriendo
            # (la transferencia crea el nuevo antes). Aquí bloqueamos dejar el sistema sin ninguno.
            raise HTTPException(
                status_code=400,
                detail="No se puede quitar el único SUPERADMIN. Asigna el tipo a otro usuario antes.",
            )
    return tip


def _assert_superadmin_unico(db: Session, codusr: str):
    """Solo puede haber un SUPERADMIN activo; si hay otro, se transfiere (baja lógica)."""
    otros = (
        db.query(PermisoUsuario)
        .filter(
            PermisoUsuario.peu_codper == SUPERADMIN_CODPER,
            PermisoUsuario.peu_fecbaj.is_(None),
            PermisoUsuario.peu_codusr != codusr,
        )
        .all()
    )
    for otro in otros:
        otro.peu_fecbaj = datetime.now()


def _assert_puede_asignar_superadmin(db: Session, actor: Usuario):
    if not es_superadmin(db, actor.usr_codusr):
        raise HTTPException(
            status_code=403,
            detail="Solo el SUPERADMIN puede asignar el permiso SUPERADMIN",
        )


# =========================
# AUTH / LOGIN
# =========================
@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    usuario = db.get(Usuario, payload.usr_codusr)

    if usuario is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    if usuario.usr_fecbaj is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario dado de baja")

    if usuario.usr_pass != payload.usr_pass:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos")

    client_ip = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    nuevo_login = Login(
        log_codusr=usuario.usr_codusr,
        log_feclog=datetime.now(),
        log_ip=client_ip,
        log_dispos=payload.log_dispos or request.headers.get("user-agent", "")[:100],
    )
    db.add(nuevo_login)
    db.commit()
    db.refresh(nuevo_login)

    perms = permisos_de(db, usuario.usr_codusr)
    return LoginResponse(
        ok=True,
        message="Login correcto",
        usuario=_usuario_out(usuario, db=db, permisos_by_usr={usuario.usr_codusr: perms}),
        login=LoginOut.model_validate(nuevo_login),
        permisos=perms,
    )


@router.post("/auth/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    from app.config import settings

    email = payload.usr_email.strip().lower()
    mensaje_ok = "Si el email existe en el sistema, recibirás tu contraseña en breve."

    usuario = (
        db.query(Usuario)
        .filter(Usuario.usr_email.isnot(None))
        .filter(Usuario.usr_email.ilike(email))
        .first()
    )

    # Respuesta genérica para no revelar si el email existe
    if usuario is None or usuario.usr_fecbaj is not None or not usuario.usr_email:
        return ForgotPasswordResponse(ok=True, message=mensaje_ok)

    try:
        send_password_reminder(
            to_email=usuario.usr_email,
            usr_codusr=usuario.usr_codusr,
            usr_name=usuario.usr_name,
            password=usuario.usr_pass,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo enviar el email: {exc}",
        ) from exc

    if not settings.smtp_host:
        return ForgotPasswordResponse(
            ok=True,
            message=(
                "SMTP no está configurado: el correo NO se ha enviado a Gmail. "
                "Se ha guardado en backend/outbox/. "
                "Configura SMTP_HOST/SMTP_USER/SMTP_PASSWORD en backend/.env"
            ),
        )

    return ForgotPasswordResponse(ok=True, message=mensaje_ok)


# =========================
# USUARIOS
# =========================
@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    monitores_by_usr, permisos_by_usr = _mapas_usuarios(db)
    return [
        _usuario_out(u, monitores_by_usr, permisos_by_usr)
        for u in db.query(Usuario).order_by(Usuario.usr_codusr).all()
    ]


@router.get("/usuarios/{codusr}", response_model=UsuarioOut)
def obtener_usuario(
    codusr: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    usuario = db.get(Usuario, codusr)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return _usuario_out(usuario, db=db)


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def crear_usuario(
    payload: UsuarioCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    if db.get(Usuario, payload.usr_codusr):
        raise HTTPException(status_code=409, detail="El usuario ya existe")
    if payload.usr_email:
        existe_email = (
            db.query(Usuario)
            .filter(Usuario.usr_email.ilike(payload.usr_email.strip()))
            .first()
        )
        if existe_email:
            raise HTTPException(status_code=409, detail="El email ya está en uso")

    tipusr = _aplicar_tipusr(
        db,
        admin,
        payload.usr_tipusr,
        codusr_destino=payload.usr_codusr,
    )

    usuario = Usuario(
        usr_codusr=payload.usr_codusr,
        usr_name=payload.usr_name,
        user_feccre=datetime.now(),
        usr_usrcre=payload.usr_usrcre or admin.usr_codusr,
        usr_pass=payload.usr_pass,
        usr_email=payload.usr_email.strip().lower() if payload.usr_email else None,
        usr_descri=payload.usr_descri,
        usr_tipusr=tipusr,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return _usuario_out(usuario, db=db)


@router.put("/usuarios/{codusr}", response_model=UsuarioOut)
def actualizar_usuario(
    codusr: str,
    payload: UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    usuario = db.get(Usuario, codusr)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    _assert_puede_tocar_usuario(db, admin, codusr)
    data = payload.model_dump(exclude_unset=True)
    if "usr_email" in data and data["usr_email"]:
        email = data["usr_email"].strip().lower()
        existe_email = (
            db.query(Usuario)
            .filter(Usuario.usr_email.ilike(email), Usuario.usr_codusr != codusr)
            .first()
        )
        if existe_email:
            raise HTTPException(status_code=409, detail="El email ya está en uso")
        data["usr_email"] = email
    if "usr_tipusr" in data and data["usr_tipusr"] is not None:
        data["usr_tipusr"] = _aplicar_tipusr(
            db,
            admin,
            data["usr_tipusr"],
            codusr_destino=codusr,
            tipusr_actual=usuario.usr_tipusr,
        )
    for key, value in data.items():
        setattr(usuario, key, value)
    db.commit()
    db.refresh(usuario)
    return _usuario_out(usuario, db=db)


@router.delete("/usuarios/{codusr}", status_code=204)
def baja_usuario(
    codusr: str,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    usuario = db.get(Usuario, codusr)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if codusr == admin.usr_codusr:
        raise HTTPException(status_code=400, detail="No puedes darte de baja a ti mismo")
    _assert_puede_tocar_usuario(db, admin, codusr)
    if es_superadmin(db, codusr) or usuario.usr_tipusr == "SUPERADMIN":
        raise HTTPException(
            status_code=400,
            detail="No se puede dar de baja al SUPERADMIN. Transfiere el rol antes.",
        )
    usuario.usr_fecbaj = datetime.now()
    db.commit()
    return None


@router.delete("/usuarios/{codusr}/permanente", status_code=204)
def borrar_usuario_permanente(
    codusr: str,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    usuario = db.get(Usuario, codusr)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if codusr == admin.usr_codusr:
        raise HTTPException(status_code=400, detail="No puedes borrarte a ti mismo")
    _assert_puede_tocar_usuario(db, admin, codusr)
    if es_superadmin(db, codusr) or usuario.usr_tipusr == "SUPERADMIN":
        raise HTTPException(
            status_code=400,
            detail="No se puede borrar al SUPERADMIN. Transfiere el rol antes.",
        )
    if db.query(Monitor).filter(Monitor.mon_codusr == codusr).first():
        raise HTTPException(
            status_code=409,
            detail="El usuario está asociado a un monitor. Elimina el monitor antes.",
        )

    db.query(PermisoUsuario).filter(PermisoUsuario.peu_codusr == codusr).delete()
    db.query(Login).filter(Login.log_codusr == codusr).delete()
    db.delete(usuario)
    db.commit()
    return None


@router.post("/usuarios/{codusr}/reactivar", response_model=UsuarioOut)
def reactivar_usuario(
    codusr: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    usuario = db.get(Usuario, codusr)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    usuario.usr_fecbaj = None
    db.commit()
    db.refresh(usuario)
    return _usuario_out(usuario, db=db)


# =========================
# LOGINS
# =========================
def _rango_fechas(desde: date | None, hasta: date | None):
    if desde is None and hasta is None:
        hasta = date.today()
        desde = hasta - timedelta(days=13)
    elif desde is None:
        desde = hasta - timedelta(days=13)
    elif hasta is None:
        hasta = date.today()
    if hasta < desde:
        raise HTTPException(status_code=400, detail="hasta debe ser >= desde")
    return desde, hasta


@router.get("/logins", response_model=list[LoginOut])
def listar_logins(
    limit: int = Query(500, ge=1, le=5000),
    codusr: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    q = db.query(Login)
    if codusr:
        q = q.filter(Login.log_codusr == codusr)
    if desde or hasta:
        d, h = _rango_fechas(desde, hasta)
        inicio = datetime.combine(d, time.min)
        fin = datetime.combine(h, time.max)
        q = q.filter(Login.log_feclog >= inicio, Login.log_feclog <= fin)
    return q.order_by(Login.log_feclog.desc()).limit(limit).all()


@router.get("/logins/resumen", response_model=LoginResumenOut)
def resumen_logins(
    desde: date | None = None,
    hasta: date | None = None,
    codusr: str | None = None,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    d, h = _rango_fechas(desde, hasta)
    inicio = datetime.combine(d, time.min)
    fin = datetime.combine(h, time.max)

    q = db.query(Login).filter(Login.log_feclog >= inicio, Login.log_feclog <= fin)
    if codusr:
        q = q.filter(Login.log_codusr == codusr)
    filas = q.order_by(Login.log_feclog.asc()).all()

    por_dia_hora: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    for fila in filas:
        clave = fila.log_feclog.strftime("%Y-%m-%d")
        por_dia_hora[clave][fila.log_feclog.hour] += 1

    dias: list[LoginDiaOut] = []
    cursor = d
    while cursor <= h:
        clave = cursor.isoformat()
        horas_map = por_dia_hora.get(clave, {})
        por_hora = [
            LoginHoraOut(hora=hora, total=int(horas_map.get(hora, 0)))
            for hora in range(24)
        ]
        dias.append(
            LoginDiaOut(
                fecha=clave,
                total=sum(h.total for h in por_hora),
                por_hora=por_hora,
            )
        )
        cursor += timedelta(days=1)

    return LoginResumenOut(dias=dias, total=sum(dia.total for dia in dias))


@router.get("/logins/usuario/{codusr}", response_model=list[LoginOut])
def logins_por_usuario(
    codusr: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    return (
        db.query(Login)
        .filter(Login.log_codusr == codusr)
        .order_by(Login.log_feclog.desc())
        .all()
    )


# =========================
# PERMISOS
# =========================
@router.get("/permisos", response_model=list[PermisoOut])
def listar_permisos(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    return db.query(Permiso).order_by(Permiso.per_codper).all()


@router.post("/permisos", response_model=PermisoOut, status_code=201)
def crear_permiso(
    payload: PermisoCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    if db.get(Permiso, payload.per_codper):
        raise HTTPException(status_code=409, detail="El permiso ya existe")
    permiso = Permiso(
        per_codper=payload.per_codper,
        per_nomper=payload.per_nomper,
        per_feccre=datetime.now(),
        per_usrcre=payload.per_usrcre or admin.usr_codusr,
    )
    db.add(permiso)
    db.commit()
    db.refresh(permiso)
    return permiso


@router.put("/permisos/{codper}", response_model=PermisoOut)
def actualizar_permiso(
    codper: str,
    payload: PermisoCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    permiso = db.get(Permiso, codper)
    if not permiso:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    permiso.per_nomper = payload.per_nomper
    db.commit()
    db.refresh(permiso)
    return permiso


@router.delete("/permisos/{codper}", status_code=204)
def baja_permiso(
    codper: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    if codper in (ADMIN_CODPER, SUPERADMIN_CODPER):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede dar de baja el permiso {codper}",
        )
    permiso = db.get(Permiso, codper)
    if not permiso:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    permiso.per_fecbaj = datetime.now()
    db.commit()
    return None


@router.post("/permisos/{codper}/reactivar", response_model=PermisoOut)
def reactivar_permiso(
    codper: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    permiso = db.get(Permiso, codper)
    if not permiso:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    permiso.per_fecbaj = None
    db.commit()
    db.refresh(permiso)
    return permiso


@router.delete("/permisos/{codper}/permanente", status_code=204)
def borrar_permiso_permanente(
    codper: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    if codper in (ADMIN_CODPER, SUPERADMIN_CODPER):
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el permiso {codper}",
        )
    permiso = db.get(Permiso, codper)
    if not permiso:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    asignaciones = db.query(PermisoUsuario).filter(PermisoUsuario.peu_codper == codper).count()
    if asignaciones:
        raise HTTPException(
            status_code=409,
            detail=f"Hay {asignaciones} asignación(es). Quítalas antes de borrar el permiso.",
        )
    db.delete(permiso)
    db.commit()
    return None


# =========================
# PERMISOS USUARIO
# =========================
@router.get("/permisos-usuario", response_model=list[PermisoUsuarioOut])
def listar_permisos_usuario(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    return db.query(PermisoUsuario).order_by(PermisoUsuario.peu_codpeu).all()


@router.get("/permisos-usuario/{codusr}", response_model=list[PermisoUsuarioOut])
def permisos_de_usuario(
    codusr: str,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    return db.query(PermisoUsuario).filter(PermisoUsuario.peu_codusr == codusr).all()


@router.post("/permisos-usuario", response_model=PermisoUsuarioOut, status_code=201)
def asignar_permiso(
    payload: PermisoUsuarioCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    if not db.get(Usuario, payload.peu_codusr):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    permiso = db.get(Permiso, payload.peu_codper)
    if not permiso:
        raise HTTPException(status_code=404, detail="Permiso no encontrado")
    if permiso.per_fecbaj is not None:
        raise HTTPException(status_code=400, detail="El permiso está dado de baja")

    if payload.peu_codper == SUPERADMIN_CODPER:
        _assert_puede_asignar_superadmin(db, admin)
        _assert_superadmin_unico(db, payload.peu_codusr)

    existe = (
        db.query(PermisoUsuario)
        .filter(
            PermisoUsuario.peu_codusr == payload.peu_codusr,
            PermisoUsuario.peu_codper == payload.peu_codper,
        )
        .first()
    )
    if existe:
        if existe.peu_fecbaj is None:
            raise HTTPException(status_code=409, detail="El usuario ya tiene ese permiso")
        # Reactivar asignación dada de baja
        if payload.peu_codper == SUPERADMIN_CODPER:
            _assert_puede_asignar_superadmin(db, admin)
            _assert_superadmin_unico(db, payload.peu_codusr)
        existe.peu_fecbaj = None
        existe.peu_feccre = datetime.now()
        existe.peu_usrcre = payload.peu_usrcre or admin.usr_codusr
        db.commit()
        db.refresh(existe)
        return existe

    asignacion = PermisoUsuario(
        peu_codusr=payload.peu_codusr,
        peu_codper=payload.peu_codper,
        peu_feccre=datetime.now(),
        peu_usrcre=payload.peu_usrcre or admin.usr_codusr,
    )
    db.add(asignacion)
    db.commit()
    db.refresh(asignacion)
    return asignacion


@router.delete("/permisos-usuario/{peu_id}", status_code=204)
def baja_asignacion(
    peu_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    asignacion = db.get(PermisoUsuario, peu_id)
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    if (
        asignacion.peu_codusr == admin.usr_codusr
        and asignacion.peu_codper in (ADMIN_CODPER, SUPERADMIN_CODPER)
        and asignacion.peu_fecbaj is None
    ):
        raise HTTPException(
            status_code=400,
            detail=f"No puedes darte de baja a ti mismo el permiso {asignacion.peu_codper}",
        )
    if asignacion.peu_codper == SUPERADMIN_CODPER and asignacion.peu_fecbaj is None:
        if not es_superadmin(db, admin.usr_codusr):
            raise HTTPException(
                status_code=403,
                detail="Solo el SUPERADMIN puede quitar el permiso SUPERADMIN",
            )
        if count_superadmins(db) <= 1:
            raise HTTPException(
                status_code=400,
                detail="No se puede quitar el único SUPERADMIN. Asígnalo a otro usuario antes.",
            )
    asignacion.peu_fecbaj = datetime.now()
    db.commit()
    return None


@router.post("/permisos-usuario/{peu_id}/reactivar", response_model=PermisoUsuarioOut)
def reactivar_asignacion(
    peu_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    asignacion = db.get(PermisoUsuario, peu_id)
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    permiso = db.get(Permiso, asignacion.peu_codper)
    if permiso and permiso.per_fecbaj is not None:
        raise HTTPException(status_code=400, detail="El permiso del catálogo está dado de baja")
    if asignacion.peu_codper == SUPERADMIN_CODPER:
        _assert_puede_asignar_superadmin(db, admin)
        _assert_superadmin_unico(db, asignacion.peu_codusr)
    asignacion.peu_fecbaj = None
    db.commit()
    db.refresh(asignacion)
    return asignacion


@router.delete("/permisos-usuario/{peu_id}/permanente", status_code=204)
def borrar_asignacion_permanente(
    peu_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(require_admin),
):
    asignacion = db.get(PermisoUsuario, peu_id)
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    if (
        asignacion.peu_codusr == admin.usr_codusr
        and asignacion.peu_codper in (ADMIN_CODPER, SUPERADMIN_CODPER)
    ):
        raise HTTPException(
            status_code=400,
            detail=f"No puedes borrarte a ti mismo el permiso {asignacion.peu_codper}",
        )
    if asignacion.peu_codper == SUPERADMIN_CODPER and asignacion.peu_fecbaj is None:
        if not es_superadmin(db, admin.usr_codusr):
            raise HTTPException(
                status_code=403,
                detail="Solo el SUPERADMIN puede quitar el permiso SUPERADMIN",
            )
        if count_superadmins(db) <= 1:
            raise HTTPException(
                status_code=400,
                detail="No se puede quitar el único SUPERADMIN. Asígnalo a otro usuario antes.",
            )
    db.delete(asignacion)
    db.commit()
    return None


# =========================
# CENTROS (mantenimiento GENERAL)
# =========================
@router.get("/centros", response_model=list[CentroOut])
def listar_centros(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    return db.query(Centro).order_by(Centro.exi_codcen).all()


@router.get("/centros/{codcen}", response_model=CentroOut)
def obtener_centro(
    codcen: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    centro = db.get(Centro, codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    return centro


@router.post("/centros", response_model=CentroOut, status_code=201)
def crear_centro(
    payload: CentroCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    if db.get(Centro, payload.exi_codcen):
        raise HTTPException(status_code=409, detail="El centro ya existe")
    numgru = payload.exi_numgru if payload.exi_numgru in (3, 4) else 3
    centro = Centro(
        exi_codcen=payload.exi_codcen,
        exi_nomcen=payload.exi_nomcen,
        exi_latgps=payload.exi_latgps,
        exi_longgps=payload.exi_longgps,
        exi_nompob=payload.exi_nompob,
        exi_capaci=payload.exi_capaci,
        exi_descen=payload.exi_descen,
        exi_numgru=numgru,
        cen_usrcre=user.usr_codusr,
        cen_feccre=datetime.now(),
    )
    db.add(centro)
    db.commit()
    db.refresh(centro)
    return centro


@router.put("/centros/{codcen}", response_model=CentroOut)
def actualizar_centro(
    codcen: str,
    payload: CentroUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    centro = db.get(Centro, codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "exi_numgru" in data and data["exi_numgru"] is not None and data["exi_numgru"] not in (3, 4):
        raise HTTPException(status_code=400, detail="exi_numgru debe ser 3 o 4")
    for key, value in data.items():
        setattr(centro, key, value)
    db.commit()
    db.refresh(centro)
    return centro


@router.delete("/centros/{codcen}", status_code=204)
def baja_centro(
    codcen: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    centro = db.get(Centro, codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    centro.exi_fecbaj = datetime.now()
    db.commit()
    return None


@router.post("/centros/{codcen}/reactivar", response_model=CentroOut)
def reactivar_centro(
    codcen: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    centro = db.get(Centro, codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    centro.exi_fecbaj = None
    db.commit()
    db.refresh(centro)
    return centro


@router.delete("/centros/{codcen}/permanente", status_code=204)
def borrar_centro_permanente(
    codcen: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    centro = db.get(Centro, codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    db.query(TipoGrupoCentro).filter(TipoGrupoCentro.tgc_codcen == codcen).delete()
    db.query(NinoCentro).filter(NinoCentro.nic_codcen == codcen).delete()
    db.query(MonitorCentro).filter(MonitorCentro.moc_codcen == codcen).delete()
    db.query(NinoAsistencia).filter(NinoAsistencia.asi_codcen == codcen).delete()
    db.query(Evento).filter(Evento.exi_codcen == codcen).delete()
    db.delete(centro)
    db.commit()
    return None


# =========================
# LOOKUPS (GENERAL)
# =========================
@router.get("/lookups/usuarios")
def lookup_usuarios(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    rows = (
        db.query(Usuario)
        .filter(Usuario.usr_fecbaj.is_(None))
        .order_by(Usuario.usr_codusr)
        .all()
    )
    return [{"usr_codusr": u.usr_codusr, "usr_name": u.usr_name} for u in rows]


# =========================
# MONITORES (mantenimiento GENERAL)
# =========================
@router.get("/monitores", response_model=list[MonitorOut])
def listar_monitores(
    codcen: str | None = None,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(Monitor)
    if codcen:
        q = q.filter(Monitor.mon_codcen == codcen)
    return q.order_by(Monitor.mon_codmon.desc()).all()


@router.get("/monitores/{codmon}", response_model=MonitorOut)
def obtener_monitor(
    codmon: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    monitor = db.get(Monitor, codmon)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    return monitor


def _norm_tipmon(value: str | None) -> str | None:
    tip = (value or "").strip().upper() or None
    if tip is None:
        return None
    if tip not in ("INTERNO", "BECARIO"):
        raise HTTPException(status_code=400, detail="Tipo de monitor: INTERNO o BECARIO")
    return tip


@router.post("/monitores", response_model=MonitorOut, status_code=201)
def crear_monitor(
    payload: MonitorCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    """Crea el monitor. Si se informan datos de usuario, también crea y vincula el usuario."""
    centro = db.get(Centro, payload.mon_codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    if centro.exi_fecbaj is not None:
        raise HTTPException(status_code=400, detail="El centro está dado de baja")

    ahora = datetime.now()
    codusr = _crear_usuario_para_monitor(
        db,
        actor=user,
        mon_nommon=payload.mon_nommon,
        usr_codusr=payload.usr_codusr,
        usr_pass=payload.usr_pass,
        usr_name=payload.usr_name,
        usr_email=payload.usr_email,
        usr_descri=payload.usr_descri,
        ahora=ahora,
    )

    monitor = Monitor(
        mon_nommon=payload.mon_nommon,
        mon_codusr=codusr,
        mon_codcen=payload.mon_codcen,
        mon_ciumon=payload.mon_ciumon,
        mon_tipmon=_norm_tipmon(payload.mon_tipmon),
        mon_usrcre=user.usr_codusr,
        mon_feccre=ahora,
    )
    db.add(monitor)
    db.commit()
    db.refresh(monitor)
    return monitor


@router.put("/monitores/{codmon}", response_model=MonitorOut)
def actualizar_monitor(
    codmon: int,
    payload: MonitorUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    monitor = db.get(Monitor, codmon)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    data = payload.model_dump(exclude_unset=True)
    usr_fields = {
        k: data.pop(k)
        for k in ("usr_codusr", "usr_pass", "usr_name", "usr_email", "usr_descri")
        if k in data
    }

    if "mon_codcen" in data and data["mon_codcen"]:
        centro = db.get(Centro, data["mon_codcen"])
        if not centro:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if centro.exi_fecbaj is not None:
            raise HTTPException(status_code=400, detail="El centro está dado de baja")

    if "mon_tipmon" in data:
        data["mon_tipmon"] = _norm_tipmon(data.get("mon_tipmon"))

    for key, value in data.items():
        setattr(monitor, key, value)

    # Si el monitor aún no tiene usuario y llegan datos, crearlo y vincular
    quiere_usuario = any(
        usr_fields.get(k) for k in ("usr_codusr", "usr_pass", "usr_email", "usr_descri", "usr_name")
    )
    if quiere_usuario:
        if monitor.mon_codusr:
            raise HTTPException(
                status_code=400,
                detail="El monitor ya tiene usuario; no se puede cambiar ni reasignar",
            )
        codusr = _crear_usuario_para_monitor(
            db,
            actor=user,
            mon_nommon=monitor.mon_nommon,
            usr_codusr=usr_fields.get("usr_codusr"),
            usr_pass=usr_fields.get("usr_pass"),
            usr_name=usr_fields.get("usr_name"),
            usr_email=usr_fields.get("usr_email"),
            usr_descri=usr_fields.get("usr_descri"),
        )
        if not codusr:
            raise HTTPException(
                status_code=400,
                detail="Para crear el usuario del monitor indica código y contraseña",
            )
        monitor.mon_codusr = codusr

    db.commit()
    db.refresh(monitor)
    return monitor


def _crear_usuario_para_monitor(
    db: Session,
    *,
    actor: Usuario,
    mon_nommon: str,
    usr_codusr: str | None,
    usr_pass: str | None,
    usr_name: str | None = None,
    usr_email: str | None = None,
    usr_descri: str | None = None,
    ahora: datetime | None = None,
) -> str | None:
    """Crea usuario para un monitor. None si no se pidió crear usuario."""
    cod = (usr_codusr or "").strip()
    pwd = usr_pass or ""
    if not cod and not pwd and not (usr_email or "").strip() and not (usr_descri or "").strip():
        return None
    if not cod or not pwd:
        raise HTTPException(
            status_code=400,
            detail="Para crear el usuario del monitor indica código y contraseña",
        )
    if db.get(Usuario, cod):
        raise HTTPException(status_code=409, detail="El usuario ya existe")
    ya_monitor = db.query(Monitor).filter(Monitor.mon_codusr == cod).first()
    if ya_monitor:
        raise HTTPException(
            status_code=409,
            detail="Ese usuario ya está asociado a otro monitor",
        )
    if usr_email:
        existe_email = (
            db.query(Usuario)
            .filter(Usuario.usr_email.ilike(usr_email.strip()))
            .first()
        )
        if existe_email:
            raise HTTPException(status_code=409, detail="El email ya está en uso")

    ts = ahora or datetime.now()
    usuario_nuevo = Usuario(
        usr_codusr=cod,
        usr_name=(usr_name or mon_nommon).strip(),
        user_feccre=ts,
        usr_usrcre=actor.usr_codusr,
        usr_pass=pwd,
        usr_email=usr_email.strip().lower() if usr_email else None,
        usr_descri=usr_descri,
        usr_tipusr="MONITOR",
    )
    db.add(usuario_nuevo)
    db.flush()
    return cod


@router.delete("/monitores/{codmon}", status_code=204)
def baja_monitor(
    codmon: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    monitor = db.get(Monitor, codmon)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    monitor.mon_fecbaj = datetime.now()
    db.commit()
    return None


@router.post("/monitores/{codmon}/reactivar", response_model=MonitorOut)
def reactivar_monitor(
    codmon: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    monitor = db.get(Monitor, codmon)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    monitor.mon_fecbaj = None
    db.commit()
    db.refresh(monitor)
    return monitor


@router.delete("/monitores/{codmon}/permanente", status_code=204)
def borrar_monitor_permanente(
    codmon: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    monitor = db.get(Monitor, codmon)
    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    db.query(MonitorCentro).filter(MonitorCentro.moc_codmon == codmon).delete()
    db.query(MonitorPeriodo).filter(MonitorPeriodo.mpe_codmon == codmon).delete()
    db.query(NinoAsistencia).filter(NinoAsistencia.asi_codmon == codmon).delete()
    db.delete(monitor)
    db.commit()
    return None


# =========================
# MONITORES POR CENTRO / GRUPO (GENERAL)
# =========================
def _monitor_centro_out(db: Session, asoc: MonitorCentro) -> MonitorCentroOut:
    mon = db.get(Monitor, asoc.moc_codmon)
    cen = db.get(Centro, asoc.moc_codcen)
    per = db.get(Periodo, asoc.moc_codper)
    return MonitorCentroOut(
        moc_codmoc=asoc.moc_codmoc,
        moc_codmon=asoc.moc_codmon,
        moc_codcen=asoc.moc_codcen,
        moc_tipgru=asoc.moc_tipgru,
        moc_codper=asoc.moc_codper,
        mon_nommon=mon.mon_nommon if mon else None,
        mon_tipmon=mon.mon_tipmon if mon else None,
        exi_nomcen=cen.exi_nomcen if cen else None,
        per_fecini=per.per_fecini if per else None,
        per_fecfin=per.per_fecfin if per else None,
    )


@router.get("/monitores-cent", response_model=list[MonitorCentroOut])
def listar_monitores_cent(
    codcen: str | None = Query(None),
    codper: str | None = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(MonitorCentro)
    if codcen:
        q = q.filter(MonitorCentro.moc_codcen == codcen)
    if codper:
        q = q.filter(MonitorCentro.moc_codper == codper.strip().upper())
    rows = q.order_by(MonitorCentro.moc_tipgru, MonitorCentro.moc_codmoc).all()
    return [_monitor_centro_out(db, r) for r in rows]


@router.post("/monitores-cent", response_model=MonitorCentroOut, status_code=201)
def crear_monitor_cent(
    payload: MonitorCentroCreate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    mon = db.get(Monitor, payload.moc_codmon)
    if not mon or mon.mon_fecbaj is not None:
        raise HTTPException(status_code=404, detail="Monitor no encontrado o de baja")
    if not db.get(Centro, payload.moc_codcen):
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    codper = (payload.moc_codper or "").strip().upper()
    per = db.get(Periodo, codper)
    if not per:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    if (per.per_status or "").strip() != "Activo":
        raise HTTPException(status_code=400, detail="Solo se pueden asignar periodos activos")
    tipgru = (payload.moc_tipgru or "").strip()
    if not tipgru:
        raise HTTPException(status_code=400, detail="El grupo es obligatorio")
    existe = (
        db.query(MonitorCentro)
        .filter(
            MonitorCentro.moc_codmon == payload.moc_codmon,
            MonitorCentro.moc_codcen == payload.moc_codcen,
            MonitorCentro.moc_codper == codper,
        )
        .first()
    )
    if existe:
        existe.moc_tipgru = tipgru
        db.commit()
        db.refresh(existe)
        return _monitor_centro_out(db, existe)
    asoc = MonitorCentro(
        moc_codmon=payload.moc_codmon,
        moc_codcen=payload.moc_codcen,
        moc_tipgru=tipgru,
        moc_codper=codper,
    )
    db.add(asoc)
    db.commit()
    db.refresh(asoc)
    return _monitor_centro_out(db, asoc)


@router.put("/monitores-cent/{codmoc}", response_model=MonitorCentroOut)
def actualizar_monitor_cent(
    codmoc: int,
    payload: MonitorCentroUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    asoc = db.get(MonitorCentro, codmoc)
    if not asoc:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "moc_codcen" in data and data["moc_codcen"] is not None:
        if not db.get(Centro, data["moc_codcen"]):
            raise HTTPException(status_code=404, detail="Centro no encontrado")
    if "moc_codper" in data and data["moc_codper"] is not None:
        codper = str(data["moc_codper"]).strip().upper()
        per = db.get(Periodo, codper)
        if not per:
            raise HTTPException(status_code=404, detail="Periodo no encontrado")
        if (per.per_status or "").strip() != "Activo":
            raise HTTPException(status_code=400, detail="Solo se pueden asignar periodos activos")
        data["moc_codper"] = codper
    if "moc_tipgru" in data and data["moc_tipgru"] is not None:
        data["moc_tipgru"] = data["moc_tipgru"].strip()
        if not data["moc_tipgru"]:
            raise HTTPException(status_code=400, detail="El grupo es obligatorio")
    for key, value in data.items():
        setattr(asoc, key, value)
    db.commit()
    db.refresh(asoc)
    return _monitor_centro_out(db, asoc)


@router.delete("/monitores-cent/{codmoc}", status_code=204)
def borrar_monitor_cent(
    codmoc: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    asoc = db.get(MonitorCentro, codmoc)
    if not asoc:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(asoc)
    db.commit()
    return None


# =========================
# NIÑOS (mantenimiento GENERAL)
# =========================
@router.get("/ninos", response_model=list[NinoOut])
def listar_ninos(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    return db.query(Nino).order_by(Nino.nin_codnin.desc()).all()


@router.get("/ninos/{codnin}", response_model=NinoOut)
def obtener_nino(
    codnin: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    nino = db.get(Nino, codnin)
    if not nino:
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    return nino


@router.post("/ninos", response_model=NinoOut, status_code=201)
def crear_nino(
    payload: NinoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    nino = Nino(
        nin_nomnin=payload.nin_nomnin.strip(),
        nin_fecnac=payload.nin_fecnac,
        nin_tipnin=(payload.nin_tipnin or "").strip() or None,
        nin_apoyo=bool(payload.nin_apoyo),
        nin_comali=(payload.nin_comali or "").strip() or None,
        nin_desnin=payload.nin_desnin,
        nin_usrcre=user.usr_codusr,
        nin_feccre=datetime.now(),
    )
    db.add(nino)
    db.commit()
    db.refresh(nino)
    return nino


@router.put("/ninos/{codnin}", response_model=NinoOut)
def actualizar_nino(
    codnin: int,
    payload: NinoUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    nino = db.get(Nino, codnin)
    if not nino:
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "nin_nomnin" in data and data["nin_nomnin"] is not None:
        data["nin_nomnin"] = data["nin_nomnin"].strip()
    if "nin_tipnin" in data and data["nin_tipnin"] is not None:
        data["nin_tipnin"] = data["nin_tipnin"].strip() or None
    if "nin_comali" in data and data["nin_comali"] is not None:
        data["nin_comali"] = data["nin_comali"].strip() or None
    for key, value in data.items():
        setattr(nino, key, value)
    db.commit()
    db.refresh(nino)
    return nino


@router.delete("/ninos/{codnin}", status_code=204)
def baja_nino(
    codnin: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    nino = db.get(Nino, codnin)
    if not nino:
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    nino.nin_fecbaj = datetime.now()
    db.commit()
    return None


@router.post("/ninos/{codnin}/reactivar", response_model=NinoOut)
def reactivar_nino(
    codnin: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    nino = db.get(Nino, codnin)
    if not nino:
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    nino.nin_fecbaj = None
    db.commit()
    db.refresh(nino)
    return nino


@router.delete("/ninos/{codnin}/permanente", status_code=204)
def borrar_nino_permanente(
    codnin: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    nino = db.get(Nino, codnin)
    if not nino:
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    db.query(NinoCentro).filter(NinoCentro.nic_codnin == codnin).delete()
    db.query(NinoPeriodo).filter(NinoPeriodo.nip_codnin == codnin).delete()
    db.query(NinoAsistencia).filter(NinoAsistencia.asi_codnin == codnin).delete()
    db.delete(nino)
    db.commit()
    return None


# =========================
# NIÑOS POR CENTRO (GENERAL)
# =========================
def _nino_centro_out(db: Session, asoc: NinoCentro) -> NinoCentroOut:
    nino = db.get(Nino, asoc.nic_codnin)
    centro = db.get(Centro, asoc.nic_codcen)
    return NinoCentroOut(
        nic_codnic=asoc.nic_codnic,
        nic_codnin=asoc.nic_codnin,
        nic_codcen=asoc.nic_codcen,
        nic_tipgru=asoc.nic_tipgru,
        nin_nomnin=nino.nin_nomnin if nino else None,
        nin_fecnac=nino.nin_fecnac if nino else None,
        nin_tipnin=nino.nin_tipnin if nino else None,
        nin_apoyo=bool(nino.nin_apoyo) if nino else None,
        exi_nomcen=centro.exi_nomcen if centro else None,
    )


@router.get("/ninos-cent", response_model=list[NinoCentroOut])
def listar_ninos_cent(
    codcen: str | None = None,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(NinoCentro)
    if codcen:
        q = q.filter(NinoCentro.nic_codcen == codcen)
    rows = q.order_by(NinoCentro.nic_tipgru, NinoCentro.nic_codnic).all()
    return [_nino_centro_out(db, r) for r in rows]


@router.get("/ninos-cent/grupos", response_model=list[str])
def listar_grupos_centro(
    codcen: str = Query(...),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    rows = (
        db.query(NinoCentro.nic_tipgru)
        .filter(NinoCentro.nic_codcen == codcen)
        .distinct()
        .order_by(NinoCentro.nic_tipgru)
        .all()
    )
    grupos = [r[0] for r in rows if r[0]]
    if "Sin grupo" not in grupos:
        grupos.insert(0, "Sin grupo")
    return grupos


@router.post("/ninos-cent", response_model=NinoCentroOut, status_code=201)
def crear_nino_cent(
    payload: NinoCentroCreate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    nino = db.get(Nino, payload.nic_codnin)
    if not nino or nino.nin_fecbaj is not None:
        raise HTTPException(status_code=404, detail="Niño no encontrado o de baja")
    centro = db.get(Centro, payload.nic_codcen)
    if not centro:
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    if centro.exi_fecbaj is not None:
        raise HTTPException(status_code=400, detail="El centro está dado de baja")

    tipgru = (payload.nic_tipgru or "Sin grupo").strip() or "Sin grupo"
    existe = (
        db.query(NinoCentro)
        .filter(
            NinoCentro.nic_codnin == payload.nic_codnin,
            NinoCentro.nic_codcen == payload.nic_codcen,
        )
        .first()
    )
    if existe:
        # Mover de grupo en el mismo centro
        existe.nic_tipgru = tipgru
        db.commit()
        db.refresh(existe)
        return _nino_centro_out(db, existe)

    asoc = NinoCentro(
        nic_codnin=payload.nic_codnin,
        nic_codcen=payload.nic_codcen,
        nic_tipgru=tipgru,
    )
    db.add(asoc)
    db.commit()
    db.refresh(asoc)
    return _nino_centro_out(db, asoc)


@router.put("/ninos-cent/{codnic}", response_model=NinoCentroOut)
def actualizar_nino_cent(
    codnic: int,
    payload: NinoCentroUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    asoc = db.get(NinoCentro, codnic)
    if not asoc:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "nic_codcen" in data and data["nic_codcen"]:
        centro = db.get(Centro, data["nic_codcen"])
        if not centro:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if centro.exi_fecbaj is not None:
            raise HTTPException(status_code=400, detail="El centro está dado de baja")
        # Evitar duplicar niño en el nuevo centro
        otro = (
            db.query(NinoCentro)
            .filter(
                NinoCentro.nic_codnin == asoc.nic_codnin,
                NinoCentro.nic_codcen == data["nic_codcen"],
                NinoCentro.nic_codnic != codnic,
            )
            .first()
        )
        if otro:
            raise HTTPException(
                status_code=409,
                detail="El niño ya está asignado a ese centro",
            )
    if "nic_tipgru" in data and data["nic_tipgru"] is not None:
        data["nic_tipgru"] = data["nic_tipgru"].strip() or "Sin grupo"
    for key, value in data.items():
        setattr(asoc, key, value)
    db.commit()
    db.refresh(asoc)
    return _nino_centro_out(db, asoc)


@router.delete("/ninos-cent/{codnic}", status_code=204)
def borrar_nino_cent(
    codnic: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    asoc = db.get(NinoCentro, codnic)
    if not asoc:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(asoc)
    db.commit()
    return None


# =========================
# TIPOS DE GRUPO (mantenimiento GENERAL)
# =========================
@router.get("/tipos-grupo", response_model=list[TipoGrupoOut])
def listar_tipos_grupo(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    return db.query(TipoGrupo).order_by(TipoGrupo.tip_descri.asc()).all()


@router.get("/tipos-grupo/{codgru}", response_model=TipoGrupoOut)
def obtener_tipo_grupo(
    codgru: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    tip = db.get(TipoGrupo, codgru)
    if not tip:
        raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado")
    return tip


@router.post("/tipos-grupo", response_model=TipoGrupoOut, status_code=201)
def crear_tipo_grupo(
    payload: TipoGrupoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    descri = payload.tip_descri.strip()
    if not descri:
        raise HTTPException(status_code=400, detail="La descripción es obligatoria")
    existe = (
        db.query(TipoGrupo)
        .filter(TipoGrupo.tip_descri.ilike(descri))
        .first()
    )
    if existe:
        raise HTTPException(status_code=409, detail="Ya existe un tipo de grupo con esa descripción")
    tip = TipoGrupo(
        tip_descri=descri,
        tip_usrcre=user.usr_codusr,
        tip_feccre=datetime.now(),
    )
    db.add(tip)
    db.commit()
    db.refresh(tip)
    return tip


@router.put("/tipos-grupo/{codgru}", response_model=TipoGrupoOut)
def actualizar_tipo_grupo(
    codgru: int,
    payload: TipoGrupoUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    tip = db.get(TipoGrupo, codgru)
    if not tip:
        raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "tip_descri" in data and data["tip_descri"] is not None:
        descri = data["tip_descri"].strip()
        if not descri:
            raise HTTPException(status_code=400, detail="La descripción es obligatoria")
        existe = (
            db.query(TipoGrupo)
            .filter(TipoGrupo.tip_descri.ilike(descri), TipoGrupo.tip_codgru != codgru)
            .first()
        )
        if existe:
            raise HTTPException(status_code=409, detail="Ya existe un tipo de grupo con esa descripción")
        data["tip_descri"] = descri
    for key, value in data.items():
        setattr(tip, key, value)
    db.commit()
    db.refresh(tip)
    return tip


@router.delete("/tipos-grupo/{codgru}", status_code=204)
def baja_tipo_grupo(
    codgru: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    tip = db.get(TipoGrupo, codgru)
    if not tip:
        raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado")
    tip.tip_fecbaj = datetime.now()
    db.commit()
    return None


@router.post("/tipos-grupo/{codgru}/reactivar", response_model=TipoGrupoOut)
def reactivar_tipo_grupo(
    codgru: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    tip = db.get(TipoGrupo, codgru)
    if not tip:
        raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado")
    tip.tip_fecbaj = None
    db.commit()
    db.refresh(tip)
    return tip


@router.delete("/tipos-grupo/{codgru}/permanente", status_code=204)
def borrar_tipo_grupo_permanente(
    codgru: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    tip = db.get(TipoGrupo, codgru)
    if not tip:
        raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado")
    db.query(TipoGrupoCentro).filter(TipoGrupoCentro.tgc_tipgru == codgru).delete()
    db.delete(tip)
    db.commit()
    return None


# =========================
# TIPOS DE GRUPO POR CENTRO (GENERAL)
# =========================
def _tipo_grupo_centro_out(
    db: Session,
    row: TipoGrupoCentro,
    stats: dict | None = None,
) -> TipoGrupoCentroOut:
    tip = db.get(TipoGrupo, row.tgc_tipgru)
    cen = db.get(Centro, row.tgc_codcen)
    descri = tip.tip_descri if tip else None
    key = (row.tgc_codcen, (descri or "").strip())
    st = (stats or {}).get(key, {"ninos_total": 0, "ninos_apoyo": 0, "monitores": []})
    mons = st.get("monitores") or []
    return TipoGrupoCentroOut(
        tgc_codtgc=row.tgc_codtgc,
        tgc_codcen=row.tgc_codcen,
        tgc_tipgru=row.tgc_tipgru,
        tgc_ordgru=row.tgc_ordgru,
        tip_descri=descri,
        exi_nomcen=cen.exi_nomcen if cen else None,
        ninos_total=int(st.get("ninos_total") or 0),
        ninos_apoyo=int(st.get("ninos_apoyo") or 0),
        monitores=mons,
        monitores_txt=", ".join(mons) if mons else "—",
    )


def _stats_grupos_centro(db: Session, codcen: str | None = None) -> dict:
    """Agrega niños/apoyo/monitores por (codcen, tipgru)."""
    stats: dict = defaultdict(lambda: {"ninos_total": 0, "ninos_apoyo": 0, "monitores": []})

    q_ninos = (
        db.query(NinoCentro.nic_codcen, NinoCentro.nic_tipgru, Nino.nin_apoyo)
        .outerjoin(Nino, Nino.nin_codnin == NinoCentro.nic_codnin)
    )
    if codcen:
        q_ninos = q_ninos.filter(NinoCentro.nic_codcen == codcen)
    for cen, tipgru, apoyo in q_ninos.all():
        key = (cen, (tipgru or "").strip())
        stats[key]["ninos_total"] += 1
        if apoyo:
            stats[key]["ninos_apoyo"] += 1

    q_mon = (
        db.query(MonitorCentro.moc_codcen, MonitorCentro.moc_tipgru, Monitor.mon_nommon)
        .outerjoin(Monitor, Monitor.mon_codmon == MonitorCentro.moc_codmon)
    )
    if codcen:
        q_mon = q_mon.filter(MonitorCentro.moc_codcen == codcen)
    for cen, tipgru, nombre in q_mon.all():
        key = (cen, (tipgru or "").strip())
        if nombre and nombre not in stats[key]["monitores"]:
            stats[key]["monitores"].append(nombre)

    return stats


@router.get("/tipos-grupos-centro", response_model=list[TipoGrupoCentroOut])
def listar_tipos_grupos_centro(
    codcen: str | None = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(TipoGrupoCentro)
    if codcen:
        q = q.filter(TipoGrupoCentro.tgc_codcen == codcen)
    rows = q.order_by(TipoGrupoCentro.tgc_codcen, TipoGrupoCentro.tgc_ordgru, TipoGrupoCentro.tgc_codtgc).all()
    stats = _stats_grupos_centro(db, codcen)
    return [_tipo_grupo_centro_out(db, r, stats) for r in rows]


@router.get("/tipos-grupos-centro/{codtgc}", response_model=TipoGrupoCentroOut)
def obtener_tipo_grupo_centro(
    codtgc: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(TipoGrupoCentro, codtgc)
    if not row:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    stats = _stats_grupos_centro(db, row.tgc_codcen)
    return _tipo_grupo_centro_out(db, row, stats)


@router.post("/tipos-grupos-centro", response_model=TipoGrupoCentroOut, status_code=201)
def crear_tipo_grupo_centro(
    payload: TipoGrupoCentroCreate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    if not db.get(Centro, payload.tgc_codcen):
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    tip = db.get(TipoGrupo, payload.tgc_tipgru)
    if not tip or tip.tip_fecbaj:
        raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado o de baja")
    existe = (
        db.query(TipoGrupoCentro)
        .filter(
            TipoGrupoCentro.tgc_codcen == payload.tgc_codcen,
            TipoGrupoCentro.tgc_tipgru == payload.tgc_tipgru,
        )
        .first()
    )
    if existe:
        raise HTTPException(status_code=409, detail="Ese tipo de grupo ya está asociado al centro")
    row = TipoGrupoCentro(
        tgc_codcen=payload.tgc_codcen,
        tgc_tipgru=payload.tgc_tipgru,
        tgc_ordgru=payload.tgc_ordgru or 1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _tipo_grupo_centro_out(db, row)


@router.put("/tipos-grupos-centro/{codtgc}", response_model=TipoGrupoCentroOut)
def actualizar_tipo_grupo_centro(
    codtgc: int,
    payload: TipoGrupoCentroUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(TipoGrupoCentro, codtgc)
    if not row:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    data = payload.model_dump(exclude_unset=True)
    if "tgc_codcen" in data and data["tgc_codcen"] is not None:
        if not db.get(Centro, data["tgc_codcen"]):
            raise HTTPException(status_code=404, detail="Centro no encontrado")
    if "tgc_tipgru" in data and data["tgc_tipgru"] is not None:
        tip = db.get(TipoGrupo, data["tgc_tipgru"])
        if not tip or tip.tip_fecbaj:
            raise HTTPException(status_code=404, detail="Tipo de grupo no encontrado o de baja")
    new_cen = data.get("tgc_codcen", row.tgc_codcen)
    new_tip = data.get("tgc_tipgru", row.tgc_tipgru)
    if new_cen != row.tgc_codcen or new_tip != row.tgc_tipgru:
        existe = (
            db.query(TipoGrupoCentro)
            .filter(
                TipoGrupoCentro.tgc_codcen == new_cen,
                TipoGrupoCentro.tgc_tipgru == new_tip,
                TipoGrupoCentro.tgc_codtgc != codtgc,
            )
            .first()
        )
        if existe:
            raise HTTPException(status_code=409, detail="Ese tipo de grupo ya está asociado al centro")
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _tipo_grupo_centro_out(db, row)


@router.delete("/tipos-grupos-centro/{codtgc}", status_code=204)
def borrar_tipo_grupo_centro(
    codtgc: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(TipoGrupoCentro, codtgc)
    if not row:
        raise HTTPException(status_code=404, detail="Asociación no encontrada")
    db.delete(row)
    db.commit()
    return None


# =========================
# EVENTOS (mantenimiento ADMIN + lectura home)
# =========================
def _evento_out(db: Session, eve: Evento) -> EventoOut:
    cen = db.get(Centro, eve.exi_codcen)
    return EventoOut(
        exi_eveide=eve.exi_eveide,
        exi_feceve=eve.exi_feceve,
        exi_nomeve=eve.exi_nomeve,
        exi_codcen=eve.exi_codcen,
        eve_neccir=bool(eve.eve_neccir),
        exi_nomcen=cen.exi_nomcen if cen else None,
    )


@router.get("/eventos", response_model=list[EventoOut])
def listar_eventos(
    codcen: str | None = Query(None),
    proximos: bool = Query(False),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    q = db.query(Evento)
    if codcen:
        q = q.filter(Evento.exi_codcen == codcen)
    if proximos:
        q = q.filter(Evento.exi_feceve >= date.today()).order_by(Evento.exi_feceve.asc(), Evento.exi_eveide.asc())
    else:
        q = q.order_by(Evento.exi_feceve.desc(), Evento.exi_eveide.desc())
    rows = q.limit(limit).all()
    return [_evento_out(db, r) for r in rows]


@router.get("/eventos/{eveide}", response_model=EventoOut)
def obtener_evento(
    eveide: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_admin),
):
    eve = db.get(Evento, eveide)
    if not eve:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return _evento_out(db, eve)


@router.post("/eventos", response_model=EventoOut, status_code=201)
def crear_evento(
    payload: EventoCreate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_admin),
):
    if not db.get(Centro, payload.exi_codcen):
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    nomeve = payload.exi_nomeve.strip()
    if not nomeve:
        raise HTTPException(status_code=400, detail="El nombre del evento es obligatorio")
    eve = Evento(
        exi_feceve=payload.exi_feceve,
        exi_nomeve=nomeve,
        exi_codcen=payload.exi_codcen,
        eve_neccir=bool(payload.eve_neccir),
    )
    db.add(eve)
    db.commit()
    db.refresh(eve)
    return _evento_out(db, eve)


@router.put("/eventos/{eveide}", response_model=EventoOut)
def actualizar_evento(
    eveide: int,
    payload: EventoUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_admin),
):
    eve = db.get(Evento, eveide)
    if not eve:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "exi_codcen" in data and data["exi_codcen"] is not None:
        if not db.get(Centro, data["exi_codcen"]):
            raise HTTPException(status_code=404, detail="Centro no encontrado")
    if "exi_nomeve" in data and data["exi_nomeve"] is not None:
        data["exi_nomeve"] = data["exi_nomeve"].strip()
        if not data["exi_nomeve"]:
            raise HTTPException(status_code=400, detail="El nombre del evento es obligatorio")
    for key, value in data.items():
        setattr(eve, key, value)
    db.commit()
    db.refresh(eve)
    return _evento_out(db, eve)


@router.delete("/eventos/{eveide}", status_code=204)
def borrar_evento(
    eveide: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_admin),
):
    eve = db.get(Evento, eveide)
    if not eve:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    db.delete(eve)
    db.commit()
    return None


# =========================
# PERIODOS (mantenimiento GENERAL)
# =========================
def _validar_fechas_periodo(fecini: date, fecfin: date) -> None:
    if fecfin < fecini:
        raise HTTPException(
            status_code=400,
            detail="La fecha de fin debe ser igual o posterior a la de inicio",
        )


def _normalizar_status_periodo(value: str | None) -> str:
    status = (value or "Activo").strip()
    if status not in ("Activo", "No Activo"):
        raise HTTPException(
            status_code=400,
            detail="El estado debe ser Activo o No Activo",
        )
    return status


@router.get("/periodos", response_model=list[PeriodoOut])
def listar_periodos(
    activos: bool = Query(False),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(Periodo)
    if activos:
        q = q.filter(Periodo.per_status == "Activo")
    return q.order_by(Periodo.per_fecini.desc(), Periodo.per_codper.asc()).all()


@router.get("/periodos/{codper}", response_model=PeriodoOut)
def obtener_periodo(
    codper: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    per = db.get(Periodo, codper)
    if not per:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    return per


@router.post("/periodos", response_model=PeriodoOut, status_code=201)
def crear_periodo(
    payload: PeriodoCreate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    codper = payload.per_codper.strip().upper()
    if not codper:
        raise HTTPException(status_code=400, detail="El código del periodo es obligatorio")
    if db.get(Periodo, codper):
        raise HTTPException(status_code=409, detail="Ya existe un periodo con ese código")
    _validar_fechas_periodo(payload.per_fecini, payload.per_fecfin)
    status = _normalizar_status_periodo(payload.per_status)
    per = Periodo(
        per_codper=codper,
        per_fecini=payload.per_fecini,
        per_fecfin=payload.per_fecfin,
        per_status=status,
    )
    db.add(per)
    db.commit()
    db.refresh(per)
    return per


@router.put("/periodos/{codper}", response_model=PeriodoOut)
def actualizar_periodo(
    codper: str,
    payload: PeriodoUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    per = db.get(Periodo, codper)
    if not per:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "per_status" in data and data["per_status"] is not None:
        data["per_status"] = _normalizar_status_periodo(data["per_status"])
    fecini = data.get("per_fecini", per.per_fecini)
    fecfin = data.get("per_fecfin", per.per_fecfin)
    _validar_fechas_periodo(fecini, fecfin)
    for key, value in data.items():
        setattr(per, key, value)
    db.commit()
    db.refresh(per)
    return per


@router.delete("/periodos/{codper}", status_code=204)
def borrar_periodo(
    codper: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    per = db.get(Periodo, codper)
    if not per:
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    db.query(NinoPeriodo).filter(NinoPeriodo.nip_codper == codper).delete()
    db.query(MonitorPeriodo).filter(MonitorPeriodo.mpe_codper == codper).delete()
    db.query(MonitorCentro).filter(MonitorCentro.moc_codper == codper).delete()
    db.query(NinoAsistencia).filter(NinoAsistencia.asi_codper == codper).delete()
    db.delete(per)
    db.commit()
    return None


# =========================
# NINOS-PERIODO (asistencia al campus)
# =========================
def _nino_periodo_out(db: Session, row: NinoPeriodo) -> NinoPeriodoOut:
    nino = db.get(Nino, row.nip_codnin)
    per = db.get(Periodo, row.nip_codper)
    return NinoPeriodoOut(
        nip_codnip=row.nip_codnip,
        nip_codnin=row.nip_codnin,
        nip_codper=row.nip_codper,
        nip_usrcre=row.nip_usrcre,
        nip_feccre=row.nip_feccre,
        nin_nomnin=nino.nin_nomnin if nino else None,
        per_fecini=per.per_fecini if per else None,
        per_fecfin=per.per_fecfin if per else None,
    )


@router.get("/ninos-periodo", response_model=list[NinoPeriodoOut])
def listar_ninos_periodo(
    codnin: int | None = Query(None),
    codper: str | None = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(NinoPeriodo)
    if codnin is not None:
        q = q.filter(NinoPeriodo.nip_codnin == codnin)
    if codper:
        q = q.filter(NinoPeriodo.nip_codper == codper)
    rows = q.order_by(NinoPeriodo.nip_codnin.asc(), NinoPeriodo.nip_codper.asc()).all()
    return [_nino_periodo_out(db, r) for r in rows]


@router.post("/ninos-periodo", response_model=NinoPeriodoOut, status_code=201)
def crear_nino_periodo(
    payload: NinoPeriodoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    if not db.get(Nino, payload.nip_codnin):
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    codper = payload.nip_codper.strip().upper()
    if not db.get(Periodo, codper):
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    per = db.get(Periodo, codper)
    if per and per.per_status != "Activo":
        raise HTTPException(status_code=400, detail="El periodo no está activo")
    existe = (
        db.query(NinoPeriodo)
        .filter(NinoPeriodo.nip_codnin == payload.nip_codnin, NinoPeriodo.nip_codper == codper)
        .first()
    )
    if existe:
        return _nino_periodo_out(db, existe)
    row = NinoPeriodo(
        nip_codnin=payload.nip_codnin,
        nip_codper=codper,
        nip_usrcre=user.usr_codusr,
        nip_feccre=datetime.now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _nino_periodo_out(db, row)


@router.put("/ninos-periodo/nino/{codnin}", response_model=list[NinoPeriodoOut])
def reemplazar_periodos_nino(
    codnin: int,
    payload: NinoPeriodoBulk,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    if not db.get(Nino, codnin):
        raise HTTPException(status_code=404, detail="Niño no encontrado")
    wanted = []
    for raw in payload.periodos:
        cod = str(raw or "").strip().upper()
        if not cod:
            continue
        if cod not in wanted:
            wanted.append(cod)
        if not db.get(Periodo, cod):
            raise HTTPException(status_code=404, detail=f"Periodo no encontrado: {cod}")
        per = db.get(Periodo, cod)
        if per and per.per_status != "Activo":
            raise HTTPException(status_code=400, detail=f"El periodo no está activo: {cod}")

    actuales = db.query(NinoPeriodo).filter(NinoPeriodo.nip_codnin == codnin).all()
    actuales_map = {r.nip_codper: r for r in actuales}
    wanted_set = set(wanted)

    for cod, row in list(actuales_map.items()):
        if cod not in wanted_set:
            db.delete(row)

    for cod in wanted:
        if cod not in actuales_map:
            db.add(
                NinoPeriodo(
                    nip_codnin=codnin,
                    nip_codper=cod,
                    nip_usrcre=user.usr_codusr,
                    nip_feccre=datetime.now(),
                )
            )

    db.commit()
    rows = (
        db.query(NinoPeriodo)
        .filter(NinoPeriodo.nip_codnin == codnin)
        .order_by(NinoPeriodo.nip_codper.asc())
        .all()
    )
    return [_nino_periodo_out(db, r) for r in rows]


@router.delete("/ninos-periodo/{codnip}", status_code=204)
def borrar_nino_periodo(
    codnip: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(NinoPeriodo, codnip)
    if not row:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(row)
    db.commit()
    return None


@router.delete("/ninos-periodo/nino/{codnin}/periodo/{codper}", status_code=204)
def borrar_nino_periodo_por_clave(
    codnin: int,
    codper: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = (
        db.query(NinoPeriodo)
        .filter(NinoPeriodo.nip_codnin == codnin, NinoPeriodo.nip_codper == codper.strip().upper())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(row)
    db.commit()
    return None


# =========================
# MONITORES-PERIODO (asistencia al campus)
# =========================
def _monitor_periodo_out(db: Session, row: MonitorPeriodo) -> MonitorPeriodoOut:
    mon = db.get(Monitor, row.mpe_codmon)
    per = db.get(Periodo, row.mpe_codper)
    return MonitorPeriodoOut(
        mpe_codmpe=row.mpe_codmpe,
        mpe_codmon=row.mpe_codmon,
        mpe_codper=row.mpe_codper,
        mpe_usrcre=row.mpe_usrcre,
        mpe_feccre=row.mpe_feccre,
        mon_nommon=mon.mon_nommon if mon else None,
        per_fecini=per.per_fecini if per else None,
        per_fecfin=per.per_fecfin if per else None,
    )


@router.get("/monitores-periodo", response_model=list[MonitorPeriodoOut])
def listar_monitores_periodo(
    codmon: int | None = Query(None),
    codper: str | None = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(MonitorPeriodo)
    if codmon is not None:
        q = q.filter(MonitorPeriodo.mpe_codmon == codmon)
    if codper:
        q = q.filter(MonitorPeriodo.mpe_codper == codper)
    rows = q.order_by(MonitorPeriodo.mpe_codmon.asc(), MonitorPeriodo.mpe_codper.asc()).all()
    return [_monitor_periodo_out(db, r) for r in rows]


@router.post("/monitores-periodo", response_model=MonitorPeriodoOut, status_code=201)
def crear_monitor_periodo(
    payload: MonitorPeriodoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    if not db.get(Monitor, payload.mpe_codmon):
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    codper = payload.mpe_codper.strip().upper()
    if not db.get(Periodo, codper):
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    per = db.get(Periodo, codper)
    if per and per.per_status != "Activo":
        raise HTTPException(status_code=400, detail="El periodo no está activo")
    existe = (
        db.query(MonitorPeriodo)
        .filter(MonitorPeriodo.mpe_codmon == payload.mpe_codmon, MonitorPeriodo.mpe_codper == codper)
        .first()
    )
    if existe:
        return _monitor_periodo_out(db, existe)
    row = MonitorPeriodo(
        mpe_codmon=payload.mpe_codmon,
        mpe_codper=codper,
        mpe_usrcre=user.usr_codusr,
        mpe_feccre=datetime.now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _monitor_periodo_out(db, row)


@router.put("/monitores-periodo/monitor/{codmon}", response_model=list[MonitorPeriodoOut])
def reemplazar_periodos_monitor(
    codmon: int,
    payload: MonitorPeriodoBulk,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    if not db.get(Monitor, codmon):
        raise HTTPException(status_code=404, detail="Monitor no encontrado")
    wanted = []
    for raw in payload.periodos:
        cod = str(raw or "").strip().upper()
        if not cod:
            continue
        if cod not in wanted:
            wanted.append(cod)
        if not db.get(Periodo, cod):
            raise HTTPException(status_code=404, detail=f"Periodo no encontrado: {cod}")
        per = db.get(Periodo, cod)
        if per and per.per_status != "Activo":
            raise HTTPException(status_code=400, detail=f"El periodo no está activo: {cod}")

    actuales = db.query(MonitorPeriodo).filter(MonitorPeriodo.mpe_codmon == codmon).all()
    actuales_map = {r.mpe_codper: r for r in actuales}
    wanted_set = set(wanted)

    for cod, row in list(actuales_map.items()):
        if cod not in wanted_set:
            db.delete(row)

    for cod in wanted:
        if cod not in actuales_map:
            db.add(
                MonitorPeriodo(
                    mpe_codmon=codmon,
                    mpe_codper=cod,
                    mpe_usrcre=user.usr_codusr,
                    mpe_feccre=datetime.now(),
                )
            )

    db.commit()
    rows = (
        db.query(MonitorPeriodo)
        .filter(MonitorPeriodo.mpe_codmon == codmon)
        .order_by(MonitorPeriodo.mpe_codper.asc())
        .all()
    )
    return [_monitor_periodo_out(db, r) for r in rows]


@router.delete("/monitores-periodo/{codmpe}", status_code=204)
def borrar_monitor_periodo(
    codmpe: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(MonitorPeriodo, codmpe)
    if not row:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(row)
    db.commit()
    return None


@router.delete("/monitores-periodo/monitor/{codmon}/periodo/{codper}", status_code=204)
def borrar_monitor_periodo_por_clave(
    codmon: int,
    codper: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = (
        db.query(MonitorPeriodo)
        .filter(MonitorPeriodo.mpe_codmon == codmon, MonitorPeriodo.mpe_codper == codper.strip().upper())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(row)
    db.commit()
    return None


# =========================
# ASISTENCIA DIARIA NIÑOS
# =========================
def _nino_asistencia_out(db: Session, row: NinoAsistencia) -> NinoAsistenciaOut:
    nin = db.get(Nino, row.asi_codnin)
    mon = db.get(Monitor, row.asi_codmon)
    cen = db.get(Centro, row.asi_codcen)
    return NinoAsistenciaOut(
        asi_codasi=row.asi_codasi,
        asi_fecasi=row.asi_fecasi,
        asi_codnin=row.asi_codnin,
        asi_codmon=row.asi_codmon,
        asi_codcen=row.asi_codcen,
        asi_codper=row.asi_codper,
        asi_tipgru=row.asi_tipgru,
        asi_asist=row.asi_asist,
        asi_comedor=row.asi_comedor,
        asi_usrcre=row.asi_usrcre,
        asi_feccre=row.asi_feccre,
        nin_nomnin=nin.nin_nomnin if nin else None,
        mon_nommon=mon.mon_nommon if mon else None,
        exi_nomcen=cen.exi_nomcen if cen else None,
    )


def _estado_asistencia(asist: bool, comedor: bool) -> str:
    if not asist:
        return "no"
    if comedor:
        return "comedor"
    return "asiste"


@router.get("/ninos-asistencia", response_model=list[NinoAsistenciaOut])
def listar_ninos_asistencia(
    fecha: date | None = Query(None),
    codmon: int | None = Query(None),
    codnin: int | None = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    q = db.query(NinoAsistencia)
    if fecha:
        q = q.filter(NinoAsistencia.asi_fecasi == fecha)
    if codmon is not None:
        q = q.filter(NinoAsistencia.asi_codmon == codmon)
    if codnin is not None:
        q = q.filter(NinoAsistencia.asi_codnin == codnin)
    rows = q.order_by(NinoAsistencia.asi_fecasi.desc(), NinoAsistencia.asi_codasi.desc()).all()
    return [_nino_asistencia_out(db, r) for r in rows]


@router.get("/ninos-asistencia/lista", response_model=list[NinoAsistenciaListaItem])
def lista_asistencia_dia(
    fecha: date = Query(...),
    codmon: int | None = Query(None),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    periodo = (
        db.query(Periodo)
        .filter(Periodo.per_fecini <= fecha, Periodo.per_fecfin >= fecha)
        .order_by(Periodo.per_fecini.desc())
        .first()
    )
    if not periodo:
        return []

    ninos_periodo = {
        r.nip_codnin
        for r in db.query(NinoPeriodo).filter(NinoPeriodo.nip_codper == periodo.per_codper).all()
    }
    if not ninos_periodo:
        return []

    mon = None
    if codmon is not None:
        mon = db.get(Monitor, codmon)
        if not mon or mon.mon_fecbaj is not None:
            raise HTTPException(status_code=404, detail="Monitor no encontrado o de baja")
        asigns_mon = (
            db.query(MonitorCentro)
            .filter(
                MonitorCentro.moc_codmon == codmon,
                MonitorCentro.moc_codper == periodo.per_codper,
            )
            .all()
        )
        if not asigns_mon:
            # Sin asignación monitor-grupo en ese periodo: no filtramos por grupo
            asigns_mon = []
        kids: dict[int, NinoCentro] = {}
        if asigns_mon:
            for moc in asigns_mon:
                for nic in (
                    db.query(NinoCentro)
                    .filter(
                        NinoCentro.nic_codcen == moc.moc_codcen,
                        NinoCentro.nic_tipgru == moc.moc_tipgru,
                    )
                    .all()
                ):
                    if nic.nic_codnin in ninos_periodo:
                        kids[nic.nic_codnin] = nic
        else:
            # Monitor elegido pero sin grupo en el periodo → mostrar todos los del periodo
            for nic in db.query(NinoCentro).all():
                if nic.nic_codnin in ninos_periodo:
                    kids[nic.nic_codnin] = nic
    else:
        kids = {}
        for nic in db.query(NinoCentro).all():
            if nic.nic_codnin in ninos_periodo:
                kids[nic.nic_codnin] = nic

    if not kids:
        return []

    asis_map = {
        r.asi_codnin: r
        for r in db.query(NinoAsistencia)
        .filter(
            NinoAsistencia.asi_fecasi == fecha,
            NinoAsistencia.asi_codnin.in_(list(kids.keys())),
        )
        .all()
    }

    out: list[NinoAsistenciaListaItem] = []
    for codnin, nic in kids.items():
        nin = db.get(Nino, codnin)
        if not nin or nin.nin_fecbaj is not None:
            continue
        cen = db.get(Centro, nic.nic_codcen)
        row = asis_map.get(codnin)
        asist = bool(row.asi_asist) if row else False
        comedor = bool(row.asi_comedor) if row else False
        mon_id = codmon if codmon is not None else (row.asi_codmon if row else None)
        mon_name = mon.mon_nommon if mon else None
        if mon_name is None and row and row.asi_codmon:
            m2 = db.get(Monitor, row.asi_codmon)
            mon_name = m2.mon_nommon if m2 else None
        usr_name = None
        if row and row.asi_usrcre:
            u = db.get(Usuario, row.asi_usrcre)
            usr_name = u.usr_name if u else row.asi_usrcre
        out.append(
            NinoAsistenciaListaItem(
                asi_codasi=row.asi_codasi if row else None,
                asi_fecasi=fecha,
                asi_codnin=codnin,
                nin_nomnin=nin.nin_nomnin,
                nin_tipnin=nin.nin_tipnin,
                nin_apoyo=bool(nin.nin_apoyo),
                nin_comali=nin.nin_comali,
                asi_codmon=mon_id,
                mon_nommon=mon_name,
                asi_codcen=nic.nic_codcen,
                exi_nomcen=cen.exi_nomcen if cen else None,
                asi_codper=periodo.per_codper,
                asi_tipgru=nic.nic_tipgru,
                asi_asist=asist,
                asi_comedor=comedor,
                estado=_estado_asistencia(asist, comedor),
                asi_usrcre=row.asi_usrcre if row else None,
                asi_feccre=row.asi_feccre if row else None,
                usr_name=usr_name,
            )
        )

    out.sort(key=lambda x: (x.asi_tipgru or "", x.nin_nomnin or ""))
    return out


@router.get("/ninos-asistencia/mensual", response_model=NinoAsistenciaMensualOut)
def asistencia_mensual(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    tipgru: str | None = Query(None, description="Filtrar por grupo (PEQUEÑOS, MEDIANOS…)"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    dias_mes = monthrange(anio, mes)[1]
    mes_ini = date(anio, mes, 1)
    mes_fin = date(anio, mes, dias_mes)

    periodos = (
        db.query(Periodo)
        .filter(Periodo.per_fecini <= mes_fin, Periodo.per_fecfin >= mes_ini)
        .all()
    )
    if not periodos:
        return NinoAsistenciaMensualOut(anio=anio, mes=mes, dias_mes=dias_mes, ninos=[])

    codpers = [p.per_codper for p in periodos]
    per_by_cod = {p.per_codper: p for p in periodos}
    nip_rows = (
        db.query(NinoPeriodo).filter(NinoPeriodo.nip_codper.in_(codpers)).all()
    )
    # Rangos de fechas en los que cada niño está inscrito (calendario del mes)
    rangos_nino: dict[int, list[tuple[date, date]]] = defaultdict(list)
    for r in nip_rows:
        per = per_by_cod.get(r.nip_codper)
        if not per:
            continue
        rangos_nino[r.nip_codnin].append((per.per_fecini, per.per_fecfin))
    ninos_periodo = set(rangos_nino.keys())
    if not ninos_periodo:
        return NinoAsistenciaMensualOut(anio=anio, mes=mes, dias_mes=dias_mes, ninos=[])

    tipgru_norm = (tipgru or "").strip()
    kids: dict[int, NinoCentro] = {}
    for nic in db.query(NinoCentro).all():
        if nic.nic_codnin not in ninos_periodo:
            continue
        if tipgru_norm and (nic.nic_tipgru or "").strip() != tipgru_norm:
            continue
        kids[nic.nic_codnin] = nic

    if not kids:
        return NinoAsistenciaMensualOut(anio=anio, mes=mes, dias_mes=dias_mes, ninos=[])

    def _en_periodo(codnin: int, dia: int) -> bool:
        f = date(anio, mes, dia)
        for ini, fin in rangos_nino.get(codnin, []):
            if ini <= f <= fin:
                return True
        return False

    asis_rows = (
        db.query(NinoAsistencia)
        .filter(
            NinoAsistencia.asi_fecasi >= mes_ini,
            NinoAsistencia.asi_fecasi <= mes_fin,
            NinoAsistencia.asi_codnin.in_(list(kids.keys())),
        )
        .all()
    )
    asis_by_nino: dict[int, dict[int, NinoAsistencia]] = defaultdict(dict)
    for row in asis_rows:
        asis_by_nino[row.asi_codnin][row.asi_fecasi.day] = row

    out_ninos: list[NinoAsistenciaMensualItem] = []
    for codnin, nic in kids.items():
        nin = db.get(Nino, codnin)
        if not nin or nin.nin_fecbaj is not None:
            continue
        cen = db.get(Centro, nic.nic_codcen)
        dia_map = asis_by_nino.get(codnin, {})
        dias: list[NinoAsistenciaDiaMes] = []
        tot_viene = 0
        tot_come = 0
        for d in range(1, dias_mes + 1):
            en_per = _en_periodo(codnin, d)
            row = dia_map.get(d)
            asist = bool(row.asi_asist) if row else False
            comedor = bool(row.asi_comedor) if row else False
            if en_per and (asist or comedor):
                tot_viene += 1
            if en_per and comedor:
                tot_come += 1
            dias.append(
                NinoAsistenciaDiaMes(
                    dia=d,
                    asist=asist or comedor,
                    comedor=comedor,
                    en_periodo=en_per,
                )
            )
        out_ninos.append(
            NinoAsistenciaMensualItem(
                asi_codnin=codnin,
                nin_nomnin=nin.nin_nomnin,
                nin_apoyo=bool(nin.nin_apoyo),
                nin_comali=nin.nin_comali,
                asi_codcen=nic.nic_codcen,
                exi_nomcen=cen.exi_nomcen if cen else None,
                asi_tipgru=nic.nic_tipgru,
                dias=dias,
                tot_viene=tot_viene,
                tot_come=tot_come,
            )
        )

    out_ninos.sort(key=lambda x: (x.asi_tipgru or "", x.nin_nomnin or ""))
    return NinoAsistenciaMensualOut(anio=anio, mes=mes, dias_mes=dias_mes, ninos=out_ninos)


@router.post("/ninos-asistencia", response_model=NinoAsistenciaOut)
def upsert_nino_asistencia(
    payload: NinoAsistenciaUpsert,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    nin = db.get(Nino, payload.asi_codnin)
    if not nin or nin.nin_fecbaj is not None:
        raise HTTPException(status_code=404, detail="Niño no encontrado o de baja")
    codmon = payload.asi_codmon
    if codmon is not None:
        mon = db.get(Monitor, codmon)
        if not mon or mon.mon_fecbaj is not None:
            raise HTTPException(status_code=404, detail="Monitor no encontrado o de baja")
    if not db.get(Centro, payload.asi_codcen):
        raise HTTPException(status_code=404, detail="Centro no encontrado")
    codper = (payload.asi_codper or "").strip().upper()
    if not db.get(Periodo, codper):
        raise HTTPException(status_code=404, detail="Periodo no encontrado")
    tipgru = (payload.asi_tipgru or "").strip()
    if not tipgru:
        raise HTTPException(status_code=400, detail="El grupo es obligatorio")

    comedor = bool(payload.asi_comedor)

    existe = (
        db.query(NinoAsistencia)
        .filter(
            NinoAsistencia.asi_fecasi == payload.asi_fecasi,
            NinoAsistencia.asi_codnin == payload.asi_codnin,
        )
        .first()
    )

    if existe:
        existe.asi_codmon = codmon
        existe.asi_codcen = payload.asi_codcen
        existe.asi_codper = codper
        existe.asi_tipgru = tipgru
        existe.asi_asist = True
        existe.asi_comedor = comedor
        existe.asi_usrcre = user.usr_codusr
        existe.asi_feccre = datetime.now()
        db.commit()
        db.refresh(existe)
        return _nino_asistencia_out(db, existe)

    row = NinoAsistencia(
        asi_fecasi=payload.asi_fecasi,
        asi_codnin=payload.asi_codnin,
        asi_codmon=codmon,
        asi_codcen=payload.asi_codcen,
        asi_codper=codper,
        asi_tipgru=tipgru,
        asi_asist=True,
        asi_comedor=comedor,
        asi_usrcre=user.usr_codusr,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _nino_asistencia_out(db, row)


@router.delete("/ninos-asistencia/dia/{fecha}/nino/{codnin}", status_code=204)
def borrar_asistencia_dia_nino(
    fecha: date,
    codnin: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = (
        db.query(NinoAsistencia)
        .filter(NinoAsistencia.asi_fecasi == fecha, NinoAsistencia.asi_codnin == codnin)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return None


@router.delete("/ninos-asistencia/{codasi}", status_code=204)
def borrar_nino_asistencia(
    codasi: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(NinoAsistencia, codasi)
    if not row:
        raise HTTPException(status_code=404, detail="Asistencia no encontrada")
    db.delete(row)
    db.commit()
    return None


# =========================
# DESCUENTOS
# =========================
@router.get("/descuentos", response_model=list[DescuentoOut])
def listar_descuentos(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    return db.query(Descuento).order_by(Descuento.des_coddes.asc()).all()


@router.get("/descuentos/{coddes}", response_model=DescuentoOut)
def obtener_descuento(
    coddes: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(Descuento, coddes.strip().upper())
    if not row:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    return row


@router.post("/descuentos", response_model=DescuentoOut, status_code=201)
def crear_descuento(
    payload: DescuentoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    cod = (payload.des_coddes or "").strip().upper()
    if not cod:
        raise HTTPException(status_code=400, detail="El código de descuento es obligatorio")
    desdes = (payload.des_desdes or "").strip()
    if not desdes:
        raise HTTPException(status_code=400, detail="La descripción es obligatoria")
    if payload.des_pordes is None or payload.des_pordes < 0:
        raise HTTPException(status_code=400, detail="El porcentaje debe ser >= 0")
    if db.get(Descuento, cod):
        raise HTTPException(status_code=409, detail="Ya existe un descuento con ese código")
    row = Descuento(
        des_coddes=cod,
        des_desdes=desdes,
        des_pordes=payload.des_pordes,
        des_usrcre=user.usr_codusr,
        des_feccre=datetime.now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/descuentos/{coddes}", response_model=DescuentoOut)
def actualizar_descuento(
    coddes: str,
    payload: DescuentoUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(Descuento, coddes.strip().upper())
    if not row:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "des_desdes" in data and data["des_desdes"] is not None:
        data["des_desdes"] = data["des_desdes"].strip()
        if not data["des_desdes"]:
            raise HTTPException(status_code=400, detail="La descripción es obligatoria")
    if "des_pordes" in data and data["des_pordes"] is not None and data["des_pordes"] < 0:
        raise HTTPException(status_code=400, detail="El porcentaje debe ser >= 0")
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/descuentos/{coddes}", status_code=204)
def borrar_descuento(
    coddes: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(Descuento, coddes.strip().upper())
    if not row:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    db.delete(row)
    db.commit()
    return None


# =========================
# PRECIOS
# =========================
@router.get("/precios", response_model=list[PrecioOut])
def listar_precios(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    return db.query(Precio).order_by(Precio.pre_codpre.asc()).all()


@router.get("/precios/{codpre}", response_model=PrecioOut)
def obtener_precio(
    codpre: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(Precio, codpre.strip().upper())
    if not row:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    return row


@router.post("/precios", response_model=PrecioOut, status_code=201)
def crear_precio(
    payload: PrecioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_general),
):
    cod = (payload.pre_codpre or "").strip().upper()
    if not cod:
        raise HTTPException(status_code=400, detail="El código de precio es obligatorio")
    nom = (payload.pre_nompre or "").strip()
    if not nom:
        raise HTTPException(status_code=400, detail="El nombre del precio es obligatorio")
    if payload.pre_valpre is None or payload.pre_valpre < 0:
        raise HTTPException(status_code=400, detail="El valor debe ser >= 0")
    div = (payload.pre_coddiv or "EUR").strip().upper()
    if not div or len(div) > 3:
        raise HTTPException(status_code=400, detail="La divisa debe tener 1-3 caracteres")
    if db.get(Precio, cod):
        raise HTTPException(status_code=409, detail="Ya existe un precio con ese código")
    row = Precio(
        pre_codpre=cod,
        pre_nompre=nom,
        pre_valpre=payload.pre_valpre,
        pre_coddiv=div,
        pre_usrcre=user.usr_codusr,
        pre_feccre=datetime.now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/precios/{codpre}", response_model=PrecioOut)
def actualizar_precio(
    codpre: str,
    payload: PrecioUpdate,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(Precio, codpre.strip().upper())
    if not row:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "pre_nompre" in data and data["pre_nompre"] is not None:
        data["pre_nompre"] = data["pre_nompre"].strip()
        if not data["pre_nompre"]:
            raise HTTPException(status_code=400, detail="El nombre del precio es obligatorio")
    if "pre_valpre" in data and data["pre_valpre"] is not None and data["pre_valpre"] < 0:
        raise HTTPException(status_code=400, detail="El valor debe ser >= 0")
    if "pre_coddiv" in data and data["pre_coddiv"] is not None:
        data["pre_coddiv"] = data["pre_coddiv"].strip().upper()
        if not data["pre_coddiv"] or len(data["pre_coddiv"]) > 3:
            raise HTTPException(status_code=400, detail="La divisa debe tener 1-3 caracteres")
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/precios/{codpre}", status_code=204)
def borrar_precio(
    codpre: str,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(require_general),
):
    row = db.get(Precio, codpre.strip().upper())
    if not row:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    db.delete(row)
    db.commit()
    return None


# =========================
# SQL CONSOLE (solo ADMIN, solo lectura)
# =========================
_SQL_FORBIDDEN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|"
    r"CALL|DO|EXECUTE|COMMENT|VACUUM|ANALYZE|REINDEX|CLUSTER|REFRESH|"
    r"SECURITY|OWNER|SET\s+ROLE|SET\s+SESSION|RESET|LOCK|NOTIFY|LISTEN|"
    r"UNLISTEN|LOAD|DISCARD|PREPARE|DEALLOCATE|DECLARE|FETCH|MOVE|CLOSE|"
    r"CHECKPOINT|REASSIGN|IMPORT|EXPORT)\b",
    re.IGNORECASE,
)
_SQL_ALLOWED_START = re.compile(r"^\s*(WITH|SELECT|SHOW|EXPLAIN|TABLE)\b", re.IGNORECASE)
_SQL_MAX_ROWS = 1000


def _serialize_sql_cell(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (bytes, memoryview)):
        return str(bytes(value))
    if isinstance(value, (int, float, bool, str)):
        return value
    return str(value)


@router.post("/sql/query", response_model=SqlQueryOut)
def ejecutar_sql(
    payload: SqlQueryRequest,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    sql = (payload.sql or "").strip().rstrip(";")
    if not sql:
        raise HTTPException(status_code=400, detail="Escribe una consulta SQL")
    if ";" in sql:
        raise HTTPException(status_code=400, detail="Solo se permite una sentencia (sin ; intermedios)")
    if not _SQL_ALLOWED_START.search(sql):
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten consultas de lectura: SELECT, WITH, SHOW, EXPLAIN o TABLE",
        )
    if _SQL_FORBIDDEN.search(sql):
        raise HTTPException(
            status_code=400,
            detail="La consulta contiene operaciones no permitidas (solo lectura)",
        )

    try:
        result = db.execute(text(sql))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Error SQL: {exc}") from exc

    if not result.returns_rows:
        raise HTTPException(status_code=400, detail="La consulta no devolvió filas")

    columns = list(result.keys())
    raw_rows = result.fetchmany(_SQL_MAX_ROWS + 1)
    truncated = len(raw_rows) > _SQL_MAX_ROWS
    if truncated:
        raw_rows = raw_rows[:_SQL_MAX_ROWS]

    rows = [[_serialize_sql_cell(cell) for cell in row] for row in raw_rows]
    return SqlQueryOut(columns=columns, rows=rows, row_count=len(rows), truncated=truncated)
