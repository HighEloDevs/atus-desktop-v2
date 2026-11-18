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

/** Length of the simulated ruler scale in millimetres. */
export const RULER_MAX_MM = 60;

/** A vernier: how many lines it has, the length they span and what it reads. */
export type Vernier = {
  /** Number of divisions after the vernier zero. */
  lines: number;
  /** Length of the vernier in millimetres. */
  spanMm: number;
  /** Smallest division of the reading, in millimetres. */
  resolution: number;
  /** A number is engraved every this many lines; each number is a tenth of millimetre. */
  labelEvery: number;
  /** Largest opening that keeps the whole vernier on the scale, in hundredths. */
  maxHundredths: number;
  /** Reading uncertainty as written: half the resolution with one significant figure. */
  uncertainty: number;
};

/** Vernier of 20 divisions over 39 mm: reads 0,05 mm; 0,025 mm is written 0,03 mm. */
export const VERNIER_005: Vernier = {
  lines: 20,
  spanMm: 39,
  resolution: 0.05,
  labelEvery: 2,
  maxHundredths: 6000,
  uncertainty: 0.03,
};

/** Vernier of 50 divisions over 49 mm: reads 0,02 mm, with 0,01 mm of uncertainty. */
export const VERNIER_002: Vernier = {
  lines: 50,
  spanMm: 49,
  resolution: 0.02,
  labelEvery: 5,
  maxHundredths: 5000,
  uncertainty: 0.01,
};

/** Spacing between two vernier lines, in millimetres (1,95 or 0,98). */
export const vernierDivision = (vernier: Vernier) => vernier.spanMm / vernier.lines;
/** Step of the opening in hundredths of millimetre (5 or 2). */
export const vernierStep = (vernier: Vernier) => Math.round(vernier.resolution * 100);

/** Reading of a vernier caliper. */
export type CaliperReading = {
  /** Whole millimetres passed by the vernier zero. */
  mm: number;
  /** Vernier line that coincides with a main-scale line. */
  line: number;
  /** Main-scale millimetre where the coinciding vernier line falls. */
  coincidentMm: number;
  /** Reading in millimetres. */
  value: number;
};

/**
 * Reads a caliper opened by a given amount.
 *
 * Vernier line `k` sits at `value + d k`, with `d` the vernier division. With
 * `value = mm + r n` it falls on the main-scale line `mm + (d + r) n` exactly when `k = n`;
 * `d + r` is 2 mm on the 0,05 vernier and 1 mm on the 0,02 one.
 * @param hundredths - Opening in hundredths of millimetre; a non-negative multiple of the
 * vernier step.
 * @param vernier - Vernier of the caliper; the 0,05 mm one by default.
 * @returns The whole millimetres, the coinciding line and the reading.
 * @throws RangeError when the opening is not a reachable vernier position.
 * @example caliperReading(2365) // { mm: 23, line: 13, coincidentMm: 49, value: 23.65 }
 * @example caliperReading(2364, VERNIER_002) // { mm: 23, line: 32, coincidentMm: 55, ... }
 */
export function caliperReading(hundredths: number, vernier = VERNIER_005): CaliperReading {
  const step = vernierStep(vernier);
  if (!Number.isInteger(hundredths) || hundredths < 0 || hundredths % step !== 0)
    throw new RangeError(`Invalid caliper opening: ${hundredths}`);
  const mm = Math.floor(hundredths / 100);
  const line = (hundredths % 100) / step;
  const jump = Math.round(vernierDivision(vernier) + vernier.resolution);
  return { mm, line, coincidentMm: mm + jump * line, value: hundredths / 100 };
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
 * half the resolution with one significant figure, rounded up (`0,03` on the 0,05 mm
 * vernier, `0,01` on the 0,02 mm one). Wrong values are matched against the usual mistakes:
 * counting each line as 0,1 mm or with another caliper's resolution, the wrong whole
 * millimetres and a neighbouring line.
 * @param valueText - Length typed by the student, in millimetres.
 * @param uncertaintyText - Uncertainty typed by the student, in millimetres.
 * @param hundredths - Simulated opening, in hundredths of millimetre.
 * @param vernier - Vernier of the caliper; the 0,05 mm one by default.
 * @returns The verdict and what to fix.
 */
export function checkCaliper(
  valueText: string,
  uncertaintyText: string,
  hundredths: number,
  vernier = VERNIER_005,
): MeasureCheck {
  const { mm, line, value: reading } = caliperReading(hundredths, vernier);
  const value = parseDecimal(valueText);
  const uncertainty = parseDecimal(uncertaintyText);
  if (Number.isNaN(value))
    return { correct: false, messages: ["Escreva o comprimento em milímetros."] };
  const messages: string[] = [];
  const resolution = vernier.resolution;
  const r = formatMm(resolution, 2);
  const half = resolution / 2;
  const expected = vernier.uncertainty;
  const u = formatMm(expected, 2);
  const difference = value - reading;
  const otherResolution = [0.05, 0.02].find(
    (x) => x !== resolution && near(value, mm + line * x, 1e-4),
  );
  if (!near(value, reading, 1e-4)) {
    const hundredthsOf = (x: number) => ((Math.round(x * 100) % 100) + 100) % 100;
    if (near(value, mm + line * 0.1, 1e-4))
      messages.push(
        `Cada traço do nônio vale ${r} mm, não 0,1 mm. Os números marcam décimos, mas há ${vernier.labelEvery} traços entre um número e o seguinte.`,
      );
    else if (otherResolution !== undefined)
      messages.push(
        `Neste paquímetro cada traço do nônio vale ${r} mm, não ${formatMm(otherResolution, 2)} mm. A menor divisão vem gravada no cursor.`,
      );
    else if (hundredthsOf(value) === hundredths % 100 && Math.abs(difference) >= 0.99)
      messages.push(
        `Os décimos e centésimos estão certos, mas os milímetros inteiros não. O zero do nônio passou do traço ${mm} da escala de cima.`,
      );
    else if (near(Math.abs(difference), resolution, 1e-4))
      messages.push(
        "Quase. Use a lupa: o traço do nônio que coincide é o vizinho do que você escolheu.",
      );
    else if (Math.abs(difference) < 1)
      messages.push(
        `Os milímetros inteiros estão certos (${mm} mm). Procure com a lupa o traço do nônio que se alinha com um traço da escala de cima e multiplique por ${r} mm.`,
      );
    else
      messages.push(
        "Comece pelo zero do nônio: o último traço da escala de cima antes dele dá os milímetros inteiros.",
      );
  } else if (decimalPlaces(valueText) > 2)
    messages.push(
      `Não complete o valor com zeros à direita. Com incerteza de ${u} mm, ele termina na segunda casa decimal.`,
    );
  else if (decimalPlaces(valueText) < 2)
    messages.push("Escreva o valor até os centésimos, a mesma casa da incerteza.");
  const halfText = formatMm(half, 3).replace(/0$/, "");
  if (Number.isNaN(uncertainty)) messages.push(MISSING_UNCERTAINTY);
  else if (!near(half, expected) && near(uncertainty, half))
    messages.push(
      `Quase: ${halfText} mm tem dois algarismos significativos. Incerteza estimada leva um só: arredonde para ${u} mm.`,
    );
  else if (!near(half, expected) && uncertainty > 0 && uncertainty < half)
    messages.push(
      `Arredonde ${halfText} para cima, ${u} mm, para não declarar uma incerteza menor do que a estimada.`,
    );
  else if (near(uncertainty, expected) && significantFigures(uncertaintyText) > 1)
    messages.push(`A incerteza leva um só algarismo significativo: ${u} mm.`);
  else if (!near(uncertainty, expected))
    messages.push(
      near(uncertainty, resolution)
        ? `A incerteza de leitura é metade da menor divisão: ${r} mm ÷ 2 = ${halfText} mm${near(half, expected) ? "." : `, que se escreve ${u} mm.`}`
        : `A incerteza de leitura do paquímetro é metade da menor divisão, ${halfText} mm${near(half, expected) ? "" : `, escrita com um significativo: ${u} mm`}.`,
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
 * @param vernier - Vernier of the caliper; the 0,05 mm one by default.
 * @returns An opening from 8 mm up to 8 mm short of the largest one, in hundredths, on the
 * vernier step.
 */
export function drawCaliperOpening(
  random: () => number,
  previous?: number,
  vernier = VERNIER_005,
): number {
  const step = vernierStep(vernier);
  const range = vernier.maxHundredths - 1600;
  for (let attempt = 0; ; attempt++) {
    let opening = step * Math.round((800 + random() * range) / step);
    if (opening % 100 === 0) opening += 7 * step;
    if (previous === undefined || Math.abs(opening - previous) >= 300) return opening;
    // A source stuck on one value would never leave the previous piece.
    if (attempt === 50) return opening > 3000 ? opening - 1000 : opening + 1000;
  }
}
