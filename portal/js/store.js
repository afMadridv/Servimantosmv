/* ============================================================
   Capa de datos: Supabase (producción) o localStorage (demo).
   La app solo habla con `Store`, nunca con Supabase directo.

   El portal es de UN SOLO usuario: no hay roles ni gestión de
   trabajadores. El nombre que se muestra sale de los metadatos
   del usuario de Supabase (`full_name`), así que no hace falta
   una tabla de perfiles.
   ============================================================ */
(function () {
  const DEMO_KEYS = {
    user: "sm_user", reps: "sm_reportes", session: "sm_session", seq: "sm_seq",
    proys: "sm_proyectos",
  };
  const SIGNED_TTL = 3600;        // segundos que vive una URL firmada
  const signedUrls = new Map();   // ruta → { url, expira }
  let sb = null;                  // cliente supabase
  let currentProfile = null;

  /* ---------- utilidades ---------- */
  function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function uid() { return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }

  /* cliente supabase con almacenamiento según "mantener sesión" */
  function makeClient(keep) {
    return window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
      auth: { storage: keep ? window.localStorage : window.sessionStorage },
    });
  }

  function perfilDeSesion(user) {
    const meta = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email,
      name: meta.full_name || meta.name || (user.email || "").split("@")[0],
    };
  }

  /* Comprime una imagen a JPEG máx 1600px: las fotos de obra salen
     a página completa, así que se guardan con algo más de detalle
     que una miniatura pero sin que el reporte pese de más. */
  function compressImage(file, maxSize = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const scale = maxSize / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function dataURLtoBlob(dataURL) {
    const [meta, b64] = dataURL.split(",");
    const mime = meta.match(/data:(.*?);/)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* Recorre las fotos de todas las hojas. `fn` recibe cada foto y,
     si devuelve algo, lo reemplaza. Se usa para firmar las URLs
     antes de generar el PDF y para subir las fotos nuevas. */
  async function mapFotos(hojas, fn) {
    const out = [];
    for (const hoja of hojas || []) {
      const fotos = [];
      for (const foto of hoja.fotos || []) {
        if (!foto || !foto.src) { fotos.push(foto); continue; }
        fotos.push((await fn(foto)) || foto);
      }
      out.push({ ...hoja, fotos });
    }
    return out;
  }

  /* Las imágenes de un proyecto pueden venir como texto suelto (una
     ruta) o como { src, desc }: adentro siempre se trabaja con objetos. */
  function normalizarProyecto(p) {
    const imagenes = (Array.isArray(p.imagenes) ? p.imagenes : [])
      .map((im) => (typeof im === "string" ? { src: im, desc: "" } : { src: im?.src || "", desc: im?.desc || "" }))
      .filter((im) => im.src);
    return {
      id: p.id,
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      imagenes,
      orden: p.orden ?? 0,
      publicado: p.publicado !== false,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  /* Antes todo fallo de login decía «usuario o contraseña incorrectos»,
     incluso cuando el problema era otro (usuario sin confirmar, key mal
     puesta, sin internet) y no había forma de saberlo desde el portal. */
  function mensajeLogin(error) {
    const code = error?.code || error?.error_code || "";
    const msg = String(error?.message || "");
    if (code === "email_not_confirmed")
      return "El usuario existe pero no está confirmado. Confírmalo en Supabase → Authentication → Users.";
    if (code === "invalid_credentials")
      return "Correo o contraseña incorrectos.";
    if (code === "user_not_found")
      return "Ese correo no existe en este proyecto de Supabase.";
    if (code === "over_request_rate_limit" || error?.status === 429)
      return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar.";
    if (error?.status === 401 || /api key/i.test(msg))
      return "La API key del portal no sirve para este proyecto. Revisa config.js.";
    if (/fetch|network/i.test(msg))
      return "Sin conexión con el servidor. Revisa internet o la URL de config.js.";
    return msg || "No fue posible iniciar sesión.";
  }

  /* URL de una foto del bucket público de proyectos. */
  function publicImageUrl(ref) {
    if (!ref) return "";
    const s = String(ref);
    if (s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("http")) return s;
    return `${APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/${APP_CONFIG.PROYECTOS_BUCKET}/${s}`;
  }

  /* ---------- semilla del modo demo ---------- */
  function seedDemo() {
    if (!lsGet(DEMO_KEYS.user, null)) {
      lsSet(DEMO_KEYS.user, { id: uid(), name: "Servimantos Demo", email: "demo@servimantos.com", password: "demo1234" });
    }
    if (!lsGet(DEMO_KEYS.reps, null)) lsSet(DEMO_KEYS.reps, []);
    if (!lsGet(DEMO_KEYS.proys, null)) lsSet(DEMO_KEYS.proys, []);
  }

  /* ============================================================ */
  const Store = {
    isDemo: window.IS_DEMO,

    async init() {
      if (this.isDemo) {
        seedDemo();
        const sess = lsGet(DEMO_KEYS.session, null);
        const user = lsGet(DEMO_KEYS.user, null);
        if (sess && user && sess.id === user.id) {
          currentProfile = { id: user.id, name: user.name, email: user.email };
        }
        return currentProfile;
      }
      sb = makeClient(localStorage.getItem("sm_keep") !== "0");
      const { data: { session } } = await sb.auth.getSession();
      if (session) currentProfile = perfilDeSesion(session.user);
      return currentProfile;
    },

    getProfile() { return currentProfile; },

    /* ---------- autenticación ---------- */
    async login(email, password, keep = true) {
      const correo = String(email || "").trim();
      if (this.isDemo) {
        const user = lsGet(DEMO_KEYS.user, null);
        if (!user || user.email.toLowerCase() !== correo.toLowerCase() || user.password !== password)
          throw new Error("Usuario o contraseña incorrectos.");
        currentProfile = { id: user.id, name: user.name, email: user.email };
        lsSet(DEMO_KEYS.session, { id: user.id });
        return currentProfile;
      }
      localStorage.setItem("sm_keep", keep ? "1" : "0");
      sb = makeClient(keep);
      const { data, error } = await sb.auth.signInWithPassword({ email: correo, password });
      if (error) throw new Error(mensajeLogin(error));
      currentProfile = perfilDeSesion(data.user);
      return currentProfile;
    },

    async logout() {
      if (this.isDemo) localStorage.removeItem(DEMO_KEYS.session);
      else await sb.auth.signOut();
      currentProfile = null;
    },

    /* ---------- reportes ---------- */
    /* El número lo entrega el servidor (tabla consecutivos): así no
       se puede repetir aunque se generen dos reportes a la vez. */
    async nextNumber() {
      const prefijo = APP_CONFIG.REPORTE.prefijo;
      if (this.isDemo) {
        const n = (lsGet(DEMO_KEYS.seq, 0) || 0) + 1;
        lsSet(DEMO_KEYS.seq, n);
        return `${prefijo}-${String(n).padStart(3, "0")}`;
      }
      const { data, error } = await sb.rpc("siguiente_numero", { p_prefijo: prefijo });
      if (error) throw new Error("No se pudo asignar el número del reporte.");
      return data;
    },

    /* El historial solo necesita la cabecera: pedir `data` completa
       traería todas las fotos del histórico en cada carga. */
    async listReportes() {
      if (this.isDemo) {
        return lsGet(DEMO_KEYS.reps, [])
          .slice()
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .map((r) => ({
            id: r.id, numero: r.numero, created_at: r.created_at, updated_at: r.updated_at,
            proyecto: r.data?.proyecto || "", visita: r.data?.visita || "", fecha: r.data?.fecha || "",
          }));
      }
      const PAGE = 1000;
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb
          .from("reportes")
          .select("id, numero, created_at, updated_at, proyecto:data->>proyecto, visita:data->>visita, fecha:data->>fecha")
          .order("updated_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      return rows;
    },

    async getReporte(id) {
      if (this.isDemo) return lsGet(DEMO_KEYS.reps, []).find((r) => r.id === id) || null;
      const { data, error } = await sb.from("reportes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },

    async createReporte({ numero, data }) {
      const now = new Date().toISOString();
      if (this.isDemo) {
        const rec = { id: uid(), numero, data, user_id: currentProfile.id, created_at: now, updated_at: now };
        const all = lsGet(DEMO_KEYS.reps, []);
        all.push(rec);
        lsSet(DEMO_KEYS.reps, all);
        return rec;
      }
      const { data: row, error } = await sb
        .from("reportes")
        .insert({ numero, data, user_id: currentProfile.id })
        .select().single();
      if (error) throw error;
      return row;
    },

    async updateReporte(id, data) {
      const now = new Date().toISOString();
      if (this.isDemo) {
        const all = lsGet(DEMO_KEYS.reps, []);
        const idx = all.findIndex((r) => r.id === id);
        if (idx === -1) throw new Error("Reporte no encontrado.");
        all[idx].data = data;
        all[idx].updated_at = now;
        lsSet(DEMO_KEYS.reps, all);
        return all[idx];
      }
      const { data: row, error } = await sb
        .from("reportes")
        .update({ data, updated_at: now })
        .eq("id", id).select().single();
      if (error) throw error;
      return row;
    },

    async deleteReporte(id) {
      if (this.isDemo) {
        lsSet(DEMO_KEYS.reps, lsGet(DEMO_KEYS.reps, []).filter((r) => r.id !== id));
        return;
      }
      // primero se lee: si no, las fotos quedan en el bucket para siempre
      const rec = await this.getReporte(id).catch(() => null);
      const { error } = await sb.from("reportes").delete().eq("id", id);
      if (error) throw error;
      await this._deleteImages(rec);
    },

    /* ---------- proyectos de la página web ---------- */
    /* Estos NO son los reportes: son las cajas que se ven en la
       sección «Proyectos» del sitio público. El visitante los lee
       sin sesión, así que sus fotos van a un bucket público. */

    async listProyectos() {
      if (this.isDemo) {
        return lsGet(DEMO_KEYS.proys, [])
          .slice()
          .sort((a, b) => (a.orden - b.orden) || (new Date(a.created_at) - new Date(b.created_at)))
          .map(normalizarProyecto);
      }
      const { data, error } = await sb
        .from("proyectos")
        .select("*")
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map(normalizarProyecto);
    },

    /* Sin id crea; con id actualiza. Devuelve el registro guardado. */
    async saveProyecto(proy) {
      const fila = {
        nombre: String(proy.nombre || "").trim(),
        descripcion: String(proy.descripcion || "").trim(),
        imagenes: (proy.imagenes || []).map((im) => ({ src: im.src, desc: String(im.desc || "").trim() })),
        publicado: proy.publicado !== false,
        orden: Number.isFinite(proy.orden) ? proy.orden : 0,
      };
      if (this.isDemo) {
        const all = lsGet(DEMO_KEYS.proys, []);
        const now = new Date().toISOString();
        if (proy.id) {
          const idx = all.findIndex((p) => p.id === proy.id);
          if (idx === -1) throw new Error("Proyecto no encontrado.");
          all[idx] = { ...all[idx], ...fila, updated_at: now };
          lsSet(DEMO_KEYS.proys, all);
          return normalizarProyecto(all[idx]);
        }
        const rec = { id: uid(), ...fila, user_id: currentProfile.id, created_at: now, updated_at: now };
        all.push(rec);
        lsSet(DEMO_KEYS.proys, all);
        return normalizarProyecto(rec);
      }
      if (proy.id) {
        const { data, error } = await sb
          .from("proyectos").update(fila).eq("id", proy.id).select().single();
        if (error) throw error;
        return normalizarProyecto(data);
      }
      const { data, error } = await sb
        .from("proyectos").insert({ ...fila, user_id: currentProfile.id }).select().single();
      if (error) throw error;
      return normalizarProyecto(data);
    },

    async deleteProyecto(id) {
      if (this.isDemo) {
        lsSet(DEMO_KEYS.proys, lsGet(DEMO_KEYS.proys, []).filter((p) => p.id !== id));
        return;
      }
      // se lee antes de borrar: si no, las fotos quedan en el bucket
      const { data: rec } = await sb.from("proyectos").select("imagenes").eq("id", id).single();
      const { error } = await sb.from("proyectos").delete().eq("id", id);
      if (error) throw error;
      const rutas = (rec?.imagenes || [])
        .map((im) => (typeof im === "string" ? im : im && im.src))
        .filter((v) => typeof v === "string" && !v.startsWith("data:") && !v.startsWith("http") && v.includes("/"));
      if (rutas.length) {
        try { await sb.storage.from(APP_CONFIG.PROYECTOS_BUCKET).remove(rutas); }
        catch (e) { console.warn("No se pudieron borrar las fotos del proyecto:", e); }
      }
    },

    /* Guarda el orden que quedó en pantalla: la posición en el array
       es el `orden` de cada proyecto. */
    async ordenarProyectos(ids) {
      if (this.isDemo) {
        const all = lsGet(DEMO_KEYS.proys, []);
        ids.forEach((id, i) => {
          const p = all.find((x) => x.id === id);
          if (p) p.orden = i;
        });
        lsSet(DEMO_KEYS.proys, all);
        return;
      }
      for (let i = 0; i < ids.length; i++) {
        const { error } = await sb.from("proyectos").update({ orden: i }).eq("id", ids[i]);
        if (error) throw error;
      }
    },

    async uploadProyectoImage(dataURL) {
      if (this.isDemo) return dataURL;
      const blob = dataURLtoBlob(dataURL);
      const path = `${currentProfile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage
        .from(APP_CONFIG.PROYECTOS_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      return path;
    },

    /* El bucket es público: la URL se arma sola y no caduca, así que
       no hace falta firmarla ni esperar (a diferencia de las fotos de
       obra, que sí son privadas). */
    proyectoImageUrl: publicImageUrl,

    /* Sube las fotos nuevas (las que todavía son dataURL). */
    async uploadProyectoPending(imagenes) {
      const out = [];
      for (const im of imagenes || []) {
        if (!im || !im.src) continue;
        out.push({
          ...im,
          src: String(im.src).startsWith("data:") ? await this.uploadProyectoImage(im.src) : im.src,
        });
      }
      return out;
    },

    /* ---------- imágenes ---------- */
    compressImage,

    /* Guarda la RUTA dentro del bucket, no una URL: el bucket es
       privado y cada vez que hay que mostrar la foto se firma una
       URL temporal. */
    async uploadImage(dataURL) {
      if (this.isDemo) return dataURL;
      const blob = dataURLtoBlob(dataURL);
      const path = `${currentProfile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage
        .from(APP_CONFIG.STORAGE_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      return path;
    },

    async imageUrl(ref) {
      if (!ref) return "";
      const s = String(ref);
      if (this.isDemo || s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("http")) return s;
      const hit = signedUrls.get(s);
      if (hit && hit.expira > Date.now()) return hit.url;
      const { data, error } = await sb.storage
        .from(APP_CONFIG.STORAGE_BUCKET)
        .createSignedUrl(s, SIGNED_TTL);
      if (error) throw error;
      signedUrls.set(s, { url: data.signedUrl, expira: Date.now() + (SIGNED_TTL - 300) * 1000 });
      return data.signedUrl;
    },

    /* Copia del registro con las fotos ya firmadas, lista para el PDF.
       El registro original conserva las rutas, que es lo que se guarda. */
    async hydrateImages(record) {
      const data = { ...(record.data || {}) };
      data.hojas = await mapFotos(data.hojas, async (foto) => ({
        ...foto, src: await this.imageUrl(foto.src),
      }));
      return { ...record, data };
    },

    /* Sube al bucket las fotos nuevas (las que aún son dataURL). */
    async uploadPending(data) {
      const copia = { ...data };
      copia.hojas = await mapFotos(data.hojas, async (foto) => ({
        ...foto,
        src: String(foto.src).startsWith("data:") ? await this.uploadImage(foto.src) : foto.src,
      }));
      return copia;
    },

    /* Borra del bucket las fotos de un reporte eliminado. */
    async _deleteImages(record) {
      if (this.isDemo || !record) return;
      const rutas = [];
      for (const hoja of record.data?.hojas || []) {
        for (const foto of hoja.fotos || []) {
          const v = foto && foto.src;
          if (typeof v === "string" && !v.startsWith("data:") && !v.startsWith("http") && v.includes("/")) {
            rutas.push(v);
          }
        }
      }
      if (!rutas.length) return;
      try { await sb.storage.from(APP_CONFIG.STORAGE_BUCKET).remove(rutas); }
      catch (e) { console.warn("No se pudieron borrar las fotos:", e); }
    },
  };

  window.Store = Store;
})();
