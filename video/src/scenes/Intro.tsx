/* 0 · Branding: logo, SERVIMANTOS letra a letra, subtítulo y etiquetas. */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Fondo } from "../components/Fondo";
import { useLayout } from "../hooks";
import { body, C, clamp, display } from "../theme";

const PALABRA = "SERVIMANTOS";
const ETIQUETAS = ["PWA instalable", "PDF en un toque", "Avisos en vivo"];

export const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u, vertical } = useLayout();

  const logo = spring({ frame: f, fps, config: { damping: 13, mass: 0.9 } });
  const barra = interpolate(f, [42, 78], [0, 1], clamp);
  const sub = spring({ frame: f - 58, fps, config: { damping: 200 } });
  const zoom = interpolate(f, [0, durationInFrames], [1, 1.07]);
  const letra = (vertical ? 128 : 196) * u;

  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `scale(${zoom})` }}>
        <div
          style={{
            padding: `${22 * u}px ${34 * u}px`,
            borderRadius: 40 * u,
            background: C.white,
            boxShadow: `0 ${30 * u}px ${80 * u}px -${20 * u}px rgba(0,0,0,.5)`,
            transform: `scale(${logo}) rotate(${(1 - logo) * -8}deg)`,
          }}
        >
          <Img src={staticFile("logo.svg")} style={{ width: (vertical ? 300 : 260) * u, display: "block" }} />
        </div>

        <div style={{ display: "flex", marginTop: 46 * u }}>
          {PALABRA.split("").map((ch, i) => {
            const p = spring({ frame: f - 16 - i * 3, fps, config: { damping: 12 } });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: display,
                  fontWeight: 800,
                  fontSize: letra,
                  letterSpacing: -letra * 0.02,
                  lineHeight: 1,
                  color: C.white,
                  opacity: p,
                  transform: `translateY(${(1 - p) * letra * 0.6}px) rotate(${(1 - p) * 12}deg)`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>

        <div style={{ width: barra * (vertical ? 760 : 1180) * u, height: 12 * u, borderRadius: 99, background: C.grad, marginTop: 26 * u }} />

        <div
          style={{
            marginTop: 34 * u,
            fontFamily: display,
            fontWeight: 600,
            fontSize: (vertical ? 58 : 64) * u,
            color: "rgba(255,255,255,.9)",
            opacity: sub,
            transform: `translateY(${(1 - sub) * 30}px)`,
            textAlign: "center",
          }}
        >
          Portal de Reportes de Obra
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 * u, marginTop: 40 * u, maxWidth: (vertical ? 900 : 1400) * u }}>
          {ETIQUETAS.map((t, i) => {
            const p = spring({ frame: f - 80 - i * 7, fps, config: { damping: 14 } });
            return (
              <div
                key={t}
                style={{
                  padding: `${14 * u}px ${28 * u}px`,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.2)",
                  background: "rgba(255,255,255,.07)",
                  color: C.white,
                  fontFamily: body,
                  fontWeight: 600,
                  fontSize: 32 * u,
                  opacity: p,
                  transform: `scale(${0.6 + 0.4 * p})`,
                }}
              >
                {t}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
