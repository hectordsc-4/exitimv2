-- Necesita circular (Sí/No)
ALTER TABLE exi_eventos
    ADD COLUMN IF NOT EXISTS eve_neccir BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN exi_eventos.eve_neccir IS 'Necesita circular (true=Sí, false=No)';
