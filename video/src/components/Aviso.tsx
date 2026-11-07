/* Banner del portal (NotificationService.banner) y notificación del
   sistema (la que sale con el portal en segundo plano o por Web Push). */
import { Img, staticFile } from "remotion";
import { body, C, display, Tono, TONOS } from "../theme";
import { Icono } from "./Icono";

const ICONO_TONO: Record<Tono, string> = { ok: "check", info: "users", alerta: "shield", peligro: "shield" };

export const Banner: React.FC<{ s: number; tono: Tono; titulo: string; cuerpo: string; accion?: string; style?: React.CSSProperties }> = ({
  s,
  tono,
  titulo,
  cuerpo,
  accion,
  style,
}) => (
  <div
    style={{
      display: "flex",
      gap: 14 * s,
      padding: 16 * s,
      borderRadius: 18 * s,
      background: C.white,
      boxShadow: `0 ${14 * s}px ${40 * s}px -${12 * s}px rgba(16,47,84,.35)`,
      borderLeft: `${6 * s}px solid ${TONOS[tono]}`,
      fontFamily: body,
      ...style,
    }}
  >
    <div
      style={{
        flexShrink: 0,
        width: 42 * s,
        height: 42 * s,
        borderRadius: "50%",
        background: `${TONOS[tono]}1f`,
        color: TONOS[tono],
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icono name={ICONO_TONO[tono]} size={22 * s} stroke={2.4} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 17 * s, color: C.ink }}>{titulo}</div>
      <div style={{ fontSize: 14 * s, color: C.slate, marginTop: 3 * s, lineHeight: 1.35 }}>{cuerpo}</div>
      {accion && (
        <div style={{ marginTop: 8 * s, fontSize: 14 * s, fontWeight: 700, color: TONOS[tono], fontFamily: display }}>{accion} →</div>
      )}
    </div>
  </div>
);

export const AvisoSistema: React.FC<{ s: number; titulo: string; cuerpo: string; hora: string; style?: React.CSSProperties }> = ({
  s,
  titulo,
  cuerpo,
  hora,
  style,
}) => (
  <div
    style={{
      width: 460 * s,
      display: "flex",
      gap: 16 * s,
      padding: 18 * s,
      borderRadius: 22 * s,
      background: "rgba(18,30,50,.82)",
      border: "1px solid rgba(255,255,255,.14)",
      boxShadow: `0 ${24 * s}px ${60 * s}px -${20 * s}px rgba(0,0,0,.6)`,
      color: C.white,
      fontFamily: body,
      ...style,
    }}
  >
    <div style={{ flexShrink: 0, width: 52 * s, height: 52 * s, borderRadius: 14 * s, background: C.white, display: "grid", placeItems: "center" }}>
      <Img src={staticFile("logo.svg")} style={{ width: 46 * s }} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 * s, color: "rgba(255,255,255,.55)" }}>
        <span>Servimantos</span>
        <span>{hora}</span>
      </div>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 19 * s, marginTop: 4 * s }}>{titulo}</div>
      <div style={{ fontSize: 15 * s, color: "rgba(255,255,255,.75)", marginTop: 3 * s, lineHeight: 1.35 }}>{cuerpo}</div>
    </div>
  </div>
);
