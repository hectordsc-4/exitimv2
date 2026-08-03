-- Periodos de apertura
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
