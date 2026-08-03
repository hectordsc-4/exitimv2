-- Descuentos y precios
CREATE TABLE IF NOT EXISTS exi_descuentos (
    des_coddes   VARCHAR(20)    PRIMARY KEY,
    des_desdes   VARCHAR(100)   NOT NULL,
    des_pordes   NUMERIC(10, 4) NOT NULL,
    des_usrcre   VARCHAR(20),
    des_feccre   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_des_desdes ON exi_descuentos (des_desdes);

COMMENT ON TABLE  exi_descuentos IS 'Catalogo de descuentos';
COMMENT ON COLUMN exi_descuentos.des_coddes IS 'Codigo de descuento (PK)';
COMMENT ON COLUMN exi_descuentos.des_desdes IS 'Descripcion del descuento';
COMMENT ON COLUMN exi_descuentos.des_pordes IS 'Porcentaje de descuento (decimal, p.ej. 23.43)';
COMMENT ON COLUMN exi_descuentos.des_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_descuentos.des_feccre IS 'Fecha de creacion';

CREATE TABLE IF NOT EXISTS exi_precios (
    pre_codpre   VARCHAR(20)    PRIMARY KEY,
    pre_nompre   VARCHAR(100)   NOT NULL,
    pre_valpre   NUMERIC(12, 2) NOT NULL,
    pre_coddiv   VARCHAR(3)     NOT NULL DEFAULT 'EUR',
    pre_usrcre   VARCHAR(20),
    pre_feccre   TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_nompre ON exi_precios (pre_nompre);
CREATE INDEX IF NOT EXISTS idx_pre_coddiv ON exi_precios (pre_coddiv);

COMMENT ON TABLE  exi_precios IS 'Catalogo de precios';
COMMENT ON COLUMN exi_precios.pre_codpre IS 'Codigo de precio (PK)';
COMMENT ON COLUMN exi_precios.pre_nompre IS 'Nombre del precio';
COMMENT ON COLUMN exi_precios.pre_valpre IS 'Valor del precio';
COMMENT ON COLUMN exi_precios.pre_coddiv IS 'Codigo de divisa (ISO, p.ej. EUR)';
COMMENT ON COLUMN exi_precios.pre_usrcre IS 'Usuario de creacion';
COMMENT ON COLUMN exi_precios.pre_feccre IS 'Fecha de creacion';
