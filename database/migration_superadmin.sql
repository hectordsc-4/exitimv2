-- Permiso SUPERADMIN (único en el sistema) + promoción del usuario admin
INSERT INTO exi_permisos (per_codper, per_nomper, per_usrcre)
VALUES ('SUPERADMIN', 'Superadministrador (único)', 'SYSTEM')
ON CONFLICT (per_codper) DO NOTHING;

-- El usuario seed 'admin' pasa a ser el SUPERADMIN (si existe)
INSERT INTO exi_permisos_usuario (peu_codusr, peu_codper, peu_usrcre)
SELECT 'admin', 'SUPERADMIN', 'SYSTEM'
WHERE EXISTS (SELECT 1 FROM exi_usuarios WHERE usr_codusr = 'admin')
  AND NOT EXISTS (
      SELECT 1 FROM exi_permisos_usuario
      WHERE peu_codusr = 'admin' AND peu_codper = 'SUPERADMIN'
  );

-- Si no existe 'admin', promover al primer usuario que ya tenga ADMIN activo
INSERT INTO exi_permisos_usuario (peu_codusr, peu_codper, peu_usrcre)
SELECT peu_codusr, 'SUPERADMIN', 'SYSTEM'
FROM exi_permisos_usuario
WHERE peu_codper = 'ADMIN'
  AND peu_fecbaj IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM exi_permisos_usuario
      WHERE peu_codper = 'SUPERADMIN' AND peu_fecbaj IS NULL
  )
ORDER BY peu_codpeu
LIMIT 1;
