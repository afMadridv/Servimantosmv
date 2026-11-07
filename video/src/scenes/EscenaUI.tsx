/* Escena de interfaz real: la grabación dentro de un dispositivo y,
   alrededor, título y puntos animados. Vertical → celular + texto
   arriba; horizontal → navegador a la izquierda + texto a la derecha.
   Si falta la grabación, sale un marcador con lo que hay que grabar. */
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Banner } from "../components/Aviso";
import { Kicker, Titulo } from "../components/Comunes";
import { Celular, Portatil } from "../components/Dispositivos";
import { Fondo } from "../components/Fondo";
import { Icono } from "../components/Icono";
import { CLIPS, rutaClip } from "../grabaciones";
import { useLayout } from "../hooks";
import { body, C, clamp, display, Tono } from "../theme";

/* Captura real del portal (public/ui/m-*.png celular, d-*.png escritorio):
   desde qué frame se ve y paneo vertical de inicio a fin (0–100 %). */
export type Captura = { img: string; desde: number; pan?: [number, number] };

type Props = {
  clip: keyof typeof CLIPS;
  capturas?: Captura[];
  kicker: string;
  titulo: string;
  puntos: string[];
  aviso?: { at: number; tono: Tono; titulo: string; cuerpo: string };
};

const Marcador: React.FC<{ id: string; s: number }> = ({ id, s }) => {
  const f = useCurrentFrame();
  const c = CLIPS[id];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14 * s,
        padding: 30 * s,
        textAlign: "center",
        background: `repeating-linear-gradient(45deg, ${C.bg} 0 ${22 * s}px, #edf2f8 ${22 * s}px ${44 * s}px)`,
        backgroundPosition: `${f}px 0`,
        fontFamily: body,
        color: C.slate,
      }}
    >
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 40 * s, color: C.orange }}>{id}</div>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: 24 * s, color: C.ink }}>{c.nombre}</div>
      <div style={{ fontSize: 17 * s, maxWidth: 340 * s }}>Graba: {c.graba}</div>
    </div>
  );
};

const Capturas: React.FC<{ lista: Captura[]; prefijo: "m" | "d" }> = ({ lista, prefijo }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      {lista.map((c, i) => {
        const fin = lista[i + 1]?.desde ?? durationInFrames;
        const op = interpolate(f, [c.desde, c.desde + 12], [0, 1], clamp);
        const [a, b] = c.pan ?? [0, 0];
        const pan = interpolate(f, [c.desde + 10, fin - 10], [a, b], { ...clamp, easing: Easing.inOut(Easing.cubic) });
        return (
          <Img
            key={i}
            src={staticFile(`ui/${prefijo}-${c.img}.png`)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `50% ${pan}%`, opacity: i === 0 ? 1 : op }}
          />
        );
      })}
    </>
  );
};

export const EscenaUI: React.FC<Props> = ({ clip, capturas, kicker, titulo, puntos, aviso }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u, vertical } = useLayout();
  const c = CLIPS[clip];

  // vertical usa la grabación de celular; horizontal prefiere la de escritorio
  const tipo = vertical ? (c.movil ? "movil" : null) : c.escritorio ? "escritorio" : c.movil ? "movil" : null;
  const archivo = tipo && rutaClip(clip, tipo);
  const enCelular = vertical || (!c.escritorio && !!c.movil);
  const entra = spring({ frame: f, fps, config: { damping: 18 } });
  const flotar = Math.sin(f / 24) * 8 * u;

  const video = (s: number) =>
    archivo ? (
      <OffthreadVideo
        src={staticFile(archivo)}
        trimBefore={Math.round(c.desde * fps)}
        playbackRate={c.velocidad}
        muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : capturas ? (
      <Capturas lista={capturas} prefijo={enCelular ? "m" : "d"} />
    ) : (
      <Marcador id={clip} s={s} />
    );

  const W = enCelular ? (vertical ? 600 : 440) * u : 1120 * u;
  const dispositivo = enCelular ? (
    <Celular width={W}>{video(W / 430)}</Celular>
  ) : (
    <Portatil width={W} url="servimantosmv.vercel.app/portal/">
      {video(W / 700)}
    </Portatil>
  );

  const lista = (
    <div style={{ display: "flex", flexDirection: vertical ? "row" : "column", flexWrap: "wrap", justifyContent: vertical ? "center" : "flex-start", gap: (vertical ? 14 : 22) * u }}>
      {puntos.map((p, i) => {
        const at = 20 + i * Math.floor((durationInFrames - 60) / Math.max(puntos.length, 1));
        const e = spring({ frame: f - at, fps, config: { damping: 14 } });
        return (
          <div
            key={p}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14 * u,
              padding: vertical ? `${12 * u}px ${22 * u}px` : 0,
              borderRadius: 999,
              background: vertical ? "rgba(255,255,255,.08)" : "transparent",
              opacity: e,
              transform: `translateX(${(1 - e) * 40 * u}px)`,
              fontFamily: body,
              fontWeight: 600,
              fontSize: (vertical ? 30 : 38) * u,
              color: C.white,
            }}
          >
            <span style={{ width: 40 * u, height: 40 * u, borderRadius: "50%", background: C.orange, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icono name="check" size={24 * u} stroke={3} color={C.white} />
            </span>
            {p}
          </div>
        );
      })}
    </div>
  );

  const avisoEl = aviso && (() => {
    const e = spring({ frame: f - aviso.at, fps, config: { damping: 15 } });
    return (
      <div
        style={{
          position: "absolute",
          zIndex: 60,
          width: (vertical ? 820 : 560) * u,
          left: vertical ? 130 * u : undefined,
          right: vertical ? undefined : 90 * u,
          top: vertical ? undefined : 90 * u,
          bottom: vertical ? 420 * u : undefined,
          opacity: e,
          transform: `translateY(${(1 - e) * -80 * u}px)`,
        }}
      >
        <Banner s={(vertical ? 1.7 : 1.2) * u} tono={aviso.tono} titulo={aviso.titulo} cuerpo={aviso.cuerpo} />
      </div>
    );
  })();

  return (
    <AbsoluteFill>
      <Fondo />
      {vertical ? (
        /* zona segura de Reels: nada importante en los 250 px de arriba ni los 380 de abajo */
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 230 * u, gap: 34 * u }}>
          <div style={{ textAlign: "center", padding: `0 ${60 * u}px` }}>
            <Kicker size={24 * u}>{kicker}</Kicker>
            <div style={{ marginTop: 12 * u }}>
              <Titulo texto={titulo} size={70 * u} delay={4} align="center" />
            </div>
          </div>
          <div style={{ transform: `translateY(${(1 - entra) * 500 * u + flotar}px) scale(.92)`, transformOrigin: "top center" }}>{dispositivo}</div>
          <div style={{ position: "absolute", bottom: 250 * u, left: 50 * u, right: 50 * u }}>{lista}</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 90 * u, padding: `0 ${100 * u}px` }}>
          <div style={{ transform: `translateX(${(1 - entra) * -300 * u}px) translateY(${flotar}px)`, opacity: entra }}>{dispositivo}</div>
          <div style={{ flex: 1, maxWidth: 620 * u }}>
            <Kicker size={24 * u}>{kicker}</Kicker>
            <div style={{ margin: `${14 * u}px 0 ${40 * u}px` }}>
              <Titulo texto={titulo} size={66 * u} delay={4} />
            </div>
            {lista}
          </div>
        </AbsoluteFill>
      )}
      {avisoEl}
    </AbsoluteFill>
  );
};
