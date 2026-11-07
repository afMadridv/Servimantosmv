/* Dos composiciones con las mismas escenas: cada escena mira el
   tamaño del video (useLayout) y se acomoda a vertical u horizontal. */
import { Composition } from "remotion";
import { DURACION, FPS, Servimantos } from "./Video";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ServimantosVertical"
      component={Servimantos}
      durationInFrames={DURACION}
      fps={FPS}
      width={1080}
      height={1920}
    />
    <Composition
      id="ServimantosHorizontal"
      component={Servimantos}
      durationInFrames={DURACION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
