/* 7 · Cierre: crédito y enlaces. */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Fondo } from "../components/Fondo";
import { useLayout } from "../hooks";
import { body, C, clamp, display } from "../theme";

export const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u, vertical } = useLayout();

  const a = spring({ frame: f - 6, fps, config: { damping: 200 } });
  const nombre = spring({ frame: f - 18, fps, config: { damping: 14 } });
  const url = spring({ frame: f - 50, fps, config: { damping: 15 } });
  const sitio = spring({ frame: f - 70, fps, config: { damping: 200 } });
  const negro = interpolate(f, [durationInFrames - 24, durationInFrames], [0, 1], clamp);
  const brillo = interpolate(f, [30, 150], [-30, 130], clamp);

  return (
    <AbsoluteFill>
      <Fondo />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center" }}>
        <div style={{ padding: `${16 * u}px ${24 * u}px`, borderRadius: 28 * u, background: C.white, opacity: a, transform: `scale(${0.8 + 0.2 * a})` }}>
          <Img src={staticFile("logo.svg")} style={{ width: 190 * u, display: "block" }} />
        </div>
        <div style={{ marginTop: 50 * u, fontFamily: body, fontSize: 40 * u, color: "rgba(255,255,255,.7)", opacity: a }}>Desarrollado por</div>
        <div
          style={{
            marginTop: 6 * u,
            fontFamily: display,
            fontWeight: 800,
            fontSize: (vertical ? 150 : 170) * u,
            lineHeight: 1,
            letterSpacing: -4 * u,
            backgroundImage: `linear-gradient(110deg, ${C.orange} ${brillo - 30}%, #fff ${brillo}%, ${C.sky} ${brillo + 30}%)`,
            WebkitBackgroundClip: "text",
            color: "transparent",
            opacity: nombre,
            transform: `scale(${0.7 + 0.3 * nombre})`,
          }}
        >
          {vertical ? (
            <>
              Andrés
              <br />
              Madrid
            </>
          ) : (
            "Andrés Madrid"
          )}
        </div>
        <div
          style={{
            marginTop: 50 * u,
            padding: `${22 * u}px ${44 * u}px`,
            borderRadius: 999,
            background: C.orange,
            color: C.white,
            fontFamily: display,
            fontWeight: 800,
            fontSize: 46 * u,
            opacity: url,
            transform: `translateY(${(1 - url) * 40 * u}px)`,
            boxShadow: `0 ${20 * u}px ${50 * u}px -${16 * u}px rgba(255,106,26,.7)`,
          }}
        >
          andresmadrid.vercel.app
        </div>
        <div style={{ marginTop: 30 * u, fontFamily: body, fontSize: 32 * u, color: "rgba(255,255,255,.55)", opacity: sitio }}>
          Proyecto: servimantosmv.vercel.app
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.night, opacity: negro }} />
    </AbsoluteFill>
  );
};
