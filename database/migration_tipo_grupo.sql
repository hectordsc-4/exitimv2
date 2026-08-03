-- Mantenimiento de tipos de grupo
CREATE TABLE IF NOT EXISTS exi_tipo_grupo (
    tip_codgru   SERIAL         PRIMARY KEY,
    tip_descri   VARCHAR(100)   NOT NULL,
    tip_usrcre   VARCHAR(20),
    tip_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tip_fecbaj   TIMESTAMP,
    CONSTRAINT uq_tipo_grupo_descri UNIQUE (tip_descri)
);

CREATE INDEX IF NOT EXISTS idx_tipo_grupo_descri ON exi_tipo_grupo (tip_descri);

COMMENT ON TABLE  exi_tipo_grupo IS 'Tipos de grupo (PEQUEÑOS, MEDIANOS, MAYORES, etc.)';
COMMENT ON COLUMN exi_tipo_grupo.tip_codgru IS 'Codigo autonumerico del tipo de grupo (PK)';
COMMENT ON COLUMN exi_tipo_grupo.tip_descri IS 'Descripcion del tipo de grupo';
COMMENT ON COLUMN exi_tipo_grupo.tip_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_tipo_grupo.tip_feccre IS 'Fecha de creacion';
COMMENT ON COLUMN exi_tipo_grupo.tip_fecbaj IS 'Fecha de baja';

-- Datos iniciales (solo si la tabla esta vacia)
INSERT INTO exi_tipo_grupo (tip_descri, tip_usrcre, tip_feccre)
SELECT v.descri, 'admin', CURRENT_TIMESTAMP
FROM (VALUES
    ('PEQUEÑOS'),
    ('MEDIANOS'),
    ('MAYORES'),
    ('PEQUEÑOS 1'),
    ('PEQUEÑOS 2')
) AS v(descri)
WHERE NOT EXISTS (SELECT 1 FROM exi_tipo_grupo LIMIT 1);
