-- Tabla EXI_MONITORES
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
