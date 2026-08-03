-- Asignacion de ninos a periodos de apertura (asistencia al campus)
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
