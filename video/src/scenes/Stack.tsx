/* 6 · Bajo el capó: tecnologías reales del proyecto. */
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Kicker, Parrafo, Titulo } from "../components/Comunes";
import { Fondo } from "../components/Fondo";
import { useLayout } from "../hooks";
import { body, C } from "../theme";

const PIEZAS = [
  { t: "HTML · CSS · JS", d: "sin build" },
  { t: "Supabase Auth", d: "admin / trabajador" },
  { t: "Postgres + RLS", d: "7 tablas" },
  { t: "Realtime", d: "avisos en vivo" },
  { t: "Edge Functions", d: "Deno" },
  { t: "Web Push", d: "VAPID" },
  { t: "pdf-lib", d: "PDF en el navegador" },
  { t: "Service Worker", d: "funciona sin señal" },
  { t: "PWA", d: "Android · iOS · PC" },
  { t: "Vercel", d: "deploy en cada push" },
];

export const Stack: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();

  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 56 * u, padding: `0 ${(vertical ? 60 : 160) * u}px` }}>
        <div style={{ textAlign: "center" }}>
          <Kicker size={26 * u}>Bajo el capó</Kicker>
          <div style={{ marginTop: 16 * u }}>
            <Titulo texto="Liviano, seguro e instalable" size={(vertical ? 92 : 90) * u} delay={4} align="center" />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22 * u }}>
          {PIEZAS.map((p, i) => {
            const e = spring({ frame: f - 20 - i * 6, fps, config: { damping: 12 } });
            const ang = (i * 137) % 360;
            const dx = Math.cos((ang * Math.PI) / 180) * 500 * u * (1 - e);
            const dy = Math.sin((ang * Math.PI) / 180) * 500 * u * (1 - e);
            return (
              <div
                key={p.t}
                style={{
                  padding: `${22 * u}px ${32 * u}px`,
                  borderRadius: 24 * u,
                  background: i % 3 === 0 ? "rgba(255,106,26,.16)" : "rgba(255,255,255,.07)",
                  border: `1px solid ${i % 3 === 0 ? "rgba(255,106,26,.5)" : "rgba(255,255,255,.15)"}`,
                  opacity: e,
                  transform: `translate(${dx}px, ${dy}px) scale(${0.5 + 0.5 * e})`,
                  fontFamily: body,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 40 * u, color: C.white }}>{p.t}</div>
                <div style={{ fontSize: 25 * u, color: "rgba(255,255,255,.6)", marginTop: 4 * u }}>{p.d}</div>
              </div>
            );
          })}
        </div>
        <Parrafo size={34 * u} delay={110} align="center">
          Táctil ≥ 48 px · sin scroll horizontal · modo app con safe-area
        </Parrafo>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
