/* ============================================================
   Lógica de la interfaz: login, formulario, hojas de fotos,
   vista previa e historial.
   ============================================================ */
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const N_FOTOS = window.FOTOS_POR_HOJA;

  /* ---------- estado ---------- */
  let editingRecord = null;   // registro en edición (null = nuevo)
  let formHojas = [];         // [{ titulo, fotos: [{src, desc} × 4] }]
  let formDirty = false;      // hay cambios sin guardar

  /* ---------- helpers ---------- */
  function toast(msg, type = "ok") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = `toast ${type}`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function showConfirm(title, text, okLabel = "Eliminar") {
    return new Promise((resolve) => {
      $("#confirm-title").textContent = title;
      $("#confirm-text").textContent = text;
      $("#confirm-ok").textContent = okLabel;
      const modal = $("#confirm-modal");
      modal.classList.remove("hidden");
      const done = (val) => {
        modal.classList.add("hidden");
        $("#confirm-ok").onclick = null;
        modal.querySelector("[data-close-modal]").onclick = null;
        resolve(val);
      };
      $("#confirm-ok").onclick = () => done(true);
      modal.querySelector("[data-close-modal]").onclick = () => done(false);
    });
  }

  /* Fecha de HOY en hora local. Con toISOString() a secas, un reporte
     hecho por la tarde en Colombia (UTC-5) salía ya con la fecha del
     día siguiente, porque esa función trabaja en UTC. */
  const hoy = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };
  const fechaLarga = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  function hojaVacia() {
    return { titulo: "", fotos: Array.from({ length: N_FOTOS }, () => ({ src: "", desc: "" })) };
  }

  /* ============================================================
     ARRANQUE Y SESIÓN
     ============================================================ */
  async function boot() {
    if (Store.isDemo) $("#demo-hint").classList.remove("hidden");
    let profile = null;
    try { profile = await Store.init(); }
    catch (e) { console.error(e); }
    if (profile) enterApp(profile);
    else $("#view-login").classList.remove("hidden");
  }

  function enterApp(profile) {
    $("#view-login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#user-name").textContent = profile.name;
    $("#user-email").textContent = profile.email;
    $("#user-avatar").textContent = (profile.name || "?").trim().charAt(0).toUpperCase();
    openForm(null);
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-btn");
    const err = $("#login-error");
    err.classList.add("hidden");
    btn.disabled = true;
    btn.textContent = "Ingresando…";
    try {
      const profile = await Store.login(
        $("#login-email").value.trim(),
        $("#login-password").value,
        $("#login-keep").checked
      );
      enterApp(profile);
    } catch (ex) {
      err.textContent = ex.message || "No fue posible iniciar sesión.";
      err.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Ingresar";
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    const ok = await showConfirm("Cerrar sesión", "¿Seguro que deseas salir del portal?", "Cerrar sesión");
    if (!ok) return;
    await Store.logout();
    location.reload();
  });

  /* aviso nativo al recargar o cerrar la pestaña con cambios sin guardar */
  window.addEventListener("beforeunload", (e) => {
    if (formDirty && !$("#view-generar").classList.contains("hidden")) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* modal propio para la navegación interna */
  function guardExit(proceed) {
    if (!formDirty || $("#view-generar").classList.contains("hidden")) { proceed(); return; }
    const modal = $("#exit-modal");
    modal.classList.remove("hidden");
    const close = () => {
      modal.classList.add("hidden");
      $("#exit-save").onclick = $("#exit-discard").onclick = null;
      modal.querySelector("[data-close-modal]").onclick = null;
    };
    $("#exit-save").onclick = async () => {
      const ok = await guardar(false);
      close();
      if (ok) proceed();
    };
    $("#exit-discard").onclick = () => { formDirty = false; close(); proceed(); };
    modal.querySelector("[data-close-modal]").onclick = close;
  }

  /* ============================================================
     NAVEGACIÓN
     ============================================================ */
  function switchView(view) {
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    ["generar", "historial", "pagina"].forEach((v) => $(`#view-${v}`).classList.toggle("hidden", v !== view));
    if (view === "historial") renderHistorial();
    if (view === "pagina") renderProyectos();
  }

  $$(".nav-item").forEach((b) => b.addEventListener("click", () => {
    // "Nuevo reporte" desde el historial arranca una hoja en blanco
    if (b.dataset.view === "generar" && editingRecord) {
      guardExit(() => openForm(null));
      return;
    }
    guardExit(() => switchView(b.dataset.view));
  }));

  $("#nuevo-btn").addEventListener("click", () => guardExit(() => openForm(null)));

  /* el <form> vive toda la sesión: el aviso de "cambios sin guardar"
     se engancha una sola vez y no en cada openForm() */
  $("#dynamic-form").addEventListener("input", () => { formDirty = true; });

  /* ============================================================
     FORMULARIO
     ============================================================ */
  function openForm(record) {
    editingRecord = record;
    const data = record ? (record.data || {}) : {};
    formHojas = normalizarHojas(data.hojas);
    if (!formHojas.length) formHojas = [hojaVacia()];

    $("#form-title").textContent = record ? `Editando ${record.numero}` : "Nuevo reporte de obra";
    $("#form-sub").textContent = record
      ? "Cambia lo que necesites y vuelve a generar el PDF."
      : "Completa los datos, agrega las hojas de fotos y genera el PDF.";
    $("#generate-btn-label").textContent = record ? "Guardar cambios y descargar PDF" : "Generar PDF";
    $("#save-status").textContent = "";

    const form = $("#dynamic-form");
    form.innerHTML = "";
    let rowOpen = null;
    const closeRow = () => { rowOpen = null; };
    const container = (half) => {
      if (!half) { closeRow(); return form; }
      if (!rowOpen) {
        rowOpen = document.createElement("div");
        rowOpen.className = "form-row";
        form.appendChild(rowOpen);
      }
      const target = rowOpen;
      if (target.children.length >= 1) rowOpen = null;   // la fila se llena con 2
      return target;
    };

    for (const f of FORMATO.fields) {
      if (f.section) {
        closeRow();
        const h = document.createElement("div");
        h.className = "form-section-title";
        h.textContent = f.section;
        form.appendChild(h);
        continue;
      }
      const val = data[f.key];
      const hint = f.hint ? `<small class="field-hint">${escapeHtml(f.hint)}</small>` : "";

      switch (f.type) {
        case "text": case "number": {
          const label = document.createElement("label");
          label.className = "field";
          label.innerHTML = `<span>${escapeHtml(f.label)}${f.required ? " *" : ""}</span>
            <input type="${f.type}" id="f-${f.key}" ${f.required ? "required" : ""}
              ${f.min != null ? `min="${f.min}"` : ""}
              placeholder="${escapeHtml(f.placeholder || "")}" value="${escapeHtml(val ?? "")}" />${hint}`;
          container(f.half).appendChild(label);
          break;
        }
        case "date-auto": {
          /* la fecha no se escribe: se pone sola al crear el reporte
             y se conserva tal cual cuando se edita después */
          const iso = val || hoy();
          const label = document.createElement("label");
          label.className = "field";
          label.innerHTML = `<span>${escapeHtml(f.label)}</span>
            <input type="text" id="f-${f.key}" class="input-auto" readonly tabindex="-1"
              value="${escapeHtml(fechaLarga(iso))}" data-iso="${escapeHtml(iso)}" />${hint}`;
          container(f.half).appendChild(label);
          break;
        }
        case "textarea": {
          const label = document.createElement("label");
          label.className = "field";
          label.innerHTML = `<span>${escapeHtml(f.label)}${f.required ? " *" : ""}</span>
            <textarea id="f-${f.key}" rows="${f.rows || 5}" ${f.required ? "required" : ""}
              placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val || "")}</textarea>${hint}`;
          container(false).appendChild(label);
          break;
        }
        case "hojas":
          container(false).appendChild(buildHojasField());
          break;
      }
    }

    formDirty = false;
    $("#preview-panel").classList.add("hidden");
    $("#pdf-preview").removeAttribute("src");
    switchView("generar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function normalizarHojas(hojas) {
    return (Array.isArray(hojas) ? hojas : []).map((h) => ({
      titulo: h.titulo || "",
      fotos: Array.from({ length: N_FOTOS }, (_, i) => {
        const f = (h.fotos || [])[i];
        if (!f) return { src: "", desc: "" };
        return typeof f === "string" ? { src: f, desc: "" } : { src: f.src || "", desc: f.desc || "" };
      }),
    }));
  }

  /* ----- campo: hojas de fotos ----- */
  function buildHojasField() {
    const wrap = document.createElement("div");
    wrap.className = "field hojas-field";
    wrap.innerHTML = `
      <p class="field-hint">Cada hoja del PDF lleva ${N_FOTOS} fotos en dos columnas, cada una con su descripción debajo.</p>
      <div class="hojas-list"></div>
      <button type="button" class="btn btn-ghost add-hoja-btn">+ Agregar hoja</button>`;

    const list = wrap.querySelector(".hojas-list");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.className = "hidden";
    wrap.appendChild(input);

    /* un solo <input file> para todos los huecos: guarda a cuál va */
    let destino = null;
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      input.value = "";
      if (!file || !destino) return;
      try {
        const dataURL = await Store.compressImage(file);
        formHojas[destino.hoja].fotos[destino.foto].src = dataURL;
        formDirty = true;
        render();
      } catch { toast("No se pudo leer la imagen.", "error"); }
    });

    function render() {
      list.innerHTML = "";
      formHojas.forEach((hoja, hi) => {
        const card = document.createElement("div");
        card.className = "hoja-card";
        card.innerHTML = `
          <div class="hoja-head">
            <span class="hoja-num">Hoja ${hi + 1}</span>
            <input type="text" class="hoja-titulo" maxlength="60"
              placeholder="Título de la hoja (opcional) — ej. Placa 2"
              value="${escapeHtml(hoja.titulo)}" />
            <button type="button" class="icon-btn danger hoja-del" title="Quitar hoja">${window.ICONS.trash}</button>
          </div>
          <div class="foto-grid"></div>`;

        card.querySelector(".hoja-titulo").addEventListener("input", (e) => {
          formHojas[hi].titulo = e.target.value;
          formDirty = true;
        });
        card.querySelector(".hoja-del").addEventListener("click", async () => {
          if (formHojas.length === 1) { toast("El reporte necesita al menos una hoja.", "error"); return; }
          const ok = await showConfirm("Quitar hoja",
            `Se quitará la hoja ${hi + 1} con sus ${N_FOTOS} fotos.`, "Quitar hoja");
          if (!ok) return;
          formHojas.splice(hi, 1);
          formDirty = true;
          render();
        });

        const grid = card.querySelector(".foto-grid");
        hoja.fotos.forEach((foto, fi) => {
          const slot = document.createElement("div");
          slot.className = "foto-slot" + (foto.src ? " lleno" : "");
          slot.innerHTML = `
            <div class="foto-box">
              <span class="foto-idx">${fi + 1}</span>
              ${foto.src
                ? `<img alt="Foto ${fi + 1}" /><button type="button" class="foto-del" title="Quitar foto">×</button>`
                : `<span class="foto-empty">${window.ICONS.camera}<em>Agregar foto</em></span>`}
            </div>
            <input type="text" class="foto-desc" maxlength="110"
              placeholder="Descripción de la foto ${fi + 1}" value="${escapeHtml(foto.desc)}" />`;

          const box = slot.querySelector(".foto-box");
          const img = slot.querySelector("img");
          if (img) Store.imageUrl(foto.src).then((u) => { img.src = u; }).catch(() => {});

          box.addEventListener("click", (e) => {
            if (e.target.closest(".foto-del")) return;
            destino = { hoja: hi, foto: fi };
            input.click();
          });
          const del = slot.querySelector(".foto-del");
          if (del) del.addEventListener("click", () => {
            formHojas[hi].fotos[fi] = { src: "", desc: formHojas[hi].fotos[fi].desc };
            formDirty = true;
            render();
          });
          slot.querySelector(".foto-desc").addEventListener("input", (e) => {
            formHojas[hi].fotos[fi].desc = e.target.value;
            formDirty = true;
          });

          grid.appendChild(slot);
        });

        list.appendChild(card);
      });
    }

    wrap.querySelector(".add-hoja-btn").addEventListener("click", () => {
      formHojas.push(hojaVacia());
      formDirty = true;
      render();
      list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    render();
    return wrap;
  }

  /* ============================================================
     DATOS, VISTA PREVIA Y GUARDADO
     ============================================================ */
  function collectData() {
    const data = {};
    for (const f of FORMATO.fields) {
      if (f.section) continue;
      if (f.type === "hojas") {
        data[f.key] = formHojas.map((h) => ({
          titulo: h.titulo.trim(),
          fotos: h.fotos.map((x) => ({ src: x.src, desc: x.desc.trim() })),
        }));
        continue;
      }
      const el = $(`#f-${f.key}`);
      if (!el) continue;
      data[f.key] = f.type === "date-auto" ? el.dataset.iso : el.value.trim();
    }
    return data;
  }

  /* Devuelve el primer problema encontrado, o null si todo está bien */
  function validar(data) {
    for (const f of FORMATO.fields) {
      if (f.required && !f.section && f.type !== "hojas" && !String(data[f.key] ?? "").trim()) {
        return { msg: `Completa el campo: ${f.label}`, focus: `#f-${f.key}` };
      }
    }
    if (!data.hojas.length) return { msg: "Agrega al menos una hoja de fotos." };
    for (let i = 0; i < data.hojas.length; i++) {
      const h = data.hojas[i];
      if (h.fotos.some((f) => !f.src)) {
        return { msg: `A la hoja ${i + 1} le faltan fotos: cada hoja lleva ${N_FOTOS}.` };
      }
      if (h.fotos.some((f) => !f.desc)) {
        return { msg: `A la hoja ${i + 1} le falta la descripción de alguna foto.` };
      }
    }
    return null;
  }

  async function refreshPreview() {
    $("#preview-panel").classList.remove("hidden");
    try {
      /* Sin guardar todavía no hay número: la casilla va vacía. Antes
         salía «INF-VT-BORRADOR» y se colaba en PDF impresos a mano. */
      const record = await Store.hydrateImages({
        numero: editingRecord ? editingRecord.numero : "",
        data: collectData(),
      });
      $("#pdf-preview").src = await PDFGen.previewURL(record);
    } catch (e) {
      console.error("vista previa:", e);
      toast("No se pudo generar la vista previa.", "error");
    }
  }

  $("#refresh-preview").addEventListener("click", refreshPreview);

  $("#preview-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await refreshPreview();
      $("#preview-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally { btn.disabled = false; }
  });

  $("#generate-btn").addEventListener("click", () => guardar(true));

  /* guarda el reporte; download=false para "guardar y salir" */
  async function guardar(download = true) {
    const data = collectData();
    const problema = validar(data);
    if (problema) {
      toast(problema.msg, "error");
      if (problema.focus) $(problema.focus)?.focus();
      return false;
    }

    const btn = $("#generate-btn");
    btn.disabled = true;
    $("#save-status").textContent = "Guardando…";
    try {
      const conFotos = await Store.uploadPending(data);

      let record;
      if (editingRecord) {
        record = await Store.updateReporte(editingRecord.id, conFotos);
      } else {
        const numero = await Store.nextNumber();
        record = await Store.createReporte({ numero, data: conFotos });
        $("#form-title").textContent = `Editando ${record.numero}`;
        $("#generate-btn-label").textContent = "Guardar cambios y descargar PDF";
      }
      editingRecord = record;
      // las fotos ya viven en el bucket: el formulario trabaja con las rutas
      formHojas = normalizarHojas(conFotos.hojas);

      if (download) await PDFGen.download(await Store.hydrateImages(record));
      formDirty = false;
      $("#save-status").textContent = "✓ Guardado en el historial";
      toast(download ? `Reporte ${record.numero} generado y guardado.` : `Reporte ${record.numero} guardado.`);
      return true;
    } catch (e) {
      console.error(e);
      $("#save-status").textContent = "";
      toast(e.message || "Error al generar el PDF.", "error");
      return false;
    } finally {
      btn.disabled = false;
    }
  }

  /* ============================================================
     HISTORIAL
     ============================================================ */
  let historialCache = [];

  async function renderHistorial() {
    const list = $("#historial-list");
    list.innerHTML = '<div class="empty-state">Cargando…</div>';
    try { historialCache = await Store.listReportes(); }
    catch (e) {
      list.innerHTML = `<div class="empty-state">Error al cargar el historial.<br><small>${escapeHtml(e.message || "")}</small></div>`;
      return;
    }
    drawHistorial();
  }

  function drawHistorial() {
    const q = $("#search-historial").value.trim().toLowerCase();
    const list = $("#historial-list");
    const rows = historialCache.filter((r) => !q ||
      [r.numero, r.proyecto, r.visita].some((s) => String(s || "").toLowerCase().includes(q)));

    if (!rows.length) {
      list.innerHTML = `<div class="empty-state"><div class="es-icon">${window.ICONS.folder}</div>
        ${q ? "Sin resultados para la búsqueda."
            : "Aún no hay reportes. Crea el primero desde «Nuevo reporte»."}</div>`;
      return;
    }

    list.innerHTML = rows.map((r) => {
      const editado = new Date(r.updated_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
      return `
      <div class="hist-card" data-id="${r.id}">
        <div class="hist-icon">${window.ICONS.report}</div>
        <div class="hist-info">
          <strong>${escapeHtml(r.proyecto || "Sin proyecto")}</strong>
          <small>Visita ${escapeHtml(r.visita || "—")} · ${escapeHtml(fechaLarga(r.fecha))} · editado ${editado}</small>
        </div>
        <span class="hist-num">${escapeHtml(r.numero)}</span>
        <div class="hist-actions">
          <button class="btn btn-primary btn-sm" data-act="edit">Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="pdf">PDF</button>
          <button class="icon-btn danger" data-act="del" title="Eliminar">${window.ICONS.trash}</button>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll(".hist-card").forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('[data-act="edit"]').addEventListener("click", async () => {
        try { openForm(await Store.getReporte(id)); }
        catch (e) { toast("No se pudo abrir el reporte.", "error"); }
      });
      card.querySelector('[data-act="pdf"]').addEventListener("click", async (e) => {
        e.target.disabled = true;
        try {
          const rec = await Store.getReporte(id);
          await PDFGen.download(await Store.hydrateImages(rec));
        } catch (ex) {
          toast(ex.message || "No se pudo generar el PDF.", "error");
        } finally { e.target.disabled = false; }
      });
      card.querySelector('[data-act="del"]').addEventListener("click", async () => {
        const rec = historialCache.find((r) => r.id === id);
        const ok = await showConfirm("Eliminar reporte",
          `Se eliminará ${rec.numero} (${rec.proyecto || "sin proyecto"}) junto con sus fotos. Esta acción no se puede deshacer.`);
        if (!ok) return;
        try {
          await Store.deleteReporte(id);
          if (editingRecord && editingRecord.id === id) { editingRecord = null; openForm(null); }
          toast("Reporte eliminado.");
          renderHistorial();
        } catch (e) { toast(e.message || "Error al eliminar.", "error"); }
      });
    });
  }

  $("#search-historial").addEventListener("input", drawHistorial);

  /* ============================================================
     ADMINISTRAR PÁGINA — los proyectos que se ven en el sitio
     ============================================================ */
  let proyectos = [];       // guardados, en el orden en que salen en la web
  let proyEditando = null;   // proyecto abierto en el modal (null = nuevo)
  let proyFotos = [];        // fotos del modal: [{ src, desc }]

  /* un solo <input file> para todo el modal */
  const proyInput = document.createElement("input");
  proyInput.type = "file";
  proyInput.accept = "image/*";
  proyInput.multiple = true;
  proyInput.className = "hidden";
  document.body.appendChild(proyInput);

  async function renderProyectos() {
    const list = $("#proyectos-list");
    list.innerHTML = '<div class="empty-state">Cargando…</div>';
    try { proyectos = await Store.listProyectos(); }
    catch (e) {
      list.innerHTML = `<div class="empty-state">Error al cargar los proyectos.<br><small>${escapeHtml(e.message || "")}</small></div>`;
      return;
    }
    drawProyectos();
  }

  function drawProyectos() {
    const q = $("#search-proyectos").value.trim().toLowerCase();
    const list = $("#proyectos-list");
    const rows = proyectos.filter((p) => !q ||
      [p.nombre, p.descripcion].some((s) => String(s || "").toLowerCase().includes(q)));

    if (!rows.length) {
      list.innerHTML = `<div class="empty-state"><div class="es-icon">${window.ICONS.image}</div>
        ${q ? "Sin resultados para la búsqueda."
            : "Aún no hay proyectos en la web. Crea el primero desde «Nuevo proyecto»."}</div>`;
      return;
    }

    list.innerHTML = rows.map((p) => {
      const i = proyectos.indexOf(p);
      const portada = p.imagenes[0] ? Store.proyectoImageUrl(p.imagenes[0].src) : "";
      const nFotos = p.imagenes.length;
      return `
      <div class="proy-card" data-id="${p.id}">
        <div class="proy-thumb">${portada
          ? `<img src="${escapeHtml(portada)}" alt="" loading="lazy" />`
          : `<span class="proy-thumb-empty">${window.ICONS.image}</span>`}</div>
        <div class="proy-info">
          <strong>${escapeHtml(p.nombre || "Sin nombre")}</strong>
          <small>${escapeHtml(p.descripcion || "Sin descripción")} · ${nFotos} foto${nFotos === 1 ? "" : "s"}</small>
        </div>
        <span class="proy-state ${p.publicado ? "on" : "off"}">${p.publicado ? "Visible" : "Oculto"}</span>
        <div class="proy-move">
          <button class="icon-btn" data-act="up" title="Subir" ${q || i === 0 ? "disabled" : ""}>${window.ICONS.up}</button>
          <button class="icon-btn" data-act="down" title="Bajar" ${q || i === proyectos.length - 1 ? "disabled" : ""}>${window.ICONS.down}</button>
        </div>
        <div class="hist-actions">
          <button class="btn btn-primary btn-sm" data-act="edit">Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="toggle">${p.publicado ? "Ocultar" : "Mostrar"}</button>
          <button class="icon-btn danger" data-act="del" title="Eliminar">${window.ICONS.trash}</button>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll(".proy-card").forEach((card) => {
      const id = card.dataset.id;
      const proy = () => proyectos.find((p) => p.id === id);

      card.querySelector('[data-act="edit"]').addEventListener("click", () => openProyectoModal(proy()));

      card.querySelector('[data-act="toggle"]').addEventListener("click", async (e) => {
        const p = proy();
        e.target.disabled = true;
        try {
          await Store.saveProyecto({ ...p, publicado: !p.publicado });
          p.publicado = !p.publicado;
          toast(p.publicado ? "Proyecto visible en la web." : "Proyecto oculto de la web.");
          drawProyectos();
        } catch (ex) {
          toast(ex.message || "No se pudo cambiar la visibilidad.", "error");
          e.target.disabled = false;
        }
      });

      card.querySelector('[data-act="del"]').addEventListener("click", async () => {
        const p = proy();
        const ok = await showConfirm("Eliminar proyecto",
          `Se quitará «${p.nombre}» de la web junto con sus ${p.imagenes.length} foto(s). Esta acción no se puede deshacer.`);
        if (!ok) return;
        try {
          await Store.deleteProyecto(id);
          proyectos = proyectos.filter((x) => x.id !== id);
          toast("Proyecto eliminado.");
          drawProyectos();
        } catch (e) { toast(e.message || "Error al eliminar.", "error"); }
      });

      card.querySelectorAll('[data-act="up"], [data-act="down"]').forEach((b) =>
        b.addEventListener("click", () => mover(id, b.dataset.act === "up" ? -1 : 1)));
    });
  }

  async function mover(id, paso) {
    const i = proyectos.findIndex((p) => p.id === id);
    const j = i + paso;
    if (i === -1 || j < 0 || j >= proyectos.length) return;
    [proyectos[i], proyectos[j]] = [proyectos[j], proyectos[i]];
    proyectos.forEach((p, k) => { p.orden = k; });
    drawProyectos();   // el orden nuevo se ve enseguida; se guarda detrás
    try { await Store.ordenarProyectos(proyectos.map((p) => p.id)); }
    catch (e) {
      toast("No se pudo guardar el orden.", "error");
      renderProyectos();
    }
  }

  $("#search-proyectos").addEventListener("input", drawProyectos);
  $("#nuevo-proyecto-btn").addEventListener("click", () => openProyectoModal(null));

  /* ----- modal del proyecto ----- */
  function openProyectoModal(p) {
    proyEditando = p || null;
    proyFotos = p ? p.imagenes.map((im) => ({ ...im })) : [];
    $("#proyecto-modal-title").textContent = p ? `Editar «${p.nombre}»` : "Nuevo proyecto";
    $("#proy-nombre").value = p ? p.nombre : "";
    $("#proy-descripcion").value = p ? p.descripcion : "";
    $("#proy-publicado").checked = p ? p.publicado : true;
    $("#proyecto-error").classList.add("hidden");
    drawProyFotos();
    $("#proyecto-modal").classList.remove("hidden");
    $("#proy-nombre").focus();
  }

  function closeProyectoModal() {
    $("#proyecto-modal").classList.add("hidden");
    proyEditando = null;
    proyFotos = [];
  }

  function drawProyFotos() {
    const box = $("#proy-fotos");
    box.innerHTML = proyFotos.map((im, i) => `
      <div class="proy-foto" data-i="${i}">
        <div class="proy-foto-box">
          <img src="${escapeHtml(Store.proyectoImageUrl(im.src))}" alt="Foto ${i + 1}" />
          ${i === 0 ? '<span class="proy-portada">Portada</span>' : ""}
          <button type="button" class="foto-del" data-act="del" title="Quitar foto">×</button>
        </div>
        <div class="proy-foto-tools">
          <button type="button" class="icon-btn" data-act="izq" title="Mover a la izquierda" ${i === 0 ? "disabled" : ""}>‹</button>
          <input type="text" class="foto-desc" maxlength="90" placeholder="Descripción (opcional)" value="${escapeHtml(im.desc)}" />
          <button type="button" class="icon-btn" data-act="der" title="Mover a la derecha" ${i === proyFotos.length - 1 ? "disabled" : ""}>›</button>
        </div>
      </div>`).join("");

    box.querySelectorAll(".proy-foto").forEach((el) => {
      const i = Number(el.dataset.i);
      el.querySelector('[data-act="del"]').addEventListener("click", () => {
        proyFotos.splice(i, 1);
        drawProyFotos();
      });
      el.querySelector(".foto-desc").addEventListener("input", (e) => { proyFotos[i].desc = e.target.value; });
      el.querySelectorAll('[data-act="izq"], [data-act="der"]').forEach((b) =>
        b.addEventListener("click", () => {
          const j = i + (b.dataset.act === "izq" ? -1 : 1);
          if (j < 0 || j >= proyFotos.length) return;
          [proyFotos[i], proyFotos[j]] = [proyFotos[j], proyFotos[i]];
          drawProyFotos();
        }));
    });
  }

  $("#proy-add-foto").addEventListener("click", () => proyInput.click());

  proyInput.addEventListener("change", async () => {
    const files = Array.from(proyInput.files || []);
    proyInput.value = "";
    if (!files.length) return;
    const btn = $("#proy-add-foto");
    btn.disabled = true;
    try {
      for (const file of files) {
        proyFotos.push({ src: await Store.compressImage(file), desc: "" });
      }
      drawProyFotos();
    } catch { toast("No se pudo leer alguna imagen.", "error"); }
    finally { btn.disabled = false; }
  });

  $("#proyecto-modal").querySelector("[data-close-modal]").addEventListener("click", closeProyectoModal);

  $("#proy-save").addEventListener("click", async () => {
    const nombre = $("#proy-nombre").value.trim();
    const err = $("#proyecto-error");
    const fallo = !nombre ? "Escribe el nombre del proyecto."
      : !proyFotos.length ? "Agrega al menos una foto."
      : "";
    if (fallo) {
      err.textContent = fallo;
      err.classList.remove("hidden");
      return;
    }
    err.classList.add("hidden");

    const btn = $("#proy-save");
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const imagenes = await Store.uploadProyectoPending(proyFotos);
      await Store.saveProyecto({
        id: proyEditando ? proyEditando.id : null,
        nombre,
        descripcion: $("#proy-descripcion").value.trim(),
        imagenes,
        publicado: $("#proy-publicado").checked,
        /* uno nuevo va al final de la fila */
        orden: proyEditando ? proyEditando.orden : proyectos.length,
      });
      closeProyectoModal();
      toast("Proyecto guardado. Ya se ve en la web.");
      renderProyectos();
    } catch (e) {
      console.error(e);
      err.textContent = e.message || "No se pudo guardar el proyecto.";
      err.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar proyecto";
    }
  });

  /* ---------- go ---------- */
  boot();
})();
