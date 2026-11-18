/**
 * @module
 * Pure logic of the Como medir track: how a ruler and a vernier caliper are read, how the
 * student's written answer is checked and how practice pieces are drawn.
 *
 * Conventions follow the didactic laboratory of IFUSP: the reading uncertainty is half of
 * the smallest division, an estimated uncertainty is written with one significant figure,
 * the value ends in the same decimal place as the uncertainty and, on a ruler, the tenth of
 * millimetre is estimated as the doubtful digit (Tabacniks, "Conceitos básicos da teoria de
 * erros", IFUSP 2009; Marineli, Oliveira, Guimarães-Filho and Pacca, XV SNEF 2003).
 */

/** Number of lines of the caliper vernier after its zero. */
export const VERNIER_LINES = 20;
/** Length of the vernier in millimetres: 20 divisions over 39 mm give 0.05 mm. */
export const VERNIER_SPAN_MM = 39;
/** Spacing between two vernier lines in millimetres. */
export const VERNIER_DIVISION_MM = VERNIER_SPAN_MM / VERNIER_LINES;
/** Largest opening of the simulated caliper, in hundredths of millimetre. */
export const CALIPER_MAX_HUNDREDTHS = 6000;
/** Length of the simulated ruler scale in millimetres. */
export const RULER_MAX_MM = 60;

/** Reading of a vernier caliper. */
export type CaliperReading = {
  /** Whole millimetres passed by the vernier zero. */
  mm: number;
  /** Vernier line that coincides with a main-scale line (0 to 19). */
  line: number;
  /** Main-scale millimetre where the coinciding vernier line falls. */
  coincidentMm: number;
  /** Reading in millimetres. */
  value: number;
};

/**
 * Reads a caliper opened by a given amount.
 *
 * Vernier line `k` sits at `value + 1.95 k`; with `value = mm + 0.05 n` it falls on the
 * main-scale line `mm + 2n` exactly when `k = n`.
 * @param hundredths - Opening in hundredths of millimetre; a non-negative multiple of 5.
 * @returns The whole millimetres, the coinciding line and the reading.
 * @throws RangeError when the opening is not a reachable vernier position.
 * @example caliperReading(2365) // { mm: 23, line: 13, coincidentMm: 49, value: 23.65 }
 */
export function caliperReading(hundredths: number): CaliperReading {
  if (!Number.isInteger(hundredths) || hundredths < 0 || hundredths % 5 !== 0)
    throw new RangeError(`Invalid caliper opening: ${hundredths}`);
  const mm = Math.floor(hundredths / 100);
  const line = (hundredths % 100) / 5;
  return { mm, line, coincidentMm: mm + 2 * line, value: hundredths / 100 };
}

/**
 * Formats millimetres with a decimal comma.
 * @param value - Value in millimetres.
 * @param decimals - Decimal places to keep.
 * @returns The value as the interface writes it, as `23,65`.
 */
export function formatMm(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Parses a decimal typed with comma or point.
 * @param text - Text typed by the student.
 * @returns The number, or `NaN` for an empty or malformed text.
 */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  if (!/^[+-]?\d+([.,]\d+)?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

/**
 * Counts the decimal places written by the student, trailing zeros included.
 * @param text - Number as typed.
 * @returns How many digits follow the decimal separator.
 */
export function decimalPlaces(text: string): number {
  return /[.,](\d+)$/.exec(text.trim())?.[1].length ?? 0;
}

/**
 * Counts significant figures as written: leading zeros do not count, trailing zeros do.
 * @param text - Number as typed.
 * @returns The number of significant figures.
 */
export function significantFigures(text: string): number {
  return text.replace(/\D/g, "").replace(/^0+/, "").length;
}

/** Verdict on a written measurement. */
export type MeasureCheck = {
  correct: boolean;
  /** What to fix, in the order the student should look at it. Empty when correct. */
  messages: string[];
};

const near = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const MISSING_UNCERTAINTY = "Falta a incerteza. Toda medida vem com ela.";

/**
 * Checks a ruler reading written as value and uncertainty.
 *
 * Any value within the reading uncertainty of the true length is right, as long as it keeps
 * the doubtful tenth of millimetre and nothing more; the uncertainty must be `0,5`.
 * @param valueText - Length typed by the student, in millimetres.
 * @param uncertaintyText - Uncertainty typed by the student, in millimetres.
 * @param lengthMm - Simulated length of the piece.
 * @returns The verdict and what to fix.
 */
export function checkRuler(
  valueText: string,
  uncertaintyText: string,
  lengthMm: number,
): MeasureCheck {
  const value = parseDecimal(valueText);
  const uncertainty = parseDecimal(uncertaintyText);
  if (Number.isNaN(value))
    return { correct: false, messages: ["Escreva o comprimento em milímetros."] };
  const messages: string[] = [];
  const whole = Math.floor(lengthMm);
  if (Math.abs(value - lengthMm) > 0.5 + 1e-9) {
    if (Math.abs(value * 10 - lengthMm) <= 0.5)
      messages.push(
        "Parece que a leitura está em centímetros. A resposta pede milímetros: multiplique por 10.",
      );
    else if (Math.abs(value - lengthMm) <= 1.5)
      messages.push(`Leve a lupa até a ponta da peça: ela está entre ${whole} e ${whole + 1} mm.`);
    else
      messages.push(
        "Confira se a peça está encostada no zero e conte os centímetros pelos números grandes antes dos milímetros.",
      );
  } else if (decimalPlaces(valueText) === 0)
    messages.push(
      "Falta o dígito duvidoso. Estime os décimos de milímetro entre os dois traços: com ± 0,5 mm, o valor tem uma casa decimal.",
    );
  else if (decimalPlaces(valueText) > 1)
    messages.push(
      "Algarismos demais no valor. Com incerteza de 0,5 mm, ele termina na primeira casa decimal.",
    );
  if (Number.isNaN(uncertainty)) messages.push(MISSING_UNCERTAINTY);
  else if (near(uncertainty, 0.5) && significantFigures(uncertaintyText) > 1)
    messages.push(
      "A incerteza estimada leva um só algarismo significativo: 0,5 mm, e não 0,50 mm.",
    );
  else if (!near(uncertainty, 0.5))
    messages.push(
      near(uncertainty, 1)
        ? "A incerteza de leitura é metade da menor divisão: 1 mm ÷ 2 = 0,5 mm."
        : "A incerteza de leitura é metade da menor divisão da régua: 0,5 mm.",
    );
  return { correct: messages.length === 0, messages };
}

/**
 * Checks a caliper reading written as value and uncertainty.
 *
 * The value must be the exact vernier reading, written to the hundredth; the uncertainty is
 * half of 0,05 mm with one significant figure, rounded up: `0,03`. Wrong values are matched
 * against the usual mistakes: counting each vernier line as 0,1 mm, the wrong whole
 * millimetres and a neighbouring line.
 * @param valueText - Length typed by the student, in millimetres.
 * @param uncertaintyText - Uncertainty typed by the student, in millimetres.
 * @param hundredths - Simulated opening, in hundredths of millimetre.
 * @returns The verdict and what to fix.
 */
export function checkCaliper(
  valueText: string,
  uncertaintyText: string,
  hundredths: number,
): MeasureCheck {
  const { mm, line, value: reading } = caliperReading(hundredths);
  const value = parseDecimal(valueText);
  const uncertainty = parseDecimal(uncertaintyText);
  if (Number.isNaN(value))
    return { correct: false, messages: ["Escreva o comprimento em milímetros."] };
  const messages: string[] = [];
  const difference = value - reading;
  if (!near(value, reading, 1e-4)) {
    const hundredthsOf = (x: number) => ((Math.round(x * 100) % 100) + 100) % 100;
    if (near(value, mm + line * 0.1, 1e-4))
      messages.push(
        "Cada traço do nônio vale 0,05 mm, não 0,1 mm. Os números marcam décimos, mas há um traço entre cada par deles.",
      );
    else if (hundredthsOf(value) === hundredths % 100 && Math.abs(difference) >= 0.99)
      messages.push(
        `Os décimos e centésimos estão certos, mas os milímetros inteiros não. O zero do nônio passou do traço ${mm} da escala de cima.`,
      );
    else if (near(Math.abs(difference), 0.05, 1e-4))
      messages.push(
        "Quase. Use a lupa: o traço do nônio que coincide é o vizinho do que você escolheu.",
      );
    else if (Math.abs(difference) < 1)
      messages.push(
        `Os milímetros inteiros estão certos (${mm} mm). Procure com a lupa o traço do nônio que se alinha com um traço da escala de cima e multiplique por 0,05 mm.`,
      );
    else
      messages.push(
        "Comece pelo zero do nônio: o último traço da escala de cima antes dele dá os milímetros inteiros.",
      );
  } else if (decimalPlaces(valueText) > 2)
    messages.push(
      "Não complete o valor com zeros à direita. Com incerteza de 0,03 mm, ele termina na segunda casa decimal.",
    );
  else if (decimalPlaces(valueText) < 2)
    messages.push("Escreva o valor até os centésimos, a mesma casa da incerteza.");
  if (Number.isNaN(uncertainty)) messages.push(MISSING_UNCERTAINTY);
  else if (near(uncertainty, 0.025))
    messages.push(
      "Quase: 0,025 mm tem dois algarismos significativos. Incerteza estimada leva um só: arredonde para 0,03 mm.",
    );
  else if (near(uncertainty, 0.02))
    messages.push(
      "Arredonde 0,025 para cima, 0,03 mm, para não declarar uma incerteza menor do que a estimada.",
    );
  else if (near(uncertainty, 0.03) && significantFigures(uncertaintyText) > 1)
    messages.push("A incerteza leva um só algarismo significativo: 0,03 mm.");
  else if (!near(uncertainty, 0.03))
    messages.push(
      near(uncertainty, 0.05)
        ? "A incerteza de leitura é metade da menor divisão: 0,05 mm ÷ 2 = 0,025 mm, que se escreve 0,03 mm."
        : "A incerteza de leitura do paquímetro é metade da menor divisão, 0,025 mm, escrita com um significativo: 0,03 mm.",
    );
  return { correct: messages.length === 0, messages };
}

/**
 * Draws the length of a new ruler piece, away from the previous one.
 * @param random - Uniform source in [0, 1).
 * @param previous - Length of the previous piece, in millimetres.
 * @returns A length between 12 and 56 mm, in tenths of millimetre.
 */
export function drawRulerLength(random: () => number, previous?: number): number {
  for (let attempt = 0; ; attempt++) {
    const length = Math.round(120 + random() * 440) / 10;
    if (previous === undefined || Math.abs(length - previous) >= 0.5) return length;
    // A source stuck on one value would never leave the previous piece.
    if (attempt === 50) return length > 34 ? length - 10 : length + 10;
  }
}

/**
 * Draws the opening of a new caliper piece, away from the previous one.
 *
 * Whole millimetres are skipped, so the coinciding line is never the vernier zero.
 * @param random - Uniform source in [0, 1).
 * @param previous - Previous opening, in hundredths of millimetre.
 * @returns An opening between 8 and 52 mm, in hundredths, multiple of 5.
 */
export function drawCaliperOpening(random: () => number, previous?: number): number {
  for (let attempt = 0; ; attempt++) {
    let opening = 5 * Math.round((800 + random() * 4400) / 5);
    if (opening % 100 === 0) opening += 35;
    if (previous === undefined || Math.abs(opening - previous) >= 300) return opening;
    // A source stuck on one value would never leave the previous piece.
    if (attempt === 50) return opening > 3000 ? opening - 1000 : opening + 1000;
  }
}
