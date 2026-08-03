ALTER TABLE exi_centros ADD COLUMN IF NOT EXISTS exi_descen VARCHAR(1000);
COMMENT ON COLUMN exi_centros.exi_descen IS 'Descripcion del centro';
