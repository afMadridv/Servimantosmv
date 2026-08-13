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
};

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
