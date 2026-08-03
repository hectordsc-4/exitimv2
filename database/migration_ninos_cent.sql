-- Asociación niños ↔ centros / grupos
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
