-- Monitores asignados a grupos de un centro
CREATE TABLE IF NOT EXISTS exi_monitores_centro (
    moc_codmoc   SERIAL         PRIMARY KEY,
    moc_codmon   INTEGER        NOT NULL,
    moc_codcen   VARCHAR(20)    NOT NULL,
    moc_tipgru   VARCHAR(100)   NOT NULL,
    CONSTRAINT fk_moc_monitor
        FOREIGN KEY (moc_codmon) REFERENCES exi_monitores (mon_codmon),
    CONSTRAINT fk_moc_centro
        FOREIGN KEY (moc_codcen) REFERENCES exi_centros (exi_codcen),
    CONSTRAINT uq_moc_monitor_centro UNIQUE (moc_codmon, moc_codcen)
);

CREATE INDEX IF NOT EXISTS idx_moc_codcen ON exi_monitores_centro (moc_codcen);
CREATE INDEX IF NOT EXISTS idx_moc_codmon ON exi_monitores_centro (moc_codmon);
CREATE INDEX IF NOT EXISTS idx_moc_tipgru ON exi_monitores_centro (moc_codcen, moc_tipgru);

COMMENT ON TABLE  exi_monitores_centro IS 'Asignacion de monitores a grupos de un centro';
COMMENT ON COLUMN exi_monitores_centro.moc_codmoc IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_monitores_centro.moc_codmon IS 'Codigo del monitor';
COMMENT ON COLUMN exi_monitores_centro.moc_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_monitores_centro.moc_tipgru IS 'Tipo / nombre del grupo';
