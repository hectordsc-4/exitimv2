-- Tabla EXI_CENTROS + permiso GENERAL
CREATE TABLE IF NOT EXISTS exi_centros (
    exi_codcen   VARCHAR(20)    PRIMARY KEY,
    exi_nomcen   VARCHAR(200)   NOT NULL,
    exi_latgps   NUMERIC(12, 8),
    exi_longgps  NUMERIC(12, 8),
    exi_nompob   VARCHAR(200),
    exi_capaci   NUMERIC(10),
    exi_descen   VARCHAR(1000),
    cen_usrcre   VARCHAR(20),
    cen_feccre   TIMESTAMP,
    exi_fecbaj   TIMESTAMP
);

COMMENT ON TABLE  exi_centros IS 'Centros EXI';
COMMENT ON COLUMN exi_centros.exi_codcen IS 'Código del centro (PK)';
COMMENT ON COLUMN exi_centros.exi_nomcen IS 'Nombre del centro';
COMMENT ON COLUMN exi_centros.exi_latgps IS 'Latitud GPS';
COMMENT ON COLUMN exi_centros.exi_longgps IS 'Longitud GPS';
COMMENT ON COLUMN exi_centros.exi_nompob IS 'Nombre de la población';
COMMENT ON COLUMN exi_centros.exi_capaci IS 'Capacidad';
COMMENT ON COLUMN exi_centros.exi_descen IS 'Descripción del centro';
COMMENT ON COLUMN exi_centros.cen_usrcre IS 'Usuario de creación';
COMMENT ON COLUMN exi_centros.cen_feccre IS 'Fecha de creación';
COMMENT ON COLUMN exi_centros.exi_fecbaj IS 'Fecha de baja';

INSERT INTO exi_permisos (per_codper, per_nomper, per_usrcre)
VALUES ('GENERAL', 'Acceso general a mantenimientos', 'SYSTEM')
ON CONFLICT (per_codper) DO NOTHING;

-- Usuario de prueba con acceso General (Centros)
INSERT INTO exi_usuarios (usr_codusr, usr_name, usr_usrcre, usr_pass, usr_email, usr_descri)
VALUES ('general', 'Usuario General', 'SYSTEM', 'general123', 'general@exi.local', 'Acceso a mantenimientos generales')
ON CONFLICT (usr_codusr) DO NOTHING;

INSERT INTO exi_permisos_usuario (peu_codusr, peu_codper, peu_usrcre)
VALUES
    ('general', 'GENERAL', 'SYSTEM'),
    ('admin', 'GENERAL', 'SYSTEM')
ON CONFLICT (peu_codusr, peu_codper) DO NOTHING;
