/**
 * The Como medir track logic: the vernier reading against the geometry of the scale, the
 * checker of written answers (each usual mistake has its own message), the practice draws
 * and the lesson manifests, whose guide results must pass their own checker.
 */
import { describe, expect, it } from "vitest";
import {
  CALIPER_MAX_HUNDREDTHS,
  VERNIER_DIVISION_MM,
  VERNIER_LINES,
  caliperReading,
  checkCaliper,
  checkRuler,
  decimalPlaces,
  drawCaliperOpening,
  drawRulerLength,
  formatMm,
  parseDecimal,
  significantFigures,
} from "../../src/features/learn/measure/reading";
import {
  fillTemplate,
  focusMm,
  templateValues,
  toHundredths,
} from "../../src/features/learn/measure/measure-lesson";
import { lensRect } from "../../src/features/learn/measure/geometry";
import { measureLessons, upcomingMeasureLessons } from "../../src/features/learn/lessons";
import { rulerLesson } from "../../src/features/learn/lessons/ruler";
import { caliperLesson } from "../../src/features/learn/lessons/caliper";

/** Deterministic uniform source (linear congruential generator). */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

describe("caliper reading", () => {
  it("reads whole millimetres, the coinciding line and the main-scale line it meets", () => {
    expect(caliperReading(2365)).toEqual({ mm: 23, line: 13, coincidentMm: 49, value: 23.65 });
    expect(caliperReading(0)).toEqual({ mm: 0, line: 0, coincidentMm: 0, value: 0 });
  });

  it("rejects openings the vernier cannot show", () => {
    for (const bad of [-5, 12.5, 2366]) expect(() => caliperReading(bad)).toThrow(RangeError);
  });

  it("matches the drawn scale: only the reported line falls on a main-scale line", () => {
    expect(VERNIER_DIVISION_MM).toBeCloseTo(1.95, 12);
    for (let h = 0; h <= CALIPER_MAX_HUNDREDTHS; h += 5) {
      const { line, coincidentMm, value } = caliperReading(h);
      expect(value + line * VERNIER_DIVISION_MM).toBeCloseTo(coincidentMm, 9);
      for (let k = 0; k <= VERNIER_LINES; k++) {
        const position = value + k * VERNIER_DIVISION_MM;
        const offset = Math.abs(position - Math.round(position));
        // Line 20 closes the vernier: on a whole millimetre it coincides with line 0.
        const coincides = k === line || (line === 0 && k === VERNIER_LINES);
        if (coincides) expect(offset).toBeLessThan(1e-9);
        else expect(offset).toBeGreaterThan(0.049);
      }
    }
  });
});

describe("number helpers", () => {
  it("parses comma or point and refuses anything else", () => {
    expect(parseDecimal(" 23,65 ")).toBe(23.65);
    expect(parseDecimal("0.5")).toBe(0.5);
    for (const bad of ["", "2,3,4", "1e3", "mm", "4,"]) expect(parseDecimal(bad)).toBeNaN();
  });

  it("counts decimals and significant figures as written", () => {
    expect(decimalPlaces("42")).toBe(0);
    expect(decimalPlaces("42,30")).toBe(2);
    expect(significantFigures("0,5")).toBe(1);
    expect(significantFigures("0,50")).toBe(2);
    expect(significantFigures("0,025")).toBe(2);
    expect(significantFigures("0,03")).toBe(1);
    expect(formatMm(23.65, 2)).toBe("23,65");
  });
});

describe("ruler checker", () => {
  const verdict = (value, uncertainty) => checkRuler(value, uncertainty, 42.3);

  it("accepts any reading within the uncertainty that keeps the doubtful tenth", () => {
    for (const value of ["42,3", "42.5", "41,8", "42,8"])
      expect(verdict(value, "0,5")).toEqual({ correct: true, messages: [] });
  });

  it.each([
    ["", "0,5", "Escreva o comprimento"],
    ["42", "0,5", "Falta o dígito duvidoso"],
    ["42,30", "0,5", "Algarismos demais"],
    ["4,23", "0,5", "centímetros"],
    ["43,5", "0,5", "entre 42 e 43 mm"],
    ["30,0", "0,5", "encostada no zero"],
    ["42,3", "", "Falta a incerteza"],
    ["42,3", "0,50", "um só algarismo significativo"],
    ["42,3", "1", "1 mm ÷ 2 = 0,5 mm"],
    ["42,3", "0,2", "metade da menor divisão da régua"],
  ])("explains %s ± %s", (value, uncertainty, message) => {
    const result = verdict(value, uncertainty);
    expect(result.correct).toBe(false);
    expect(result.messages.join(" ")).toContain(message);
  });
});

describe("caliper checker", () => {
  const verdict = (value, uncertainty) => checkCaliper(value, uncertainty, 2365);

  it("accepts the exact reading to the hundredth with 0,03 mm", () => {
    expect(verdict("23,65", "0,03")).toEqual({ correct: true, messages: [] });
    expect(verdict("23.65", "0.03").correct).toBe(true);
  });

  it("asks for the hundredths when a reading ends in a whole tenth", () => {
    expect(checkCaliper("23,60", "0,03", 2360).correct).toBe(true);
    expect(checkCaliper("23,6", "0,03", 2360).messages).toEqual([
      "Escreva o valor até os centésimos, a mesma casa da incerteza.",
    ]);
  });

  it.each([
    ["", "0,03", "Escreva o comprimento"],
    ["23,650", "0,03", "zeros à direita"],
    ["24,30", "0,03", "não 0,1 mm"],
    ["22,65", "0,03", "milímetros inteiros não"],
    ["23,70", "0,03", "é o vizinho"],
    ["23,40", "0,03", "Os milímetros inteiros estão certos (23 mm)"],
    ["30,00", "0,03", "Comece pelo zero do nônio"],
    ["23,65", "", "Falta a incerteza"],
    ["23,65", "0,025", "arredonde para 0,03 mm"],
    ["23,65", "0,02", "Arredonde 0,025 para cima"],
    ["23,65", "0,030", "um só algarismo significativo"],
    ["23,65", "0,05", "0,05 mm ÷ 2 = 0,025 mm"],
    ["23,65", "0,1", "escrita com um significativo"],
  ])("explains %s ± %s", (value, uncertainty, message) => {
    const result = verdict(value, uncertainty);
    expect(result.correct).toBe(false);
    expect(result.messages.join(" ")).toContain(message);
  });
});

describe("practice draws", () => {
  it("draws ruler pieces in tenths, inside the scale and away from the previous one", () => {
    const random = seeded(7);
    let previous;
    for (let i = 0; i < 500; i++) {
      const length = drawRulerLength(random, previous);
      expect(length).toBeGreaterThanOrEqual(12);
      expect(length).toBeLessThanOrEqual(56);
      expect(Math.round(length * 10)).toBeCloseTo(length * 10, 9);
      if (previous !== undefined) expect(Math.abs(length - previous)).toBeGreaterThanOrEqual(0.5);
      previous = length;
    }
  });

  it("draws caliper openings on the vernier, never on a whole millimetre", () => {
    const random = seeded(11);
    let previous;
    for (let i = 0; i < 500; i++) {
      const opening = drawCaliperOpening(random, previous);
      expect(opening % 5).toBe(0);
      expect(opening % 100).not.toBe(0);
      expect(opening).toBeGreaterThanOrEqual(800);
      expect(opening).toBeLessThanOrEqual(5235);
      if (previous !== undefined) expect(Math.abs(opening - previous)).toBeGreaterThanOrEqual(300);
      previous = opening;
    }
  });

  it("leaves the previous piece even with a stuck source", () => {
    expect(drawRulerLength(() => 0.5, 34)).toBe(44);
    expect(drawRulerLength(() => 0.9, 51.6)).toBe(41.6);
    expect(drawCaliperOpening(() => 0.5, 3000)).toBe(2035);
    expect(drawCaliperOpening(() => 0, 800)).toBe(1835);
  });
});

describe("lesson manifests", () => {
  it("lists the ruler and the caliper, with the micrometer announced", () => {
    expect(measureLessons.map((lesson) => lesson.instrument)).toEqual(["ruler", "caliper"]);
    expect(upcomingMeasureLessons.map((item) => item.title)).toEqual(["Micrômetro"]);
  });

  it("fills placeholders from the reading of the example", () => {
    expect(templateValues("ruler", 42.3)).toEqual({ L: "42,3", a: "42", b: "43" });
    expect(templateValues("caliper", 23.65)).toEqual({
      L: "23,65",
      M: "23",
      n: "13",
      C: "49",
      labels: "entre os números 6 e 7",
    });
    expect(templateValues("caliper", 23.6).labels).toBe("o número 6");
    expect(fillTemplate("{M} + {n} = {x}", { M: "1", n: "2" })).toBe("1 + 2 = {x}");
  });

  it("points the loupe at the part of the instrument each step talks about", () => {
    expect(focusMm("ruler", "zero", 42.3)).toBe(0.5);
    expect(focusMm("ruler", "division", 42.3)).toBe(10.5);
    expect(focusMm("ruler", "end", 42.3)).toBe(42.3);
    expect(focusMm("caliper", "zero", 23.65)).toBe(0);
    expect(focusMm("caliper", "vernierZero", 23.65)).toBeCloseTo(22.65, 9);
    expect(focusMm("caliper", "coincident", 23.65)).toBe(49);
    expect(lensRect("caliper", 49)).toEqual({ x: 512, y: 88, width: 96, height: 64 });
    expect(toHundredths(23.65)).toBe(2365);
  });

  it.each([rulerLesson, caliperLesson])("leaves no placeholder in the $title texts", (lesson) => {
    const values = templateValues(lesson.instrument, lesson.example);
    for (const step of lesson.steps)
      for (const text of [step.html, step.why, step.rule, step.result, step.note])
        if (text) expect(fillTemplate(text, values)).not.toMatch(/\{\w+\}/);
  });

  it("states guide results that pass the practice checker", () => {
    const result = (lesson) =>
      fillTemplate(lesson.steps.at(-1).result, templateValues(lesson.instrument, lesson.example));
    expect(result(rulerLesson)).toBe("L = (42,3 ± 0,5) mm");
    expect(result(caliperLesson)).toBe("L = (23,65 ± 0,03) mm");
    expect(checkRuler("42,3", "0,5", rulerLesson.example).correct).toBe(true);
    expect(checkCaliper("23,65", "0,03", toHundredths(caliperLesson.example)).correct).toBe(true);
  });
});
