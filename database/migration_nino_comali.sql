-- Comentario alimenticio del niño (alergias / restricciones para cocina)
ALTER TABLE exi_ninos
    ADD COLUMN IF NOT EXISTS nin_comali VARCHAR(100);

COMMENT ON COLUMN exi_ninos.nin_comali IS 'Comentario alimenticio: CELIACO, No come CERDO, etc.';
