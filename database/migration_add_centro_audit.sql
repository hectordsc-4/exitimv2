ALTER TABLE exi_centros ADD COLUMN IF NOT EXISTS cen_usrcre VARCHAR(20);
ALTER TABLE exi_centros ADD COLUMN IF NOT EXISTS cen_feccre TIMESTAMP;
COMMENT ON COLUMN exi_centros.cen_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_centros.cen_feccre IS 'Fecha de creacion';
