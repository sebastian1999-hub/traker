$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

Write-Host 'Regenerando data/dashboard_data.json...' -ForegroundColor Cyan
python scripts/build_dashboard_data.py --out data/dashboard_data.json
Write-Host 'Listo.' -ForegroundColor Green
