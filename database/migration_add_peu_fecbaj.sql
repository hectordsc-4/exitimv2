-- Añadir fecha de baja a asignaciones usuario-permiso
ALTER TABLE exi_permisos_usuario
    ADD COLUMN IF NOT EXISTS peu_fecbaj TIMESTAMP;

COMMENT ON COLUMN exi_permisos_usuario.peu_fecbaj IS 'Fecha de baja';
