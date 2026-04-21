# STS2 Dashboard

Dashboard estatico para Slay the Spire 2 generado desde archivos `.run` locales.

## Ejecutar en local

Desde PowerShell, en esta carpeta:

```powershell
.\run_local.ps1
```

Esto hace tres cosas:
1. Regenera `data/dashboard_data.json` con tus ultimas partidas.
2. Abre el navegador en `http://127.0.0.1:8765/`.
3. Levanta un servidor local para ver el dashboard.

Si solo quieres refrescar datos:

```powershell
.\update_data.ps1
```

## Despliegue en GitHub Pages

Si lo quieres ver online igual que local:

1. Este repo ya incluye workflow de Pages en `.github/workflows/pages.yml`.
2. Haz push a `main`.
3. En GitHub: `Settings` -> `Pages`.
4. En `Build and deployment`, selecciona `Source: GitHub Actions`.
5. Espera a que termine el workflow `Deploy static dashboard to GitHub Pages`.
6. Tu web quedara en: `https://TU_USUARIO.github.io/traker/`.

## Como mantenerlo actualizado en GitHub

GitHub Pages es estatico, no puede leer tus partidas locales por si solo.

Flujo recomendado cada vez que quieras actualizar:

1. Ejecuta localmente:

```powershell
.\update_data.ps1
```

2. Haz commit y push de `data/dashboard_data.json`.
3. GitHub Pages se actualiza automaticamente con ese nuevo JSON.

## Mantenerlo "ejecutado"

- En **GitHub Pages**: no tienes que mantener nada ejecutandose; siempre queda online.
- En **local**: para verlo, necesitas mantener abierto el proceso de `python -m http.server` (por ejemplo con `run_local.ps1`).
