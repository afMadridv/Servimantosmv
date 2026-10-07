# Portal de Reportes de Obra · Servimantos

Genera formatos en PDF (hoy: **REPORTE DE OBRA**), los guarda y deja editarlos
después sin volver a llenarlo todo. Se instala como app en el teléfono o el
computador y avisa con notificaciones.

## Qué hace

- **Entrar** con correo y contraseña (Supabase Auth). Cada usuario es
  **admin** o **trabajador**.
- **Formatos**: la pantalla de inicio. Cada formato es una caja; se toca y se
  abre. Ver [Formatos](#formatos).
- **Reporte de Obra**: datos de la visita, hojas de fotos y conclusiones.
  Vista previa del PDF antes de descargarlo.
- **Historial / Editar**: lista con búsqueda; se abre cualquier reporte, se
  cambia lo que haga falta y se vuelve a generar el PDF.
- **Administrar página** (solo admin): los proyectos que se ven en la sección
  «Proyectos» del sitio público. Ver [Administrar página](#administrar-página).
- **Campanita**: notificaciones del sistema y avisos dentro del portal. Ver
  [Notificaciones](#notificaciones).
- **App instalable** (PWA): ícono en la pantalla de inicio, abre sin barra del
  navegador y funciona sin señal para lo básico. Ver [Instalar como app](#instalar-como-app-pwa).
- El **número del reporte** (`INF-VT-001`, `-002`, …) lo asigna el servidor,
  así que no se puede repetir.

## Formatos

Al entrar se ve **Formatos**, no un formulario: una caja por formato. Tocarla
abre ese formato; «← Formatos» vuelve.

**Sumar un formato nuevo:**

1. En [`js/formats.js`](js/formats.js), agregar una entrada a `window.FORMATOS`
   (`key`, `nombre`, `descripcion`, `etiquetas`, `icon`). Ya sale su caja.
2. En [`js/app.js`](js/app.js), en `ABRIR_FORMATO`, la función que lo abre
   (con la misma `key`). Sin esa función la caja avisa «todavía no disponible».
3. Si guarda datos o genera PDF propio, llamar a los avisos igual que el
   reporte de obra: `NotificationService.formatoAbierto(…)`,
   `formatoCompletado(…)` y `formatoListo(…)`.

### El Reporte de Obra

Una hoja de A4 por cada grupo de fotos, más la hoja final de conclusiones.
Todas llevan el mismo encabezado:

| | | |
|---|---|---|
| logo | **REPORTE DE OBRA**<br>para impermeabilizacion de cubiertas | `INF-VT-001`<br>`9/06/25`<br>`1/3` |
| **Proyecto** | Puerta Dorada Marisima E1 | **Visita No.** 1 |
| **Solicitante** | Ing. Residente Eddisson Rueda | **Contrato** Os 25 00002 |

- **Hojas de fotos**: título opcional (ej. «Placa 2») y **4 fotos** en dos
  columnas, cada una con su descripción debajo.
- **Hoja final**: `CONCLUSIONES Y RECOMENDACIONES` y el bloque «Realizado por».
  En ese campo, cada renglón sin guion sale en **negrita** como subtítulo y los
  que empiezan por `- ` salen como viñeta indentada:

  ```
  Placa 3
  - Resane y arreglo detalles en placa
  - Limpieza y retiro de arena
  ```

La **fecha** no se escribe: se pone sola el día que se crea el reporte y no
cambia si se edita más adelante. El **número de hoja** (`1/3`) también es
automático y cuenta las hojas de fotos más las de conclusiones.

## Administrar página

Solo para administradores (el servidor también lo exige).

Cada proyecto es una **caja** de la sección «Proyectos» del sitio: un nombre,
una descripción corta y sus fotos. La **primera foto es la portada** de la caja;
las demás se ven cuando el visitante la abre.

- **Ocultar** deja el proyecto guardado pero fuera de la web.
- Las flechas ↑ ↓ cambian el orden en que salen las cajas en la página.
- Los cambios se ven en el sitio al recargarlo: no hay que volver a publicar.

Mientras no haya ningún proyecto cargado, la web muestra las cinco cajas de
ejemplo que vienen escritas en `index.html`. En cuanto se guarda el primero,
esas desaparecen y solo se ven los de verdad.

## Notificaciones

Todo pasa por `NotificationService` ([`js/notificaciones.js`](js/notificaciones.js)).
Cada aviso sale como **banner** dentro del portal si se está mirando, como
**notificación del sistema** si el portal está en segundo plano, y queda en
**Recientes** (los últimos 30, en la campanita).

| Aviso | Quién lo recibe | Preferencia |
|---|---|---|
| Formato generado / descargado (con botón «Ver historial») | quien lo generó | `formato_listo` |
| Inicio de sesión desde un dispositivo nuevo (equipo, navegador y hora) | el dueño de la cuenta, en sus **otros** dispositivos | `seguridad` |
| Un trabajador entra al portal | administradores | `admin_login` |
| Un trabajador abre o edita un formato | administradores | `admin_formato_abierto` (apagado por defecto) |
| Un trabajador completa / firma un formato | administradores | `admin_formato_completado` |

**La campanita:** sin permiso, abre un modal que explica qué avisos llegan
antes de que el navegador pregunte (nunca se pide en frío). Con permiso, abre
el panel: **Recientes** y **Preferencias** (interruptores por aviso, más un
botón de prueba). Si el permiso está bloqueado, explica cómo desbloquearlo; en
iPhone sin instalar, explica cómo instalar primero.

**Por dónde llegan:**

1. **Locales**: «formato listo» lo dispara el mismo navegador al descargar.
2. **En vivo (Realtime)**: el portal escucha la tabla `eventos`. Llega mientras
   el portal esté abierto, aunque esté minimizado. No requiere configuración.
3. **Web Push**: llega con el portal **cerrado**. Requiere los pasos de
   [Web Push](#4-web-push-opcional-avisos-con-el-portal-cerrado).

Un mismo evento usa el mismo `tag` por las tres vías: no sale repetido.

**Métodos reutilizables** (`window.NotificationService`):

```js
NotificationService.formatoListo({ formato, numero, proyecto });          // aviso local
NotificationService.formatoAbierto({ formato_key, formato, numero, proyecto });
NotificationService.formatoCompletado({ formato_key, formato, numero, proyecto, nuevo });
NotificationService.emitir("clave_pref" | null, { titulo, cuerpo, tono, tag, url, accion });
NotificationService.banner({ titulo, cuerpo, tono, accion: { label, url | fn } });
```

`tono`: `ok` · `info` · `alerta` · `peligro`. Para un aviso nuevo con su propio
interruptor, agregarlo a `EVENTOS` en `notificaciones.js`.

**Detección de dispositivo nuevo:** cada navegador guarda un id aleatorio
(`sm_device_id`). Si la cuenta no lo conocía (tabla `dispositivos`) y no es su
primer dispositivo, se registra la alerta. Borrar los datos del sitio hace que
ese navegador cuente como nuevo — igual que en Gmail.

## Instalar como app (PWA)

- **Android / Chrome / Edge**: aparece el botón de instalar (ícono de teléfono)
  junto a la campanita, o el menú del navegador → «Instalar app».
- **iPhone / iPad**: Safari → Compartir → «Añadir a pantalla de inicio». Las
  notificaciones en iOS **solo** funcionan así instalado (iOS 16.4+).
- Accesos directos al mantener pulsado el ícono: «Nuevo reporte» e «Historial».

Piezas: [`manifest.json`](manifest.json), [`sw.js`](sw.js) (Service Worker),
[`js/pwa.js`](js/pwa.js) (registro, instalación, versiones) e
[`icons/`](icons) (SVG fuente + PNG 192/512, maskable y apple-touch).

**Caché y versiones:** el SW guarda el «app shell» para abrir sin señal; lo
propio va red primero (siempre la última versión) y **Supabase nunca se
cachea**. Al publicar cambios en `sw.js` o en la lista `APP_SHELL`, **sube
`VERSION`** al principio de `sw.js`: el portal mostrará «Hay una versión nueva —
Actualizar».

Sin señal: el portal abre, pero cargar el historial, guardar y generar PDF
necesitan internet (sale un aviso de «Sin conexión»).

## Cómo se genera el PDF

No hay plantilla que rellenar: la hoja se dibuja completa con
[pdf-lib](https://pdf-lib.js.org/), todo en el navegador. Las medidas de
[`js/pdf.js`](js/pdf.js) están tomadas de un reporte real de la empresa, así
que cada dato cae donde siempre ha caído. Si algún día cambia el encabezado,
las constantes de geometría están todas juntas al principio del archivo.

El logo del encabezado es el `assets/img/logo.svg` del sitio: el navegador lo
pinta en un canvas y de ahí sale el PNG que entiende pdf-lib.

## Puesta en producción

### 1. Supabase

1. **SQL Editor → New query**, pega todo [`supabase/schema.sql`](supabase/schema.sql)
   y dale Run. Es idempotente: cada vez que cambie, se pega completo otra vez.
   No borra datos.
2. **Authentication → Users → Add user**, marcando *Auto Confirm User*. En
   **Raw User Meta Data**: `{ "full_name": "Nombre que se ve en el portal" }`.
   El **primer** usuario queda como **admin**; los siguientes, como
   **trabajador**.
3. Para cambiar un rol: **Table Editor → perfiles → columna `rol`**
   (`admin` / `trabajador`).
4. **Authentication → Providers → Email**: apaga *Enable Sign Ups*.

Credenciales en [`js/config.js`](js/config.js) (proyecto `gozqaqfgrvdghmdubuii`).

### 2. Publicar

`portal/` es estático: se sube junto con el resto del sitio, sin build. El
enlace **Acceso equipo** ya está en el pie de `index.html`.
[`../vercel.json`](../vercel.json) pone las cabeceras de seguridad y evita que
Vercel cachee `sw.js` (el `_headers` de la raíz es para Netlify/Cloudflare;
Vercel lo ignora).

### 3. Textos de la empresa

`COMPANY` y `REPORTE` en [`js/config.js`](js/config.js): nombre, teléfono,
correo, el título del formato y quién firma («Realizado por»). Cambiarlos ahí
los cambia en todos los PDF; no hay que tocar el código.

### 4. Web Push (opcional: avisos con el portal cerrado)

Sin esto todo funciona igual, salvo que los avisos solo llegan con el portal
abierto.

1. **Llaves VAPID** — una sola vez, en PowerShell desde la raíz del repo:
   ```
   powershell -ExecutionPolicy Bypass -File portal\supabase\vapid-keys.ps1
   ```
   La **pública** va en `js/config.js` → `VAPID_PUBLIC_KEY`. La **privada**
   va **solo** en los secretos de Supabase (paso 3): nunca en el repo.
2. **Edge Function**: Dashboard → **Edge Functions → Deploy a new function →
   Via Editor**, nombre `notificar`, pega
   [`supabase/functions/notificar/index.ts`](supabase/functions/notificar/index.ts)
   y despliega. En su configuración, **apaga «Verify JWT»** (la función valida
   la sesión por dentro).
3. **Edge Functions → Secrets**: agrega `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (ej. `mailto:servimanto10@gmail.com`).
4. Publica el sitio con la llave pública ya puesta. Cada dispositivo que active
   la campanita queda suscrito solo (tabla `push_suscripciones`).

## Seguridad

- El bucket de las fotos de obra es **privado**. El portal abre cada foto con
  una URL firmada temporal (1 hora).
- El bucket de las fotos de proyectos (`proyectos-web`) sí es **público**: esas
  fotos se muestran en la web abierta. Subirlas y borrarlas es solo de
  administradores.
- La tabla `proyectos` la lee cualquiera sin sesión, pero solo las filas
  publicadas; escribir es solo de administradores.
- **Roles**: nadie puede cambiar su rol desde el navegador (`perfiles` no
  tiene políticas de escritura); solo desde el dashboard.
- **Eventos**: quién hizo qué lo firma el servidor con un trigger
  (`actor_id`, `actor_nombre`); el navegador no puede inventar un evento a
  nombre de otro. El admin ve todos; cada quien, los suyos.
- **Push**: la Edge Function solo acepta eventos del usuario que la llama, de
  hace menos de 2 minutos y no notificados antes. Al cerrar sesión se borra la
  suscripción de ese dispositivo.
- La anon key de `config.js` es pública por diseño: sin sesión no abre nada,
  porque todas las tablas tienen RLS. La llave **privada** VAPID y la
  `service_role` nunca van al repo ni al navegador.
- Cada reporte y cada foto quedan atados al usuario que los creó.
- Borrar un reporte borra también sus fotos del bucket.

## Estructura

```
portal/
├── index.html              # login + formatos, formulario, historial, admin
├── manifest.json           # PWA: nombre, colores, íconos, accesos directos
├── sw.js                   # Service Worker: caché, sin conexión, Web Push
├── offline.html            # pantalla de «sin conexión»
├── icons/                  # icon.svg / maskable.svg / badge.svg + PNG
├── css/styles.css          # diseño (rem; táctil ≥ 48 px; safe-area)
├── js/
│   ├── config.js           # credenciales, empresa, textos, llave VAPID pública
│   ├── pwa.js              # registro del SW, instalar, versiones, red
│   ├── formats.js          # catálogo de formatos, íconos y campos
│   ├── store.js            # capa de datos (Supabase o demo/localStorage)
│   ├── notificaciones.js   # NotificationService + campanita + panel
│   ├── pdf.js              # dibujo del PDF (pdf-lib)
│   └── app.js              # lógica de la interfaz y rutas (#formatos, …)
└── supabase/
    ├── schema.sql          # tablas + RLS + roles + eventos + storage
    ├── functions/notificar # Edge Function de Web Push
    └── vapid-keys.ps1      # genera las llaves VAPID (sin Node)
```

El sitio público (`index.html`) también carga `js/config.js`: de ahí saca la
URL y la anon key para leer los proyectos. Por eso en ese archivo no va nada
que no pueda ver un visitante.

## Modo demo

Mientras `js/config.js` no tenga credenciales de Supabase, el portal corre en
**modo demo** y guarda todo en el localStorage del navegador
(`demo@servimantos.com` / `demo1234`, rol admin). Sirve para probar los
formatos y la campanita sin tocar la base de datos. **No usar en producción.**

## Pendientes conocidos

- **Web Push no está probado de punta a punta**: depende de las llaves VAPID y
  de desplegar la Edge Function. Lo probado es el registro del SW, la caché, la
  campanita, el panel, los banners y el filtrado de eventos; la suscripción,
  el envío y la recepción del push en el SW, no.
- El admin recibe los avisos de los trabajadores, pero **no ve sus reportes**
  en el historial (cada quien ve solo los suyos, por RLS).
- La tabla `eventos` crece sin límite; conviene borrar periódicamente lo de
  hace más de unos meses.
- iOS no usa `background_color` para la pantalla de arranque: sale blanca un
  instante (harían falta `apple-touch-startup-image` por cada tamaño).
- `pdf-lib` y `supabase-js` se cargan desde CDN sin `integrity`, y
  `supabase-js` no está fijado a una versión exacta.
- No hay borrador local: si falla el guardado sin señal, el formulario sigue en
  pantalla pero se pierde al cerrar la pestaña.
- El PDF no se archiva; se vuelve a dibujar cada vez desde los datos guardados.
- La descripción de cada foto entra en dos renglones; lo que pase de ahí se
  recorta con puntos suspensivos (el campo está limitado a 110 caracteres).
