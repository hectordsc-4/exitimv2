-- Renombrar necesidades especiales -> necesita apoyo (monitor extra)
ALTER TABLE exi_ninos
    RENAME COLUMN nin_necesp TO nin_apoyo;

COMMENT ON COLUMN exi_ninos.nin_apoyo IS 'Indica si el niño necesita apoyo (monitor extra en el grupo)';
