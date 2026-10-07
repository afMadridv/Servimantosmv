/* ============================================================
   Service Worker · Portal de Reportes Servimantos
   Alcance: /portal/  (la web pública no pasa por aquí)

   - App shell en caché: el portal abre aunque no haya señal.
   - Red primero para lo propio: siempre se ve la última versión
     y la caché solo entra cuando no hay conexión.
   - Supabase NUNCA se cachea: sesión, datos y fotos firmadas
     van siempre directo a la red.
   - Web Push: muestra el aviso si el portal está cerrado o en
     segundo plano; si está a la vista, se lo pasa a la página
     para que lo muestre como banner y no salga dos veces.

   OJO: al cambiar este archivo o la lista APP_SHELL, sube VERSION.
   ============================================================ */
const VERSION = "2026-10-07.1";
const SHELL = `sm-shell-${VERSION}`;
const RUNTIME = "sm-runtime";          // CDNs y fuentes: viven entre versiones

const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/config.js",
  "./js/formats.js",
  "./js/store.js",
  "./js/pdf.js",
  "./js/pwa.js",
  "./js/notificaciones.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",          // el de 512 pesa ~240 KB: lo baja el navegador al instalar, no el SW
  "./icons/badge-96.png",
  "../assets/img/logo.svg",
  "../assets/img/firma.png",
];

/* acciones de los botones de una notificación → adónde llevan */
const ACCIONES = {
  historial: "./index.html#historial",
  formatos: "./index.html#formatos",
};

/* ---------- instalación y activación ---------- */
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // uno por uno: si falta un archivo, el resto igual queda guardado
    await Promise.all(APP_SHELL.map((url) =>
      cache.add(new Request(url, { cache: "reload" }))
        .catch((err) => console.warn("[sw] sin caché:", url, err))));
  })());
  // sin skipWaiting: la página ofrece «Actualizar» y decide el usuario
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres
      .filter((n) => n.startsWith("sm-shell-") && n !== SHELL)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.tipo === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- red ---------- */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (/\.supabase\.(co|in)$/.test(url.hostname)) return;   // datos y sesión: directo
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (req.mode === "navigate") {
    e.respondWith(navegacion(req));
  } else if (url.origin === self.location.origin) {
    e.respondWith(redPrimero(req));
  } else if (/(^|\.)cdn\.jsdelivr\.net$|^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(cacheYRefresco(req));
  }
});

async function navegacion(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req, { ignoreSearch: true }))
      || (await caches.match("./index.html"))
      || (await caches.match("./offline.html"))
      || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function redPrimero(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error("sin red y sin caché: " + req.url);
  }
}

/* Lo de CDN viene versionado (pdf-lib@1.17.1): se sirve de caché al
   instante y se refresca por detrás para la próxima vez. */
async function cacheYRefresco(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const red = fetch(req)
    .then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; })
    .catch(() => hit);
  return hit || red;
}

/* ---------- Web Push ---------- */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch { d = { cuerpo: e.data ? e.data.text() : "" }; }

  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visibles = ventanas.filter((c) => c.visibilityState === "visible");
    if (visibles.length) {
      // el portal está a la vista: que lo muestre él como banner
      visibles.forEach((c) => c.postMessage({ tipo: "push", datos: d }));
      return;
    }
    await self.registration.showNotification(d.titulo || "Servimantos", {
      body: d.cuerpo || "",
      tag: d.tag || "sm-push",
      icon: "icons/icon-192.png",
      badge: "icons/badge-96.png",
      lang: "es",
      timestamp: Date.now(),
      data: { url: d.url || "./" },
      actions: Array.isArray(d.acciones) ? d.acciones : [],
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const ruta = (e.action && ACCIONES[e.action]) || (e.notification.data && e.notification.data.url) || "./";
  const destino = new URL(ruta, self.registration.scope).href;

  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const abierta = ventanas.find((c) => c.url.startsWith(self.registration.scope));
    if (abierta) {
      await abierta.focus();
      abierta.postMessage({ tipo: "abrir", url: destino });
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
