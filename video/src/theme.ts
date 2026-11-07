/* Marca del portal (portal/css/styles.css) y sus fuentes. */
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const display = loadJakarta("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin"],
}).fontFamily;

export const body = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
}).fontFamily;

export const C = {
  orange: "#ff6a1a",
  orangeSoft: "#ff8a3d",
  orangeTint: "#fff1e7",
  sky: "#38bdf8",
  skyDeep: "#0ea5e9",
  skyTint: "#eaf7ff",
  navy: "#0c2440",
  navy2: "#102f54",
  night: "#07182d",
  ink: "#16243a",
  slate: "#51637a",
  slate2: "#7c8ca3",
  line: "#e6ecf3",
  bg: "#f6f9fc",
  white: "#ffffff",
  danger: "#d64545",
  ok: "#159467",
  grad: "linear-gradient(120deg, #ff6a1a 0%, #ff8a3d 35%, #38bdf8 100%)",
};

export type Tono = "ok" | "info" | "alerta" | "peligro";

export const TONOS: Record<Tono, string> = {
  ok: C.ok,
  info: C.skyDeep,
  alerta: C.orange,
  peligro: C.danger,
};

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
