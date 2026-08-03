-- Asignacion de monitores a periodos de apertura
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
