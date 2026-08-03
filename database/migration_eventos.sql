-- Eventos asociados a centros
CREATE TABLE IF NOT EXISTS exi_eventos (
    exi_eveide   SERIAL         PRIMARY KEY,
    exi_feceve   DATE           NOT NULL,
    exi_nomeve   VARCHAR(200)   NOT NULL,
    exi_codcen   VARCHAR(20)    NOT NULL,
    eve_neccir   BOOLEAN        NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_eve_centro
        FOREIGN KEY (exi_codcen) REFERENCES exi_centros (exi_codcen)
);

CREATE INDEX IF NOT EXISTS idx_eventos_feceve ON exi_eventos (exi_feceve);
CREATE INDEX IF NOT EXISTS idx_eventos_codcen ON exi_eventos (exi_codcen);

COMMENT ON TABLE  exi_eventos IS 'Eventos asociados a centros';
COMMENT ON COLUMN exi_eventos.exi_eveide IS 'Codigo autonumerico del evento (PK)';
COMMENT ON COLUMN exi_eventos.exi_feceve IS 'Fecha del evento';
COMMENT ON COLUMN exi_eventos.exi_nomeve IS 'Nombre / descripcion del evento';
COMMENT ON COLUMN exi_eventos.exi_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_eventos.eve_neccir IS 'Necesita circular (true=Si, false=No)';
