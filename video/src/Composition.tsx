import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { Audio } from "@remotion/media";
import { Composition, Folder, staticFile, useVideoConfig } from "remotion";
import { Agenda, Cierre, Datos, Horarios, Intro, Pagina, Ruleta, Ticket } from "./Escenas";

const T = 12; // frames de cada transición

export const Promo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
    <Audio name="Música (beat propio)" src={staticFile("musica.wav")} premountFor={fps} volume={0.9} />
    <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={84} premountFor={fps}>
        <Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Tu link" durationInFrames={105} premountFor={fps}>
        <Pagina />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Horarios" durationInFrames={96} premountFor={fps}>
        <Horarios />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Datos" durationInFrames={96} premountFor={fps}>
        <Datos />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Ticket" durationInFrames={105} premountFor={fps}>
        <Ticket />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Agenda" durationInFrames={108} premountFor={fps}>
        <Agenda />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Ruleta" durationInFrames={96} premountFor={fps}>
        <Ruleta />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence name="Cierre" durationInFrames={120} premountFor={fps}>
        <Cierre />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    </>
  );
};

const DURACION = 84 + 105 + 96 + 96 + 105 + 108 + 96 + 120 - 7 * T;
const VERTICAL = { width: 1080, height: 1920, fps: 30 } as const;

export const MyComposition = () => (
  <>
    <Composition id="NavAgendaPromo" component={Promo} durationInFrames={DURACION} {...VERTICAL} />
    <Folder name="Escenas">
      <Composition id="Intro" component={Intro} durationInFrames={84} {...VERTICAL} />
      <Composition id="Pagina" component={Pagina} durationInFrames={105} {...VERTICAL} />
      <Composition id="Horarios" component={Horarios} durationInFrames={96} {...VERTICAL} />
      <Composition id="Datos" component={Datos} durationInFrames={96} {...VERTICAL} />
      <Composition id="Ticket" component={Ticket} durationInFrames={105} {...VERTICAL} />
      <Composition id="Agenda" component={Agenda} durationInFrames={108} {...VERTICAL} />
      <Composition id="Ruleta" component={Ruleta} durationInFrames={96} {...VERTICAL} />
      <Composition id="Cierre" component={Cierre} durationInFrames={120} {...VERTICAL} />
    </Folder>
  </>
);
