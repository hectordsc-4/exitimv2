-- Ejecutar una sola vez en el Postgres de Coolify (lista-viva-postgres)
-- si el usuario no tiene permiso CREATEDB y el arranque automático falla.

CREATE DATABASE exi_db OWNER listaviva ENCODING 'UTF8';
