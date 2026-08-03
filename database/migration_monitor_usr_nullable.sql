-- Usuario del monitor opcional (puede haber monitores sin acceso al sistema)
ALTER TABLE exi_monitores
    ALTER COLUMN mon_codusr DROP NOT NULL;

COMMENT ON COLUMN exi_monitores.mon_codusr IS 'Codigo de usuario asociado (opcional; NULL si no entra al sistema)';
