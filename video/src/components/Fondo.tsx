/* Fondo navy con rejilla que avanza y dos luces (naranja y cielo). */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useLayout } from "../hooks";
import { C } from "../theme";

export const Fondo: React.FC = () => {
  const f = useCurrentFrame();
  const { u, width, height } = useLayout();
  const a = Math.sin(f / 55) * 140 * u;
  const b = Math.cos(f / 70) * 160 * u;
  const luz = (color: string, size: number) => ({
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
  });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 25% 15%, ${C.navy2} 0%, ${C.navy} 50%, ${C.night} 100%)`, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
          backgroundSize: `${90 * u}px ${90 * u}px`,
          backgroundPosition: `0 ${f * 0.8}px`,
        }}
      />
      <div style={{ ...luz("rgba(255,106,26,.30)", 900 * u), left: width * 0.62 + a, top: -260 * u + b }} />
      <div style={{ ...luz("rgba(56,189,248,.24)", 1000 * u), left: -320 * u - b, top: height * 0.55 + a }} />
    </AbsoluteFill>
  );
};
