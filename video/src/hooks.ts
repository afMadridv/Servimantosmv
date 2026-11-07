import { spring, useCurrentFrame, useVideoConfig } from "remotion";

/* vertical = 9:16 (redes), si no 16:9. u = 1 px de diseño a 1080 de lado corto. */
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  return { width, height, vertical: height > width, u: Math.min(width, height) / 1080 };
};

/* Entrada con resorte que arranca en `delay` (frames). */
export const useEntrada = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/* Texto que se va escribiendo: `cps` caracteres por segundo desde `inicio`. */
export const escrito = (texto: string, frame: number, inicio: number, fps: number, cps = 24) =>
  texto.slice(0, Math.max(0, Math.floor(((frame - inicio) / fps) * cps)));
