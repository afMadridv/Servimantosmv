/* ============================================================
   Configuración — Portal de Reportes de Obra · Servimantos
   ------------------------------------------------------------
   SUPABASE_URL y SUPABASE_ANON_KEY salen de
   Supabase → Settings → API. Mientras estén vacías el portal
   corre en MODO DEMO (todo se guarda en este navegador).

   REPORTE es el texto fijo del formato: si algún día cambia el
   encabezado o quien firma, se cambia AQUÍ y no en el código.

   OJO: el sitio público (index3.0.html) también carga este
   archivo para leer los proyectos, así que aquí no va nada que
   no pueda ver un visitante.
   ============================================================ */
window.APP_CONFIG = {
  SUPABASE_URL: "https://gozqaqfgrvdghmdubuii.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ySUmY1Iy3fBYs6IyEP-J3Q_4q6ggH4e",
  STORAGE_BUCKET: "reportes-obra",
  /* fotos de los proyectos que se ven en la web (bucket PÚBLICO) */
  PROYECTOS_BUCKET: "proyectos-web",

  COMPANY: {
    name: "SERVIMANTOS MV",
    phone: "+57 300 437 2848",
    email: "servimanto10@gmail.com",
    city: "Barranquilla · Santa Marta, Colombia",
    /* logo del encabezado del PDF (relativo a portal/index.html) */
    logo: "../assets/img/logo.svg",
  },

  REPORTE: {
    titulo: "INFORME DE OBRA",
    /* vacío = el título va solo y centrado en su casilla */
    subtitulo: "",
    banner: "ACTIVIDADES PENDIENTES POR REALIZAR EN LA CUBIERTA",
    bannerFinal: "CONCLUSIONES Y RECOMENDACIONES",
    /* consecutivo: INF-VT-001, INF-VT-002, … */
    prefijo: "INF-VT",
    /* bloque «Realizado por» del final */
    firmante: "Miriam Villar Sepulveda",
    cargo: "Representante Legal",
    empresaFirma: "Impermeabilizaciones MV Sas",
    /* firma digital sobre el renglón (relativa a portal/index.html).
       Déjala vacía y sale el renglón en blanco para firmar a mano. */
    firma: "../assets/img/firma.png",
  },
};

window.IS_DEMO = !window.APP_CONFIG.SUPABASE_URL || !window.APP_CONFIG.SUPABASE_ANON_KEY;
