# Video de portafolio · Portal Servimantos

Reel de **~87 s** hecho con [Remotion](https://www.remotion.dev/). Mezcla motion graphics con grabaciones reales de la interfaz del portal.

| Composición | Tamaño | Uso |
|---|---|---|
| `ServimantosVertical` | 1080×1920 (9:16) | Reels, Shorts, LinkedIn en el celular |
| `ServimantosHorizontal` | 1920×1080 (16:9) | Portafolio web, YouTube |

El guion segundo a segundo y la guía de grabación están en **[GUION.md](GUION.md)**.

## Uso

```bash
npm install
npm run dev        # Remotion Studio
npm run render     # out/servimantos-9x16.mp4 y out/servimantos-16x9.mp4
npm run still      # portadas PNG
```

## Grabaciones

1. Grabar los clips `REC-01…06` (ver GUION.md).
2. Copiar cada uno a su carpeta, `public/grabaciones/REC-0X/`, como `movil.mp4` y/o `escritorio.mp4`, y activar su bandera en `src/grabaciones.ts`.
3. Mientras falte un clip, su escena muestra un marcador con lo que hay que grabar.

## Archivos

- `src/Video.tsx`: orden y duración de las escenas.
- `src/scenes/`:
  - motion: `Gancho`, `Intro`, `Numeros`, `Pdf`, `Avisos`, `Stack`, `Outro`
  - UI real: `EscenaUI`
- `src/components/`: celular, portátil, banners, íconos y fondo.
- `src/theme.ts`: colores y fuentes del portal.

Los datos que aparecen son de demo. Esta carpeta no se publica en Vercel (`/.vercelignore`).
