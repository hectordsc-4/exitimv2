-- Estado del periodo: Activo / No Activo
ALTER TABLE exi_periodos
    ADD COLUMN IF NOT EXISTS per_status VARCHAR(20) NOT NULL DEFAULT 'Activo';

UPDATE exi_periodos
SET per_status = 'Activo'
WHERE per_status IS NULL OR TRIM(per_status) = '';

ALTER TABLE exi_periodos
    DROP CONSTRAINT IF EXISTS ck_periodo_status;

ALTER TABLE exi_periodos
    ADD CONSTRAINT ck_periodo_status
    CHECK (per_status IN ('Activo', 'No Activo'));

CREATE INDEX IF NOT EXISTS idx_periodos_status ON exi_periodos (per_status);

COMMENT ON COLUMN exi_periodos.per_status IS 'Estado del periodo: Activo / No Activo';
