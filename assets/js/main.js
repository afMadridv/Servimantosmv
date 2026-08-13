/* ============================================================
   Servimantos · Interacciones
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---- Año en el footer ---- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Navbar con fondo al hacer scroll + barra de progreso ---- */
  const navbar = $("#navbar");
  const progress = $("#scrollProgress");

  const onScroll = () => {
    const y = window.scrollY;
    navbar.classList.toggle("scrolled", y > 30);

    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";

    if (toTop) toTop.classList.toggle("show", y > 600);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Menú móvil ---- */
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  const closeMenu = () => {
    toggle.classList.remove("open");
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle?.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("#navLinks a").forEach((a) => a.addEventListener("click", closeMenu));

  /* ---- Revelado al hacer scroll (IntersectionObserver) ---- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.dataset.delay || 0;
            entry.target.style.transitionDelay = delay + "ms";
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---- Contadores animados ---- */
  const counters = $$(".count");
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.target) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1600;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => cio.observe(el));
  } else {
    counters.forEach((el) => (el.textContent = el.dataset.target + (el.dataset.suffix || "")));
  }

  /* ---- Tilt suave en la tarjeta del hero ---- */
  const tilt = $(".tilt");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (tilt && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    const wrap = tilt.parentElement;
    wrap.addEventListener("mousemove", (e) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `perspective(900px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateZ(8px)`;
    });
    wrap.addEventListener("mouseleave", () => {
      tilt.style.transform = "perspective(900px) rotateY(0) rotateX(0)";
    });
  }

  /* ---- Botón volver arriba ---- */
  const toTop = $("#toTop");
  toTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---- Formulario de contacto (demo) ---- */
  const form = $("#contactForm");
  const formMsg = $("#formMsg");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = $("#nombre").value.trim();
    const tel = $("#telefono").value.trim();
    if (!nombre || !tel) {
      formMsg.textContent = "Por favor completa tu nombre y teléfono.";
      formMsg.style.color = "#ffd0b0";
      return;
    }
    formMsg.textContent = "¡Gracias, " + nombre.split(" ")[0] + "! Te contactaremos muy pronto. 💧";
    formMsg.style.color = "";
    form.reset();
    setTimeout(() => (formMsg.textContent = ""), 6000);
  });

  /* ---- Tema claro/oscuro ---- */
  const themeBtn = $("#themeBtn");
  themeBtn?.addEventListener("click", () => {
    const root = document.documentElement;
    const next = (root.getAttribute("data-theme") || "light") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("sm-theme", next); } catch (e) {}
  });

  /* ---- Marca de scroll inicial ---- */
  onScroll();
})();
