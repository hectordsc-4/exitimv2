-- Tabla EXI_NINOS (mantenimiento GENERAL)
CREATE TABLE IF NOT EXISTS exi_ninos (
    nin_codnin   SERIAL         PRIMARY KEY,
    nin_nomnin   VARCHAR(100)   NOT NULL,
    nin_fecnac   DATE,
    nin_tipnin   VARCHAR(50),
    nin_comali   VARCHAR(100),
    nin_desnin   VARCHAR(900),
    nin_usrcre   VARCHAR(20),
    nin_feccre   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nin_fecbaj   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ninos_nomnin ON exi_ninos (nin_nomnin);

COMMENT ON TABLE  exi_ninos IS 'Niños EXI';
COMMENT ON COLUMN exi_ninos.nin_codnin IS 'Codigo autonumerico del niño (PK)';
COMMENT ON COLUMN exi_ninos.nin_nomnin IS 'Nombre del niño';
COMMENT ON COLUMN exi_ninos.nin_fecnac IS 'Fecha de nacimiento';
COMMENT ON COLUMN exi_ninos.nin_tipnin IS 'Tipo de niño: Pequeños, Medianos, Mayores, etc.';
COMMENT ON COLUMN exi_ninos.nin_comali IS 'Comentario alimenticio: CELIACO, No come CERDO, etc.';
COMMENT ON COLUMN exi_ninos.nin_desnin IS 'Descripcion del niño';
COMMENT ON COLUMN exi_ninos.nin_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_ninos.nin_feccre IS 'Fecha de creacion';
COMMENT ON COLUMN exi_ninos.nin_fecbaj IS 'Fecha de baja';
