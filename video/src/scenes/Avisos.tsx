/* 5 · Avisos: celular con el historial (expedientes), banners que entran,
   campanita con contador, avisos del sistema flotando y preferencias. */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AvisoSistema, Banner } from "../components/Aviso";
import { Kicker, Titulo } from "../components/Comunes";
import { BarraPortal, Celular } from "../components/Dispositivos";
import { Fondo } from "../components/Fondo";
import { Icono } from "../components/Icono";
import { useLayout } from "../hooks";
import { body, C, clamp, display, Tono } from "../theme";

const HISTORIAL = [
  { n: "INF-VT-014", p: "Edificio Altamar · Torre 2", c: "OS-26-031" },
  { n: "INF-VT-013", p: "Conjunto Brisas del Mar", c: "OS-26-029" },
  { n: "INF-VT-012", p: "Bodega Zona Franca", c: "OS-26-027" },
  { n: "INF-VT-011", p: "Colegio La Esperanza", c: "OS-26-024" },
  { n: "INF-VT-010", p: "Hotel Rodadero Sur", c: "OS-26-020" },
];

const BANNERS: { at: number; tono: Tono; titulo: string; cuerpo: string; accion?: string }[] = [
  { at: 40, tono: "ok", titulo: "Reporte INF-VT-014 listo", cuerpo: "Generado y descargado.", accion: "Ver historial" },
  { at: 105, tono: "info", titulo: "Laura completó un formato", cuerpo: "Reporte de Obra · Conjunto Brisas del Mar" },
  { at: 170, tono: "alerta", titulo: "Nuevo inicio de sesión", cuerpo: "Chrome en Android (móvil) · 7:58 a. m." },
];

const SISTEMA = [
  { at: 70, titulo: "Un trabajador entró al portal", cuerpo: "Laura · Chrome en Windows", hora: "ahora" },
  { at: 140, titulo: "Formato completado", cuerpo: "INF-VT-013 · Conjunto Brisas del Mar", hora: "1 min" },
];

const PREFS = ["Formato generado o descargado", "Dispositivo nuevo", "Un trabajador entra", "Un trabajador completa un formato"];

export const Avisos: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();

  const W = (vertical ? 600 : 400) * u;
  const s = W / 430;
  const entra = spring({ frame: f, fps, config: { damping: 18 } });
  const badge = BANNERS.filter((b) => f >= b.at).length + SISTEMA.filter((b) => f >= b.at).length;
  const ultimo = Math.max(...[...BANNERS, ...SISTEMA].map((b) => (f >= b.at ? b.at : -999)));
  const sacudir = interpolate(f - ultimo, [0, 6, 12, 18, 24], [0, 16, -12, 6, 0], clamp);
  const hoja = spring({ frame: f - 250, fps, config: { damping: 18 } });

  const pantalla = (
    <>
      <BarraPortal s={s} badge={badge} sacudir={sacudir} />
      <div style={{ padding: 20 * s }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 28 * s, color: C.ink }}>Historial</div>
        <div style={{ marginTop: 10 * s, height: 42 * s, borderRadius: 12 * s, border: `1px solid ${C.line}`, background: C.white, display: "flex", alignItems: "center", padding: `0 ${12 * s}px`, fontFamily: body, fontSize: 13 * s, color: C.slate2 }}>
          Buscar por proyecto, número o código…
        </div>
        {HISTORIAL.map((h, i) => {
          const p = spring({ frame: f - 10 - i * 5, fps, config: { damping: 200 } });
          return (
            <div
              key={h.n}
              style={{
                marginTop: 10 * s,
                padding: 14 * s,
                borderRadius: 14 * s,
                background: C.white,
                border: `1px solid ${C.line}`,
                display: "flex",
                alignItems: "center",
                gap: 12 * s,
                opacity: p,
                transform: `translateY(${(1 - p) * 30 * s}px)`,
              }}
            >
              <div style={{ width: 40 * s, height: 40 * s, borderRadius: 12 * s, background: C.orangeTint, color: C.orange, display: "grid", placeItems: "center" }}>
                <Icono name="folder" size={20 * s} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 15 * s, color: C.ink }}>{h.n}</div>
                <div style={{ fontFamily: body, fontSize: 12.5 * s, color: C.slate, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {h.p} · {h.c}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* banners del portal, apilados arriba */}
      <div style={{ position: "absolute", top: 120 * s, left: 14 * s, right: 14 * s, display: "flex", flexDirection: "column", gap: 10 * s, zIndex: 20 }}>
        {BANNERS.map((b) => {
          const p = spring({ frame: f - b.at, fps, config: { damping: 15 } });
          const fuera = interpolate(f, [235, 255], [0, 1], clamp);
          if (f < b.at) return null;
          return (
            <div key={b.titulo} style={{ opacity: p * (1 - fuera), transform: `translateY(${(1 - p) * -120 * s - fuera * 40 * s}px)` }}>
              <Banner s={s} tono={b.tono} titulo={b.titulo} cuerpo={b.cuerpo} accion={b.accion} />
            </div>
          );
        })}
      </div>

      {/* panel de preferencias como hoja inferior */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          padding: `${22 * s}px ${22 * s}px ${36 * s}px`,
          borderRadius: `${26 * s}px ${26 * s}px 0 0`,
          background: C.white,
          boxShadow: "0 -20px 50px -20px rgba(12,36,64,.45)",
          transform: `translateY(${(1 - hoja) * 110}%)`,
        }}
      >
        <div style={{ width: 50 * s, height: 5 * s, borderRadius: 99, background: C.line, margin: `0 auto ${16 * s}px` }} />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 22 * s, color: C.ink }}>Preferencias</div>
        {PREFS.map((p, i) => {
          const on = interpolate(f, [275 + i * 14, 285 + i * 14], [0, 1], clamp);
          return (
            <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 * s, fontFamily: body, fontSize: 14.5 * s, color: C.ink }}>
              {p}
              <div style={{ width: 50 * s, height: 30 * s, borderRadius: 99, background: on > 0.5 ? C.ok : C.line, padding: 3 * s, boxSizing: "border-box" }}>
                <div style={{ width: 24 * s, height: 24 * s, borderRadius: "50%", background: C.white, transform: `translateX(${on * 20 * s}px)`, boxShadow: "0 2px 6px rgba(0,0,0,.2)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const flotantes = SISTEMA.map((n, i) => {
    const p = spring({ frame: f - n.at, fps, config: { damping: 14 } });
    const vaiven = Math.sin((f + i * 40) / 25) * 12 * u;
    const pos: React.CSSProperties = vertical
      ? { left: i === 0 ? 50 * u : undefined, right: i === 1 ? 50 * u : undefined, top: i === 0 ? 380 * u : undefined, bottom: i === 1 ? 140 * u : undefined }
      : { left: i === 0 ? 120 * u : undefined, right: i === 1 ? 110 * u : undefined, top: i === 0 ? 470 * u : 640 * u };
    return (
      <div key={n.titulo} style={{ position: "absolute", ...pos, zIndex: 40, opacity: p, transform: `translateY(${vaiven}px) scale(${0.7 + 0.3 * p})` }}>
        <AvisoSistema s={(vertical ? 1.45 : 1.1) * u} titulo={n.titulo} cuerpo={n.cuerpo} hora={n.hora} />
      </div>
    );
  });

  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: (vertical ? 130 : 70) * u }}>
        <div style={{ textAlign: "center" }}>
          <Kicker size={24 * u}>NotificationService</Kicker>
          <div style={{ marginTop: 12 * u }}>
            <Titulo texto="Avisos en vivo, aunque esté cerrado" size={(vertical ? 74 : 60) * u} delay={4} align="center" />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: (vertical ? 70 : 24) * u }}>
        <div style={{ transform: `translateY(${(1 - entra) * 500 * u}px)` }}>
          <Celular width={W}>{pantalla}</Celular>
        </div>
      </AbsoluteFill>
      {flotantes}
    </AbsoluteFill>
  );
};
