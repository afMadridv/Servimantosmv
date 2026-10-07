/* ============================================================
   PWA: registro del Service Worker, instalación y versiones.

   Este archivo NO pinta nada: avisa con eventos del documento y
   la interfaz (notificaciones.js) decide cómo mostrarlo.
     pwa:instalable    → el navegador permite instalar la app
     pwa:instalada     → se instaló
     pwa:actualizacion → hay una versión nueva esperando
     pwa:conexion      → cambió el estado de la red (detail.online)
   ============================================================ */
(function () {
  let promptInstalar = null;
  let recargarAlCambiar = false;

  const esStandalone = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  const emitir = (nombre, detail) => document.dispatchEvent(new CustomEvent(nombre, { detail }));

  /* ---------- instalación ---------- */
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();             // el botón propio decide cuándo
    promptInstalar = e;
    emitir("pwa:instalable");
  });
  addEventListener("appinstalled", () => {
    promptInstalar = null;
    emitir("pwa:instalada");
  });

  async function instalar() {
    if (!promptInstalar) return false;
    promptInstalar.prompt();
    const { outcome } = await promptInstalar.userChoice;
    promptInstalar = null;
    return outcome === "accepted";
  }

  /* iPhone/iPad no tienen beforeinstallprompt: se instala desde
     Compartir → «Añadir a pantalla de inicio». */
  const esIOS = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  /* ---------- service worker ---------- */
  async function registrar() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
    try {
      const reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });

      const avisar = (worker) => {
        // sin controlador es la primera instalación: no hay nada que actualizar
        if (worker && navigator.serviceWorker.controller) emitir("pwa:actualizacion", { worker });
      };
      if (reg.waiting) avisar(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w && w.addEventListener("statechange", () => { if (w.state === "installed") avisar(w); });
      });

      /* Solo se recarga si el usuario pidió actualizar. Sin esta
         bandera, la primera visita (cuando el SW toma control con
         clients.claim) recargaba la página y borraba lo escrito. */
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!recargarAlCambiar) return;
        recargarAlCambiar = false;
        location.reload();
      });

      // revisa si hay versión nueva cada vez que se vuelve a la app
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
      return reg;
    } catch (e) {
      console.warn("No se pudo registrar el Service Worker:", e);
      return null;
    }
  }

  function aplicarActualizacion(worker) {
    if (!worker) return;
    recargarAlCambiar = true;
    worker.postMessage({ tipo: "SKIP_WAITING" });
  }

  addEventListener("online", () => emitir("pwa:conexion", { online: true }));
  addEventListener("offline", () => emitir("pwa:conexion", { online: false }));

  /* Se registra después de la carga para no competir con la
     primera pintura del portal. */
  const listo = new Promise((resolve) => {
    const go = () => registrar().then(resolve);
    if (document.readyState === "complete") go();
    else addEventListener("load", go, { once: true });
  });

  window.PWA = {
    listo,                       // Promise<ServiceWorkerRegistration|null>
    esStandalone,
    esIOS,
    instalar,
    puedeInstalar: () => !!promptInstalar,
    aplicarActualizacion,
  };
})();
