# Detiene PostgreSQL portable
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Bin = Join-Path $Root "tools\pgsql\pgsql\bin"
$Data = Join-Path $Root "tools\pgdata"
$env:Path = "$Bin;$env:Path"
& "$Bin\pg_ctl.exe" -D $Data stop -m fast
Write-Host "PostgreSQL detenido."
