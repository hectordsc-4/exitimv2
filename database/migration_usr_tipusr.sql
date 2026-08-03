-- Tipo de usuario: SUPERADMIN | ADMIN | DIRECTOR | MONITOR
ALTER TABLE exi_usuarios
    ADD COLUMN IF NOT EXISTS usr_tipusr VARCHAR(20);

-- Rellenar según permisos / vínculo a monitor
UPDATE exi_usuarios u
SET usr_tipusr = 'SUPERADMIN'
WHERE EXISTS (
    SELECT 1 FROM exi_permisos_usuario p
    WHERE p.peu_codusr = u.usr_codusr
      AND p.peu_codper = 'SUPERADMIN'
      AND p.peu_fecbaj IS NULL
);

UPDATE exi_usuarios u
SET usr_tipusr = 'MONITOR'
WHERE usr_tipusr IS NULL
  AND EXISTS (
    SELECT 1 FROM exi_monitores m
    WHERE m.mon_codusr = u.usr_codusr
);

UPDATE exi_usuarios u
SET usr_tipusr = 'ADMIN'
WHERE usr_tipusr IS NULL
  AND EXISTS (
    SELECT 1 FROM exi_permisos_usuario p
    WHERE p.peu_codusr = u.usr_codusr
      AND p.peu_codper = 'ADMIN'
      AND p.peu_fecbaj IS NULL
);

UPDATE exi_usuarios
SET usr_tipusr = 'DIRECTOR'
WHERE usr_tipusr IS NULL;

ALTER TABLE exi_usuarios
    ALTER COLUMN usr_tipusr SET DEFAULT 'DIRECTOR';

ALTER TABLE exi_usuarios
    ALTER COLUMN usr_tipusr SET NOT NULL;

ALTER TABLE exi_usuarios
    DROP CONSTRAINT IF EXISTS ck_usuarios_tipusr;

ALTER TABLE exi_usuarios
    ADD CONSTRAINT ck_usuarios_tipusr CHECK (
        usr_tipusr IN ('SUPERADMIN', 'ADMIN', 'DIRECTOR', 'MONITOR')
    );

COMMENT ON COLUMN exi_usuarios.usr_tipusr IS 'Tipo de usuario: SUPERADMIN, ADMIN, DIRECTOR o MONITOR';
