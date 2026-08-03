-- Monitor opcional en asistencia diaria
ALTER TABLE exi_ninos_asistencia
    ALTER COLUMN asi_codmon DROP NOT NULL;
