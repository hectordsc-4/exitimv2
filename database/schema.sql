-- EXI Database schema (PostgreSQL)
-- Compatible with DBeaver

CREATE DATABASE exi_db
    WITH OWNER = postgres
         ENCODING = 'UTF8'
         TEMPLATE = template0;

\c exi_db

-- =========================
-- EXI_USUARIOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_usuarios (
    usr_codusr  VARCHAR(20)  PRIMARY KEY,
    usr_name    VARCHAR(200) NOT NULL,
    user_feccre TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usr_usrcre  VARCHAR(20),
    usr_fecbaj  TIMESTAMP,
    usr_pass    VARCHAR(200) NOT NULL,
    usr_email   VARCHAR(200),
    usr_descri  VARCHAR(200),
    usr_tipusr  VARCHAR(20)  NOT NULL DEFAULT 'DIRECTOR',
    CONSTRAINT ck_usuarios_tipusr CHECK (
        usr_tipusr IN ('SUPERADMIN', 'ADMIN', 'DIRECTOR', 'MONITOR')
    )
);

COMMENT ON TABLE  exi_usuarios IS 'Usuarios del sistema EXI';
COMMENT ON COLUMN exi_usuarios.usr_codusr IS 'Código de usuario (PK)';
COMMENT ON COLUMN exi_usuarios.usr_name IS 'Nombre del usuario';
COMMENT ON COLUMN exi_usuarios.user_feccre IS 'Fecha de creación';
COMMENT ON COLUMN exi_usuarios.usr_usrcre IS 'Usuario que creó el registro';
COMMENT ON COLUMN exi_usuarios.usr_fecbaj IS 'Fecha de baja';
COMMENT ON COLUMN exi_usuarios.usr_pass IS 'Contraseña';
COMMENT ON COLUMN exi_usuarios.usr_descri IS 'Descripción del usuario';
COMMENT ON COLUMN exi_usuarios.usr_tipusr IS 'Tipo de usuario: SUPERADMIN, ADMIN, DIRECTOR o MONITOR';

-- =========================
-- EXI_LOGINS
-- =========================
CREATE TABLE IF NOT EXISTS exi_logins (
    log_logid   BIGSERIAL    PRIMARY KEY,
    log_codusr  VARCHAR(20)  NOT NULL,
    log_feclog  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    log_ip      VARCHAR(45),
    log_dispos  VARCHAR(100),
    CONSTRAINT fk_logins_usuario
        FOREIGN KEY (log_codusr) REFERENCES exi_usuarios (usr_codusr)
);

CREATE INDEX IF NOT EXISTS idx_logins_codusr ON exi_logins (log_codusr);
CREATE INDEX IF NOT EXISTS idx_logins_feclog ON exi_logins (log_feclog);

COMMENT ON TABLE  exi_logins IS 'Registro de accesos (logins)';
COMMENT ON COLUMN exi_logins.log_logid IS 'ID autonumérico del login';
COMMENT ON COLUMN exi_logins.log_codusr IS 'Código del usuario que hizo login';
COMMENT ON COLUMN exi_logins.log_feclog IS 'Fecha/hora del login';
COMMENT ON COLUMN exi_logins.log_ip IS 'IP de acceso';
COMMENT ON COLUMN exi_logins.log_dispos IS 'Dispositivo utilizado';

-- =========================
-- EXI_PERMISOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_permisos (
    per_codper  VARCHAR(20)  PRIMARY KEY,
    per_nomper  VARCHAR(100) NOT NULL,
    per_feccre  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    per_usrcre  VARCHAR(20),
    per_fecbaj  TIMESTAMP
);

COMMENT ON TABLE  exi_permisos IS 'Catálogo de permisos';
COMMENT ON COLUMN exi_permisos.per_codper IS 'Código del permiso (PK)';
COMMENT ON COLUMN exi_permisos.per_nomper IS 'Nombre del permiso';
COMMENT ON COLUMN exi_permisos.per_feccre IS 'Fecha de creación';
COMMENT ON COLUMN exi_permisos.per_usrcre IS 'Usuario que creó el permiso';
COMMENT ON COLUMN exi_permisos.per_fecbaj IS 'Fecha de baja';

-- =========================
-- EXI_PERMISOS_USUARIO
-- =========================
CREATE TABLE IF NOT EXISTS exi_permisos_usuario (
    peu_codpeu  SERIAL       PRIMARY KEY,
    peu_codusr  VARCHAR(20)  NOT NULL,
    peu_codper  VARCHAR(20)  NOT NULL,
    peu_feccre  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    peu_usrcre  VARCHAR(20),
    peu_fecbaj  TIMESTAMP,
    CONSTRAINT fk_peu_usuario
        FOREIGN KEY (peu_codusr) REFERENCES exi_usuarios (usr_codusr),
    CONSTRAINT fk_peu_permiso
        FOREIGN KEY (peu_codper) REFERENCES exi_permisos (per_codper),
    CONSTRAINT uq_peu_usr_per UNIQUE (peu_codusr, peu_codper)
);

CREATE INDEX IF NOT EXISTS idx_peu_codusr ON exi_permisos_usuario (peu_codusr);
CREATE INDEX IF NOT EXISTS idx_peu_codper ON exi_permisos_usuario (peu_codper);

COMMENT ON TABLE  exi_permisos_usuario IS 'Relación usuario-permiso';
COMMENT ON COLUMN exi_permisos_usuario.peu_codpeu IS 'ID autonumérico';
COMMENT ON COLUMN exi_permisos_usuario.peu_codusr IS 'Código de usuario';
COMMENT ON COLUMN exi_permisos_usuario.peu_codper IS 'Código de permiso';
COMMENT ON COLUMN exi_permisos_usuario.peu_feccre IS 'Fecha de creación';
COMMENT ON COLUMN exi_permisos_usuario.peu_usrcre IS 'Usuario que asignó el permiso';
COMMENT ON COLUMN exi_permisos_usuario.peu_fecbaj IS 'Fecha de baja';

-- =========================
-- EXI_CENTROS
-- =========================
CREATE TABLE IF NOT EXISTS exi_centros (
    exi_codcen   VARCHAR(20)    PRIMARY KEY,
    exi_nomcen   VARCHAR(200)   NOT NULL,
    exi_latgps   NUMERIC(12, 8),
    exi_longgps  NUMERIC(12, 8),
    exi_nompob   VARCHAR(200),
    exi_capaci   NUMERIC(10),
    exi_descen   VARCHAR(1000),
    exi_numgru   INTEGER        NOT NULL DEFAULT 3,
    cen_usrcre   VARCHAR(20),
    cen_feccre   TIMESTAMP,
    exi_fecbaj   TIMESTAMP,
    CONSTRAINT ck_centros_numgru CHECK (exi_numgru IN (3, 4))
);

COMMENT ON TABLE  exi_centros IS 'Centros EXI';
COMMENT ON COLUMN exi_centros.exi_codcen IS 'Código del centro (PK)';
COMMENT ON COLUMN exi_centros.exi_nomcen IS 'Nombre del centro';
COMMENT ON COLUMN exi_centros.exi_latgps IS 'Latitud GPS';
COMMENT ON COLUMN exi_centros.exi_longgps IS 'Longitud GPS';
COMMENT ON COLUMN exi_centros.exi_nompob IS 'Nombre de la población';
COMMENT ON COLUMN exi_centros.exi_capaci IS 'Capacidad';
COMMENT ON COLUMN exi_centros.exi_descen IS 'Descripción del centro';
COMMENT ON COLUMN exi_centros.exi_numgru IS 'Numero de grupos: 3 o 4';
COMMENT ON COLUMN exi_centros.cen_usrcre IS 'Usuario de creación';
COMMENT ON COLUMN exi_centros.cen_feccre IS 'Fecha de creación';
COMMENT ON COLUMN exi_centros.exi_fecbaj IS 'Fecha de baja';

-- =========================
-- EXI_MONITORES
-- =========================
CREATE TABLE IF NOT EXISTS exi_monitores (
    mon_codmon   SERIAL         PRIMARY KEY,
    mon_nommon   VARCHAR(200)   NOT NULL,
    mon_codusr   VARCHAR(20)    NULL,
    mon_codcen   VARCHAR(20)    NOT NULL,
    mon_ciumon   VARCHAR(200),
    mon_tipmon   VARCHAR(50),
    mon_usrcre   VARCHAR(20),
    mon_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mon_fecbaj   TIMESTAMP,
    CONSTRAINT fk_mon_usuario
        FOREIGN KEY (mon_codusr) REFERENCES exi_usuarios (usr_codusr),
    CONSTRAINT fk_mon_centro
        FOREIGN KEY (mon_codcen) REFERENCES exi_centros (exi_codcen)
);

CREATE INDEX IF NOT EXISTS idx_mon_codusr ON exi_monitores (mon_codusr);
CREATE INDEX IF NOT EXISTS idx_mon_codcen ON exi_monitores (mon_codcen);

COMMENT ON TABLE  exi_monitores IS 'Monitores EXI';
COMMENT ON COLUMN exi_monitores.mon_codmon IS 'Codigo autonumerico del monitor (PK)';
COMMENT ON COLUMN exi_monitores.mon_nommon IS 'Nombre del monitor';
COMMENT ON COLUMN exi_monitores.mon_codusr IS 'Codigo de usuario asociado (opcional; NULL si no entra al sistema)';
COMMENT ON COLUMN exi_monitores.mon_codcen IS 'Codigo de centro asociado';
COMMENT ON COLUMN exi_monitores.mon_ciumon IS 'Ciudad del monitor';
COMMENT ON COLUMN exi_monitores.mon_tipmon IS 'Tipo de monitor: INTERNO o BECARIO';
COMMENT ON COLUMN exi_monitores.mon_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_monitores.mon_feccre IS 'Fecha de creacion';
COMMENT ON COLUMN exi_monitores.mon_fecbaj IS 'Fecha de baja';

-- =========================
-- EXI_NINOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_ninos (
    nin_codnin   SERIAL         PRIMARY KEY,
    nin_nomnin   VARCHAR(100)   NOT NULL,
    nin_fecnac   DATE,
    nin_tipnin   VARCHAR(50),
    nin_apoyo   BOOLEAN        NOT NULL DEFAULT FALSE,
    nin_comali   VARCHAR(100),
    nin_desnin   VARCHAR(900),
    nin_usrcre   VARCHAR(20),
    nin_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nin_fecbaj   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ninos_nomnin ON exi_ninos (nin_nomnin);

COMMENT ON TABLE  exi_ninos IS 'Niños EXI';
COMMENT ON COLUMN exi_ninos.nin_codnin IS 'Codigo autonumerico del niño (PK)';
COMMENT ON COLUMN exi_ninos.nin_nomnin IS 'Nombre del niño';
COMMENT ON COLUMN exi_ninos.nin_fecnac IS 'Fecha de nacimiento';
COMMENT ON COLUMN exi_ninos.nin_tipnin IS 'Tipo de niño: Pequeños, Medianos, Mayores, etc.';
COMMENT ON COLUMN exi_ninos.nin_apoyo IS 'Indica si el niño necesita apoyo (monitor extra en el grupo)';
COMMENT ON COLUMN exi_ninos.nin_comali IS 'Comentario alimenticio: CELIACO, No come CERDO, etc.';
COMMENT ON COLUMN exi_ninos.nin_desnin IS 'Descripcion del niño';
COMMENT ON COLUMN exi_ninos.nin_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_ninos.nin_feccre IS 'Fecha de creacion';
COMMENT ON COLUMN exi_ninos.nin_fecbaj IS 'Fecha de baja';

-- =========================
-- EXI_NINOS_CENT
-- =========================
CREATE TABLE IF NOT EXISTS exi_ninos_cent (
    nic_codnic   SERIAL         PRIMARY KEY,
    nic_codnin   INTEGER        NOT NULL,
    nic_codcen   VARCHAR(20)    NOT NULL,
    nic_tipgru   VARCHAR(100)   NOT NULL DEFAULT 'Sin grupo',
    CONSTRAINT fk_nic_nino
        FOREIGN KEY (nic_codnin) REFERENCES exi_ninos (nin_codnin),
    CONSTRAINT fk_nic_centro
        FOREIGN KEY (nic_codcen) REFERENCES exi_centros (exi_codcen),
    CONSTRAINT uq_nic_nino_centro UNIQUE (nic_codnin, nic_codcen)
);

CREATE INDEX IF NOT EXISTS idx_nic_codcen ON exi_ninos_cent (nic_codcen);
CREATE INDEX IF NOT EXISTS idx_nic_codnin ON exi_ninos_cent (nic_codnin);
CREATE INDEX IF NOT EXISTS idx_nic_tipgru ON exi_ninos_cent (nic_tipgru);

COMMENT ON TABLE  exi_ninos_cent IS 'Asignacion de ninos a centros y grupos';
COMMENT ON COLUMN exi_ninos_cent.nic_codnic IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_ninos_cent.nic_codnin IS 'Codigo del nino';
COMMENT ON COLUMN exi_ninos_cent.nic_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_ninos_cent.nic_tipgru IS 'Tipo / nombre del grupo';

-- =========================
-- EXI_TIPO_GRUPO
-- =========================
CREATE TABLE IF NOT EXISTS exi_tipo_grupo (
    tip_codgru   SERIAL         PRIMARY KEY,
    tip_descri   VARCHAR(100)   NOT NULL,
    tip_usrcre   VARCHAR(20),
    tip_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tip_fecbaj   TIMESTAMP,
    CONSTRAINT uq_tipo_grupo_descri UNIQUE (tip_descri)
);

CREATE INDEX IF NOT EXISTS idx_tipo_grupo_descri ON exi_tipo_grupo (tip_descri);

COMMENT ON TABLE  exi_tipo_grupo IS 'Tipos de grupo (PEQUEÑOS, MEDIANOS, MAYORES, etc.)';
COMMENT ON COLUMN exi_tipo_grupo.tip_codgru IS 'Codigo autonumerico del tipo de grupo (PK)';
COMMENT ON COLUMN exi_tipo_grupo.tip_descri IS 'Descripcion del tipo de grupo';
COMMENT ON COLUMN exi_tipo_grupo.tip_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_tipo_grupo.tip_feccre IS 'Fecha de creacion';
COMMENT ON COLUMN exi_tipo_grupo.tip_fecbaj IS 'Fecha de baja';

-- =========================
-- EXI_TIPO_GRUPOS_CENTRO
-- =========================
CREATE TABLE IF NOT EXISTS exi_tipo_grupos_centro (
    tgc_codtgc   SERIAL         PRIMARY KEY,
    tgc_codcen   VARCHAR(20)    NOT NULL,
    tgc_tipgru   INTEGER        NOT NULL,
    tgc_ordgru   INTEGER        NOT NULL DEFAULT 1,
    CONSTRAINT fk_tgc_centro
        FOREIGN KEY (tgc_codcen) REFERENCES exi_centros (exi_codcen),
    CONSTRAINT fk_tgc_tipo
        FOREIGN KEY (tgc_tipgru) REFERENCES exi_tipo_grupo (tip_codgru),
    CONSTRAINT uq_tgc_centro_tipo UNIQUE (tgc_codcen, tgc_tipgru)
);

CREATE INDEX IF NOT EXISTS idx_tgc_codcen ON exi_tipo_grupos_centro (tgc_codcen);
CREATE INDEX IF NOT EXISTS idx_tgc_tipgru ON exi_tipo_grupos_centro (tgc_tipgru);
CREATE INDEX IF NOT EXISTS idx_tgc_ordgru ON exi_tipo_grupos_centro (tgc_codcen, tgc_ordgru);

COMMENT ON TABLE  exi_tipo_grupos_centro IS 'Tipos de grupo asociados a cada centro';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_codtgc IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_tipgru IS 'Codigo del tipo de grupo';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_ordgru IS 'Ordenacion del grupo en el centro';

-- =========================
-- EXI_EVENTOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_eventos (
    exi_eveide   SERIAL         PRIMARY KEY,
    exi_feceve   DATE           NOT NULL,
    exi_nomeve   VARCHAR(200)   NOT NULL,
    exi_codcen   VARCHAR(20)    NOT NULL,
    eve_neccir   BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_eve_centro
        FOREIGN KEY (exi_codcen) REFERENCES exi_centros (exi_codcen)
);

CREATE INDEX IF NOT EXISTS idx_eventos_feceve ON exi_eventos (exi_feceve);
CREATE INDEX IF NOT EXISTS idx_eventos_codcen ON exi_eventos (exi_codcen);

COMMENT ON TABLE  exi_eventos IS 'Eventos asociados a centros';
COMMENT ON COLUMN exi_eventos.exi_eveide IS 'Codigo autonumerico del evento (PK)';
COMMENT ON COLUMN exi_eventos.exi_feceve IS 'Fecha del evento';
COMMENT ON COLUMN exi_eventos.exi_nomeve IS 'Nombre / descripcion del evento';
COMMENT ON COLUMN exi_eventos.exi_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_eventos.eve_neccir IS 'Necesita circular (true=Si, false=No)';

-- =========================
-- EXI_PERIODOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_periodos (
    per_codper   VARCHAR(10)    PRIMARY KEY,
    per_fecini   DATE           NOT NULL,
    per_fecfin   DATE           NOT NULL,
    per_status   VARCHAR(20)    NOT NULL DEFAULT 'Activo',
    CONSTRAINT ck_periodo_fechas CHECK (per_fecfin >= per_fecini),
    CONSTRAINT ck_periodo_status CHECK (per_status IN ('Activo', 'No Activo'))
);

CREATE INDEX IF NOT EXISTS idx_periodos_fecini ON exi_periodos (per_fecini);
CREATE INDEX IF NOT EXISTS idx_periodos_fecfin ON exi_periodos (per_fecfin);
CREATE INDEX IF NOT EXISTS idx_periodos_status ON exi_periodos (per_status);

COMMENT ON TABLE  exi_periodos IS 'Periodos de apertura';
COMMENT ON COLUMN exi_periodos.per_codper IS 'Codigo del periodo (PK), p.ej. P1-2026';
COMMENT ON COLUMN exi_periodos.per_fecini IS 'Fecha de inicio';
COMMENT ON COLUMN exi_periodos.per_fecfin IS 'Fecha de fin';
COMMENT ON COLUMN exi_periodos.per_status IS 'Estado del periodo: Activo / No Activo';

-- =========================
-- EXI_NINOS_PERIODO
-- =========================
CREATE TABLE IF NOT EXISTS exi_ninos_periodo (
    nip_codnip   SERIAL         PRIMARY KEY,
    nip_codnin   INTEGER        NOT NULL,
    nip_codper   VARCHAR(10)    NOT NULL,
    nip_usrcre   VARCHAR(20),
    nip_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nip_nino
        FOREIGN KEY (nip_codnin) REFERENCES exi_ninos (nin_codnin),
    CONSTRAINT fk_nip_periodo
        FOREIGN KEY (nip_codper) REFERENCES exi_periodos (per_codper),
    CONSTRAINT uq_nip_nino_periodo UNIQUE (nip_codnin, nip_codper)
);

CREATE INDEX IF NOT EXISTS idx_nip_codnin ON exi_ninos_periodo (nip_codnin);
CREATE INDEX IF NOT EXISTS idx_nip_codper ON exi_ninos_periodo (nip_codper);

COMMENT ON TABLE  exi_ninos_periodo IS 'Periodos en los que un nino asiste al campus';
COMMENT ON COLUMN exi_ninos_periodo.nip_codnip IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_ninos_periodo.nip_codnin IS 'Codigo del nino';
COMMENT ON COLUMN exi_ninos_periodo.nip_codper IS 'Codigo del periodo';
COMMENT ON COLUMN exi_ninos_periodo.nip_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_ninos_periodo.nip_feccre IS 'Fecha de creacion';

-- =========================
-- EXI_MONITORES_PERIODO
-- =========================
CREATE TABLE IF NOT EXISTS exi_monitores_periodo (
    mpe_codmpe   SERIAL         PRIMARY KEY,
    mpe_codmon   INTEGER        NOT NULL,
    mpe_codper   VARCHAR(10)    NOT NULL,
    mpe_usrcre   VARCHAR(20),
    mpe_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mpe_monitor
        FOREIGN KEY (mpe_codmon) REFERENCES exi_monitores (mon_codmon),
    CONSTRAINT fk_mpe_periodo
        FOREIGN KEY (mpe_codper) REFERENCES exi_periodos (per_codper),
    CONSTRAINT uq_mpe_monitor_periodo UNIQUE (mpe_codmon, mpe_codper)
);

CREATE INDEX IF NOT EXISTS idx_mpe_codmon ON exi_monitores_periodo (mpe_codmon);
CREATE INDEX IF NOT EXISTS idx_mpe_codper ON exi_monitores_periodo (mpe_codper);

COMMENT ON TABLE  exi_monitores_periodo IS 'Periodos en los que un monitor asiste al campus';
COMMENT ON COLUMN exi_monitores_periodo.mpe_codmpe IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_monitores_periodo.mpe_codmon IS 'Codigo del monitor';
COMMENT ON COLUMN exi_monitores_periodo.mpe_codper IS 'Codigo del periodo';
COMMENT ON COLUMN exi_monitores_periodo.mpe_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_monitores_periodo.mpe_feccre IS 'Fecha de creacion';

-- =========================
-- EXI_MONITORES_CENTRO (despues de periodos: FK moc_codper)
-- =========================
CREATE TABLE IF NOT EXISTS exi_monitores_centro (
    moc_codmoc   SERIAL         PRIMARY KEY,
    moc_codmon   INTEGER        NOT NULL,
    moc_codcen   VARCHAR(20)    NOT NULL,
    moc_tipgru   VARCHAR(100)   NOT NULL,
    moc_codper   VARCHAR(10)    NOT NULL,
    CONSTRAINT fk_moc_monitor
        FOREIGN KEY (moc_codmon) REFERENCES exi_monitores (mon_codmon),
    CONSTRAINT fk_moc_centro
        FOREIGN KEY (moc_codcen) REFERENCES exi_centros (exi_codcen),
    CONSTRAINT fk_moc_periodo
        FOREIGN KEY (moc_codper) REFERENCES exi_periodos (per_codper),
    CONSTRAINT uq_moc_monitor_centro_periodo UNIQUE (moc_codmon, moc_codcen, moc_codper)
);

CREATE INDEX IF NOT EXISTS idx_moc_codcen ON exi_monitores_centro (moc_codcen);
CREATE INDEX IF NOT EXISTS idx_moc_codmon ON exi_monitores_centro (moc_codmon);
CREATE INDEX IF NOT EXISTS idx_moc_codper ON exi_monitores_centro (moc_codper);
CREATE INDEX IF NOT EXISTS idx_moc_tipgru ON exi_monitores_centro (moc_codcen, moc_tipgru);
CREATE INDEX IF NOT EXISTS idx_moc_cen_per ON exi_monitores_centro (moc_codcen, moc_codper);

COMMENT ON TABLE  exi_monitores_centro IS 'Asignacion de monitores a grupos de un centro por periodo';
COMMENT ON COLUMN exi_monitores_centro.moc_codmoc IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_monitores_centro.moc_codmon IS 'Codigo del monitor';
COMMENT ON COLUMN exi_monitores_centro.moc_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_monitores_centro.moc_tipgru IS 'Tipo / nombre del grupo';
COMMENT ON COLUMN exi_monitores_centro.moc_codper IS 'Codigo del periodo de la asignacion';

-- =========================
-- EXI_NINOS_ASISTENCIA
-- =========================
CREATE TABLE IF NOT EXISTS exi_ninos_asistencia (
    asi_codasi   SERIAL         PRIMARY KEY,
    asi_fecasi   DATE           NOT NULL,
    asi_codnin   INTEGER        NOT NULL,
    asi_codmon   INTEGER,
    asi_codcen   VARCHAR(20)    NOT NULL,
    asi_codper   VARCHAR(10)    NOT NULL,
    asi_tipgru   VARCHAR(100)   NOT NULL,
    asi_asist    BOOLEAN        NOT NULL DEFAULT TRUE,
    asi_comedor  BOOLEAN        NOT NULL DEFAULT FALSE,
    asi_usrcre   VARCHAR(20),
    asi_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_asi_nino
        FOREIGN KEY (asi_codnin) REFERENCES exi_ninos (nin_codnin),
    CONSTRAINT fk_asi_monitor
        FOREIGN KEY (asi_codmon) REFERENCES exi_monitores (mon_codmon),
    CONSTRAINT fk_asi_centro
        FOREIGN KEY (asi_codcen) REFERENCES exi_centros (exi_codcen),
    CONSTRAINT fk_asi_periodo
        FOREIGN KEY (asi_codper) REFERENCES exi_periodos (per_codper),
    CONSTRAINT uq_asi_dia_nino UNIQUE (asi_fecasi, asi_codnin)
);

CREATE INDEX IF NOT EXISTS idx_asi_fecasi ON exi_ninos_asistencia (asi_fecasi);
CREATE INDEX IF NOT EXISTS idx_asi_codmon ON exi_ninos_asistencia (asi_codmon);
CREATE INDEX IF NOT EXISTS idx_asi_codnin ON exi_ninos_asistencia (asi_codnin);
CREATE INDEX IF NOT EXISTS idx_asi_codcen ON exi_ninos_asistencia (asi_codcen);
CREATE INDEX IF NOT EXISTS idx_asi_codper ON exi_ninos_asistencia (asi_codper);
CREATE INDEX IF NOT EXISTS idx_asi_mon_dia ON exi_ninos_asistencia (asi_codmon, asi_fecasi);

COMMENT ON TABLE  exi_ninos_asistencia IS 'Asistencia diaria de ninos (incluye comedor)';
COMMENT ON COLUMN exi_ninos_asistencia.asi_codasi IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_ninos_asistencia.asi_fecasi IS 'Fecha de asistencia';
COMMENT ON COLUMN exi_ninos_asistencia.asi_codnin IS 'Codigo del nino';
COMMENT ON COLUMN exi_ninos_asistencia.asi_codmon IS 'Codigo del monitor que registra / del grupo';
COMMENT ON COLUMN exi_ninos_asistencia.asi_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_ninos_asistencia.asi_codper IS 'Codigo del periodo';
COMMENT ON COLUMN exi_ninos_asistencia.asi_tipgru IS 'Grupo del nino en el momento del registro';
COMMENT ON COLUMN exi_ninos_asistencia.asi_asist IS 'Ha asistido (true/false)';
COMMENT ON COLUMN exi_ninos_asistencia.asi_comedor IS 'Se queda al comedor (true/false)';
COMMENT ON COLUMN exi_ninos_asistencia.asi_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_ninos_asistencia.asi_feccre IS 'Fecha de creacion';

-- =========================
-- EXI_DESCUENTOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_descuentos (
    des_coddes   VARCHAR(20)    PRIMARY KEY,
    des_desdes   VARCHAR(100)   NOT NULL,
    des_pordes   NUMERIC(10, 4) NOT NULL,
    des_usrcre   VARCHAR(20),
    des_feccre   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_des_desdes ON exi_descuentos (des_desdes);

COMMENT ON TABLE  exi_descuentos IS 'Catalogo de descuentos';
COMMENT ON COLUMN exi_descuentos.des_coddes IS 'Codigo de descuento (PK)';
COMMENT ON COLUMN exi_descuentos.des_desdes IS 'Descripcion del descuento';
COMMENT ON COLUMN exi_descuentos.des_pordes IS 'Porcentaje de descuento (decimal, p.ej. 23.43)';
COMMENT ON COLUMN exi_descuentos.des_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_descuentos.des_feccre IS 'Fecha de creacion';

-- =========================
-- EXI_PRECIOS
-- =========================
CREATE TABLE IF NOT EXISTS exi_precios (
    pre_codpre   VARCHAR(20)    PRIMARY KEY,
    pre_nompre   VARCHAR(100)   NOT NULL,
    pre_valpre   NUMERIC(12, 2) NOT NULL,
    pre_coddiv   VARCHAR(3)     NOT NULL DEFAULT 'EUR',
    pre_usrcre   VARCHAR(20),
    pre_feccre   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_nompre ON exi_precios (pre_nompre);
CREATE INDEX IF NOT EXISTS idx_pre_coddiv ON exi_precios (pre_coddiv);

COMMENT ON TABLE  exi_precios IS 'Catalogo de precios';
COMMENT ON COLUMN exi_precios.pre_codpre IS 'Codigo de precio (PK)';
COMMENT ON COLUMN exi_precios.pre_nompre IS 'Nombre del precio';
COMMENT ON COLUMN exi_precios.pre_valpre IS 'Valor del precio';
COMMENT ON COLUMN exi_precios.pre_coddiv IS 'Codigo de divisa (ISO, p.ej. EUR)';
COMMENT ON COLUMN exi_precios.pre_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_precios.pre_feccre IS 'Fecha de creacion';

-- =========================
-- Datos de prueba
-- =========================
INSERT INTO exi_usuarios (usr_codusr, usr_name, usr_usrcre, usr_pass, usr_descri, usr_tipusr)
VALUES
    ('admin', 'Administrador', 'SYSTEM', 'admin123', 'Usuario administrador', 'SUPERADMIN'),
    ('demo',  'Usuario Demo',  'SYSTEM', 'demo123',  'Usuario de demostración', 'DIRECTOR'),
    ('general', 'Usuario General', 'SYSTEM', 'general123', 'Acceso a mantenimientos generales', 'DIRECTOR')
ON CONFLICT (usr_codusr) DO NOTHING;

INSERT INTO exi_permisos (per_codper, per_nomper, per_usrcre)
VALUES
    ('SUPERADMIN', 'Superadministrador (único)', 'SYSTEM'),
    ('ADMIN',  'Administración', 'SYSTEM'),
    ('GENERAL','Acceso general a mantenimientos', 'SYSTEM'),
    ('LECTURA','Solo lectura',         'SYSTEM'),
    ('ESCRITURA','Lectura y escritura','SYSTEM')
ON CONFLICT (per_codper) DO NOTHING;

INSERT INTO exi_permisos_usuario (peu_codusr, peu_codper, peu_usrcre)
VALUES
    ('admin', 'SUPERADMIN', 'SYSTEM'),
    ('admin', 'ADMIN', 'SYSTEM'),
    ('admin', 'GENERAL', 'SYSTEM'),
    ('admin', 'LECTURA', 'SYSTEM'),
    ('admin', 'ESCRITURA', 'SYSTEM'),
    ('general', 'GENERAL', 'SYSTEM'),
    ('demo',  'LECTURA', 'SYSTEM')
ON CONFLICT (peu_codusr, peu_codper) DO NOTHING;
