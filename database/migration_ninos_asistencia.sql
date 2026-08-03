-- Asistencia diaria de niños (con comedor)
CREATE TABLE IF NOT EXISTS exi_ninos_asistencia (
    asi_codasi   SERIAL         PRIMARY KEY,
    asi_fecasi   DATE           NOT NULL,
    asi_codnin   INTEGER        NOT NULL,
    asi_codmon   INTEGER        NOT NULL,
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
