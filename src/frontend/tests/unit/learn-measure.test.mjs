/**
 * The Como medir track logic: the vernier reading against the geometry of the scale, the
 * checker of written answers (each usual mistake has its own message), the practice draws
 * and the lesson manifests, whose guide results must pass their own checker.
 */
import { describe, expect, it } from "vitest";
import {
  VERNIER_002,
  VERNIER_005,
  MICROMETER_MAX_UM,
  caliperReading,
  checkCaliper,
  checkMicrometer,
  drawMicrometerPosition,
  micrometerReading,
  checkRuler,
  decimalPlaces,
  drawCaliperOpening,
  drawRulerLength,
  formatMm,
  parseDecimal,
  significantFigures,
  vernierDivision,
  vernierStep,
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
import { caliper002Lesson } from "../../src/features/learn/lessons/caliper-002";
import { micrometerLesson } from "../../src/features/learn/lessons/micrometer";

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

  it("reads the 0,02 mm vernier: line n meets the main-scale line mm + n", () => {
    expect(caliperReading(2364, VERNIER_002)).toEqual({
      mm: 23,
      line: 32,
      coincidentMm: 55,
      value: 23.64,
    });
    expect(() => caliperReading(2365, VERNIER_002)).toThrow(RangeError);
  });

  it.each([
    ["0,05", VERNIER_005, 1.95, 5],
    ["0,02", VERNIER_002, 0.98, 2],
  ])(
    "matches the drawn %s mm scale: only the reported line falls on a main-scale line",
    (_, vernier, division, step) => {
      expect(vernierDivision(vernier)).toBeCloseTo(division, 12);
      expect(vernierStep(vernier)).toBe(step);
      for (let h = 0; h <= vernier.maxHundredths; h += step) {
        const { line, coincidentMm, value } = caliperReading(h, vernier);
        expect(value + line * division).toBeCloseTo(coincidentMm, 9);
        // The vernier stays on the 100 mm main scale.
        expect(value + vernier.spanMm).toBeLessThanOrEqual(100);
        for (let k = 0; k <= vernier.lines; k++) {
          const position = value + k * division;
          const offset = Math.abs(position - Math.round(position));
          // The last line closes the vernier: on a whole millimetre it coincides with line 0.
          const coincides = k === line || (line === 0 && k === vernier.lines);
          if (coincides) expect(offset).toBeLessThan(1e-9);
          else expect(offset).toBeGreaterThan(vernier.resolution - 0.001);
        }
      }
    },
  );
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

describe("0,02 mm caliper checker", () => {
  const verdict = (value, uncertainty) => checkCaliper(value, uncertainty, 2364, VERNIER_002);

  it("accepts the reading with 0,01 mm, already one significant figure", () => {
    expect(verdict("23,64", "0,01")).toEqual({ correct: true, messages: [] });
  });

  it.each([
    ["26,20", "0,01", "vale 0,02 mm, não 0,1 mm. Os números marcam décimos, mas há 5 traços"],
    ["24,60", "0,01", "vale 0,02 mm, não 0,05 mm"],
    ["23,66", "0,01", "é o vizinho"],
    ["23,640", "0,01", "Com incerteza de 0,01 mm"],
    ["23,64", "0,02", "0,02 mm ÷ 2 = 0,01 mm."],
    ["23,64", "0,010", "um só algarismo significativo: 0,01 mm"],
    ["23,64", "0,005", "metade da menor divisão, 0,01 mm."],
  ])("explains %s ± %s", (value, uncertainty, message) => {
    const result = verdict(value, uncertainty);
    expect(result.correct).toBe(false);
    expect(result.messages.join(" ")).toContain(message);
  });

  it("tells a 0,05 mm reader that counted 0,02 mm per line", () => {
    expect(checkCaliper("23,26", "0,03", 2365).messages[0]).toContain("não 0,02 mm");
  });
});

describe("micrometer", () => {
  it("reads sleeve millimetres, the half millimetre and the thimble", () => {
    expect(micrometerReading(7872)).toEqual({ mm: 7, half: true, thimble: 37.2, value: 7.872 });
    expect(micrometerReading(5280)).toEqual({ mm: 5, half: false, thimble: 28, value: 5.28 });
    expect(micrometerReading(MICROMETER_MAX_UM).mm).toBe(25);
    for (const bad of [-1, 25001, 7.5]) expect(() => micrometerReading(bad)).toThrow(RangeError);
  });

  it("adds back every part of the reading at any position", () => {
    for (let um = 0; um <= MICROMETER_MAX_UM; um += 7) {
      const { mm, half, thimble, value } = micrometerReading(um);
      expect(mm + (half ? 0.5 : 0) + thimble * 0.01).toBeCloseTo(value, 9);
      expect(thimble).toBeGreaterThanOrEqual(0);
      expect(thimble).toBeLessThan(50);
    }
  });

  const verdict = (value, uncertainty) => checkMicrometer(value, uncertainty, 7872);

  it("accepts any thousandth within the reading uncertainty", () => {
    for (const value of ["7,872", "7,870", "7,876", "7.868"])
      expect(verdict(value, "0,005")).toEqual({ correct: true, messages: [] });
  });

  it.each([
    ["", "0,005", "Escreva o comprimento"],
    ["7,87", "0,005", "Falta o dígito duvidoso"],
    ["7,8720", "0,005", "Algarismos demais"],
    ["7,372", "0,005", "Faltou o meio milímetro"],
    ["6,872", "0,005", "milímetros inteiros estão errados"],
    ["7,885", "0,005", "Quase"],
    ["9,000", "0,005", "Leia em três partes"],
    ["7,872", "", "Falta a incerteza"],
    ["7,872", "0,0050", "um só algarismo significativo: 0,005 mm"],
    ["7,872", "0,01", "0,01 mm ÷ 2 = 0,005 mm"],
    ["7,872", "0,5", "metade da menor divisão do tambor: 0,005 mm"],
  ])("explains %s ± %s", (value, uncertainty, message) => {
    const result = verdict(value, uncertainty);
    expect(result.correct).toBe(false);
    expect(result.messages.join(" ")).toContain(message);
  });

  it("tells who adds a half millimetre that has not shown yet", () => {
    expect(checkMicrometer("5,780", "0,005", 5280).messages[0]).toContain("Sobrou meio milímetro");
  });

  it("draws positions inside the travel, away from the previous one", () => {
    const random = seeded(5);
    let previous;
    for (let i = 0; i < 500; i++) {
      const position = drawMicrometerPosition(random, previous);
      expect(Number.isInteger(position)).toBe(true);
      expect(position).toBeGreaterThanOrEqual(1000);
      expect(position).toBeLessThanOrEqual(24000);
      if (previous !== undefined) expect(Math.abs(position - previous)).toBeGreaterThanOrEqual(300);
      previous = position;
    }
    expect(drawMicrometerPosition(() => 0.5, 12500)).toBe(7500);
    expect(drawMicrometerPosition(() => 0, 1000)).toBe(6000);
  });

  it("fills the lesson texts and points the loupe at sleeve and thimble", () => {
    expect(templateValues("micrometer", 7.872)).toMatchObject({
      L: "7,872",
      M: "7",
      B: "0,5",
      T: "37,2",
      t: "37",
      t1: "38",
    });
    expect(templateValues("micrometer", 5.28)).toMatchObject({ B: "0", t1: "29" });
    expect(templateValues("micrometer", 5.28).half).toContain("ainda não apareceu");
    expect(templateValues("micrometer", 5.495).t1).toBe("0");
    expect(focusMm("micrometer", "zero", 7.872)).toBe(0.4);
    expect(focusMm("micrometer", "sleeve", 7.872)).toBeCloseTo(6.672, 9);
    expect(focusMm("micrometer", "thimble", 7.872)).toBeCloseTo(8.472, 9);
    expect(lensRect("micrometer", 1)).toEqual({ x: 712 + 24 - 48, y: 108, width: 96, height: 64 });
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

  it("draws 0,02 mm openings on even hundredths that fit the shorter scale", () => {
    const random = seeded(3);
    let previous;
    for (let i = 0; i < 500; i++) {
      const opening = drawCaliperOpening(random, previous, VERNIER_002);
      expect(opening % 2).toBe(0);
      expect(opening % 100).not.toBe(0);
      expect(opening).toBeGreaterThanOrEqual(800);
      expect(opening).toBeLessThanOrEqual(4214);
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
    expect(measureLessons.map((lesson) => lesson.id)).toEqual([
      "ruler",
      "caliper",
      "caliper-002",
      "micrometer",
    ]);
    expect(upcomingMeasureLessons).toEqual([]);
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
    expect(templateValues("caliper", 23.64, VERNIER_002)).toEqual({
      L: "23,64",
      M: "23",
      n: "32",
      C: "55",
      labels: "entre os números 6 e 7",
    });
    expect(templateValues("caliper", 23.5, VERNIER_002).labels).toBe("o número 5");
    expect(focusMm("caliper", "coincident", 23.64, VERNIER_002)).toBe(55);
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

  it.each([rulerLesson, caliperLesson, caliper002Lesson, micrometerLesson])(
    "leaves no placeholder in the $title texts",
    (lesson) => {
      const values = templateValues(lesson.instrument, lesson.example, lesson.vernier);
      for (const step of lesson.steps)
        for (const text of [step.html, step.why, step.rule, step.result, step.note])
          if (text) expect(fillTemplate(text, values)).not.toMatch(/\{\w+\}/);
    },
  );

  it("states guide results that pass the practice checker", () => {
    const result = (lesson) =>
      fillTemplate(
        lesson.steps.at(-1).result,
        templateValues(lesson.instrument, lesson.example, lesson.vernier),
      );
    expect(result(rulerLesson)).toBe("L = (42,3 ± 0,5) mm");
    expect(result(caliperLesson)).toBe("L = (23,65 ± 0,03) mm");
    expect(checkRuler("42,3", "0,5", rulerLesson.example).correct).toBe(true);
    expect(checkCaliper("23,65", "0,03", toHundredths(caliperLesson.example)).correct).toBe(true);
    expect(result(caliper002Lesson)).toBe("L = (23,64 ± 0,01) mm");
    expect(result(micrometerLesson)).toBe("L = (7,872 ± 0,005) mm");
    expect(checkMicrometer("7,872", "0,005", 7872).correct).toBe(true);
    expect(
      checkCaliper("23,64", "0,01", toHundredths(caliper002Lesson.example), VERNIER_002).correct,
    ).toBe(true);
  });
});
