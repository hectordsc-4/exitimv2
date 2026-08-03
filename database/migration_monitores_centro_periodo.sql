-- Periodo en asignacion monitor-centro-grupo
ALTER TABLE exi_monitores_centro
    ADD COLUMN IF NOT EXISTS moc_codper VARCHAR(10);

-- Rellenar filas antiguas con el primer periodo activo (o cualquiera)
UPDATE exi_monitores_centro moc
SET moc_codper = (
    SELECT p.per_codper
    FROM exi_periodos p
    WHERE p.per_status = 'Activo'
    ORDER BY p.per_fecini ASC
    LIMIT 1
)
WHERE moc.moc_codper IS NULL;

UPDATE exi_monitores_centro moc
SET moc_codper = (
    SELECT p.per_codper
    FROM exi_periodos p
    ORDER BY p.per_fecini ASC
    LIMIT 1
)
WHERE moc.moc_codper IS NULL;

ALTER TABLE exi_monitores_centro
    ALTER COLUMN moc_codper SET NOT NULL;

ALTER TABLE exi_monitores_centro
    DROP CONSTRAINT IF EXISTS fk_moc_periodo;
ALTER TABLE exi_monitores_centro
    ADD CONSTRAINT fk_moc_periodo
    FOREIGN KEY (moc_codper) REFERENCES exi_periodos (per_codper);

ALTER TABLE exi_monitores_centro
    DROP CONSTRAINT IF EXISTS uq_moc_monitor_centro;
ALTER TABLE exi_monitores_centro
    DROP CONSTRAINT IF EXISTS uq_moc_monitor_centro_periodo;
ALTER TABLE exi_monitores_centro
    ADD CONSTRAINT uq_moc_monitor_centro_periodo UNIQUE (moc_codmon, moc_codcen, moc_codper);

CREATE INDEX IF NOT EXISTS idx_moc_codper ON exi_monitores_centro (moc_codper);
CREATE INDEX IF NOT EXISTS idx_moc_cen_per ON exi_monitores_centro (moc_codcen, moc_codper);

COMMENT ON COLUMN exi_monitores_centro.moc_codper IS 'Codigo del periodo de la asignacion';
COMMENT ON TABLE  exi_monitores_centro IS 'Asignacion de monitores a grupos de un centro por periodo';
