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

1. Sube **todo** el contenido de esta carpeta a un repo nuevo (por ejemplo `sts2-dashboard`).
2. En GitHub: `Settings` -> `Pages`.
3. En `Build and deployment`, elige `Deploy from a branch`.
4. Branch: `main`, folder: `/ (root)`.
5. Guarda y espera 1-2 minutos.
6. Tu web quedara en: `https://TU_USUARIO.github.io/sts2-dashboard/`.

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
