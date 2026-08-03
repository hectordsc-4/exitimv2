from datetime import datetime, date

from sqlalchemy import String, DateTime, ForeignKey, BigInteger, Integer, UniqueConstraint, Numeric, Date, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Usuario(Base):
    __tablename__ = "exi_usuarios"

    usr_codusr: Mapped[str] = mapped_column(String(20), primary_key=True)
    usr_name: Mapped[str] = mapped_column(String(200), nullable=False)
    user_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    usr_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    usr_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    usr_pass: Mapped[str] = mapped_column(String(200), nullable=False)
    usr_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    usr_descri: Mapped[str | None] = mapped_column(String(200), nullable=True)
    usr_tipusr: Mapped[str] = mapped_column(String(20), nullable=False, default="DIRECTOR")

    logins = relationship("Login", back_populates="usuario")
    permisos = relationship("PermisoUsuario", back_populates="usuario")


class Login(Base):
    __tablename__ = "exi_logins"

    log_logid: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    log_codusr: Mapped[str] = mapped_column(String(20), ForeignKey("exi_usuarios.usr_codusr"), nullable=False)
    log_feclog: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    log_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    log_dispos: Mapped[str | None] = mapped_column(String(100), nullable=True)

    usuario = relationship("Usuario", back_populates="logins")


class Permiso(Base):
    __tablename__ = "exi_permisos"

    per_codper: Mapped[str] = mapped_column(String(20), primary_key=True)
    per_nomper: Mapped[str] = mapped_column(String(100), nullable=False)
    per_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    per_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    per_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    asignaciones = relationship("PermisoUsuario", back_populates="permiso")


class PermisoUsuario(Base):
    __tablename__ = "exi_permisos_usuario"
    __table_args__ = (UniqueConstraint("peu_codusr", "peu_codper", name="uq_peu_usr_per"),)

    peu_codpeu: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    peu_codusr: Mapped[str] = mapped_column(String(20), ForeignKey("exi_usuarios.usr_codusr"), nullable=False)
    peu_codper: Mapped[str] = mapped_column(String(20), ForeignKey("exi_permisos.per_codper"), nullable=False)
    peu_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    peu_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    peu_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    usuario = relationship("Usuario", back_populates="permisos")
    permiso = relationship("Permiso", back_populates="asignaciones")


class Centro(Base):
    __tablename__ = "exi_centros"

    exi_codcen: Mapped[str] = mapped_column(String(20), primary_key=True)
    exi_nomcen: Mapped[str] = mapped_column(String(200), nullable=False)
    exi_latgps: Mapped[float | None] = mapped_column(Numeric(12, 8), nullable=True)
    exi_longgps: Mapped[float | None] = mapped_column(Numeric(12, 8), nullable=True)
    exi_nompob: Mapped[str | None] = mapped_column(String(200), nullable=True)
    exi_capaci: Mapped[float | None] = mapped_column(Numeric(10, 0), nullable=True)
    exi_descen: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    exi_numgru: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    cen_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cen_feccre: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    exi_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Monitor(Base):
    __tablename__ = "exi_monitores"

    mon_codmon: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mon_nommon: Mapped[str] = mapped_column(String(200), nullable=False)
    mon_codusr: Mapped[str | None] = mapped_column(String(20), ForeignKey("exi_usuarios.usr_codusr"), nullable=True)
    mon_codcen: Mapped[str] = mapped_column(String(20), ForeignKey("exi_centros.exi_codcen"), nullable=False)
    mon_ciumon: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mon_tipmon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mon_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mon_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    mon_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class MonitorCentro(Base):
    __tablename__ = "exi_monitores_centro"
    __table_args__ = (
        UniqueConstraint("moc_codmon", "moc_codcen", "moc_codper", name="uq_moc_monitor_centro_periodo"),
    )

    moc_codmoc: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    moc_codmon: Mapped[int] = mapped_column(Integer, ForeignKey("exi_monitores.mon_codmon"), nullable=False)
    moc_codcen: Mapped[str] = mapped_column(String(20), ForeignKey("exi_centros.exi_codcen"), nullable=False)
    moc_tipgru: Mapped[str] = mapped_column(String(100), nullable=False)
    moc_codper: Mapped[str] = mapped_column(String(10), ForeignKey("exi_periodos.per_codper"), nullable=False)


class Nino(Base):
    __tablename__ = "exi_ninos"

    nin_codnin: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nin_nomnin: Mapped[str] = mapped_column(String(100), nullable=False)
    nin_fecnac: Mapped[date | None] = mapped_column(Date, nullable=True)
    nin_tipnin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nin_apoyo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    nin_comali: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nin_desnin: Mapped[str | None] = mapped_column(String(900), nullable=True)
    nin_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nin_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    nin_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class NinoCentro(Base):
    __tablename__ = "exi_ninos_cent"
    __table_args__ = (UniqueConstraint("nic_codnin", "nic_codcen", name="uq_nic_nino_centro"),)

    nic_codnic: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nic_codnin: Mapped[int] = mapped_column(Integer, ForeignKey("exi_ninos.nin_codnin"), nullable=False)
    nic_codcen: Mapped[str] = mapped_column(String(20), ForeignKey("exi_centros.exi_codcen"), nullable=False)
    nic_tipgru: Mapped[str] = mapped_column(String(100), nullable=False, default="Sin grupo")


class TipoGrupo(Base):
    __tablename__ = "exi_tipo_grupo"

    tip_codgru: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tip_descri: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    tip_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tip_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    tip_fecbaj: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class TipoGrupoCentro(Base):
    __tablename__ = "exi_tipo_grupos_centro"
    __table_args__ = (UniqueConstraint("tgc_codcen", "tgc_tipgru", name="uq_tgc_centro_tipo"),)

    tgc_codtgc: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tgc_codcen: Mapped[str] = mapped_column(String(20), ForeignKey("exi_centros.exi_codcen"), nullable=False)
    tgc_tipgru: Mapped[int] = mapped_column(Integer, ForeignKey("exi_tipo_grupo.tip_codgru"), nullable=False)
    tgc_ordgru: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Evento(Base):
    __tablename__ = "exi_eventos"

    exi_eveide: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exi_feceve: Mapped[date] = mapped_column(Date, nullable=False)
    exi_nomeve: Mapped[str] = mapped_column(String(200), nullable=False)
    exi_codcen: Mapped[str] = mapped_column(String(20), ForeignKey("exi_centros.exi_codcen"), nullable=False)
    eve_neccir: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Periodo(Base):
    __tablename__ = "exi_periodos"

    per_codper: Mapped[str] = mapped_column(String(10), primary_key=True)
    per_fecini: Mapped[date] = mapped_column(Date, nullable=False)
    per_fecfin: Mapped[date] = mapped_column(Date, nullable=False)
    per_status: Mapped[str] = mapped_column(String(20), nullable=False, default="Activo")


class NinoPeriodo(Base):
    __tablename__ = "exi_ninos_periodo"
    __table_args__ = (UniqueConstraint("nip_codnin", "nip_codper", name="uq_nip_nino_periodo"),)

    nip_codnip: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nip_codnin: Mapped[int] = mapped_column(Integer, ForeignKey("exi_ninos.nin_codnin"), nullable=False)
    nip_codper: Mapped[str] = mapped_column(String(10), ForeignKey("exi_periodos.per_codper"), nullable=False)
    nip_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nip_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class MonitorPeriodo(Base):
    __tablename__ = "exi_monitores_periodo"
    __table_args__ = (UniqueConstraint("mpe_codmon", "mpe_codper", name="uq_mpe_monitor_periodo"),)

    mpe_codmpe: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mpe_codmon: Mapped[int] = mapped_column(Integer, ForeignKey("exi_monitores.mon_codmon"), nullable=False)
    mpe_codper: Mapped[str] = mapped_column(String(10), ForeignKey("exi_periodos.per_codper"), nullable=False)
    mpe_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mpe_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class NinoAsistencia(Base):
    __tablename__ = "exi_ninos_asistencia"
    __table_args__ = (UniqueConstraint("asi_fecasi", "asi_codnin", name="uq_asi_dia_nino"),)

    asi_codasi: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asi_fecasi: Mapped[date] = mapped_column(Date, nullable=False)
    asi_codnin: Mapped[int] = mapped_column(Integer, ForeignKey("exi_ninos.nin_codnin"), nullable=False)
    asi_codmon: Mapped[int | None] = mapped_column(Integer, ForeignKey("exi_monitores.mon_codmon"), nullable=True)
    asi_codcen: Mapped[str] = mapped_column(String(20), ForeignKey("exi_centros.exi_codcen"), nullable=False)
    asi_codper: Mapped[str] = mapped_column(String(10), ForeignKey("exi_periodos.per_codper"), nullable=False)
    asi_tipgru: Mapped[str] = mapped_column(String(100), nullable=False)
    asi_asist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    asi_comedor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    asi_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    asi_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Descuento(Base):
    __tablename__ = "exi_descuentos"

    des_coddes: Mapped[str] = mapped_column(String(20), primary_key=True)
    des_desdes: Mapped[str] = mapped_column(String(100), nullable=False)
    des_pordes: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    des_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    des_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Precio(Base):
    __tablename__ = "exi_precios"

    pre_codpre: Mapped[str] = mapped_column(String(20), primary_key=True)
    pre_nompre: Mapped[str] = mapped_column(String(100), nullable=False)
    pre_valpre: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    pre_coddiv: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    pre_usrcre: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pre_feccre: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
