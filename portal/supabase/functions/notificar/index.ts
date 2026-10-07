// ============================================================
// Edge Function «notificar» · Web Push del portal Servimantos
//
// El portal la llama justo después de registrar un evento:
//   POST { evento_id }   con el token de la sesión del usuario
//
// 1. Valida el token y que el evento sea de ese usuario, reciente
//    y aún no notificado (lo marca en la misma operación, así dos
//    llamadas no mandan dos pushes).
// 2. Elige destinatarios:
//    - login / formato_abierto / formato_completado → administradores
//      (menos quien lo hizo).
//    - login_nuevo_dispositivo → el mismo usuario, en sus OTROS
//      dispositivos.
//    Y de ellos, solo las suscripciones con esa preferencia encendida.
// 3. Manda el push y borra las suscripciones muertas (404/410).
//
// Secretos (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen puestos.
//
// Desplegar con «Verify JWT» APAGADO: el token se valida aquí
// adentro con auth.getUser(), que funciona con cualquier tipo de
// llave del proyecto.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:servimanto10@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* tipo de evento → preferencia de la campanita que lo controla */
const PREF: Record<string, string> = {
  login: "admin_login",
  formato_abierto: "admin_formato_abierto",
  formato_completado: "admin_formato_completado",
  login_nuevo_dispositivo: "seguridad",
};

type Evento = {
  id: number;
  actor_id: string;
  actor_nombre: string;
  tipo: string;
  detalle: Record<string, string>;
  created_at: string;
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

/* Mismo texto que arma el portal (notificaciones.js → mensajeDeEvento). */
function mensaje(ev: Evento) {
  const d = ev.detalle ?? {};
  const quien = ev.actor_nombre || "Alguien del equipo";
  const formato = d.formato_nombre || "un formato";
  const base = { tag: `ev-${ev.id}`, url: "./index.html#formatos" };
  switch (ev.tipo) {
    case "login":
      return { ...base, titulo: `${quien} entró al portal`, cuerpo: `${d.dispositivo || "Dispositivo sin identificar"} · ${hora(ev.created_at)}` };
    case "formato_abierto":
      return { ...base, titulo: `${quien} abrió ${formato}`,
        cuerpo: d.numero ? `Editando ${d.numero}${d.proyecto ? ` · ${d.proyecto}` : ""} · ${hora(ev.created_at)}` : `Empezó uno nuevo · ${hora(ev.created_at)}` };
    case "formato_completado":
      return { ...base, titulo: `${quien} completó ${formato} ${d.numero || ""}`.trim(),
        cuerpo: `${d.proyecto ? `${d.proyecto} · ` : ""}firmado y guardado · ${hora(ev.created_at)}` };
    case "login_nuevo_dispositivo": {
      const f = fecha(ev.created_at);   // termina en «a. m.»: no repetir el punto
      return { ...base, titulo: "Nuevo inicio de sesión en tu cuenta",
        cuerpo: `${d.dispositivo || "Un dispositivo nuevo"} · ${f}${f.endsWith(".") ? "" : "."} Si no fuiste tú, cambia tu contraseña.` };
    }
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "Faltan los secretos VAPID" }, 500);

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1. ¿quién llama?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Sesión no válida" }, 401);

  let eventoId: number;
  try {
    eventoId = Number((await req.json()).evento_id);
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }
  if (!Number.isFinite(eventoId)) return json({ error: "Falta evento_id" }, 400);

  // reclamar el evento: suyo, de hace menos de 2 minutos y sin notificar
  const hace2min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data } = await admin.from("eventos")
    .update({ notificado: true })
    .eq("id", eventoId)
    .eq("actor_id", user.id)
    .eq("notificado", false)
    .gt("created_at", hace2min)
    .select()
    .maybeSingle();
  const ev = data as Evento | null;
  if (!ev) return json({ enviados: 0, motivo: "evento no válido, viejo o ya notificado" });

  const pref = PREF[ev.tipo];
  const msg = mensaje(ev);
  if (!pref || !msg) return json({ enviados: 0, motivo: "tipo sin aviso" });

  // 2. destinatarios
  let subs: Array<{ endpoint: string; p256dh: string; auth: string; device_id: string; prefs: Record<string, boolean> }> = [];
  if (ev.tipo === "login_nuevo_dispositivo") {
    const { data } = await admin.from("push_suscripciones").select("*").eq("user_id", ev.actor_id);
    subs = (data ?? []).filter((s) => s.device_id !== ev.detalle?.device_id);
  } else {
    const { data: admins } = await admin.from("perfiles").select("id").eq("rol", "admin").neq("id", ev.actor_id);
    const ids = (admins ?? []).map((a) => a.id);
    if (ids.length) {
      const { data } = await admin.from("push_suscripciones").select("*").in("user_id", ids);
      subs = data ?? [];
    }
  }
  subs = subs.filter((s) => s.prefs?.[pref] === true);
  if (!subs.length) return json({ enviados: 0, motivo: "nadie con ese aviso encendido" });

  // 3. enviar
  const payload = JSON.stringify(msg);
  const resultados = await Promise.allSettled(subs.map((s) =>
    webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
      { TTL: 60 * 60, urgency: "high" },
    )));

  const muertas = subs
    .filter((_, i) => {
      const r = resultados[i];
      return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
    })
    .map((s) => s.endpoint);
  if (muertas.length) await admin.from("push_suscripciones").delete().in("endpoint", muertas);

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  return json({ enviados, fallidos: resultados.length - enviados, limpiadas: muertas.length });
});
