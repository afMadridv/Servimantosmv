/* ============================================================
   El único formato del portal: REPORTE DE OBRA.

   El formulario se dibuja solo a partir de `FORMATO.fields`.
   Tipos: text | number | date-auto | textarea | hojas

   - date-auto: la fecha no se escribe, se pone sola el día que
     se crea el reporte (y no cambia al editarlo después).
   - hojas: las páginas de fotos. Cada hoja lleva un título
     opcional y EXACTAMENTE 4 fotos, cada una con su descripción.
   ============================================================ */

/* Iconos SVG (trazo, estilo Feather) */
const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

window.ICONS = {
  report: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'),
  history: svg('<path d="M12 8v4l3 3"/><path d="M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z"/>'),
  camera: svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  up: svg('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'),
  down: svg('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>'),
  bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  bellOff: svg('<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  check: svg('<polyline points="20 6 9 17 4 12"/>'),
  close: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  arrowRight: svg('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
  arrowLeft: svg('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
  install: svg('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7"/><polyline points="9 11 12 14 15 11"/><line x1="10" y1="18" x2="14" y2="18"/>'),
  wifiOff: svg('<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'),
};

/* ============================================================
   Catálogo de formatos: cada uno es una caja en «Formatos».
   Para sumar un formato nuevo se agrega una entrada aquí y su
   función de apertura en ABRIR_FORMATO (app.js).
   ============================================================ */
window.FORMATOS = [
  {
    key: "reporte_obra",
    nombre: "Reporte de Obra",
    descripcion: "Visita a obra con hojas de 4 fotos, conclusiones, recomendaciones y firma.",
    etiquetas: ["PDF A4", "4 fotos por hoja", "Consecutivo INF-VT"],
    icon: "report",
  },
];

/* Cuántas fotos lleva cada hoja. El formato es fijo: 4. */
window.FOTOS_POR_HOJA = 4;

window.FORMATO = {
  key: "reporte_obra",
  name: "Reporte de Obra",
  fields: [
    { section: "Datos del reporte" },
    { key: "proyecto",  label: "Proyecto de obra", type: "text", required: true,
      placeholder: "Ej: Puerta Dorada Marisima E1" },
    { key: "ingeniero", label: "Nombre del ingeniero", type: "text", required: true, half: true,
      placeholder: "Ej: Ing. Residente Eddisson Rueda" },
    { key: "visita",    label: "Visita N°", type: "number", required: true, half: true,
      placeholder: "Ej: 1", min: 1 },
    { key: "contrato",  label: "Contrato", type: "text", required: true, half: true,
      placeholder: "Ej: Os 25 00002" },
    { key: "fecha",     label: "Fecha", type: "date-auto", half: true,
      hint: "Se pone sola el día que se crea el reporte." },

    { section: "Hojas de fotos" },
    { key: "hojas", label: "Hojas", type: "hojas" },

    { section: "Conclusiones y recomendaciones" },
    { key: "conclusiones", label: "Conclusiones y recomendaciones", type: "textarea", required: true,
      rows: 8,
      hint: "Una línea por renglón. Las líneas que empiezan con «- » salen como viñeta debajo del título anterior.",
      placeholder: "Placa 3\n- Resane y arreglo detalles en placa\n- Limpieza y retiro de arena\n\nPlaca 2\n- Detalles de resane tomados el día lunes 9 de junio" },
  ],
};
