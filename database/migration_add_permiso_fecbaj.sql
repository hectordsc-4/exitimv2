-- Añadir fecha de baja a permisos
ALTER TABLE exi_permisos
    ADD COLUMN IF NOT EXISTS per_fecbaj TIMESTAMP;

COMMENT ON COLUMN exi_permisos.per_fecbaj IS 'Fecha de baja';
