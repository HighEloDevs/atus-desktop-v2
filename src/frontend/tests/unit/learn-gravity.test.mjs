/**
 * The free-fall lesson (IFUSP ovinho with a spark timer): its ready fit result is checked
 * against an independent weighted least-squares solution, its simulated tape is regenerated
 * from the physics it states, every number quoted by the guide page is recomputed, and its
 * fit service accepts only the lesson's model.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FREE_AIR_GRADIENT,
  INTERVALS_MM,
  MAINS_FREQUENCY,
  OVINHO,
  REFERENCE_G,
  gravityLesson,
  guideFits,
} from "../../src/features/learn/lessons/gravity";
import { lessons, upcomingLessons } from "../../src/features/learn/lessons";
import {
  createLessonFitService,
  isEquivalentModel,
} from "../../src/features/learn/lesson-fit-service";
import { roundToUncertainty, parameterToText } from "../../src/features/analysis/fit/result-format";
import { resolveFitParameters } from "../../src/features/analysis/fit/parse-fit-parameters";
import { parseValidPoints } from "../../src/features/analysis/data-import/parse-valid-points";
import { rangeToTsv } from "../../src/features/learn/sheet-range";

/** Weighted least squares for a model linear in its parameters; `columns` gives ∂y/∂p. */
function linearFit(rows, columns) {
  const n = columns.length;
  const A = columns.map(() => Array(n).fill(0));
  const B = Array(n).fill(0);
  for (const [t, y, s] of rows) {
    const f = columns.map((c) => c(t));
    for (let a = 0; a < n; a++) {
      B[a] += (f[a] * y) / s ** 2;
      for (let b = 0; b < n; b++) A[a][b] += (f[a] * f[b]) / s ** 2;
    }
  }
  const M = A.map((row, i) => [...row, ...row.map((_, j) => +(i === j))]);
  for (let i = 0; i < n; i++) {
    const p = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= p;
    for (let k = 0; k < n; k++)
      if (k !== i) {
        const f = M[k][i];
        for (let j = 0; j < 2 * n; j++) M[k][j] -= f * M[i][j];
      }
  }
  const C = M.map((row) => row.slice(n));
  const p = C.map((row) => row.reduce((sum, v, j) => sum + v * B[j], 0));
  const chi = rows.reduce((sum, [t, y, s]) => {
    const model = columns.reduce((acc, c, i) => acc + p[i] * c(t), 0);
    return sum + ((y - model) / s) ** 2;
  }, 0);
  return { p, C, sd: C.map((row, i) => Math.sqrt(row[i])), chi };
}

/** The model of the lesson, v = v0 + a·t, in the manifest's parameter order [a, v0]. */
const LINE = [(t) => t, () => 1];

/**
 * Position of the ovinho (or a hollow one of another mass, same shape) after falling for t
 * from rest, with buoyancy and quadratic drag: the physics of the simulated tape.
 */
function fallWithAir(mass = OVINHO.mass) {
  const { volume, area, drag, airDensity } = OVINHO;
  const g = REFERENCE_G * (1 - (airDensity * volume) / mass);
  const vt = Math.sqrt((mass * g) / (0.5 * airDensity * drag * area));
  return (t) => ((vt * vt) / g) * Math.log(Math.cosh((g * t) / vt));
}

/** Time between the release and mark 0 in the simulation (s). */
const RELEASE = 0.0213;

/** Rows a tape would give with no reading error, for an ovinho of the given mass. */
function cleanTape(mass) {
  const y = fallWithAir(mass);
  const tau = 1 / MAINS_FREQUENCY;
  return gravityLesson.dataset.rows.map(([t, , s]) => [
    t,
    (y(RELEASE + t + tau) - y(RELEASE + t - tau)) / (2 * tau),
    s,
  ]);
}

/** Every text of the guide page, tables included, as one string. */
function guideText() {
  return gravityLesson.guide.sections
    .flatMap((section) =>
      section.blocks.flatMap((block) => [
        block.html ?? "",
        block.title ?? "",
        block.note ?? "",
        block.caption ?? "",
        ...(block.items ?? []),
        ...(block.head ?? []),
        ...(block.rows ?? []).flat(),
      ]),
    )
    .join(" ");
}

const rounded = (param) => parameterToText(roundToUncertainty(param.value, param.uncertainty));
const comma = (value, digits) => value.toFixed(digits).replace(".", ",");
const step = (id) => gravityLesson.steps.find((s) => s.id === id);

describe("free-fall guide page", () => {
  const [a, v0] = gravityLesson.fit.parameters;
  const { fixedV0 } = guideFits;
  const rows = gravityLesson.dataset.rows;
  const text = guideText();

  it("generates the tape from the physics it states", () => {
    // Seeded Gaussian reading noise (σ = 0.65 mm, mulberry32 seed 3), then rounded to the mm.
    const noise = [
      1.01, 0.64, -1.1, 0.4, -0.48, 0.37, -1.02, 0.84, -0.21, -0.25, 0.39, 0.81, -0.49, 0.19, -0.15,
      -0.25, 1.04,
    ];
    const y = fallWithAir();
    const mark = (n) => y(RELEASE + n / MAINS_FREQUENCY);
    const simulated = noise.map((e, k) => Math.round((mark(2 * k + 2) - mark(2 * k)) * 1000 + e));
    expect(simulated).toEqual(INTERVALS_MM);
    expect(text).toContain("Os dados desta lição são simulados");
    expect(gravityLesson.dataset.sheetName).toContain("simulada");
    for (const quoted of ["84,3 g", "41 cm³", "9,15 cm²", "0,45"]) expect(text).toContain(quoted);
  });

  it("turns each interval into a mean velocity at the middle mark", () => {
    rows.forEach(([t, v, s], k) => {
      expect(t).toBeCloseTo((2 * k + 1) / MAINS_FREQUENCY, 4);
      expect(v).toBeCloseTo((INTERVALS_MM[k] / 1000) * (MAINS_FREQUENCY / 2), 10);
      expect(s).toBe(0.021);
    });
    // σv: two readings of half a millimetre over two cycles.
    expect((Math.hypot(0.0005, 0.0005) * MAINS_FREQUENCY) / 2).toBeCloseTo(0.021, 3);
    expect(text).toContain("σ<sub><i>v</i></sub> = 0,021 m/s");
  });

  it("reproduces the simulation of the IFUSP ovinho", () => {
    const y = fallWithAir();
    const mark = (n) => y(RELEASE + n / MAINS_FREQUENCY);
    // SNEF 2005: Reynolds number from 5·10² to 1.4·10⁴ along the fall.
    const speed = (n) => (mark(n + 0.01) - mark(n - 0.01)) / (0.02 / MAINS_FREQUENCY);
    const reynolds = (v) =>
      (OVINHO.airDensity * v * Math.sqrt((4 * OVINHO.area) / Math.PI)) / 1.8e-5;
    expect(reynolds(speed(0))).toBeGreaterThan(400);
    expect(reynolds(speed(34))).toBeLessThan(1.4e4);
    expect(text).toContain(`depois de ${comma(mark(34), 1)} m de queda`);
    expect(text).toContain(`<i>v</i> ≈ ${comma(speed(34), 1)} m/s`);
  });

  it("quotes the air bias, compatible with the IFUSP estimate and about one uncertainty", () => {
    const { p } = linearFit(cleanTape(OVINHO.mass), LINE);
    const bias = REFERENCE_G - p[0];
    expect(text).toContain(`${comma(bias, 3)} m/s² (${comma((bias / REFERENCE_G) * 100, 2)} %)`);
    // SNEF 2005: buoyancy 0.0052(4) plus drag 0.0294(65).
    expect(Math.abs(bias - 0.0346) / Math.hypot(0.0004, 0.0065)).toBeLessThan(1.5);
    expect(bias / a.uncertainty).toBeGreaterThan(0.8);
    expect(bias / a.uncertainty).toBeLessThan(1.3);
  });

  it("quotes the acceleration of a hollow ovinho for each mass", () => {
    const quoted = gravityLesson.guide.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.kind === "table" && block.head[0] === "Massa do ovinho");
    const masses = [0.035, 0.05, 0.07, OVINHO.mass, 0.12];
    const accelerations = masses.map((m) => linearFit(cleanTape(m), LINE).p[0]);
    expect(quoted.rows[0].slice(1)).toEqual(accelerations.map((x) => comma(x, 3)));
    // Linear in 1/m, as the improved model says.
    const slope = (i, j) => (accelerations[j] - accelerations[i]) / (1 / masses[j] - 1 / masses[i]);
    expect(slope(0, 1) / slope(3, 4)).toBeCloseTo(1, 1);
  });

  it("quotes the force ratios at the end of the tape", () => {
    const y = fallWithAir();
    const end = RELEASE + 34 / MAINS_FREQUENCY;
    const v = (y(end + 1e-4) - y(end - 1e-4)) / 2e-4;
    const { volume, area, drag, airDensity } = OVINHO;
    const dragRatio = (m) => (0.5 * airDensity * drag * area * v * v) / (m * REFERENCE_G);
    const buoyancy = (m) => (airDensity * volume) / m;
    expect(text).toContain(`${comma(dragRatio(OVINHO.mass) * 100, 1)} %`);
    expect(text).toContain(`${comma(dragRatio(0.035) * 100, 1)} %`);
    expect(text).toContain(`${comma(buoyancy(OVINHO.mass) * 100, 2)} %`);
    expect(text).toContain(`${comma(buoyancy(0.035) * 100, 2)} %`);
  });

  it("quotes a fit with v0 = 0 that matches the least-squares solution", () => {
    const { p, sd, chi } = linearFit(rows, [(t) => t]);
    expect(fixedV0.parameters[0].value).toBeCloseTo(p[0], 6);
    expect(fixedV0.parameters[0].uncertainty / sd[0]).toBeCloseTo(1, 6);
    expect(fixedV0.chiSquared).toBeCloseTo(chi, 4);
  });

  it("writes every quoted result as the fits give it", () => {
    const [aFixed] = fixedV0.parameters;
    const z = (param) => Math.abs(param.value - REFERENCE_G) / param.uncertainty;
    const ngl = rows.length - 2;
    for (const quoted of [
      rounded(a),
      rounded(aFixed),
      comma(z(a), 1),
      String(Math.round(z(aFixed))),
      comma(gravityLesson.fit.chiSquared / ngl, 2),
      String(Math.round(fixedV0.chiSquared / (ngl + 1))),
      comma(v0.value, 3),
      `${Math.round((v0.value / a.value) * 1000)} ms`,
      comma(REFERENCE_G, 4),
    ])
      expect(text).toContain(quoted);
    const { C } = linearFit(rows, LINE);
    const correlation = comma(C[0][1] / Math.sqrt(C[0][0] * C[1][1]), 2).replace("-", "−");
    expect(text).toContain(`(${correlation})`);
    expect(step("copy-params").body).toContain(correlation);
  });

  it("quotes the scale errors of the ruler and the mains", () => {
    expect(text).toContain(`${comma(a.value * (1 - 0.99865), 3)} m/s²`);
    const longer = 60 / 59.9 - 1;
    expect(text).toContain(`${comma(longer * 100, 2)} % mais do que a análise supõe`);
    // The analysis assumes 1/60 s per cycle: a real period that is longer inflates a.
    expect(text).toContain(`${comma(((60 / 59.9) ** 2 - 1) * 100, 2)} % maior`);
  });

  it("quotes the IFUSP free-fall results consistently", () => {
    // Guimarães-Filho et al., XVI SNEF (2005): class mean, corrected and predicted values.
    const z = (REFERENCE_G - 9.7608) / Math.hypot(0.0019, 0.0003);
    expect(text).toContain(`a ${Math.round(z)} incertezas da referência`);
    expect(REFERENCE_G - 0.0052 - 0.0294).toBeCloseTo(9.7518, 4);
    expect(Math.abs(9.7525 - 9.7518) / Math.hypot(0.0027, 0.0065)).toBeLessThan(1);
    for (const quoted of ["9,7608(19)", "9,7525(27)", "9,7518(65)", "0,0052(4)", "0,0294(65)"])
      expect(text).toContain(quoted);
    expect(text).toContain("0,99865(14)");
    expect(text).toContain("SNEF 2023");
  });

  it("quotes the IAG-USP reference with its uncertainty and source", () => {
    expect(text).toContain("IAG-USP");
    expect(text).toContain(`${comma(REFERENCE_G, 4)} ± 0,0003 m/s²`);
    expect(text).toContain("SNEF 2005");
  });

  it("derives the position function and the mean velocity, with the integrals", () => {
    const model = gravityLesson.guide.sections.find((section) => section.id === "modelo");
    const latex = model.blocks.filter((block) => block.kind === "equation").map((b) => b.latex);
    const order = [
      "m\\,\\frac{dv}{dt} = m\\,g - E - F_{\\text{ar}}",
      "\\frac{dv}{dt} = a = g",
      "\\int_{v_0}^{v(t)} dv' = \\int_0^{t} a\\,dt'",
      "\\int_{y_0}^{y(t)} dy' = \\int_0^{t} \\left(v_0 + a\\,t'\\right) dt'",
      "y(t) = y_0 + v_0\\,t + \\tfrac{1}{2}\\,a\\,t^2",
      "\\int_{t-\\tau}^{t+\\tau} \\left(v_0 + a\\,t'\\right) dt' = v_0 + a\\,t",
    ];
    const at = order.map((piece) => latex.findIndex((equation) => equation.includes(piece)));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((x, y) => x - y));
  });

  it("assigns the mean velocity to the middle of the interval exactly for constant acceleration", () => {
    const y = (t) => 0.01 + 0.2 * t + (9.8 * t * t) / 2;
    const tau = 1 / MAINS_FREQUENCY;
    for (const t of [0.05, 0.3, 0.55])
      expect((y(t + tau) - y(t - tau)) / (2 * tau)).toBeCloseTo(0.2 + 9.8 * t, 12);
  });

  it("keeps g constant along the fall to better than a millionth", () => {
    expect((FREE_AIR_GRADIENT * 2) / REFERENCE_G).toBeLessThan(1e-6);
    expect(text).toContain("menos de um milionésimo");
  });

  it("shows the dataset in the tape animation's table", () => {
    const svg = readFileSync(
      `${process.cwd()}/src/features/learn/lessons/gravity/tape.svg`,
      "utf8",
    );
    const shown = [...svg.matchAll(/font-weight="600">(\d,\d{2})</g)].map((m) =>
      Number(m[1].replace(",", ".")),
    );
    expect(shown).toEqual(rows.map(([, v]) => v));
  });

  it("is a well-formed manifest", () => {
    const ids = gravityLesson.guide.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const block of gravityLesson.guide.sections.flatMap((section) => section.blocks)) {
      if (block.kind === "figure") expect(block.src && block.alt && block.caption).toBeTruthy();
      if (block.kind === "table")
        for (const row of block.rows) expect(row).toHaveLength(block.head.length);
    }
  });

  it("names the method in the title, not only the quantity", () => {
    expect(gravityLesson.title).toBe("Queda livre com faiscador");
    expect(step("intro").title).toBe(gravityLesson.title);
  });
});

describe("free-fall fit fixture", () => {
  const { p, C, chi } = linearFit(gravityLesson.dataset.rows, LINE);
  const fit = gravityLesson.fit;

  it("matches the weighted least-squares solution", () => {
    fit.parameters.forEach((param, i) => {
      expect(param.value).toBeCloseTo(p[i], 6);
      expect(param.uncertainty / Math.sqrt(C[i][i])).toBeCloseTo(1, 6);
    });
    fit.covariance.forEach((row, i) =>
      row.forEach((value, j) => expect(value / C[i][j]).toBeCloseTo(1, 6)),
    );
    expect(fit.chiSquared).toBeCloseTo(chi, 4);
  });

  it("lists the parameters in the order the fit controls use", () => {
    const resolved = resolveFitParameters("", fit.equation);
    expect(resolved.ok && resolved.parameters.map((x) => x.name)).toEqual(
      fit.parameters.map((x) => x.name),
    );
  });

  it("quotes the rounded results in the step texts", () => {
    const [a, v0] = fit.parameters;
    expect(step("result").body).toContain(`a = ${rounded(a)} m/s²`);
    expect(step("interpret").why).toContain(`v₀ = ${rounded(v0)} m/s`);
    const ngl = gravityLesson.dataset.rows.length - 2;
    expect(step("interpret").body).toContain(`χ²/NGL = ${comma(fit.chiSquared / ngl, 2)}`);
    expect(step("interpret").body).toContain(`NGL = ${ngl} (1 ± ${comma(Math.sqrt(2 / ngl), 2)})`);
    expect(step("copy").body).toContain(`<b>C${gravityLesson.dataset.rows.length + 1}</b>`);
  });

  it("asks for the lesson's model, so typing what the step shows completes it", () => {
    const typed = step("equation").body.match(/<code>(.+?)<\/code>/)[1];
    expect(isEquivalentModel(typed, fit.equation)).toBe(true);
    expect(step("equation").waitFor).toBe("equation.matched");
    expect(step("fit")).toMatchObject({ target: "fit-run", waitFor: "fit.succeeded" });
  });

  it("states the reading-uncertainty rule of the lessons", () => {
    expect(guideText()).toContain("metade da menor divisão");
  });

  it("pastes as the dataset the analysis expects", () => {
    const { columns, rows } = gravityLesson.dataset;
    const tsv = rangeToTsv(columns, rows, { r0: 1, c0: 0, r1: rows.length, c1: 2 });
    const points = parseValidPoints(tsv, "auto");
    expect(points).toHaveLength(17);
    expect(points[16]).toMatchObject({ x: 0.55, y: 5.61, sy: 0.021 });
  });

  it("is in the catalog with the upcoming cards", () => {
    expect(lessons).toContain(gravityLesson);
    expect(upcomingLessons.map((x) => x.title)).toContain("Pêndulo simples");
  });
});

describe("lesson fit service", () => {
  const service = createLessonFitService(gravityLesson);
  const points = gravityLesson.dataset.rows.map(([x, y, sy]) => ({ x, y, sy }));
  const request = (equation) => ({
    version: 1,
    points,
    equation,
    parameters: "",
    range: {},
    useSx: true,
    useSy: true,
  });

  it("recognizes the same model written another way", () => {
    expect(isEquivalentModel("a*x + v0", gravityLesson.fit.equation)).toBe(true);
    expect(isEquivalentModel("v0 + x*a", gravityLesson.fit.equation)).toBe(true);
    expect(isEquivalentModel("v0 + a*x^2/2", gravityLesson.fit.equation)).toBe(false);
    expect(isEquivalentModel("b + c*x", gravityLesson.fit.equation)).toBe(false);
    expect(isEquivalentModel("v0 + (", gravityLesson.fit.equation)).toBe(false);
  });

  it("answers the lesson result with a curve and residuals from its parameters", async () => {
    const response = await service.fit(request("a*x + v0"));
    expect(response.equation).toBe("a*x + v0");
    expect(response.parameters).toBe(gravityLesson.fit.parameters);
    expect(response.degreesOfFreedom).toBe(15);
    expect(response.hasUncertainty).toBe(true);
    expect(response.curve).toHaveLength(81);
    expect(response.curve[0].x).toBe(0.0167);
    expect(response.curve.at(-1).x).toBeCloseTo(0.55, 12);
    const chi = response.residuals.reduce((sum, r) => sum + (r.residual / r.sy) ** 2, 0);
    expect(chi).toBeCloseTo(gravityLesson.fit.chiSquared, 3);
  });

  it("rejects another model with a hint", async () => {
    await expect(service.fit(request("v0 + a*x^2/2"))).rejects.toThrow(
      "Nesta lição, use o modelo v0 + a*x.",
    );
  });
});
