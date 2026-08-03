# Arranca PostgreSQL portable (local EXI)
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$PgRoot = Join-Path $Root "tools\pgsql\pgsql"
$Bin = Join-Path $PgRoot "bin"
$Data = Join-Path $Root "tools\pgdata"
$Log = Join-Path $Root "tools\pg.log"
$PasswordFile = Join-Path $Root "tools\pgpass.txt"

$env:Path = "$Bin;$env:Path"
$env:PGPASSWORD = "exi_local_2026"

if (-not (Test-Path (Join-Path $Bin "pg_ctl.exe"))) {
    throw "No se encontró PostgreSQL en $Bin"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Data) | Out-Null

if (-not (Test-Path (Join-Path $Data "PG_VERSION"))) {
    Write-Host "Inicializando cluster en $Data ..."
    "exi_local_2026" | Set-Content -Path $PasswordFile -NoNewline -Encoding ascii
    & "$Bin\initdb.exe" -D $Data -U postgres -A password --pwfile=$PasswordFile -E UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw "initdb falló" }

    # Escuchar en localhost:5432
    $conf = Join-Path $Data "postgresql.conf"
    (Get-Content $conf) `
        -replace "#?listen_addresses\s*=.*", "listen_addresses = 'localhost'" `
        -replace "#?port\s*=.*", "port = 5432" |
        Set-Content $conf
}

$status = & "$Bin\pg_ctl.exe" -D $Data status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL ya está en marcha."
} else {
    Write-Host "Arrancando PostgreSQL..."
    & "$Bin\pg_ctl.exe" -D $Data -l $Log start
    if ($LASTEXITCODE -ne 0) { throw "No se pudo arrancar PostgreSQL. Revisa $Log" }
    Start-Sleep -Seconds 2
    Write-Host "PostgreSQL escuchando en localhost:5432"
}

Write-Host "OK. Usuario: postgres | Password: exi_local_2026 | Puerto: 5432"
