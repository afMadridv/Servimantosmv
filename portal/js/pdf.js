/* ============================================================
   Generador del REPORTE DE OBRA (pdf-lib, todo en el navegador).

   No hay plantilla PDF que rellenar: la hoja se dibuja completa.
   Las medidas salen de un reporte real de la empresa (A4, tabla
   de encabezado de 3 columnas), así que el resultado cae en los
   mismos sitios que el formato de siempre:

     ┌───────────┬──────────────────────┬────────────┐  830.28
     │   logo    │  REPORTE DE OBRA     │ INF-VT-001 │
     │           │  para impermeab...   │  9/06/25   │
     │           │                      │    1/3     │
     ├───────────┼──────────────────────┼────────────┤  765.48
     │ Proyecto  │  ...                 │ Visita No. │  739.90
     ├───────────┼──────────────────────┼────────────┤
     │Solicitante│  ...                 │ Contrato   │  717.22
     ├───────────┴──────────────────────┴────────────┤
     │      ACTIVIDADES PENDIENTES … (franja)        │  687.94
     ├───────────────────────────────────────────────┤
     │  4 fotos por hoja, cada una con su pie        │
     └───────────────────────────────────────────────┘   88.10
   ============================================================ */
(function (root) {

const { PDFDocument, StandardFonts, rgb } = root.PDFLib;

/* ---------- geometría (puntos, origen abajo-izquierda) ---------- */
const PAGE_W = 595.28, PAGE_H = 841.89;
const ML = 42.12, MR = 553.29;          // márgenes laterales del formato
const CW = MR - ML;                     // 511.17 de ancho útil
const X1 = 135.98, X2 = 390.31;         // cortes de la tabla del encabezado

const HEAD_TOP = 830.28;                // borde superior de la tabla
const HEAD_BOT = 765.48;                // fin de la fila del título
const R1_BOT   = 739.90;                // fin de «Proyecto / Visita No.»
const R2_BOT   = 717.22;                // fin de «Solicitante / Contrato»
const BAN_BOT  = 687.94;                // fin de la franja de sección
const BODY_TOP = BAN_BOT;
const BODY_BOT_FOTOS = 88.10;           // hojas de fotos: cuerpo largo
const BODY_BOT_FINAL = 188.06;          // hoja final: deja sitio a la firma

/* ---------- colores ---------- */
const INK    = rgb(0.09, 0.14, 0.23);   // texto
const BORDER = rgb(0.13, 0.16, 0.22);   // líneas de la tabla
const NAVY   = rgb(0.047, 0.141, 0.251); // #0c2440 — franja de sección
const ORANGE = rgb(1, 0.416, 0.102);     // #ff6a1a — filete de marca
const WHITE  = rgb(1, 1, 1);
const GRAY   = rgb(0.45, 0.51, 0.60);

const FOTOS_POR_HOJA = root.FOTOS_POR_HOJA || 4;

/* ============================================================
   Utilidades de texto
   ============================================================ */

/* Las fuentes estándar de PDF usan WinAnsi: las comillas curvas y
   demás caracteres «de Word» reventarían el guardado. Se cambian
   por su equivalente y se descarta lo que no exista. */
function wa(s) {
  return String(s ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, "");
}

const w = (font, t, size) => font.widthOfTextAtSize(wa(t), size);

/* Recorta al ancho disponible, con puntos suspensivos */
function clip(font, text, size, maxW) {
  let t = wa(text);
  if (!maxW || w(font, t, size) <= maxW) return t;
  while (t.length > 1 && w(font, t + "…", size) > maxW) t = t.slice(0, -1);
  return t + "…";
}

/* Baja el tamaño de letra antes de recortar: así un proyecto de
   nombre largo se sigue leyendo completo dentro de su casilla. */
function fitSize(font, text, size, maxW, min) {
  let s = size;
  const lim = min ?? Math.max(6, size * 0.62);
  while (s > lim && w(font, text, s) > maxW) s -= 0.25;
  return s;
}

function wrap(font, text, size, maxW) {
  const lines = [];
  for (const para of wa(text).replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + " " + word : word;
      if (w(font, test, size) <= maxW) line = test;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/* 9/06/25 — igual que en los reportes en limpio */
function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${Number(d)}/${m}/${String(y).slice(-2)}`;
}

/* ============================================================
   Imágenes
   ============================================================ */
async function embedImg(doc, src) {
  try {
    if (typeof src !== "string" || !src) return null;
    let bytes;
    if (src.startsWith("data:")) {
      const b64 = src.split(",")[1] || "";
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } else {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar la foto`);
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (!bytes || bytes.length < 4) throw new Error("La foto llegó vacía");
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (e) {
    console.warn("No se pudo incrustar la foto:", String(src).slice(0, 80), "→", e.message);
    return null;
  }
}

/* Logo y firma se pintan en un canvas y de ahí sale el PNG que entiende
   pdf-lib. Se rasterizan al ancho que de verdad hacen falta: el logo
   ocupa ~82 pt en la hoja y la firma ~110 pt, así que 480 y 500 px son
   ~420 dpi al imprimir. El SVG del logo necesita este paso sí o sí; la
   firma ya es PNG, pero venía a 759 px y metía 200 KB en cada reporte.
   Se cachean: van en todas las hojas de todos los reportes.

   `ampliar` solo para el SVG: al ser vectorial, pintarlo más grande que
   su tamaño nominal sale nítido. Un PNG ampliado solo saldría borroso y
   más pesado, así que ahí nunca se pasa de su tamaño original. */
const cacheRaster = new Map();   // url → dataURL PNG, o null si falló
async function rasterizar(url, anchoPx, ampliar = false) {
  if (!url) return null;
  if (cacheRaster.has(url)) return cacheRaster.get(url);
  let out = null;
  try {
    out = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const nw = img.naturalWidth || anchoPx, nh = img.naturalHeight || anchoPx;
          const cv = document.createElement("canvas");
          cv.width = ampliar ? anchoPx : Math.min(anchoPx, nw);
          cv.height = Math.round(cv.width * nh / nw);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL("image/png"));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("no se pudo cargar " + url));
      img.src = url;
    });
  } catch (e) {
    console.warn("Imagen no disponible:", e.message);
  }
  cacheRaster.set(url, out);
  return out;
}

/* ============================================================
   Dibujo
   ============================================================ */
function makeCtx(page, font, bold) {
  const txt = (text, x, y, size, opts = {}) => {
    const t = opts.maxW ? clip(opts.font || font, text, size, opts.maxW) : wa(text);
    if (!t) return;
    page.drawText(t, { x, y, size, font: opts.font || font, color: opts.color || INK });
  };
  /* centra dentro de [x, x+width] */
  const center = (text, x, width, y, size, opts = {}) => {
    const f = opts.font || font;
    let t = wa(text);
    if (!t) return;
    const s = opts.shrink === false ? size : fitSize(f, t, size, width - 6);
    t = clip(f, t, s, width - 6);
    page.drawText(t, { x: x + (width - w(f, t, s)) / 2, y, size: s, font: f, color: opts.color || INK });
  };
  const line = (x1, y1, x2, y2, thickness = 0.8, color = BORDER) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  const rect = (x, y, width, height, opts = {}) =>
    page.drawRectangle({
      x, y, width, height,
      color: opts.fill,
      borderColor: opts.border,
      borderWidth: opts.border ? (opts.thickness || 0.8) : undefined,
    });
  return { page, font, bold, txt, center, line, rect };
}

/* Encabezado completo (tabla + franja de sección) de una hoja.
   `logo` viene ya incrustado en el documento: incrustarlo aquí metía
   una copia del PNG por cada página y el archivo se iba al doble. */
function drawHeader(ctx, info, logo) {
  const { bold } = ctx;
  const R = APP_CONFIG.REPORTE;

  /* --- franja de la sección (primero el relleno, luego la rejilla
         encima: si no, el azul se come el borde de la tabla) --- */
  ctx.rect(ML, BAN_BOT, CW, R2_BOT - BAN_BOT, { fill: NAVY });

  /* --- rejilla de la tabla --- */
  ctx.rect(ML, BAN_BOT, CW, HEAD_TOP - BAN_BOT, { border: BORDER });
  for (const y of [HEAD_BOT, R1_BOT, R2_BOT]) ctx.line(ML, y, MR, y);
  for (const x of [X1, X2]) ctx.line(x, R2_BOT, x, HEAD_TOP);

  /* --- columna 1: logo --- */
  if (logo) {
    const cajaW = X1 - ML - 12, cajaH = HEAD_TOP - HEAD_BOT - 12;
    const esc = Math.min(cajaW / logo.width, cajaH / logo.height);
    const iw = logo.width * esc, ih = logo.height * esc;
    ctx.page.drawImage(logo, {
      x: ML + (X1 - ML - iw) / 2,
      y: HEAD_BOT + (HEAD_TOP - HEAD_BOT - ih) / 2,
      width: iw, height: ih,
    });
  } else {
    ctx.center(APP_CONFIG.COMPANY.name, ML, X1 - ML, HEAD_BOT + 28, 10, { font: bold });
  }

  /* --- columna 2: título (y subtítulo si lo hay) --- */
  if (wa(R.subtitulo).trim()) {
    ctx.center(R.titulo, X1, X2 - X1, 797.76, 14, { font: bold });
    ctx.center(R.subtitulo, X1, X2 - X1, 783.48, 11, { font: bold });
  } else {
    /* sin subtítulo el título va solo: se centra en el alto de la casilla */
    ctx.center(R.titulo, X1, X2 - X1, 792.9, 15, { font: bold });
  }

  /* --- columna 3: número, fecha y hoja --- */
  const c3 = MR - X2;
  ctx.center(info.numero || "", X2, c3, 803.76, 11, { font: bold });
  ctx.center(fmtFecha(info.fecha), X2, c3, 788.64, 11, { font: bold });
  ctx.center(`${info.pageNo}/${info.total}`, X2, c3, 773.28, 11, { font: bold });

  /* --- filas de datos ---
     La etiqueta va pegada a la izquierda de su casilla y el valor
     arranca siempre en la misma X, para que las dos filas queden
     alineadas entre sí (en el formato a mano bailaban unos puntos). */
  const VAL_X3 = X2 + 70;
  const filas = [
    { y: 753.34, etiqueta: "Proyecto",    valor: info.proyecto,
      etiqueta3: "Visita No.", valor3: info.visita },
    { y: 727.78, etiqueta: "Solicitante", valor: info.ingeniero,
      etiqueta3: "Contrato",   valor3: info.contrato },
  ];
  for (const f of filas) {
    ctx.txt(f.etiqueta, ML + 5.2, f.y, 11, { font: bold, maxW: X1 - ML - 10 });
    const s = fitSize(bold, wa(f.valor), 11, X2 - X1 - 14);
    ctx.txt(f.valor, X1 + 5.2, f.y, s, { font: bold, maxW: X2 - X1 - 10 });
    ctx.txt(f.etiqueta3, X2 + 5.2, f.y, 11, { font: bold, maxW: VAL_X3 - X2 - 8 });
    const s3 = fitSize(bold, wa(f.valor3), 11, MR - VAL_X3 - 8);
    ctx.txt(f.valor3, VAL_X3, f.y, s3, { font: bold, maxW: MR - VAL_X3 - 5 });
  }

  /* filete naranja de marca bajo la fila del título */
  ctx.line(ML, HEAD_BOT, MR, HEAD_BOT, 2, ORANGE);

  ctx.center(info.banner, ML, CW, BAN_BOT + 10.5, 11.5, { font: bold, color: WHITE });
}

/* Marco del cuerpo de la hoja */
function drawBodyFrame(ctx, bottom) {
  ctx.rect(ML, bottom, CW, BODY_TOP - bottom, { border: BORDER });
}

/* Pie discreto con los datos de contacto */
function drawFooter(ctx) {
  const C = APP_CONFIG.COMPANY;
  const texto = [C.name, C.phone, C.email].filter(Boolean).join("  ·  ");
  ctx.center(texto, ML, CW, 62, 7.5, { font: ctx.font, color: GRAY, shrink: false });
}

/* ---------- hoja de fotos: 4 fotos, 2 × 2, cada una con su pie ---------- */
const GAP_X = 16, GAP_Y = 16;
const CELL_W = (CW - GAP_X) / 2;        // 247.585
const PHOTO_H = 212;
const CAP_H = 34;
const ROW_H = PHOTO_H + CAP_H;          // 246
const GRID_H = ROW_H * 2 + GAP_Y;       // 508

async function drawHojaFotos(doc, ctx, hoja) {
  const { font, bold } = ctx;
  drawBodyFrame(ctx, BODY_BOT_FOTOS);

  const titulo = wa(hoja.titulo || "").trim();
  const tituloH = titulo ? 26 : 0;
  if (titulo) ctx.center(titulo, ML, CW, BODY_TOP - 20, 13, { font: bold });

  /* la rejilla se centra en el hueco que queda: mismo aire arriba
     y abajo, con o sin título */
  const arriba = BODY_TOP - tituloH;
  const sobra = (arriba - BODY_BOT_FOTOS) - GRID_H;
  const gridTop = arriba - Math.max(6, sobra / 2);

  const fotos = hoja.fotos || [];
  for (let i = 0; i < FOTOS_POR_HOJA; i++) {
    const col = i % 2, fila = Math.floor(i / 2);
    const x = ML + col * (CELL_W + GAP_X);
    const cellTop = gridTop - fila * (ROW_H + GAP_Y);
    const marcoY = cellTop - PHOTO_H;

    ctx.rect(x, marcoY, CELL_W, PHOTO_H, { border: BORDER });

    const foto = fotos[i] || {};
    const img = foto.src ? await embedImg(doc, foto.src) : null;
    if (img) {
      const esc = Math.min((CELL_W - 8) / img.width, (PHOTO_H - 8) / img.height);
      const iw = img.width * esc, ih = img.height * esc;
      ctx.page.drawImage(img, {
        x: x + (CELL_W - iw) / 2,
        y: marcoY + (PHOTO_H - ih) / 2,
        width: iw, height: ih,
      });
    } else if (foto.src) {
      /* si la foto no cargó se deja constancia: antes el hueco salía
         en blanco y no había forma de saber por qué */
      ctx.center("(No se pudo cargar la foto)", x, CELL_W, marcoY + PHOTO_H / 2, 8,
        { color: rgb(0.65, 0.25, 0.2), shrink: false });
    }

    const desc = wa(foto.desc || "").trim();
    if (desc) {
      const lineas = wrap(font, desc, 8.5, CELL_W - 10).slice(0, 2);
      lineas.forEach((l, n) => {
        ctx.center(l, x, CELL_W, marcoY - 13 - n * 10.5, 8.5, { shrink: false });
      });
    }
  }
}

/* ---------- hoja final: conclusiones y firma ---------- */
const CONC_X_TITULO = ML + 40.6;        // 82.7 en el reporte original
const CONC_X_ITEM   = ML + 76.6;        // 118.7
const CONC_LH       = 14.64;            // interlineado del original

/* Cada renglón se clasifica: sin guion es un título (negrita, más a
   la izquierda); con «- » delante es una viñeta indentada. Así sale
   igual que los reportes escritos a mano. */
function layoutConclusiones(font, bold) {
  return (texto) => {
    const out = [];
    const crudo = wa(texto).replace(/\r/g, "").split("\n");
    crudo.forEach((raw, i) => {
      const t = raw.trim();
      if (!t) { out.push({ tipo: "blank" }); return; }
      const esItem = /^[-•*]\s+/.test(t);
      if (esItem) {
        const cuerpo = t.replace(/^[-•*]\s+/, "");
        wrap(font, cuerpo, 11, MR - CONC_X_ITEM - 8).forEach((l, n) => {
          out.push({ tipo: "item", texto: l, primera: n === 0 });
        });
      } else {
        wrap(bold, t, 11, MR - CONC_X_TITULO - 8).forEach((l) => {
          out.push({ tipo: "head", texto: l, aire: i > 0 });
        });
      }
    });
    return out;
  };
}

function paginar(lineas) {
  const paginas = [];
  let actual = [], y = BODY_TOP - 26;
  for (const ln of lineas) {
    const alto = ln.tipo === "blank" ? CONC_LH * 0.5
      : CONC_LH + (ln.tipo === "head" && ln.aire ? 8 : 0);
    if (y - alto < BODY_BOT_FINAL + 14 && actual.length) {
      paginas.push(actual);
      actual = [];
      y = BODY_TOP - 26;
    }
    actual.push(ln);
    y -= alto;
  }
  paginas.push(actual);
  return paginas;
}

function drawConclusiones(ctx, lineas, esUltima, firma) {
  const { bold } = ctx;
  drawBodyFrame(ctx, BODY_BOT_FINAL);

  let y = BODY_TOP - 26;
  for (const ln of lineas) {
    if (ln.tipo === "blank") { y -= CONC_LH * 0.5; continue; }
    if (ln.tipo === "head") {
      if (ln.aire) y -= 8;
      ctx.txt(ln.texto, CONC_X_TITULO, y, 11, { font: bold });
    } else {
      if (ln.primera) {
        ctx.txt("-", CONC_X_ITEM - 12, y, 11);
      }
      ctx.txt(ln.texto, CONC_X_ITEM, y, 11);
    }
    y -= CONC_LH;
  }

  /* bloque de firma: solo en la última hoja del reporte */
  if (!esUltima) return;
  const R = APP_CONFIG.REPORTE;
  const x = CONC_X_TITULO;
  const RENGLON_W = 210, RENGLON_Y = 106;

  ctx.txt("Realizado por:", x, 172, 11, { font: bold });

  /* La firma se apoya sobre el renglón y va centrada en él, sin
     deformarse: manda el alto, que es el que no puede crecer. */
  if (firma) {
    const esc = Math.min(RENGLON_W * 0.86 / firma.width, 48 / firma.height);
    const fw = firma.width * esc, fh = firma.height * esc;
    ctx.page.drawImage(firma, {
      x: x + (RENGLON_W - fw) / 2,
      y: RENGLON_Y + 5,
      width: fw, height: fh,
    });
  }

  ctx.line(x, RENGLON_Y, x + RENGLON_W, RENGLON_Y, 0.8, GRAY);
  ctx.txt(R.firmante, x, 92, 11, { font: bold });
  ctx.txt([R.cargo, R.empresaFirma].filter(Boolean).join(" · "), x, 78, 10);
}

/* ============================================================
   Construcción del documento
   ============================================================ */
function normalizarHojas(hojas) {
  return (Array.isArray(hojas) ? hojas : []).map((h) => ({
    titulo: h.titulo || "",
    fotos: Array.from({ length: FOTOS_POR_HOJA }, (_, i) => {
      const f = (h.fotos || [])[i];
      if (!f) return { src: "", desc: "" };
      return typeof f === "string" ? { src: f, desc: "" } : { src: f.src || "", desc: f.desc || "" };
    }),
  }));
}

async function build(record) {
  const data = record.data || {};
  const R = APP_CONFIG.REPORTE;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`${R.titulo} ${record.numero || ""}`.trim());
  doc.setAuthor(APP_CONFIG.COMPANY.name);
  doc.setSubject(data.proyecto || "");

  /* logo y firma se incrustan UNA vez y se reutilizan en todas las hojas */
  const logoSrc = await rasterizar(APP_CONFIG.COMPANY.logo, 480, true);
  const firmaSrc = await rasterizar(R.firma, 500);
  const logo = logoSrc ? await embedImg(doc, logoSrc) : null;
  const firma = firmaSrc ? await embedImg(doc, firmaSrc) : null;

  const hojas = normalizarHojas(data.hojas);
  const paginasConc = paginar(layoutConclusiones(font, bold)(data.conclusiones || ""));
  const total = hojas.length + paginasConc.length;

  const info = {
    numero: record.numero || "",
    fecha: data.fecha || "",
    proyecto: data.proyecto || "",
    ingeniero: data.ingeniero || "",
    contrato: data.contrato || "",
    visita: data.visita || "",
    total,
  };

  let n = 0;
  for (const hoja of hojas) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const ctx = makeCtx(page, font, bold);
    drawHeader(ctx, { ...info, pageNo: ++n, banner: R.banner }, logo);
    await drawHojaFotos(doc, ctx, hoja);
    drawFooter(ctx);
  }

  for (let i = 0; i < paginasConc.length; i++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const ctx = makeCtx(page, font, bold);
    drawHeader(ctx, { ...info, pageNo: ++n, banner: R.bannerFinal }, logo);
    drawConclusiones(ctx, paginasConc[i], i === paginasConc.length - 1, firma);
    drawFooter(ctx);
  }

  return doc;
}

function nombreArchivo(record) {
  const proyecto = wa(record.data?.proyecto || "").replace(/[\\/:*?"<>|]/g, "").trim();
  return [record.numero || "Reporte de obra", proyecto].filter(Boolean).join(" - ") + ".pdf";
}

const PDFGen = {
  build,
  async download(record) {
    const doc = await build(record);
    const bytes = await doc.save();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    a.download = nombreArchivo(record);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  /* Blob URL y no data-URI: con varias fotos el data-URI supera el
     límite del iframe en Chrome y la vista previa sale en blanco. */
  _lastPreviewURL: null,
  async previewURL(record) {
    const doc = await build(record);
    const bytes = await doc.save();
    if (this._lastPreviewURL) URL.revokeObjectURL(this._lastPreviewURL);
    this._lastPreviewURL = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    return this._lastPreviewURL;
  },
};

root.PDFGen = PDFGen;

})(window);
