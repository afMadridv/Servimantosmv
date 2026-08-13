/* Servimantos · index3.0 */
(function () {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

  /* tema */
  $("#themeBtn")?.addEventListener("click", () => {
    const t = (root.getAttribute("data-theme") || "light") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("sm-theme", t); } catch (e) {}
  });

  /* header + progreso + volver arriba */
  const hdr = $("#hdr"), prog = $("#progress"), toTop = $("#toTop");
  const onScroll = () => {
    const y = scrollY;
    hdr.classList.toggle("scrolled", y > 14);
    const max = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    toTop.classList.toggle("show", y > 700);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));

  /* menú móvil */
  const mb = $("#menuBtn"), links = $("#navLinks");
  mb.addEventListener("click", () => {
    const o = links.classList.toggle("open");
    mb.setAttribute("aria-expanded", String(o));
  });
  $$("#navLinks a").forEach(a => a.addEventListener("click", () => {
    links.classList.remove("open");
    mb.setAttribute("aria-expanded", "false");
  }));

  /* revelado con stagger entre hermanos */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains("rv"));
    el.style.transitionDelay = Math.max(0, sibs.indexOf(el)) * 55 + "ms";
    el.classList.add("in");
    io.unobserve(el);
  }), { threshold: 0.14, rootMargin: "0px 0px -45px 0px" });
  $$(".rv").forEach(el => io.observe(el));

  /* contadores */
  $$(".num[data-count]").forEach(el => {
    new IntersectionObserver((es, o) => es.forEach(e => {
      if (!e.isIntersecting) return;
      o.disconnect();
      const target = +el.dataset.count, suf = el.dataset.suffix || "";
      if (reduce) { el.textContent = target + suf; return; }
      const t0 = performance.now();
      const tick = t => {
        const p = Math.min((t - t0) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { threshold: 0.6 }).observe(el);
  });

  /* tabs de mantos */
  const tabs = $$(".tab"), panels = $$(".tabpanel");
  tabs.forEach((t, i) => t.addEventListener("click", () => {
    tabs.forEach(x => { x.classList.remove("on"); x.setAttribute("aria-selected", "false"); });
    t.classList.add("on");
    t.setAttribute("aria-selected", "true");
    panels.forEach((p, j) => { p.hidden = j !== i; p.classList.remove("in"); });
    const p = panels[i];
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add("in")));
  }));

  /* ============================================================
     PROYECTOS
     Las cajas salen de la tabla `proyectos` de Supabase, que se
     administra desde el portal. Las que vienen en el HTML son el
     respaldo: si no hay conexión o todavía no hay nada cargado,
     esas se quedan y la sección nunca se ve vacía.
     ============================================================ */
  const grid = $("#projGrid");
  const cfg = window.APP_CONFIG || {};
  let proyectos = [];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* El bucket de proyectos es público: la ruta guardada se vuelve URL
     sin firmar nada. Lo que ya venga como URL se deja igual. */
  const imgUrl = ref => {
    const v = String(ref || "");
    if (!v || /^(https?:|data:|blob:)/.test(v)) return v;
    return `${cfg.SUPABASE_URL}/storage/v1/object/public/${cfg.PROYECTOS_BUCKET}/${v}`;
  };

  /* Lee las cajas de respaldo que ya están en el HTML */
  const leerRespaldo = () => $$(".proj", grid).map(card => ({
    nombre: $("h3", card)?.textContent.trim() || "",
    descripcion: $("p", card)?.textContent.trim() || "",
    imagenes: [{ src: $("img", card)?.getAttribute("src") || "", desc: "" }],
  }));

  function pintarProyectos(lista) {
    grid.innerHTML = lista.map((p, i) => {
      const n = p.imagenes.length;
      return `<article class="proj rv">
        <div class="proj-ph">
          <img src="${esc(imgUrl(p.imagenes[0].src))}" alt="${esc(p.nombre)}" loading="lazy" />
          ${n > 1 ? `<span class="proj-n">${n} fotos</span>` : ""}
        </div>
        <div class="proj-b"><h3>${esc(p.nombre)}</h3>${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : ""}</div>
        <button class="proj-open" type="button" data-i="${i}"
          aria-label="Ver ${n === 1 ? "la foto" : "las " + n + " fotos"} de ${esc(p.nombre)}"></button>
      </article>`;
    }).join("");

    /* La sección puede haberse revelado ya: lo que entra después de
       ese momento se muestra de una, sin esperar otro scroll. */
    const cards = $$(".proj", grid);
    if (grid.getBoundingClientRect().top < innerHeight) cards.forEach(c => c.classList.add("in"));
    else cards.forEach(c => io.observe(c));
  }

  async function cargarProyectos() {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
    const url = `${cfg.SUPABASE_URL}/rest/v1/proyectos`
      + `?select=nombre,descripcion,imagenes&publicado=eq.true&order=orden.asc,created_at.asc`;
    const r = await fetch(url, {
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return (await r.json())
      .map(p => ({
        nombre: p.nombre || "",
        descripcion: p.descripcion || "",
        imagenes: (Array.isArray(p.imagenes) ? p.imagenes : [])
          .map(im => (typeof im === "string" ? { src: im, desc: "" } : { src: im?.src || "", desc: im?.desc || "" }))
          .filter(im => im.src),
      }))
      .filter(p => p.imagenes.length);
  }

  if (grid) {
    proyectos = leerRespaldo();
    cargarProyectos()
      .then(rows => {
        if (!rows || !rows.length) return;      // sin nada cargado se queda el respaldo
        proyectos = rows;
        pintarProyectos(proyectos);
      })
      .catch(e => console.warn("No se pudieron cargar los proyectos:", e));
  }

  /* ---------- visor de fotos ---------- */
  const lbox = $("#lbox"), lboxImg = $("#lboxImg");
  let lbFotos = [], lbIdx = 0, lbVolver = null;

  function lbPintar() {
    const f = lbFotos[lbIdx];
    lboxImg.src = imgUrl(f.src);
    lboxImg.alt = f.desc || lbox.dataset.titulo || "";
    $("#lboxCap").textContent = f.desc || "";
    $("#lboxCount").textContent = lbFotos.length > 1 ? `${lbIdx + 1} / ${lbFotos.length}` : "";
    const solaUna = lbFotos.length < 2;
    $("#lboxPrev").hidden = $("#lboxNext").hidden = solaUna;
  }
  const lbIr = paso => { lbIdx = (lbIdx + paso + lbFotos.length) % lbFotos.length; lbPintar(); };

  function lbAbrir(i) {
    const p = proyectos[i];
    if (!p || !p.imagenes.length) return;
    lbFotos = p.imagenes;
    lbIdx = 0;
    lbox.dataset.titulo = p.nombre;
    $("#lboxTitle").textContent = p.nombre;
    lbPintar();
    lbVolver = document.activeElement;
    lbox.hidden = false;
    document.body.style.overflow = "hidden";
    $("#lboxX").focus();
  }
  function lbCerrar() {
    lbox.hidden = true;
    lboxImg.removeAttribute("src");
    document.body.style.overflow = "";
    lbVolver?.focus();
  }

  grid?.addEventListener("click", e => {
    const b = e.target.closest(".proj-open");
    if (b) lbAbrir(+b.dataset.i);
  });
  $("#lboxX").addEventListener("click", lbCerrar);
  $("#lboxPrev").addEventListener("click", () => lbIr(-1));
  $("#lboxNext").addEventListener("click", () => lbIr(1));
  lbox.addEventListener("click", e => { if (e.target === lbox) lbCerrar(); });
  addEventListener("keydown", e => {
    if (lbox.hidden) return;
    if (e.key === "Escape") lbCerrar();
    if (e.key === "ArrowRight") lbIr(1);
    if (e.key === "ArrowLeft") lbIr(-1);
  });

  /* acordeón FAQ (uno abierto) */
  $$("#faqList .ac").forEach(ac => {
    const head = ac.querySelector(".ac-head");
    head.addEventListener("click", () => {
      const open = ac.classList.contains("open");
      $$("#faqList .ac.open").forEach(o => {
        o.classList.remove("open");
        o.querySelector(".ac-head").setAttribute("aria-expanded", "false");
      });
      if (!open) { ac.classList.add("open"); head.setAttribute("aria-expanded", "true"); }
    });
  });

  /* scrollspy */
  const navA = $$("#navLinks a");
  const byId = new Map(navA.map(a => [a.getAttribute("href").slice(1), a]));
  $$("main section[id]").forEach(s => {
    new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      navA.forEach(a => a.classList.remove("active"));
      byId.get(e.target.id)?.classList.add("active");
    }), { rootMargin: "-45% 0px -50% 0px" }).observe(s);
  });

  /* formulario */
  const form = $("#form"), msg = $("#formMsg");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const n = $("#nombre"), t = $("#tel");
    if (!n.value.trim()) { msg.textContent = "Escribe tu nombre."; n.focus(); return; }
    if (!t.value.trim()) { msg.textContent = "Escribe tu teléfono."; t.focus(); return; }
    msg.textContent = "¡Gracias, " + n.value.trim().split(" ")[0] + "! Te contactamos hoy mismo.";
    form.reset();
    setTimeout(() => (msg.textContent = ""), 6000);
  });

  $("#year").textContent = new Date().getFullYear();
})();
