# Portal de Reportes de Obra · Servimantos

Genera el **REPORTE DE OBRA** en PDF, lo guarda y deja editarlo después sin
volver a llenarlo todo. Un solo formato y un solo usuario.

## Qué hace

- **Entrar** con correo y contraseña (Supabase Auth). Hay un único usuario.
- **Reporte de Obra**: un formulario con los datos de la visita, las hojas de
  fotos y las conclusiones. Vista previa del PDF antes de descargarlo.
- **Historial / Editar**: lista con búsqueda; se abre cualquier reporte, se
  cambia lo que haga falta y se vuelve a generar el PDF.
- **Administrar página**: los proyectos que se ven en la sección «Proyectos»
  del sitio público. Ver [Administrar página](#administrar-página).
- El **número del reporte** (`INF-VT-001`, `-002`, …) lo asigna el servidor,
  así que no se puede repetir.

## El formato

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

Cada proyecto es una **caja** de la sección «Proyectos» del sitio: un nombre,
una descripción corta y sus fotos. La **primera foto es la portada** de la caja;
las demás se ven cuando el visitante la abre.

- **Ocultar** deja el proyecto guardado pero fuera de la web.
- Las flechas ↑ ↓ cambian el orden en que salen las cajas en la página.
- Los cambios se ven en el sitio al recargarlo: no hay que volver a publicar.

Mientras no haya ningún proyecto cargado, la web muestra las cinco cajas de
ejemplo que vienen escritas en `index3.0.html`. En cuanto se guarda el primero,
esas desaparecen y solo se ven los de verdad.

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
   y dale Run. El archivo es idempotente: cada vez que cambie, se pega completo
   otra vez. No borra datos.
2. Crea el único usuario: **Authentication → Users → Add user**, marcando
   *Auto Confirm User*. En **Raw User Meta Data** de ese usuario deja
   `{ "full_name": "Nombre que se ve en el portal" }`.
3. **Authentication → Providers → Email**: apaga *Enable Sign Ups* para que
   nadie más pueda registrarse solo.

Las credenciales ya están puestas en [`js/config.js`](js/config.js)
(proyecto `eslzvkjsbwqleiboaevj`).

### 2. Publicar

`portal/` es estático: se sube junto con el resto del sitio, sin build. El
enlace **Portal** ya está en el menú y en el pie de los tres `index`.

### 3. Textos de la empresa

`COMPANY` y `REPORTE` en [`js/config.js`](js/config.js): nombre, teléfono,
correo, el título del formato y quién firma («Realizado por»). Cambiarlos ahí
los cambia en todos los PDF; no hay que tocar el código.

## Seguridad

- El bucket de las fotos de obra es **privado**. El portal abre cada foto con
  una URL firmada temporal (1 hora).
- El bucket de las fotos de proyectos (`proyectos-web`) sí es **público**: esas
  fotos se muestran en la web abierta. Subirlas y borrarlas sigue siendo solo
  del portal. No subir ahí nada que no deba ver un visitante.
- La tabla `proyectos` la lee cualquiera sin sesión, pero solo las filas
  publicadas; escribir requiere estar dentro del portal.
- La anon key de `config.js` es pública por diseño: sin sesión no abre nada,
  porque todas las tablas tienen RLS.
- Cada reporte y cada foto quedan atados al usuario que los creó, así que si
  algún día entra alguien más al portal no se mezclan.
- Borrar un reporte borra también sus fotos del bucket.

## Estructura

```
portal/
├── index.html            # login + las tres vistas
├── css/styles.css        # diseño (naranja / azul cielo / azul marino)
├── js/
│   ├── config.js         # credenciales, datos de la empresa y textos del formato
│   ├── formats.js        # campos del formulario
│   ├── store.js          # capa de datos (Supabase o demo/localStorage)
│   ├── pdf.js            # dibujo del PDF (pdf-lib)
│   └── app.js            # lógica de la interfaz
└── supabase/schema.sql   # tablas + RLS + consecutivo + storage
```

El sitio público (`index3.0.html`) también carga `js/config.js`: de ahí saca la
URL y la anon key para leer los proyectos. Por eso en ese archivo no va nada
que no pueda ver un visitante.

## Modo demo

Mientras `js/config.js` no tenga credenciales de Supabase, el portal corre en
**modo demo** y guarda todo en el localStorage del navegador
(`demo@servimantos.com` / `demo1234`). Sirve para probar el formato sin tocar
la base de datos. **No usar en producción.**

## Pendientes conocidos

- `pdf-lib` y `supabase-js` se cargan desde CDN sin `integrity`, y
  `supabase-js` no está fijado a una versión exacta.
- No hay borrador local: si falla el guardado sin señal, el formulario sigue en
  pantalla pero se pierde al cerrar la pestaña.
- El PDF no se archiva; se vuelve a dibujar cada vez desde los datos guardados.
- La descripción de cada foto entra en dos renglones; lo que pase de ahí se
  recorta con puntos suspensivos (el campo está limitado a 110 caracteres).
