# Arranca API EXI (FastAPI + frontend estático)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"

# Asegurar PostgreSQL
& (Join-Path $Root "database\start_postgres.ps1")

Set-Location $Backend
Write-Host "API en http://127.0.0.1:8000  |  Docs: http://127.0.0.1:8000/docs"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
