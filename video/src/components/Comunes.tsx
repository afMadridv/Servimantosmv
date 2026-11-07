import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { body, C, clamp, display } from "../theme";

/* Toque de dedo: punto y onda que se abre en (x, y) en el frame `at`. */
export const Toque: React.FC<{ x: number; y: number; at: number; s: number }> = ({ x, y, at, s }) => {
  const f = useCurrentFrame();
  const llega = interpolate(f, [at - 14, at], [0, 1], clamp);
  const onda = interpolate(f, [at, at + 18], [0, 1], clamp);
  const sale = interpolate(f, [at + 14, at + 26], [1, 0], clamp);
  if (f < at - 14 || f > at + 26) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 80, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          width: 90 * s,
          height: 90 * s,
          left: -45 * s,
          top: -45 * s,
          borderRadius: "50%",
          border: `${4 * s}px solid rgba(255,106,26,${0.8 * (1 - onda)})`,
          transform: `scale(${0.3 + onda})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 46 * s,
          height: 46 * s,
          left: -23 * s,
          top: -23 * s,
          borderRadius: "50%",
          background: "rgba(22,36,58,.35)",
          border: `${3 * s}px solid rgba(255,255,255,.9)`,
          opacity: llega * sale,
          transform: `scale(${1.3 - 0.3 * llega - (f >= at && f < at + 6 ? 0.15 : 0)})`,
        }}
      />
    </div>
  );
};

/* Etiqueta pequeña de sección, como la del sitio público. */
export const Kicker: React.FC<{ children: string; size: number; delay?: number }> = ({ children, size, delay = 0 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.6,
        fontFamily: display,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: size * 0.18,
        textTransform: "uppercase",
        color: C.orangeSoft,
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
      }}
    >
      <span style={{ width: size * 2.2, height: size * 0.22, background: C.orange, borderRadius: 99 }} />
      {children}
    </div>
  );
};

/* Título grande con entrada palabra por palabra. */
export const Titulo: React.FC<{ texto: string; size: number; delay?: number; align?: "left" | "center"; color?: string }> = ({
  texto,
  size,
  delay = 0,
  align = "left",
  color = C.white,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        fontFamily: display,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: -size * 0.03,
        color,
        textAlign: align,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: size * 0.26,
      }}
    >
      {texto.split(" ").map((w, i) => {
        const p = spring({ frame: f - delay - i * 4, fps, config: { damping: 16 } });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * size * 0.5}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Parrafo: React.FC<{ children: React.ReactNode; size: number; delay?: number; align?: "left" | "center" }> = ({
  children,
  size,
  delay = 0,
  align = "left",
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ fontFamily: body, fontSize: size, lineHeight: 1.4, color: "rgba(255,255,255,.72)", textAlign: align, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      {children}
    </div>
  );
};

/* Foto de obra simulada: cielo, cubierta y manto (sin fotos reales de clientes). */
const CIELOS = [
  ["#8ec9f2", "#d9eefc"],
  ["#f6c58f", "#fde9d2"],
  ["#9fb6cf", "#e4ecf4"],
  ["#7fc2e8", "#cfe9f8"],
];
export const FotoObra: React.FC<{ i: number; style?: React.CSSProperties }> = ({ i, style }) => {
  const [a, b] = CIELOS[i % CIELOS.length];
  return (
    <svg viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" style={{ display: "block", ...style }}>
      <defs>
        <linearGradient id={`cielo-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="160" height="110" fill={`url(#cielo-${i})`} />
      <polygon points={i % 2 ? "0,70 160,48 160,110 0,110" : "0,52 160,72 160,110 0,110"} fill="#3b4250" />
      <polygon points={i % 2 ? "0,82 160,62 160,110 0,110" : "0,66 160,86 160,110 0,110"} fill={i % 3 ? "#5b4636" : "#c8cdd4"} />
      {[0, 1, 2, 3, 4].map((k) => (
        <line key={k} x1={k * 36 + 10} y1="110" x2={k * 36 + 26} y2={i % 2 ? 72 - k * 3 : 60 + k * 4} stroke="rgba(255,255,255,.18)" strokeWidth="1.5" />
      ))}
      {i === 2 && <rect x="104" y="30" width="12" height="30" fill="#2a2f38" />}
    </svg>
  );
};
