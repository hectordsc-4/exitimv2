from datetime import datetime, date
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator


TIPOS_USUARIO = ("SUPERADMIN", "ADMIN", "DIRECTOR", "MONITOR")
TipoUsuario = Literal["SUPERADMIN", "ADMIN", "DIRECTOR", "MONITOR"]


# -------- Usuarios --------
class UsuarioBase(BaseModel):
    usr_codusr: str = Field(..., max_length=20)
    usr_name: str = Field(..., max_length=200)
    usr_email: str | None = Field(None, max_length=200)
    usr_usrcre: str | None = Field(None, max_length=20)
    usr_descri: str | None = Field(None, max_length=200)
    usr_tipusr: TipoUsuario = Field(default="DIRECTOR", max_length=20)

    @field_validator("usr_tipusr")
    @classmethod
    def validar_tipusr(cls, v: str) -> str:
        tip = (v or "").strip().upper()
        if tip not in TIPOS_USUARIO:
            raise ValueError(f"usr_tipusr debe ser uno de: {', '.join(TIPOS_USUARIO)}")
        return tip


class UsuarioCreate(UsuarioBase):
    usr_pass: str = Field(..., max_length=200)


class UsuarioUpdate(BaseModel):
    usr_name: str | None = Field(None, max_length=200)
    usr_pass: str | None = Field(None, max_length=200)
    usr_email: str | None = Field(None, max_length=200)
    usr_descri: str | None = Field(None, max_length=200)
    usr_tipusr: TipoUsuario | None = Field(None, max_length=20)
    usr_fecbaj: datetime | None = None

    @field_validator("usr_tipusr")
    @classmethod
    def validar_tipusr(cls, v: str | None) -> str | None:
        if v is None:
            return v
        tip = v.strip().upper()
        if tip not in TIPOS_USUARIO:
            raise ValueError(f"usr_tipusr debe ser uno de: {', '.join(TIPOS_USUARIO)}")
        return tip


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)
    user_feccre: datetime
    usr_fecbaj: datetime | None = None
    mon_codmon: int | None = None
    mon_nommon: str | None = None
    permisos: list[str] = []


# -------- Auth / Login --------
class LoginRequest(BaseModel):
    usr_codusr: str = Field(..., max_length=20)
    usr_pass: str = Field(..., max_length=200)
    log_dispos: str | None = Field(None, max_length=100)


class ForgotPasswordRequest(BaseModel):
    usr_email: str = Field(..., max_length=200)


class ForgotPasswordResponse(BaseModel):
    ok: bool
    message: str


class LoginOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_logid: int
    log_codusr: str
    log_feclog: datetime
    log_ip: str | None = None
    log_dispos: str | None = None


class LoginResponse(BaseModel):
    ok: bool
    message: str
    usuario: UsuarioOut | None = None
    login: LoginOut | None = None
    permisos: list[str] = []


class LoginHoraOut(BaseModel):
    hora: int
    total: int


class LoginDiaOut(BaseModel):
    fecha: str
    total: int
    por_hora: list[LoginHoraOut]


class LoginResumenOut(BaseModel):
    dias: list[LoginDiaOut]
    total: int


# -------- Permisos --------
class PermisoBase(BaseModel):
    per_codper: str = Field(..., max_length=20)
    per_nomper: str = Field(..., max_length=100)
    per_usrcre: str | None = Field(None, max_length=20)


class PermisoCreate(PermisoBase):
    pass


class PermisoOut(PermisoBase):
    model_config = ConfigDict(from_attributes=True)
    per_feccre: datetime
    per_fecbaj: datetime | None = None


# -------- Permisos Usuario --------
class PermisoUsuarioCreate(BaseModel):
    peu_codusr: str = Field(..., max_length=20)
    peu_codper: str = Field(..., max_length=20)
    peu_usrcre: str | None = Field(None, max_length=20)


class PermisoUsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    peu_codpeu: int
    peu_codusr: str
    peu_codper: str
    peu_feccre: datetime
    peu_usrcre: str | None = None
    peu_fecbaj: datetime | None = None


# -------- Centros --------
class CentroBase(BaseModel):
    exi_codcen: str = Field(..., max_length=20)
    exi_nomcen: str = Field(..., max_length=200)
    exi_latgps: float | None = None
    exi_longgps: float | None = None
    exi_nompob: str | None = Field(None, max_length=200)
    exi_capaci: float | None = None
    exi_descen: str | None = Field(None, max_length=1000)
    exi_numgru: int = Field(default=3, ge=3, le=4)


class CentroCreate(CentroBase):
    pass


class CentroUpdate(BaseModel):
    exi_nomcen: str | None = Field(None, max_length=200)
    exi_latgps: float | None = None
    exi_longgps: float | None = None
    exi_nompob: str | None = Field(None, max_length=200)
    exi_capaci: float | None = None
    exi_descen: str | None = Field(None, max_length=1000)
    exi_numgru: int | None = Field(None, ge=3, le=4)
    exi_fecbaj: datetime | None = None


class CentroOut(CentroBase):
    model_config = ConfigDict(from_attributes=True)
    cen_usrcre: str | None = None
    cen_feccre: datetime | None = None
    exi_fecbaj: datetime | None = None


# -------- Monitores --------
class MonitorBase(BaseModel):
    mon_nommon: str = Field(..., max_length=200)
    mon_codcen: str = Field(..., max_length=20)
    mon_ciumon: str | None = Field(None, max_length=200)
    mon_tipmon: str | None = Field(None, max_length=50)


class MonitorCreate(MonitorBase):
    """Alta de monitor. Usuario opcional: si se informa, se crea y se vincula."""
    usr_codusr: str | None = Field(None, max_length=20)
    usr_pass: str | None = Field(None, max_length=200)
    usr_name: str | None = Field(None, max_length=200)
    usr_email: str | None = Field(None, max_length=200)
    usr_descri: str | None = Field(None, max_length=200)


class MonitorUpdate(BaseModel):
    """Datos del monitor. Si aún no tiene usuario, se pueden enviar campos usr_* para crearlo."""
    mon_nommon: str | None = Field(None, max_length=200)
    mon_codcen: str | None = Field(None, max_length=20)
    mon_ciumon: str | None = Field(None, max_length=200)
    mon_tipmon: str | None = Field(None, max_length=50)
    mon_fecbaj: datetime | None = None
    usr_codusr: str | None = Field(None, max_length=20)
    usr_pass: str | None = Field(None, max_length=200)
    usr_name: str | None = Field(None, max_length=200)
    usr_email: str | None = Field(None, max_length=200)
    usr_descri: str | None = Field(None, max_length=200)


class MonitorOut(MonitorBase):
    model_config = ConfigDict(from_attributes=True)
    mon_codmon: int
    mon_codusr: str | None = None
    mon_usrcre: str | None = None
    mon_feccre: datetime
    mon_fecbaj: datetime | None = None


# -------- Monitores por centro / grupo --------
class MonitorCentroCreate(BaseModel):
    moc_codmon: int
    moc_codcen: str = Field(..., max_length=20)
    moc_tipgru: str = Field(..., max_length=100)
    moc_codper: str = Field(..., max_length=10)


class MonitorCentroUpdate(BaseModel):
    moc_codcen: str | None = Field(None, max_length=20)
    moc_tipgru: str | None = Field(None, max_length=100)
    moc_codper: str | None = Field(None, max_length=10)


class MonitorCentroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    moc_codmoc: int
    moc_codmon: int
    moc_codcen: str
    moc_tipgru: str
    moc_codper: str
    mon_nommon: str | None = None
    mon_tipmon: str | None = None
    exi_nomcen: str | None = None
    per_fecini: date | None = None
    per_fecfin: date | None = None


# -------- Niños --------
class NinoBase(BaseModel):
    nin_nomnin: str = Field(..., max_length=100)
    nin_fecnac: date | None = None
    nin_tipnin: str | None = Field(None, max_length=50)
    nin_apoyo: bool = False
    nin_comali: str | None = Field(None, max_length=100)
    nin_desnin: str | None = Field(None, max_length=900)


class NinoCreate(NinoBase):
    pass


class NinoUpdate(BaseModel):
    nin_nomnin: str | None = Field(None, max_length=100)
    nin_fecnac: date | None = None
    nin_tipnin: str | None = Field(None, max_length=50)
    nin_apoyo: bool | None = None
    nin_comali: str | None = Field(None, max_length=100)
    nin_desnin: str | None = Field(None, max_length=900)
    nin_fecbaj: datetime | None = None


class NinoOut(NinoBase):
    model_config = ConfigDict(from_attributes=True)
    nin_codnin: int
    nin_usrcre: str | None = None
    nin_feccre: datetime
    nin_fecbaj: datetime | None = None


# -------- Niños por centro --------
class NinoCentroCreate(BaseModel):
    nic_codnin: int
    nic_codcen: str = Field(..., max_length=20)
    nic_tipgru: str = Field(default="Sin grupo", max_length=100)


class NinoCentroUpdate(BaseModel):
    nic_codcen: str | None = Field(None, max_length=20)
    nic_tipgru: str | None = Field(None, max_length=100)


class NinoCentroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    nic_codnic: int
    nic_codnin: int
    nic_codcen: str
    nic_tipgru: str
    nin_nomnin: str | None = None
    nin_fecnac: date | None = None
    nin_tipnin: str | None = None
    nin_apoyo: bool | None = None
    exi_nomcen: str | None = None


# -------- Tipos de grupo --------
class TipoGrupoBase(BaseModel):
    tip_descri: str = Field(..., max_length=100)


class TipoGrupoCreate(TipoGrupoBase):
    pass


class TipoGrupoUpdate(BaseModel):
    tip_descri: str | None = Field(None, max_length=100)
    tip_fecbaj: datetime | None = None


class TipoGrupoOut(TipoGrupoBase):
    model_config = ConfigDict(from_attributes=True)
    tip_codgru: int
    tip_usrcre: str | None = None
    tip_feccre: datetime
    tip_fecbaj: datetime | None = None


# -------- Tipos de grupo por centro --------
class TipoGrupoCentroCreate(BaseModel):
    tgc_codcen: str = Field(..., max_length=20)
    tgc_tipgru: int
    tgc_ordgru: int = Field(default=1, ge=1)


class TipoGrupoCentroUpdate(BaseModel):
    tgc_codcen: str | None = Field(None, max_length=20)
    tgc_tipgru: int | None = None
    tgc_ordgru: int | None = Field(None, ge=1)


class TipoGrupoCentroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    tgc_codtgc: int
    tgc_codcen: str
    tgc_tipgru: int
    tgc_ordgru: int
    tip_descri: str | None = None
    exi_nomcen: str | None = None
    ninos_total: int = 0
    ninos_apoyo: int = 0
    monitores: list[str] = []
    monitores_txt: str | None = None


# -------- Eventos --------
class EventoBase(BaseModel):
    exi_feceve: date
    exi_nomeve: str = Field(..., max_length=200)
    exi_codcen: str = Field(..., max_length=20)
    eve_neccir: bool = False


class EventoCreate(EventoBase):
    pass


class EventoUpdate(BaseModel):
    exi_feceve: date | None = None
    exi_nomeve: str | None = Field(None, max_length=200)
    exi_codcen: str | None = Field(None, max_length=20)
    eve_neccir: bool | None = None


class EventoOut(EventoBase):
    model_config = ConfigDict(from_attributes=True)
    exi_eveide: int
    exi_nomcen: str | None = None


# -------- Periodos --------
PERIODO_STATUS = ("Activo", "No Activo")


class PeriodoBase(BaseModel):
    per_codper: str = Field(..., max_length=10)
    per_fecini: date
    per_fecfin: date
    per_status: str = Field(default="Activo", max_length=20)


class PeriodoCreate(PeriodoBase):
    pass


class PeriodoUpdate(BaseModel):
    per_fecini: date | None = None
    per_fecfin: date | None = None
    per_status: str | None = Field(None, max_length=20)


class PeriodoOut(PeriodoBase):
    model_config = ConfigDict(from_attributes=True)


# -------- Ninos-Periodo (asistencia) --------
class NinoPeriodoCreate(BaseModel):
    nip_codnin: int
    nip_codper: str = Field(..., max_length=10)


class NinoPeriodoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    nip_codnip: int
    nip_codnin: int
    nip_codper: str
    nip_usrcre: str | None = None
    nip_feccre: datetime
    nin_nomnin: str | None = None
    per_fecini: date | None = None
    per_fecfin: date | None = None


class NinoPeriodoBulk(BaseModel):
    periodos: list[str] = Field(default_factory=list)


# -------- Monitores-Periodo (asistencia) --------
class MonitorPeriodoCreate(BaseModel):
    mpe_codmon: int
    mpe_codper: str = Field(..., max_length=10)


class MonitorPeriodoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    mpe_codmpe: int
    mpe_codmon: int
    mpe_codper: str
    mpe_usrcre: str | None = None
    mpe_feccre: datetime
    mon_nommon: str | None = None
    per_fecini: date | None = None
    per_fecfin: date | None = None


class MonitorPeriodoBulk(BaseModel):
    periodos: list[str] = Field(default_factory=list)


# -------- Asistencia diaria niños --------
class NinoAsistenciaUpsert(BaseModel):
    asi_fecasi: date
    asi_codnin: int
    asi_codmon: int | None = None
    asi_codcen: str = Field(..., max_length=20)
    asi_codper: str = Field(..., max_length=10)
    asi_tipgru: str = Field(..., max_length=100)
    asi_asist: bool = True
    asi_comedor: bool = False


class NinoAsistenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    asi_codasi: int
    asi_fecasi: date
    asi_codnin: int
    asi_codmon: int | None = None
    asi_codcen: str
    asi_codper: str
    asi_tipgru: str
    asi_asist: bool
    asi_comedor: bool
    asi_usrcre: str | None = None
    asi_feccre: datetime
    nin_nomnin: str | None = None
    mon_nommon: str | None = None
    exi_nomcen: str | None = None


class NinoAsistenciaListaItem(BaseModel):
    asi_codasi: int | None = None
    asi_fecasi: date
    asi_codnin: int
    nin_nomnin: str
    nin_tipnin: str | None = None
    nin_apoyo: bool = False
    nin_comali: str | None = None
    asi_codmon: int | None = None
    mon_nommon: str | None = None
    asi_codcen: str
    exi_nomcen: str | None = None
    asi_codper: str
    asi_tipgru: str
    asi_asist: bool = False
    asi_comedor: bool = False
    estado: str = "no"  # no | asiste | comedor
    asi_usrcre: str | None = None
    asi_feccre: datetime | None = None
    usr_name: str | None = None


class NinoAsistenciaDiaMes(BaseModel):
    dia: int
    asist: bool = False
    comedor: bool = False
    en_periodo: bool = True  # False = día fuera del calendario del niño


class NinoAsistenciaMensualItem(BaseModel):
    asi_codnin: int
    nin_nomnin: str
    nin_apoyo: bool = False
    nin_comali: str | None = None
    asi_codcen: str
    exi_nomcen: str | None = None
    asi_tipgru: str
    dias: list[NinoAsistenciaDiaMes]
    tot_viene: int = 0
    tot_come: int = 0


class NinoAsistenciaMensualOut(BaseModel):
    anio: int
    mes: int
    dias_mes: int
    ninos: list[NinoAsistenciaMensualItem]


# -------- Descuentos --------
class DescuentoBase(BaseModel):
    des_coddes: str = Field(..., max_length=20)
    des_desdes: str = Field(..., max_length=100)
    des_pordes: float


class DescuentoCreate(DescuentoBase):
    pass


class DescuentoUpdate(BaseModel):
    des_desdes: str | None = Field(None, max_length=100)
    des_pordes: float | None = None


class DescuentoOut(DescuentoBase):
    model_config = ConfigDict(from_attributes=True)
    des_usrcre: str | None = None
    des_feccre: datetime


# -------- Precios --------
class PrecioBase(BaseModel):
    pre_codpre: str = Field(..., max_length=20)
    pre_nompre: str = Field(..., max_length=100)
    pre_valpre: float
    pre_coddiv: str = Field(default="EUR", max_length=3)


class PrecioCreate(PrecioBase):
    pass


class PrecioUpdate(BaseModel):
    pre_nompre: str | None = Field(None, max_length=100)
    pre_valpre: float | None = None
    pre_coddiv: str | None = Field(None, max_length=3)


class PrecioOut(PrecioBase):
    model_config = ConfigDict(from_attributes=True)
    pre_usrcre: str | None = None
    pre_feccre: datetime


# -------- SQL (admin) --------
class SqlQueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=20000)


class SqlQueryOut(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool = False
