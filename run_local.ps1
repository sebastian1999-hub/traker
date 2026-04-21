$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

Write-Host '[1/3] Regenerando data/dashboard_data.json...' -ForegroundColor Cyan
python scripts/build_dashboard_data.py --out data/dashboard_data.json

Write-Host '[2/3] Abriendo dashboard en navegador...' -ForegroundColor Cyan
Start-Process 'http://127.0.0.1:8765/'

Write-Host '[3/3] Servidor local activo en http://127.0.0.1:8765/' -ForegroundColor Green
Write-Host 'Deja esta consola abierta para mantenerlo ejecutando.' -ForegroundColor Yellow
python -m http.server 8765
