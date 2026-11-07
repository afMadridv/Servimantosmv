/* Gancho: el problema. Reporte armado a mano, fotos sueltas y un
   número repetido… y la promesa: «del celular al PDF firmado». */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FotoObra } from "../components/Comunes";
import { Fondo } from "../components/Fondo";
import { Icono } from "../components/Icono";
import { useLayout } from "../hooks";
import { body, C, clamp, display } from "../theme";

export const Gancho: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();

  const doc = spring({ frame: f - 4, fps, config: { damping: 12 } });
  const temblor = f > 40 && f < 90 ? Math.sin(f * 1.7) * 6 * u : 0;
  const tacha = interpolate(f, [55, 70], [0, 1], clamp);
  const sale = interpolate(f, [100, 118], [0, 1], clamp);
  const promesa = spring({ frame: f - 108, fps, config: { damping: 13 } });

  const fotos = [0, 1, 2, 3].map((i) => {
    const p = spring({ frame: f - 14 - i * 6, fps, config: { damping: 10 } });
    const ang = [-18, 14, -8, 22][i];
    const x = [-330, 300, -260, 340][i] * u;
    const y = [-300, -240, 260, 220][i] * u;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          width: 260 * u,
          padding: 10 * u,
          background: C.white,
          boxShadow: "0 20px 40px -12px rgba(0,0,0,.5)",
          transform: `translate(${x * p}px, ${y * p - (1 - p) * 600 * u}px) rotate(${ang * p}deg)`,
        }}
      >
        <FotoObra i={i} style={{ width: "100%", height: 170 * u }} />
      </div>
    );
  });

  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - sale, transform: `scale(${1 - 0.15 * sale})` }}>
        {fotos}
        <div
          style={{
            width: 520 * u,
            padding: 36 * u,
            borderRadius: 20 * u,
            background: C.white,
            transform: `scale(${doc}) translateX(${temblor}px) rotate(-3deg)`,
            fontFamily: body,
            boxShadow: "0 30px 70px -20px rgba(0,0,0,.6)",
          }}
        >
          <div style={{ fontSize: 22 * u, color: C.slate2 }}>Reporte_final_v3_DEFINITIVO.docx</div>
          {[90, 70, 85, 60].map((w, i) => (
            <div key={i} style={{ height: 14 * u, width: `${w}%`, borderRadius: 4, background: C.line, marginTop: 18 * u }} />
          ))}
          <div style={{ display: "flex", gap: 16 * u, marginTop: 30 * u }}>
            {["INF-VT-007", "INF-VT-007"].map((n, i) => (
              <div key={i} style={{ position: "relative", fontFamily: display, fontWeight: 800, fontSize: 30 * u, color: C.danger }}>
                {n}
                <div style={{ position: "absolute", left: 0, top: "52%", height: 4 * u, width: `${tacha * 100}%`, background: C.danger }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 * u, fontSize: 22 * u, color: C.danger, opacity: tacha }}>Número repetido</div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: (vertical ? 420 : 90) * u, opacity: 1 - sale }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: (vertical ? 58 : 54) * u, color: C.white, textAlign: "center", padding: `0 ${60 * u}px`, opacity: interpolate(f, [20, 35], [0, 1], clamp) }}>
          Word, fotos sueltas y números repetidos.
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 * u, opacity: promesa }}>
        <div style={{ color: C.orange, transform: `scale(${promesa})` }}>
          <Icono name="report" size={130 * u} stroke={1.6} />
        </div>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontSize: (vertical ? 104 : 110) * u,
            lineHeight: 1.02,
            textAlign: "center",
            color: C.white,
            padding: `0 ${60 * u}px`,
            transform: `translateY(${(1 - promesa) * 60 * u}px)`,
          }}
        >
          Del celular al <span style={{ backgroundImage: C.grad, WebkitBackgroundClip: "text", color: "transparent" }}>PDF firmado</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
