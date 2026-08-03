-- Añade email a usuarios (idempotente)
ALTER TABLE exi_usuarios
    ADD COLUMN IF NOT EXISTS usr_email VARCHAR(200);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email
    ON exi_usuarios (usr_email)
    WHERE usr_email IS NOT NULL;

COMMENT ON COLUMN exi_usuarios.usr_email IS 'Email del usuario (recordar contraseña)';
