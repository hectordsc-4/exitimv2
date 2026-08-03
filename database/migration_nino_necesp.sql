-- Necesidades especiales del niño (check sí/no)
ALTER TABLE exi_ninos
    ADD COLUMN IF NOT EXISTS nin_necesp BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN exi_ninos.nin_necesp IS 'Indica si el niño tiene necesidades especiales';
