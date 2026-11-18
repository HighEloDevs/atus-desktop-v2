/**
 * @module
 * Data model of the Como medir lessons, where a simulated instrument is read.
 *
 * Like the experiment lessons, an instrument lesson is plain data: texts, the guided steps
 * and what each step highlights. Texts may hold placeholders such as `{L}` that are filled
 * from the reading of the lesson's example value, so the numbers in the text always match
 * the drawing.
 */

import { caliperReading, formatMm, micrometerReading, VERNIER_005, type Vernier } from "./reading";

/** Simulated instrument of a lesson. */
export type Instrument = "ruler" | "caliper" | "micrometer";

/**
 * Point of the instrument a step looks at; the loupe centres on it.
 * - `zero`: the zero of the ruler or the closed caliper.
 * - `division`: one millimetre of the ruler, away from the piece.
 * - `end`: the end of the piece on the ruler.
 * - `vernierZero`: the vernier zero over the main scale.
 * - `coincident`: the vernier line that meets a main-scale line.
 * - `sleeve`: the micrometer sleeve just before the thimble edge.
 * - `thimble`: the micrometer thimble at the reference line.
 */
export type MeasureFocus =
  "zero" | "division" | "end" | "vernierZero" | "coincident" | "sleeve" | "thimble";

/** Mark drawn over the instrument, in the analysis colour. */
export type MeasureHighlight =
  | "zero"
  | "division"
  | "end"
  | "endInterval"
  | "uncertainty"
  | "vernierZero"
  | "coincident"
  | "sleeveMm"
  | "half"
  | "thimbleLine";

/** One guided step of an instrument lesson. */
export type MeasureStep = {
  /** Stable identifier. */
  id: string;
  /** Short label for the step list. */
  label: string;
  /** Instruction, as trusted HTML with placeholders. */
  html: string;
  /** Optional reason or context, as trusted HTML with placeholders. */
  why?: string;
  /** Calculation shown in a box, as `1 mm ÷ 2 = 0,5 mm`. */
  rule?: string;
  /** Final result, as `L = ({L} ± 0,5) mm`. */
  result?: string;
  /** Note under the result, as trusted HTML with placeholders. */
  note?: string;
  /** Drawing shown with the text; `parallax` compares a vertical and an oblique look. */
  figure?: "parallax";
  focus: MeasureFocus;
  highlight?: MeasureHighlight[];
  /** Shows the caliper closed and empty, to check its zero. */
  closed?: boolean;
};

/** A lesson of the Como medir track. */
export type MeasureLesson = {
  id: string;
  kind: "instrument";
  track: "measure";
  version: number;
  instrument: Instrument;
  title: string;
  summary: string;
  /** Approximate duration in minutes. */
  minutes: number;
  /** Short topic tags shown on the card. */
  topics: string[];
  /** Example value of the guide, in millimetres: the piece length or the caliper reading. */
  example: number;
  /** Vernier of a caliper lesson; the 0,05 mm one when omitted. */
  vernier?: Vernier;
  steps: MeasureStep[];
  /** Works the lesson follows, as plain text. */
  references: string[];
};

/**
 * Converts millimetres to the caliper opening in hundredths.
 * @param mm - Reading in millimetres, a multiple of 0.05.
 * @returns The opening in hundredths of millimetre.
 */
export const toHundredths = (mm: number) => Math.round(mm * 100);

/**
 * Values that fill the placeholders of a lesson text.
 *
 * Ruler: `{L}` length with one decimal, `{a}` and `{b}` the millimetres around the end.
 * Caliper: `{L}` reading with two decimals, `{M}` whole millimetres, `{n}` coinciding line,
 * `{C}` main-scale line it meets, `{labels}` where that line sits among the vernier numbers.
 * Micrometer: `{L}` reading with three decimals, `{M}` sleeve millimetres, `{B}` the half
 * millimetre added (`0,5` or `0`), `{half}` a sentence about the half-millimetre line, `{T}`
 * the thimble position with the estimated tenth, `{t}` and `{t1}` the lines around it.
 * @param instrument - Instrument of the lesson.
 * @param value - Length or reading, in millimetres.
 * @param vernier - Vernier of a caliper; the 0,05 mm one by default.
 * @returns The placeholder values.
 */
export function templateValues(
  instrument: Instrument,
  value: number,
  vernier = VERNIER_005,
): Record<string, string> {
  if (instrument === "ruler") {
    const whole = Math.floor(value);
    return { L: formatMm(value, 1), a: String(whole), b: String(whole + 1) };
  }
  if (instrument === "micrometer") {
    const { mm, half, thimble } = micrometerReading(Math.round(value * 1000));
    const below = Math.floor(thimble);
    return {
      L: formatMm(value, 3),
      M: String(mm),
      B: half ? "0,5" : "0",
      half: half
        ? "O traço de meio milímetro, embaixo da linha, também já apareceu: some <b>0,5 mm</b>."
        : "O traço de meio milímetro, embaixo da linha, ainda não apareceu: não some nada.",
      T: formatMm(thimble, 1),
      t: String(below),
      t1: String((below + 1) % 50),
    };
  }
  const { mm, line, coincidentMm } = caliperReading(toHundredths(value), vernier);
  const every = vernier.labelEvery;
  const below = Math.floor(line / every);
  return {
    L: formatMm(value, 2),
    M: String(mm),
    n: String(line),
    C: String(coincidentMm),
    labels: line % every === 0 ? `o número ${below}` : `entre os números ${below} e ${below + 1}`,
  };
}

/**
 * Replaces `{key}` placeholders.
 * @param text - Text with placeholders.
 * @param values - Values by key.
 * @returns The text with every known placeholder replaced; unknown ones stay.
 */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Millimetre of the instrument scale a focus points to, where the loupe centres.
 * @param instrument - Instrument of the lesson.
 * @param focus - Point of interest.
 * @param value - Length or reading, in millimetres.
 * @param vernier - Vernier of a caliper; the 0,05 mm one by default.
 * @returns The scale position in millimetres.
 */
export function focusMm(
  instrument: Instrument,
  focus: MeasureFocus,
  value: number,
  vernier = VERNIER_005,
): number {
  if (focus === "zero") return instrument === "ruler" ? 0.5 : instrument === "micrometer" ? 0.4 : 0;
  if (focus === "division") return 10.5;
  if (focus === "end") return value;
  // The thimble edge sits at the reading; the sleeve lies left of it, the thimble right.
  if (focus === "sleeve") return value - 1.2;
  if (focus === "thimble") return value + 0.6;
  const reading = caliperReading(toHundredths(value), vernier);
  // The vernier zero sits a little right of centre, so the whole millimetre passed shows.
  if (focus === "vernierZero") return reading.value - 1;
  return reading.coincidentMm;
}
