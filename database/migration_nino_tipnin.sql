-- Tipo de niño (Pequeños, Medianos, Mayores, …)
ALTER TABLE exi_ninos
    ADD COLUMN IF NOT EXISTS nin_tipnin VARCHAR(50);

COMMENT ON COLUMN exi_ninos.nin_tipnin IS 'Tipo de niño: Pequeños, Medianos, Mayores, etc.';
