-- Grupos asociados a cada centro
CREATE TABLE IF NOT EXISTS exi_tipo_grupos_centro (
    tgc_codtgc   SERIAL         PRIMARY KEY,
    tgc_codcen   VARCHAR(20)    NOT NULL,
    tgc_tipgru   INTEGER        NOT NULL,
    tgc_ordgru   INTEGER        NOT NULL DEFAULT 1,
    CONSTRAINT fk_tgc_centro
        FOREIGN KEY (tgc_codcen) REFERENCES exi_centros (exi_codcen),
    CONSTRAINT fk_tgc_tipo
        FOREIGN KEY (tgc_tipgru) REFERENCES exi_tipo_grupo (tip_codgru),
    CONSTRAINT uq_tgc_centro_tipo UNIQUE (tgc_codcen, tgc_tipgru)
);

CREATE INDEX IF NOT EXISTS idx_tgc_codcen ON exi_tipo_grupos_centro (tgc_codcen);
CREATE INDEX IF NOT EXISTS idx_tgc_tipgru ON exi_tipo_grupos_centro (tgc_tipgru);
CREATE INDEX IF NOT EXISTS idx_tgc_ordgru ON exi_tipo_grupos_centro (tgc_codcen, tgc_ordgru);

COMMENT ON TABLE  exi_tipo_grupos_centro IS 'Tipos de grupo asociados a cada centro';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_codtgc IS 'Codigo autonumerico (PK)';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_codcen IS 'Codigo del centro';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_tipgru IS 'Codigo del tipo de grupo';
COMMENT ON COLUMN exi_tipo_grupos_centro.tgc_ordgru IS 'Ordenacion del grupo en el centro';

-- Semilla segun exi_numgru del centro (solo si no hay filas)
INSERT INTO exi_tipo_grupos_centro (tgc_codcen, tgc_tipgru, tgc_ordgru)
SELECT c.exi_codcen, t.tip_codgru, v.ord
FROM exi_centros c
CROSS JOIN LATERAL (
    SELECT * FROM (VALUES
        (3, 'PEQUEÑOS', 1),
        (3, 'MEDIANOS', 2),
        (3, 'MAYORES', 3),
        (4, 'PEQUEÑOS 1', 1),
        (4, 'PEQUEÑOS 2', 2),
        (4, 'MEDIANOS', 3),
        (4, 'MAYORES', 4)
    ) AS x(numgru, descri, ord)
    WHERE x.numgru = COALESCE(c.exi_numgru, 3)
) v
JOIN exi_tipo_grupo t ON t.tip_descri = v.descri AND t.tip_fecbaj IS NULL
WHERE NOT EXISTS (SELECT 1 FROM exi_tipo_grupos_centro LIMIT 1)
ON CONFLICT (tgc_codcen, tgc_tipgru) DO NOTHING;
