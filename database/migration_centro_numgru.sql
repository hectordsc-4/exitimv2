-- Número de grupos del centro (3 o 4)
ALTER TABLE exi_centros
    ADD COLUMN IF NOT EXISTS exi_numgru INTEGER;

UPDATE exi_centros
SET exi_numgru = 3
WHERE exi_numgru IS NULL;

ALTER TABLE exi_centros
    ALTER COLUMN exi_numgru SET DEFAULT 3;

ALTER TABLE exi_centros
    ALTER COLUMN exi_numgru SET NOT NULL;

ALTER TABLE exi_centros
    DROP CONSTRAINT IF EXISTS ck_centros_numgru;

ALTER TABLE exi_centros
    ADD CONSTRAINT ck_centros_numgru CHECK (exi_numgru IN (3, 4));

COMMENT ON COLUMN exi_centros.exi_numgru IS 'Numero de grupos del centro: 3 (PEQUEÑOS/MEDIANOS/MAYORES) o 4 (+PEQUEÑOS 1/2)';
