/* ============================================================
   NotificationService · avisos del portal

   Un solo punto para avisar. Cada aviso puede salir como:
     - banner dentro del portal (si se está mirando la página)
     - notificación del sistema (si el portal está en segundo plano,
       o si el aviso lo exige, como «formato listo»)
   y queda guardado en «Recientes» (la campanita).

   Qué avisos recibe cada quien lo decide ESTE dispositivo con las
   preferencias del panel; esas mismas preferencias viajan con la
   suscripción Web Push para que el servidor filtre igual.

   Fuentes de avisos:
     1. Locales: formatoListo() al terminar/descargar un PDF.
     2. En vivo: Supabase Realtime sobre la tabla `eventos` (llega
        mientras el portal esté abierto).
     3. Web Push: la Edge Function `notificar` (llega con el portal
        cerrado). Requiere APP_CONFIG.VAPID_PUBLIC_KEY.
   Un mismo evento usa el mismo `tag` por las tres vías, así que el
   sistema y «Recientes» no lo muestran dos veces.
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);

  /* ---------- catálogo de avisos ---------- */
  const EVENTOS = {
    formato_listo: {
      label: "Formato generado o descargado",
      desc: "Cuando un PDF termina de generarse y se descarga.",
      grupo: "tuyo", def: true,
    },
    seguridad: {
      label: "Inicio de sesión desde un dispositivo nuevo",
      desc: "Te avisa en tus otros dispositivos, con equipo, navegador y hora.",
      grupo: "tuyo", def: true,
    },
    admin_login: {
      label: "Un trabajador entra al portal",
      desc: "Quién entró, desde qué dispositivo y a qué hora.",
      grupo: "admin", def: true,
    },
    admin_formato_abierto: {
      label: "Un trabajador abre o edita un formato",
      desc: "Cuando empieza un formato nuevo o abre uno guardado.",
      grupo: "admin", def: false,
    },
    admin_formato_completado: {
      label: "Un trabajador completa o firma un formato",
      desc: "Cuando guarda el formato terminado y sale el PDF firmado.",
      grupo: "admin", def: true,
    },
  };

  /* tipo de la tabla `eventos` → preferencia que lo controla */
  const TIPO_A_PREF = {
    login: "admin_login",
    formato_abierto: "admin_formato_abierto",
    formato_completado: "admin_formato_completado",
    login_nuevo_dispositivo: "seguridad",
  };

  const INBOX_MAX = 30;
  const BANNER_MS = 7000;

  /* ---------- estado ---------- */
  let perfil = null;
  let prefs = {};
  let inbox = [];
  let swReg = null;
  let pushSub = null;
  let dejarDeEscuchar = null;
  let guard = (seguir) => seguir();   // app.js lo cambia por su «¿salir sin guardar?»
  const ultimosEventos = new Map();   // tipo:clave → hora, para no repetir

  /* ---------- almacenamiento local ---------- */
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const clave = (base) => `${base}_${perfil ? perfil.id : "anon"}`;

  function cargarPrefs() {
    const guardadas = lsGet(clave("sm_notif_prefs"), {});
    const out = {};
    for (const [k, e] of Object.entries(EVENTOS)) out[k] = typeof guardadas[k] === "boolean" ? guardadas[k] : e.def;
    return out;
  }
  const guardarPrefs = () => lsSet(clave("sm_notif_prefs"), prefs);
  const guardarInbox = () => lsSet(clave("sm_notif_inbox"), inbox);

  /* ---------- dispositivo ---------- */
  /* Id aleatorio por navegador. Si se borran los datos del sitio,
     el navegador cuenta como nuevo (igual que en Gmail). */
  function deviceId() {
    let id = null;
    try { id = localStorage.getItem("sm_device_id"); } catch {}
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem("sm_device_id", id); } catch {}
    }
    return id;
  }

  function infoDispositivo() {
    const ua = navigator.userAgent;
    const macTactil = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;   // iPad en modo escritorio
    const tipo = /iPad|Tablet/i.test(ua) || macTactil || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet"
      : /Mobi|iPhone|iPod|Android/i.test(ua) ? "móvil" : "escritorio";
    // el orden importa: el UA de iPhone dice «like Mac OS X» y el de Android dice «Linux»
    const so = /Windows/.test(ua) ? "Windows"
      : /Android/.test(ua) ? "Android"
      : /iPhone|iPad|iPod/.test(ua) || macTactil ? "iOS"
      : /Mac OS X/.test(ua) ? "macOS"
      : /CrOS/.test(ua) ? "ChromeOS"
      : /Linux/.test(ua) ? "Linux" : "otro sistema";
    const navegador = /Edg\//.test(ua) ? "Edge"
      : /OPR\/|Opera/.test(ua) ? "Opera"
      : /SamsungBrowser/.test(ua) ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua) ? "Firefox"
      : /Chrome|CriOS/.test(ua) ? "Chrome"
      : /Safari/.test(ua) ? "Safari" : "otro navegador";
    const app = window.PWA ? PWA.esStandalone() : false;
    return {
      device_id: deviceId(), tipo, so, navegador, app,
      dispositivo: `${navegador} en ${so} (${tipo}${app ? ", app instalada" : ""})`,
    };
  }

  /* ---------- formato de fechas ---------- */
  const horaCorta = (iso) => new Date(iso || Date.now())
    .toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const fechaCorta = (iso) => new Date(iso || Date.now())
    .toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  function haceCuanto(iso) {
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return "ahora";
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return fechaCorta(iso);
  }

  /* ---------- helpers DOM ---------- */
  function el(tag, cls, texto) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto != null) n.textContent = texto;
    return n;
  }
  const icono = (nombre) => (window.ICONS && ICONS[nombre]) || "";

  /* ============================================================
     BANNERS DENTRO DEL PORTAL
     ============================================================ */
  const TONO_ICONO = { ok: "check", info: "bell", alerta: "bell", peligro: "shield" };

  /**
   * Banner dentro de la app.
   * @param {object} n  { titulo, cuerpo, tono, icono, tag, accion:{label, url|fn}, persistente }
   */
  function banner(n) {
    const box = $("#nbanners");
    if (!box) return null;
    if (n.tag && box.querySelector(`[data-tag="${CSS.escape(n.tag)}"]`)) return null;

    const b = el("div", `nb nb-${n.tono || "info"}`);
    b.setAttribute("role", n.tono === "peligro" ? "alert" : "status");
    if (n.tag) b.dataset.tag = n.tag;

    const ic = el("span", "nb-ic");
    ic.innerHTML = icono(n.icono || TONO_ICONO[n.tono] || "bell");
    const txt = el("div", "nb-txt");
    txt.appendChild(el("strong", null, n.titulo || ""));
    if (n.cuerpo) txt.appendChild(el("p", null, n.cuerpo));
    b.append(ic, txt);

    const cerrar = () => {
      b.classList.add("nb-sale");
      setTimeout(() => b.remove(), 220);
    };

    if (n.accion) {
      const act = el("button", "nb-act", n.accion.label);
      act.type = "button";
      act.addEventListener("click", () => {
        cerrar();
        if (n.accion.fn) n.accion.fn();
        else if (n.accion.url) irA(n.accion.url);
      });
      txt.appendChild(act);   // debajo del texto: el texto conserva todo el ancho
    }
    const x = el("button", "nb-x");
    x.type = "button";
    x.setAttribute("aria-label", "Cerrar aviso");
    x.innerHTML = icono("close");
    x.addEventListener("click", cerrar);
    b.appendChild(x);

    if (!n.persistente) {
      let t = setTimeout(cerrar, BANNER_MS);
      // no se va mientras se está leyendo
      b.addEventListener("pointerenter", () => clearTimeout(t));
      b.addEventListener("focusin", () => clearTimeout(t));
      b.addEventListener("pointerleave", () => { t = setTimeout(cerrar, BANNER_MS / 2); });
    }
    box.appendChild(b);
    // máximo 4 en pantalla: el más viejo cede su lugar
    const todos = box.querySelectorAll(".nb:not(.nb-sale)");
    if (todos.length > 4) todos[0].remove();
    b.cerrar = cerrar;
    return b;
  }

  /* ============================================================
     NOTIFICACIONES DEL SISTEMA
     ============================================================ */
  const permiso = () => ("Notification" in window ? Notification.permission : "no-soportado");

  async function sistema(n) {
    if (permiso() !== "granted") return false;
    const opciones = {
      body: n.cuerpo || "",
      tag: n.tag,
      icon: "icons/icon-192.png",
      badge: "icons/badge-96.png",
      lang: "es",
      timestamp: Date.now(),
      data: { url: n.url || "#formatos" },
    };
    try {
      const reg = swReg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
      if (reg) {
        // los botones de acción solo existen en notificaciones del SW
        if (n.acciones) opciones.actions = n.acciones;
        await reg.showNotification(n.titulo, opciones);
      } else {
        const notif = new Notification(n.titulo, opciones);
        notif.onclick = () => { window.focus(); if (n.url) irA(n.url); notif.close(); };
      }
      return true;
    } catch (e) {
      console.warn("Notificación del sistema no mostrada:", e);
      return false;
    }
  }

  /* ============================================================
     MOTOR
     ============================================================ */
  /**
   * Emite un aviso respetando las preferencias.
   * @param {string|null} pref  clave de EVENTOS (null = siempre)
   * @param {object} n          { titulo, cuerpo, tono, icono, tag, url, accion, acciones }
   * @param {object} [o]        { forzarSistema: también al sistema aunque se esté mirando }
   * @returns {Promise<boolean>} false si las preferencias lo silenciaron
   */
  async function emitir(pref, n, o = {}) {
    if (!perfil) return false;
    if (pref && prefs[pref] === false) return false;
    n.tag = n.tag || `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // «Recientes»: sin duplicados por tag (push + realtime del mismo evento)
    if (!inbox.some((i) => i.tag === n.tag)) {
      inbox.unshift({
        tag: n.tag, titulo: n.titulo, cuerpo: n.cuerpo || "", tono: n.tono || "info",
        icono: n.icono || "", url: n.url || "", fecha: new Date().toISOString(), leida: false,
      });
      inbox = inbox.slice(0, INBOX_MAX);
      guardarInbox();
      pintarCampana();
    }

    const visible = document.visibilityState === "visible";
    if (visible) banner(n);
    let alSistema = false;
    if (!visible || o.forzarSistema) alSistema = await sistema(n);
    // en segundo plano y sin notificación del sistema (bloqueada o no
    // soportada): se muestra como banner apenas se vuelva a la pestaña
    if (!visible && !alSistema) pendientes.push(n);
    return true;
  }

  const pendientes = [];
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !pendientes.length) return;
    pendientes.splice(0).slice(-3).forEach((n) => banner(n));
  });

  /* ---------- disparadores reutilizables ---------- */

  /** El PDF de un formato terminó de generarse y se descargó. */
  function formatoListo({ formato = "Reporte de Obra", numero = "", proyecto = "" } = {}) {
    return emitir("formato_listo", {
      titulo: `${formato} ${numero} listo`.replace(/\s+/g, " ").trim(),
      cuerpo: `${proyecto ? `«${proyecto}»: ` : ""}el PDF se generó con firma y se descargó. Queda guardado en el historial.`,
      tono: "ok",
      icono: "check",
      tag: `formato-${numero || Date.now()}`,
      url: "#historial",
      accion: { label: "Ver historial", url: "#historial" },
      acciones: [{ action: "historial", title: "Ver historial" }],
    }, { forzarSistema: true });
  }

  /* Registro de auditoría con freno: `cadaMin` evita mandar el mismo
     evento varias veces seguidas (abrir/cerrar un formato, recargar). */
  function auditar(tipo, detalle = {}, { llave = "", cadaMin = 0 } = {}) {
    if (!perfil) return null;
    const k = `${tipo}:${llave}`;
    if (cadaMin) {
      const antes = ultimosEventos.get(k);
      if (antes && Date.now() - antes < cadaMin * 60000) return null;
      ultimosEventos.set(k, Date.now());
    }
    return Store.registrarEvento(tipo, detalle);
  }

  /** Un formato se abrió (nuevo o guardado). Avisa a los administradores. */
  function formatoAbierto({ formato_key = "reporte_obra", formato = "Reporte de Obra", numero = "", proyecto = "" } = {}) {
    return auditar("formato_abierto",
      { formato: formato_key, formato_nombre: formato, numero, proyecto, accion: numero ? "editar" : "nuevo" },
      { llave: numero || "nuevo", cadaMin: 10 });
  }

  /** Un formato se guardó terminado (sale firmado). Avisa a los administradores. */
  function formatoCompletado({ formato_key = "reporte_obra", formato = "Reporte de Obra", numero = "", proyecto = "", nuevo = false } = {}) {
    return auditar("formato_completado",
      { formato: formato_key, formato_nombre: formato, numero, proyecto, nuevo },
      { llave: numero, cadaMin: 1 });
  }

  /* Al entrar: «X entró al portal» para los admins y, si este
     navegador es nuevo para la cuenta, alerta de seguridad para los
     otros dispositivos del mismo usuario. Una vez por sesión del
     navegador: recargar la página no cuenta como volver a entrar. */
  async function ingreso() {
    if (!perfil) return;
    const marca = `sm_ingreso_${perfil.id}`;
    try { if (sessionStorage.getItem(marca)) return; sessionStorage.setItem(marca, "1"); } catch {}

    const info = infoDispositivo();
    await Store.registrarEvento("login", info);
    const { nuevo, primero } = await Store.registrarDispositivo({ device_id: info.device_id, texto: info.dispositivo });
    if (nuevo && !primero) await Store.registrarEvento("login_nuevo_dispositivo", info);
  }

  /* Texto de cada evento de la tabla `eventos`. La Edge Function
     arma el mismo texto para el push. */
  function mensajeDeEvento(ev) {
    const d = ev.detalle || {};
    const quien = ev.actor_nombre || "Alguien del equipo";
    const hora = horaCorta(ev.created_at);
    const formato = d.formato_nombre || "un formato";
    const tag = `ev-${ev.id}`;
    switch (ev.tipo) {
      case "login":
        return { tag, tono: "info", icono: "users", titulo: `${quien} entró al portal`,
          cuerpo: `${d.dispositivo || "Dispositivo sin identificar"} · ${hora}` };
      case "formato_abierto":
        return { tag, tono: "info", icono: "report", titulo: `${quien} abrió ${formato}`,
          cuerpo: d.numero ? `Editando ${d.numero}${d.proyecto ? ` · ${d.proyecto}` : ""} · ${hora}` : `Empezó uno nuevo · ${hora}` };
      case "formato_completado":
        return { tag, tono: "ok", icono: "check", titulo: `${quien} completó ${formato} ${d.numero || ""}`.trim(),
          cuerpo: `${d.proyecto ? `${d.proyecto} · ` : ""}firmado y guardado · ${hora}` };
      case "login_nuevo_dispositivo": {
        const f = fechaCorta(ev.created_at);   // termina en «a. m.»: no repetir el punto
        return { tag, tono: "peligro", icono: "shield", titulo: "Nuevo inicio de sesión en tu cuenta",
          cuerpo: `${d.dispositivo || "Un dispositivo nuevo"} · ${f}${f.endsWith(".") ? "" : "."} Si no fuiste tú, cambia tu contraseña.` };
      }
      default:
        return null;
    }
  }

  /* Evento recién insertado (Realtime). Decide si a ESTE usuario y
     en ESTE dispositivo le toca verlo. */
  function procesarEvento(ev) {
    if (!perfil || !ev) return;
    const pref = TIPO_A_PREF[ev.tipo];
    if (!pref) return;
    if (ev.tipo === "login_nuevo_dispositivo") {
      // al dueño de la cuenta, en sus OTROS dispositivos
      if (ev.actor_id !== perfil.id || (ev.detalle || {}).device_id === deviceId()) return;
    } else if (perfil.rol !== "admin" || ev.actor_id === perfil.id) {
      return;   // solo admins, y no sobre lo que hicieron ellos mismos
    }
    const n = mensajeDeEvento(ev);
    if (n) emitir(pref, n);
  }

  /* Push que llegó con el portal a la vista: el SW no lo mostró y
     nos lo pasa. El servidor ya filtró por preferencias. */
  function procesarPush(d) {
    if (!d) return;
    emitir(null, { titulo: d.titulo || "Servimantos", cuerpo: d.cuerpo || "", tag: d.tag,
      tono: d.tono || "info", icono: d.icono, url: d.url });
  }

  /* ============================================================
     WEB PUSH (este dispositivo)
     ============================================================ */
  function b64UrlABytes(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  function mismaLlave(sub, llave) {
    const a = sub.options && sub.options.applicationServerKey;
    if (!a) return true;
    const x = new Uint8Array(a), y = b64UrlABytes(llave);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  const pushDisponible = () =>
    !!APP_CONFIG.VAPID_PUBLIC_KEY && !!swReg && "PushManager" in window && permiso() === "granted";

  async function activarPush() {
    if (!pushDisponible()) return null;
    try {
      let sub = await swReg.pushManager.getSubscription();
      if (sub && !mismaLlave(sub, APP_CONFIG.VAPID_PUBLIC_KEY)) { await sub.unsubscribe(); sub = null; }
      if (!sub) {
        sub = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64UrlABytes(APP_CONFIG.VAPID_PUBLIC_KEY),
        });
      }
      pushSub = sub;
      await Store.guardarSuscripcionPush(sub, deviceId(), prefs);
      return sub;
    } catch (e) {
      console.warn("No se pudo activar Web Push:", e);
      return null;
    }
  }

  /* ============================================================
     CAMPANITA
     ============================================================ */
  const noLeidas = () => inbox.filter((i) => !i.leida).length;

  function pintarCampana() {
    const btn = $("#bell-btn"), badge = $("#bell-badge");
    if (!btn) return;
    const p = permiso();
    btn.dataset.permiso = p;
    btn.innerHTML = icono(p === "denied" ? "bellOff" : "bell");
    btn.appendChild(badge);
    const n = noLeidas();
    badge.textContent = n > 9 ? "9+" : String(n);
    badge.classList.toggle("hidden", n === 0);
    btn.setAttribute("aria-label", n ? `Notificaciones: ${n} sin leer` : "Notificaciones");
  }

  function estadoPermiso() {
    if (!("Notification" in window)) {
      return window.PWA && PWA.esIOS() && !PWA.esStandalone() ? "ios-instalar" : "no-soportado";
    }
    return Notification.permission;   // default | granted | denied
  }

  function alPulsarCampana() {
    const st = estadoPermiso();
    if (st === "granted") abrirPanel();
    else abrirModalPermiso(st);
  }

  /* ---------- modal de permiso ---------- */
  function abrirModalPermiso(st) {
    const m = $("#np-modal");
    const lista = $("#np-list");
    const ok = $("#np-ok");
    lista.innerHTML = "";
    ok.classList.remove("hidden");
    ok.onclick = null;

    const items = ["Cuando un formato termine de generarse y se descargue.",
      "Si alguien entra a tu cuenta desde un dispositivo nuevo."];
    if (perfil && perfil.rol === "admin") {
      items.push("Cuando un trabajador entre, abra o complete un formato.");
    }

    if (st === "default") {
      $("#np-title").textContent = "¿Activamos las notificaciones?";
      $("#np-text").textContent = "El navegador te va a pedir permiso. Solo te avisamos de esto:";
      items.forEach((t) => lista.appendChild(el("li", null, t)));
      $("#np-hint").textContent = "Puedes elegir qué avisos recibir y cambiarlo cuando quieras desde esta misma campanita.";
      ok.textContent = "Activar notificaciones";
      ok.onclick = async () => {
        // requestPermission va directo en el clic: Safari lo exige
        const r = await Notification.requestPermission();
        cerrarModal(m);
        pintarCampana();
        if (r === "granted") {
          await activarPush();
          abrirPanel("prefs");
          banner({ titulo: "Notificaciones activadas", cuerpo: "Elige abajo qué avisos quieres recibir en este dispositivo.", tono: "ok", icono: "check" });
        } else if (r === "denied") {
          abrirModalPermiso("denied");
        }
      };
    } else if (st === "denied") {
      $("#np-title").textContent = "Las notificaciones están bloqueadas";
      $("#np-text").textContent = "Este navegador tiene bloqueados los avisos del portal. Para activarlos:";
      ["En el navegador: toca el candado o el ícono de ajustes junto a la dirección → Notificaciones → Permitir.",
       "En la app instalada: Ajustes del teléfono → Apps → Servimantos → Notificaciones.",
       "Luego vuelve aquí y toca la campanita otra vez."].forEach((t) => lista.appendChild(el("li", null, t)));
      $("#np-hint").textContent = "Los avisos dentro del portal siguen funcionando mientras lo tengas abierto.";
      ok.classList.add("hidden");
    } else if (st === "ios-instalar") {
      $("#np-title").textContent = "Instala el portal para recibir avisos";
      $("#np-text").textContent = "En iPhone y iPad las notificaciones solo funcionan con el portal instalado:";
      ["Toca el botón Compartir de Safari (el cuadro con la flecha).",
       "Elige «Añadir a pantalla de inicio».",
       "Abre el portal desde el ícono nuevo y toca esta campanita."].forEach((t) => lista.appendChild(el("li", null, t)));
      $("#np-hint").textContent = "Requiere iOS 16.4 o más reciente.";
      ok.classList.add("hidden");
    } else {
      $("#np-title").textContent = "Este navegador no muestra notificaciones";
      $("#np-text").textContent = "Puedes seguir viendo los avisos dentro del portal mientras lo tengas abierto.";
      $("#np-hint").textContent = "Chrome, Edge, Firefox y Safari (16.4+) sí las soportan.";
      ok.classList.add("hidden");
    }
    abrirModal(m);
  }

  /* ---------- panel: recientes + preferencias ---------- */
  function abrirPanel(pestana) {
    pintarPanel(pestana || (noLeidas() ? "recientes" : "prefs"));
    abrirModal($("#nf-panel"));
  }

  function pintarPanel(pestana) {
    document.querySelectorAll(".nf-tab").forEach((t) => {
      const on = t.dataset.tab === pestana;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll(".nf-pane").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== pestana));
    const n = noLeidas();
    $("#nf-count").textContent = n ? String(n) : "";
    if (pestana === "recientes") pintarRecientes();
    else pintarPreferencias();
  }

  function pintarRecientes() {
    const ul = $("#nf-list");
    ul.innerHTML = "";
    if (!inbox.length) {
      const li = el("li", "nf-empty");
      li.innerHTML = icono("bell");
      li.appendChild(el("span", null, "Todavía no hay avisos. Aquí quedan los últimos 30."));
      ul.appendChild(li);
    }
    for (const it of inbox) {
      const li = el("li", `nf-item nf-${it.tono}${it.leida ? "" : " nueva"}`);
      const b = el("button", "nf-item-btn");
      b.type = "button";
      const ic = el("span", "nf-item-ic");
      ic.innerHTML = icono(it.icono || TONO_ICONO[it.tono] || "bell");
      const t = el("span", "nf-item-txt");
      t.append(el("strong", null, it.titulo), el("small", null, it.cuerpo), el("time", null, haceCuanto(it.fecha)));
      b.append(ic, t);
      b.addEventListener("click", () => {
        if (it.url) { cerrarModal($("#nf-panel")); irA(it.url); }
      });
      li.appendChild(b);
      ul.appendChild(li);
    }
    // abrir la pestaña cuenta como leer
    if (noLeidas()) {
      inbox.forEach((i) => { i.leida = true; });
      guardarInbox();
      pintarCampana();
    }
    $("#nf-clear").classList.toggle("hidden", !inbox.length);
  }

  function pintarPreferencias() {
    const p = permiso();
    const sist = p === "granted" ? "activas en este dispositivo"
      : p === "denied" ? "bloqueadas en el navegador" : p === "default" ? "sin activar" : "no disponibles aquí";
    const push = !APP_CONFIG.VAPID_PUBLIC_KEY ? "solo con el portal abierto (Web Push sin configurar)"
      : pushSub ? "también con el portal cerrado" : p === "granted" ? "solo con el portal abierto" : "—";
    const st = $("#nf-status");
    st.innerHTML = "";
    const l1 = el("p"); l1.append(el("span", null, "Notificaciones del sistema: "), el("strong", null, sist));
    const l2 = el("p"); l2.append(el("span", null, "Avisos: "), el("strong", null, push));
    st.append(l1, l2);

    const box = $("#nf-prefs");
    box.innerHTML = "";
    const grupos = [["tuyo", "Tus avisos"]];
    if (perfil && perfil.rol === "admin") grupos.push(["admin", "Equipo · solo administradores"]);
    for (const [g, titulo] of grupos) {
      const fs = el("fieldset", "nf-group");
      fs.appendChild(el("legend", null, titulo));
      for (const [k, e] of Object.entries(EVENTOS)) {
        if (e.grupo !== g) continue;
        const lab = el("label", "nf-toggle");
        const txt = el("span", "nf-toggle-txt");
        txt.append(el("strong", null, e.label), el("small", null, e.desc));
        const inp = el("input");
        inp.type = "checkbox";
        inp.setAttribute("role", "switch");
        inp.checked = !!prefs[k];
        inp.addEventListener("change", () => {
          prefs[k] = inp.checked;
          guardarPrefs();
          if (pushSub) Store.actualizarPrefsPush(pushSub.endpoint, prefs);
        });
        lab.append(txt, inp, el("span", "switch"));
        fs.appendChild(lab);
      }
      box.appendChild(fs);
    }
    $("#nf-test").disabled = false;
  }

  /* ---------- modales ---------- */
  let focoPrevio = null;
  function abrirModal(m) {
    focoPrevio = document.activeElement;
    m.classList.remove("hidden");
    const primero = m.querySelector("button:not(.hidden), [href], input");
    primero && primero.focus();
  }
  function cerrarModal(m) {
    m.classList.add("hidden");
    focoPrevio && focoPrevio.focus && focoPrevio.focus();
  }

  /* ============================================================
     NAVEGACIÓN DESDE UN AVISO
     ============================================================ */
  function irA(url) {
    const u = new URL(url, location.href);
    if (u.origin === location.origin && u.pathname === location.pathname) {
      if (u.hash && u.hash !== location.hash) location.hash = u.hash;
      else window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      location.href = u.href;
    }
  }

  /* ============================================================
     ENLACES CON LA PWA (instalar, actualizar, sin conexión)
     ============================================================ */
  function pintarInstalar() {
    const b = $("#install-btn");
    if (!b || !window.PWA) return;
    const mostrar = !PWA.esStandalone() && (PWA.puedeInstalar() || PWA.esIOS());
    b.classList.toggle("hidden", !mostrar);
  }

  document.addEventListener("pwa:instalable", pintarInstalar);
  document.addEventListener("pwa:instalada", () => {
    pintarInstalar();
    banner({ titulo: "Portal instalado", cuerpo: "Ya lo tienes como app en este dispositivo.", tono: "ok", icono: "check" });
  });
  document.addEventListener("pwa:actualizacion", (e) => {
    banner({
      titulo: "Hay una versión nueva del portal",
      cuerpo: "Actualiza para usar los últimos cambios. Tarda un segundo.",
      tono: "info", icono: "install", tag: "pwa-update", persistente: true,
      accion: { label: "Actualizar", fn: () => guard(() => PWA.aplicarActualizacion(e.detail.worker)) },
    });
  });
  document.addEventListener("pwa:conexion", (e) => {
    const previo = document.querySelector('.nb[data-tag="offline"]');
    if (!e.detail.online) {
      banner({ titulo: "Sin conexión", cuerpo: "Puedes seguir mirando, pero guardar y generar PDF fallará hasta que vuelva la señal.",
        tono: "alerta", icono: "wifiOff", tag: "offline", persistente: true });
    } else if (previo) {
      previo.cerrar ? previo.cerrar() : previo.remove();
      banner({ titulo: "Conexión restablecida", tono: "ok", icono: "check", tag: "online" });
    }
  });

  /* mensajes del Service Worker */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => {
      const m = e.data || {};
      if (m.tipo === "push") procesarPush(m.datos);
      if (m.tipo === "abrir" && m.url) irA(m.url);
    });
  }

  /* ---------- enganches de la interfaz (una sola vez) ---------- */
  function enganchar() {
    $("#bell-btn")?.addEventListener("click", alPulsarCampana);
    $("#install-btn")?.addEventListener("click", async () => {
      if (PWA.puedeInstalar()) { await PWA.instalar(); pintarInstalar(); }
      else abrirModalPermiso("ios-instalar");
    });
    document.querySelectorAll(".nf-tab").forEach((t) =>
      t.addEventListener("click", () => pintarPanel(t.dataset.tab)));
    $("#nf-clear")?.addEventListener("click", () => {
      inbox = [];
      guardarInbox();
      pintarCampana();
      pintarRecientes();
    });
    $("#nf-test")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      await emitir(null, {
        titulo: "Notificación de prueba",
        cuerpo: "Así se ven los avisos del portal en este dispositivo.",
        tono: "info", icono: "bell", tag: `prueba-${Date.now()}`,
      }, { forzarSistema: true });
      setTimeout(() => { const b = $("#nf-test"); if (b) b.disabled = false; }, 1500);
    });
    ["#np-modal", "#nf-panel"].forEach((id) => {
      const m = $(id);
      if (!m) return;
      m.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", () => cerrarModal(m)));
      // tocar fuera del cuadro también cierra
      m.addEventListener("click", (e) => { if (e.target === m) cerrarModal(m); });
    });
    $("#np-ver-avisos")?.addEventListener("click", () => { cerrarModal($("#np-modal")); abrirPanel(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      ["#nf-panel", "#np-modal"].forEach((id) => { const m = $(id); if (m && !m.classList.contains("hidden")) cerrarModal(m); });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enganchar);
  else enganchar();

  /* ============================================================
     CICLO DE VIDA
     ============================================================ */
  /** Arranca con la sesión. `opts.guard` = cómo pedir confirmación antes de recargar. */
  async function init(p, opts = {}) {
    perfil = p;
    if (opts.guard) guard = opts.guard;
    prefs = cargarPrefs();
    inbox = lsGet(clave("sm_notif_inbox"), []);
    pintarCampana();
    pintarInstalar();
    if (navigator.onLine === false) document.dispatchEvent(new CustomEvent("pwa:conexion", { detail: { online: false } }));

    if (dejarDeEscuchar) dejarDeEscuchar();
    dejarDeEscuchar = Store.suscribirEventos(procesarEvento);
    ingreso();   // no espera al Service Worker

    swReg = window.PWA ? await PWA.listo : null;
    if (permiso() === "granted") activarPush();   // mantiene la suscripción al día
  }

  /** Antes de cerrar sesión: este dispositivo deja de recibir push de esta cuenta. */
  async function alCerrarSesion() {
    if (dejarDeEscuchar) { dejarDeEscuchar(); dejarDeEscuchar = null; }
    try {
      const sub = pushSub || (swReg && await swReg.pushManager.getSubscription());
      if (sub) {
        await Store.borrarSuscripcionPush(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (e) { console.warn("Push al cerrar sesión:", e); }
    try { sessionStorage.removeItem(`sm_ingreso_${perfil && perfil.id}`); } catch {}
    perfil = null;
    pushSub = null;
  }

  window.NotificationService = {
    EVENTOS,
    init,
    alCerrarSesion,
    // disparadores
    emitir,
    banner,
    formatoListo,
    formatoAbierto,
    formatoCompletado,
    ingreso,
    procesarEvento,
    // utilidades
    infoDispositivo,
    abrirPanel,
    permiso,
  };
})();
