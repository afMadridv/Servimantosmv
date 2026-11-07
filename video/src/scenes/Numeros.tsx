/* 1 · Contadores: lo que hace el portal en cifras reales del código,
   y el consecutivo INF-VT que asigna el servidor (números de demo). */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Kicker, Titulo } from "../components/Comunes";
import { Fondo } from "../components/Fondo";
import { useLayout } from "../hooks";
import { body, C, clamp, display } from "../theme";

const CIFRAS = [
  { n: 4, label: "fotos por hoja", sub: "PDF A4 armado solo" },
  { n: 7, label: "tablas con RLS", sub: "cada quien ve lo suyo" },
  { n: 5, label: "tipos de aviso", sub: "con interruptor propio" },
  { n: 3, label: "vías de aviso", sub: "local · Realtime · Push" },
];

export const Numeros: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();

  const consecutivo = Math.round(interpolate(f, [150, 240], [1, 128], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const cons = spring({ frame: f - 140, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ padding: vertical ? `${200 * u}px ${80 * u}px` : `${110 * u}px ${140 * u}px`, justifyContent: "center", gap: 50 * u }}>
        <div>
          <Kicker size={26 * u}>En cifras</Kicker>
          <div style={{ marginTop: 18 * u }}>
            <Titulo texto="Todo el formato en un solo flujo" size={(vertical ? 96 : 92) * u} delay={6} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: vertical ? "1fr 1fr" : "repeat(4, 1fr)", gap: 26 * u }}>
          {CIFRAS.map((c, i) => {
            const d = 26 + i * 12;
            const p = spring({ frame: f - d, fps, config: { damping: 15 } });
            const n = Math.round(interpolate(f, [d, d + 36], [0, c.n], { ...clamp, easing: Easing.out(Easing.quad) }));
            return (
              <div
                key={c.label}
                style={{
                  padding: 34 * u,
                  borderRadius: 30 * u,
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.12)",
                  opacity: p,
                  transform: `translateY(${(1 - p) * 80 * u}px) scale(${0.9 + 0.1 * p})`,
                }}
              >
                <div style={{ fontFamily: display, fontWeight: 800, fontSize: 150 * u, lineHeight: 1, backgroundImage: C.grad, WebkitBackgroundClip: "text", color: "transparent" }}>
                  {n}
                </div>
                <div style={{ fontFamily: display, fontWeight: 700, fontSize: 38 * u, color: C.white, marginTop: 10 * u }}>{c.label}</div>
                <div style={{ fontFamily: body, fontSize: 26 * u, color: "rgba(255,255,255,.6)", marginTop: 6 * u }}>{c.sub}</div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexDirection: vertical ? "column" : "row",
            gap: vertical ? 10 * u : 40 * u,
            padding: `${28 * u}px ${40 * u}px`,
            borderRadius: 28 * u,
            background: C.white,
            opacity: cons,
            transform: `translateY(${(1 - cons) * 60 * u}px)`,
          }}
        >
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 92 * u, color: C.navy, fontVariantNumeric: "tabular-nums", letterSpacing: -2 * u }}>
            INF-VT-<span style={{ color: C.orange }}>{String(consecutivo).padStart(3, "0")}</span>
          </div>
          <div style={{ fontFamily: body, fontSize: 30 * u, color: C.slate, lineHeight: 1.35, textAlign: vertical ? "center" : "left" }}>
            Consecutivo asignado por el servidor.
            <br />
            Nunca se repite.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
