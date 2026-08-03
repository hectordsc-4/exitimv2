# Inicializa la base de datos EXI en PostgreSQL local
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pgBinCandidates = @(
    (Join-Path $root "tools\pgsql\pgsql\bin"),
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\16\bin"
)

$pgBin = $pgBinCandidates | Where-Object { Test-Path "$_\psql.exe" } | Select-Object -First 1
if (-not $pgBin) {
    throw "No se encontró psql.exe. Ejecuta primero database\start_postgres.ps1"
}

$env:Path = "$pgBin;$env:Path"
$env:PGPASSWORD = "exi_local_2026"

$psql = Join-Path $pgBin "psql.exe"
$schemaFile = Join-Path $PSScriptRoot "schema.sql"

Write-Host "Usando psql: $psql"
Write-Host "Aplicando schema..."

# Crear DB si no existe (schema.sql usa CREATE DATABASE; si ya existe fallará, lo manejamos)
& $psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=0 -c "SELECT 1 FROM pg_database WHERE datname='exi_db'" | Out-Null

$dbExists = & $psql -U postgres -h localhost -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='exi_db'"
if ($dbExists -ne "1") {
    & $psql -U postgres -h localhost -p 5432 -d postgres -c "CREATE DATABASE exi_db WITH OWNER = postgres ENCODING = 'UTF8' TEMPLATE = template0;"
    Write-Host "Base de datos exi_db creada."
} else {
    Write-Host "Base de datos exi_db ya existe."
}

# Aplicar tablas y datos (sin CREATE DATABASE)
$tablesSql = Join-Path $PSScriptRoot "tables.sql"
& $psql -U postgres -h localhost -p 5432 -d exi_db -v ON_ERROR_STOP=1 -f $tablesSql

Write-Host "Listo. Conecta DBeaver a localhost:5432 / exi_db / postgres"
