# Guion · Video Servimantos (≈87 s)

**Concepto:** *«Del celular al PDF firmado».* El reporte de obra pasa de Word, fotos sueltas y números repetidos a un portal instalable. El portal arma el PDF, numera solo y avisa al equipo. Motion graphics para explicar y grabaciones reales para probarlo.

**Formatos:**
- `ServimantosVertical` 1080×1920
- `ServimantosHorizontal` 1920×1080

Las dos usan las mismas escenas, 30 fps y transiciones de 15 frames (alternan fundido, deslizar y barrido).

**Disposición:**
- **Vertical:** título arriba (desde y≈230, fuera de la zona tapada por la interfaz de Reels), dispositivo al centro y puntos como chips (y≤1620).
- **Horizontal:** dispositivo a la izquierda (navegador o celular) y título y puntos a la derecha.

| Tiempo | Escena | Qué se ve | Vertical 9:16 | Horizontal 16:9 |
|---|---|---|---|---|
| 0.0–5.0 | **Gancho** (motion) | Un `.docx` tiembla, 4 fotos caen desordenadas, `INF-VT-007` repetido se tacha. Texto: «Word, fotos sueltas y números repetidos». A los 3,6 s entra «Del celular al **PDF firmado**» | Documento centrado, frase abajo (y≈1500) | Igual, frase abajo |
| 4.5–8.5 | **Intro** | Logo, SERVIMANTOS letra por letra, barra degradada y «Portal de Reportes de Obra». Chips: PWA · PDF · Avisos | Palabra a 128 px | Palabra a 196 px |
| 8.0–16.3 | **Números** (contadores) | 4 fotos/hoja · 7 tablas con RLS · 5 tipos de aviso · 3 vías de aviso. Consecutivo `INF-VT-001→128` | Rejilla de 2×2 | 4 en fila |
| 15.8–21.8 | **REC-01** UI real | Login → Formatos → tocar «Reporte de Obra» | Celular de 600 px | Navegador de 1120 px a la izquierda |
| 21.3–28.3 | **REC-02** UI real | Llenar datos; la fecha sale sola | Chips debajo | Lista a la derecha |
| 27.8–34.8 | **REC-03** UI real | 4 fotos por hoja con descripción | — | — |
| 34.3–45.0 | **PDF** (motion) | La hoja A4 se dibuja con la geometría real de `pdf.js`, barra «Generando PDF», descarga y banner «listo» | Portátil arriba, banner abajo | Portátil centrado, banner flotando a la derecha |
| 44.5–50.5 | **REC-04** UI real | Vista previa → Generar → descarga. Banner «Reporte INF-VT-014 listo» encima (s 3,7) | Banner sobre el celular | Banner arriba a la derecha |
| 50.0–61.0 | **Avisos** (motion) | Historial en el celular, 3 banners (listo / completado / dispositivo nuevo), campanita con contador, 2 avisos del sistema flotando y preferencias | Celular abajo, avisos arriba y abajo | Celular al centro, avisos a los lados |
| 60.5–66.5 | **REC-05** UI real | Buscar en Historial → Editar → regenerar | — | — |
| 66.0–74.0 | **REC-06** UI real | Administrar página → proyecto nuevo → se ve en el sitio público | — | Ideal en escritorio |
| 73.5–80.5 | **Stack** | 10 chips llegan desde los bordes: Supabase, RLS, Realtime, Web Push, pdf-lib, PWA… | Chips en varias filas | Chips centrados |
| 80.0–87.0 | **Outro / CTA** | «Desarrollado por **Andrés Madrid**» + `andresmadrid.vercel.app` | Nombre en 2 líneas | 1 línea |

**Música** (opcional): 100–120 BPM. Pon los cortes en 5,0 · 16 · 34 · 50 · 74 s.

---

## Implementación (Remotion)

- `src/Root.tsx`: dos `<Composition>` (9:16 y 16:9) con el mismo componente.
- `src/Video.tsx`: la lista `ESCENAS` y su duración. Para cambiar el orden o el largo, se edita solo esa lista.
- `src/hooks.ts` → `useLayout()`: indica si el video es `vertical` y la escala `u`. Cada escena acomoda su disposición con eso.
- `src/scenes/EscenaUI.tsx`: pone la grabación real en un `Celular` o un `Portatil` (`<OffthreadVideo>`), con título, puntos y un aviso opcional. Si falta el archivo, muestra un marcador rayado con lo que hay que grabar.
- `src/grabaciones.ts`: los clips `REC-01…06`. Cada uno tiene `movil` y `escritorio` (nombres de archivo en `public/grabaciones/`), `desde` (segundos a recortar) y `velocidad`.
  - En horizontal, si no hay grabación de escritorio, se usa la de celular.

```bash
npm run dev       # Studio: revisar escena por escena
npm run render    # out/servimantos-9x16.mp4 + out/servimantos-16x9.mp4
```

---

## Guía de grabación

**Antes de grabar:**
- Usa una cuenta de demo y proyectos inventados. Nada de clientes reales.
- No muestres la contraseña ni el panel de Supabase.
- Ten listos 4 o 5 fotos de cubiertas y un proyecto web con 3 fotos.
- Limpia notificaciones y barra de favoritos. Tema claro, zoom al 100 %.

**Celular** (lo usa el 9:16):
- Lo ideal: el portal **instalado como app** en Android, para que no salga la barra del navegador. Graba con la grabadora de pantalla del sistema a 1080×2340 o similar, a 30 o 60 fps.
- Alternativa: Chrome DevTools, dispositivo 390×844 con DPR 3, grabado con OBS (recortar a la zona de la página).

**Escritorio** (lo usa el 16:9):
- Ventana de Chrome a 1920×1080 en modo app o sin barras.
- OBS a 1920×1080 y 60 fps, captura de ventana.

**Ritmo:** movimientos lentos, pausa de 1 s antes y después de cada toque. Que cada clip dure 1,5–2× lo que dura su escena: se recorta con `desde` y se acelera con `velocidad`.

| Clip | Escena | Acciones exactas | Duración a grabar |
|---|---|---|---|
| REC-01 | 7 s | Pantalla de login con el correo de demo ya escrito → Ingresar → Formatos → tocar «Reporte de Obra» | 10–14 s |
| REC-02 | 7 s | Escribir Proyecto, Ingeniero, el código en la casilla libre y Contrato. Mostrar que la fecha ya está puesta | 12–16 s |
| REC-03 | 7 s | Bajar a «Hojas de fotos», cargar las 4 fotos, escribir 2 descripciones, «Agregar hoja» | 15–20 s |
| REC-04 | 6 s | Vista previa del PDF, bajar entre las hojas, «Generar PDF», que se vea la descarga | 10–12 s |
| REC-05 | 6 s | Historial → escribir en el buscador → Editar → cambiar un texto → generar | 10–14 s |
| REC-06 | 8 s | **Escritorio:** Administrar página → Nuevo proyecto → nombre y 3 fotos → Guardar → otra pestaña con el sitio público → «Proyectos» → abrir el visor | 15–20 s |

**Tomas extra** (opcionales, para reemplazar motion por UI real):
- Campanita: modal de permiso → panel con Preferencias.
- Banner real en el celular del admin mientras otro usuario completa un formato. Se necesitan 2 sesiones: admin y trabajador.
- Botón de instalar app y la app abriendo en modo standalone.

**Guardar:** cada clip en su carpeta, con nombre fijo: `public/grabaciones/REC-02/movil.mp4` y `public/grabaciones/REC-02/escritorio.mp4`. Luego, en `src/grabaciones.ts`, poner `movil: true` o `escritorio: true`. Las grabaciones están en `.gitignore`: pueden mostrar datos de sesión.
