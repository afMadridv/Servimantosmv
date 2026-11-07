/* Línea de tiempo (~87 s): motion graphics + grabaciones reales de la UI.
   Total = suma de escenas − transiciones (se solapan). Guion: GUION.md. */
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { useLayout } from "./hooks";
import { Avisos } from "./scenes/Avisos";
import { EscenaUI } from "./scenes/EscenaUI";
import { Gancho } from "./scenes/Gancho";
import { Intro } from "./scenes/Intro";
import { Numeros } from "./scenes/Numeros";
import { Outro } from "./scenes/Outro";
import { Pdf } from "./scenes/Pdf";
import { Stack } from "./scenes/Stack";

export const FPS = 30;
const TRANSICION = 15;

const ESCENAS: { id: string; frames: number; Escena: React.FC }[] = [
  { id: "gancho", frames: 150, Escena: Gancho },
  { id: "intro", frames: 120, Escena: Intro },
  { id: "numeros", frames: 250, Escena: Numeros },
  {
    id: "rec01", frames: 180,
    Escena: () => <EscenaUI clip="REC-01" capturas={[{ img: "login", desde: 0 }, { img: "formatos", desde: 80 }]} kicker="Interfaz real" titulo="Entra y elige el formato" puntos={["Correo y contraseña", "Un toque por formato"]} />,
  },
  {
    id: "rec02", frames: 210,
    Escena: () => <EscenaUI clip="REC-02" capturas={[{ img: "form", desde: 0, pan: [0, 22] }]} kicker="Reporte de Obra" titulo="Datos en segundos" puntos={["Fecha automática", "Casilla libre para el código", "Avisa si falta algo"]} />,
  },
  {
    id: "rec03", frames: 210,
    Escena: () => <EscenaUI clip="REC-03" capturas={[{ img: "form", desde: 0, pan: [36, 56] }]} kicker="Hojas de fotos" titulo="4 fotos por hoja" puntos={["Comprimidas en el celular", "Descripción en cada foto", "Hojas ilimitadas"]} />,
  },
  { id: "pdf", frames: 320, Escena: Pdf },
  {
    id: "rec04", frames: 180,
    Escena: () => (
      <EscenaUI
        clip="REC-04" capturas={[{ img: "form", desde: 0, pan: [58, 74] }]}
        kicker="Generar"
        titulo="Vista previa y descarga"
        puntos={["Consecutivo del servidor", "Firma incluida"]}
        aviso={{ at: 110, tono: "ok", titulo: "Reporte INF-VT-014 listo", cuerpo: "Generado y descargado." }}
      />
    ),
  },
  { id: "avisos", frames: 330, Escena: Avisos },
  {
    id: "rec05", frames: 180,
    Escena: () => <EscenaUI clip="REC-05" capturas={[{ img: "historial", desde: 0 }]} kicker="Historial" titulo="Edita sin volver a empezar" puntos={["Busca por proyecto o código", "Regenera el PDF"]} />,
  },
  {
    id: "rec06", frames: 240,
    Escena: () => <EscenaUI clip="REC-06" capturas={[{ img: "pagina", desde: 0, pan: [0, 40] }]} kicker="Administrar página" titulo="Del portal a la web" puntos={["Proyectos con fotos", "Ordenar y ocultar", "Sin volver a publicar"]} />,
  },
  { id: "stack", frames: 210, Escena: Stack },
  { id: "outro", frames: 210, Escena: Outro },
];

export const DURACION = ESCENAS.reduce((t, e) => t + e.frames, 0) - TRANSICION * (ESCENAS.length - 1);

export const Servimantos: React.FC = () => {
  const { vertical } = useLayout();
  const resorte = springTiming({ config: { damping: 200 }, durationInFrames: TRANSICION });
  const lineal = linearTiming({ durationInFrames: TRANSICION });

  const transicion = (i: number) => {
    const key = `t-${i}`;
    switch (i % 3) {
      case 0:
        return <TransitionSeries.Transition key={key} presentation={fade()} timing={lineal} />;
      case 1:
        return <TransitionSeries.Transition key={key} presentation={slide({ direction: vertical ? "from-bottom" : "from-right" })} timing={resorte} />;
      default:
        return <TransitionSeries.Transition key={key} presentation={wipe({ direction: vertical ? "from-top" : "from-left" })} timing={resorte} />;
    }
  };

  return (
    <TransitionSeries>
      {ESCENAS.flatMap(({ id, frames, Escena }, i) => [
        <TransitionSeries.Sequence key={id} durationInFrames={frames}>
          <Escena />
        </TransitionSeries.Sequence>,
        ...(i < ESCENAS.length - 1 ? [transicion(i)] : []),
      ])}
    </TransitionSeries>
  );
};
