/**
 * @module
 * What changes from one instrument to another on the lesson screen: the drawing, the unit
 * the instrument moves in, the practice draw and checker, the success text and the free
 * exploration. The screen itself only talks to an {@link InstrumentKit}.
 */

import type { ReactNode } from "react";
import { CALIPER, MICROMETER, RULER } from "./geometry";
import { CaliperScene, MicrometerScene, RulerScene } from "./InstrumentScenes";
import type { MeasureHighlight, MeasureLesson } from "./measure-lesson";
import {
  caliperReading,
  checkCaliper,
  checkMicrometer,
  checkRuler,
  drawCaliperOpening,
  drawMicrometerPosition,
  drawRulerLength,
  formatMm,
  MICROMETER_MAX_UM,
  micrometerReading,
  parseDecimal,
  RULER_MAX_MM,
  VERNIER_005,
  vernierStep,
  type MeasureCheck,
} from "./reading";

/** Props of an instrument drawing. */
export type SceneProps = {
  id: string;
  sceneId: string;
  /** Position in the kit unit. */
  units: number;
  piece: boolean;
  highlights: MeasureHighlight[];
};

/** Free exploration of an instrument that moves (caliper jaw, micrometer thimble). */
export type ExploreKit = {
  /** Position when exploration starts, in the kit unit. */
  start: number;
  /** Small and large moves, in the kit unit. */
  step: number;
  bigStep: number;
  max: number;
  /** Labels of the move buttons, after the sign. */
  stepLabel: string;
  bigStepLabel: string;
  ariaLabel: string;
  title: string;
  intro: string;
  why: string;
  lensHint: string;
  highlights: MeasureHighlight[];
  /** Position as text for assistive technology. */
  valueText: (units: number) => string;
  readout: (units: number) => ReactNode;
  lensMm: (units: number) => number;
};

/** Everything the lesson screen needs to know about one instrument. */
export type InstrumentKit = {
  /** Units per millimetre: tenths, hundredths or micrometres. */
  units: number;
  viewBox: string;
  /** SVG units per millimetre along the measuring axis. */
  svgPerMm: number;
  /** Accessible name of the drawing. */
  label: string;
  /** Largest loupe position in practice, in millimetres. */
  lensMax: number;
  placeholder: string;
  practiceHint: string;
  scene: (props: SceneProps) => ReactNode;
  draw: (random: () => number, previous?: number) => number;
  check: (value: string, uncertainty: string, units: number) => MeasureCheck;
  success: (units: number, value: string) => { title: string; detail: string };
  explore?: ExploreKit;
};

const cobalt = (text: ReactNode) => <b className="text-[#364cff]">{text}</b>;

/**
 * Builds the kit of a lesson's instrument.
 * @param lesson - Lesson manifest.
 * @returns The instrument kit.
 */
export function instrumentKit(lesson: MeasureLesson): InstrumentKit {
  if (lesson.instrument === "ruler")
    return {
      units: 10,
      viewBox: RULER.viewBox,
      svgPerMm: RULER.scale,
      label: "Régua milimetrada com uma peça de latão encostada no zero",
      lensMax: RULER_MAX_MM,
      placeholder: "0,0",
      practiceHint: "Leve a lupa até a ponta da peça.",
      scene: ({ id, sceneId, units, highlights }) => (
        <RulerScene id={id} sceneId={sceneId} length={units / 10} highlights={highlights} />
      ),
      draw: (random, previous) =>
        Math.round(
          drawRulerLength(random, previous === undefined ? undefined : previous / 10) * 10,
        ),
      check: (value, uncertainty, units) => checkRuler(value, uncertainty, units / 10),
      success: (units, value) => ({
        title: `Certo: L = (${formatMm(parseDecimal(value), 1)} ± 0,5) mm`,
        detail: `A peça simulada mede ${formatMm(units / 10, 1)} mm, dentro da sua incerteza.`,
      }),
    };

  if (lesson.instrument === "micrometer")
    return {
      units: 1000,
      viewBox: MICROMETER.viewBox,
      svgPerMm: MICROMETER.scale,
      label: "Micrômetro de 0 a 25 mm com tambor de 0,01 mm",
      lensMax: 26,
      placeholder: "0,000",
      practiceHint: "Leve a lupa à borda do tambor: bainha à esquerda, tambor à direita.",
      scene: ({ id, sceneId, units, piece, highlights }) => (
        <MicrometerScene
          id={id}
          sceneId={sceneId}
          micrometres={units}
          piece={piece}
          highlights={highlights}
        />
      ),
      draw: drawMicrometerPosition,
      check: checkMicrometer,
      success: (units, value) => {
        const { mm, half, thimble } = micrometerReading(units);
        return {
          title: `Certo: L = (${formatMm(parseDecimal(value), 3)} ± 0,005) mm`,
          detail: `${mm} mm${half ? " + 0,5 mm" : ""} + ${formatMm(thimble, 1)} × 0,01 mm: o micrômetro simulado está em ${formatMm(units / 1000, 3)} mm.`,
        };
      },
      explore: {
        start: 5780,
        step: 10,
        bigStep: 500,
        max: MICROMETER_MAX_UM,
        stepLabel: "0,01 mm",
        bigStepLabel: "1 volta",
        ariaLabel: "Posição do micrômetro",
        title: "Gire o tambor",
        intro:
          "Arraste o tambor ou use as setas com o micrômetro em foco. Cada traço do tambor é 0,01 mm; uma volta inteira, 50 traços, anda 0,5 mm na bainha.",
        why: "A cada volta aparece um traço novo na bainha, alternando o de cima (milímetro inteiro) e o de baixo (meio milímetro).",
        lensHint: "A lupa segue a borda do tambor.",
        highlights: ["sleeveMm", "half", "thimbleLine"],
        valueText: (units) => `${formatMm(units / 1000, 2)} mm`,
        readout: (units) => {
          const { mm, half, thimble } = micrometerReading(units);
          return (
            <>
              {mm} mm{half ? " + 0,5 mm" : ""} + {cobalt(Math.round(thimble))} × 0,01 mm ={" "}
              {cobalt(`${formatMm(units / 1000, 2)} mm`)}
            </>
          );
        },
        lensMm: (units) => units / 1000 + 0.6,
      },
    };

  const vernier = lesson.vernier ?? VERNIER_005;
  const r = formatMm(vernier.resolution, 2);
  return {
    units: 100,
    viewBox: CALIPER.viewBox,
    svgPerMm: CALIPER.scale,
    label: `Paquímetro com nônio de ${r} mm`,
    lensMax: CALIPER.scaleMm,
    placeholder: "0,00",
    practiceHint: "Leve a lupa ao zero do nônio e depois ao traço que coincide.",
    scene: ({ id, sceneId, units, piece, highlights }) => (
      <CaliperScene
        id={id}
        sceneId={sceneId}
        hundredths={units}
        piece={piece}
        highlights={highlights}
        vernier={vernier}
      />
    ),
    draw: (random, previous) => drawCaliperOpening(random, previous, vernier),
    check: (value, uncertainty, units) => checkCaliper(value, uncertainty, units, vernier),
    success: (units) => {
      const { mm, line, coincidentMm, value } = caliperReading(units, vernier);
      return {
        title: `Certo: L = (${formatMm(value, 2)} ± ${formatMm(vernier.uncertainty, 2)}) mm`,
        detail: `${mm} mm + ${line} × ${r} mm. O traço ${line} do nônio coincide com o traço ${coincidentMm} da escala.`,
      };
    },
    explore: {
      start: 1240,
      step: vernierStep(vernier),
      bigStep: 100,
      max: vernier.maxHundredths,
      stepLabel: `${r} mm`,
      bigStepLabel: "1 mm",
      ariaLabel: "Abertura do paquímetro",
      title: "Mova o cursor",
      intro: `Arraste o bico móvel ou use as setas com o paquímetro em foco. Veja o zero do nônio andar sobre a escala e o traço que coincide mudar a cada ${r} mm.`,
      why: `Ao abrir ${r} mm, o traço que coincide pula para o vizinho. Ao abrir 1 mm inteiro, ele volta ao mesmo traço.`,
      lensHint: "A lupa segue o traço do nônio que coincide.",
      highlights: ["vernierZero", "coincident"],
      valueText: (units) => `${formatMm(units / 100, 2)} mm`,
      readout: (units) => {
        const { mm, line, value } = caliperReading(units, vernier);
        return (
          <>
            {mm} mm + {cobalt(line)} × {r} mm = {cobalt(`${formatMm(value, 2)} mm`)}
          </>
        );
      },
      lensMm: (units) => caliperReading(units, vernier).coincidentMm,
    },
  };
}
