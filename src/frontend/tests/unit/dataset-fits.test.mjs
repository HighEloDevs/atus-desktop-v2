/** Several fits per dataset: letters, restoring old and new projects, styles and grouping. */
import { expect, it } from "vitest";
import {
  createFit,
  describeRange,
  duplicateFit,
  fitColor,
  fitDisplayName,
  fitLetter,
  fitLinePattern,
  groupParametersByEquation,
  restoreDatasetFits,
  serializeDatasetFits,
} from "../../src/features/analysis/fit/dataset-fits";

const result = (names) => ({
  parameters: names.map((name) => ({ name, value: 1, uncertainty: 0.1 })),
});

it("hands out spreadsheet-style letters", () => {
  expect([0, 1, 25, 26, 27, 701, 702].map(fitLetter)).toEqual([
    "A",
    "B",
    "Z",
    "AA",
    "AB",
    "ZZ",
    "AAA",
  ]);
});

it("turns a project saved before multiple fits into fit A without losing anything", () => {
  const legacy = {
    color: "#364cff",
    equation: "a*x+b",
    parameters: "a=2",
    minX: "1",
    maxX: "",
    useSx: false,
    useSy: true,
    fitState: "mock",
    linePoints: [{ x: 0, y: 1 }],
    result: { equation: "a*x+b" },
  };
  const restored = restoreDatasetFits(legacy);
  expect(restored.fits).toHaveLength(1);
  expect(restored.fits[0]).toMatchObject({
    letter: "A",
    label: "",
    visible: true,
    equation: "a*x+b",
    parameters: "a=2",
    minX: "1",
    maxX: "",
    useSx: false,
    useSy: true,
    fitState: "mock",
    linePoints: [{ x: 0, y: 1 }],
    result: { equation: "a*x+b" },
  });
  expect(restored.activeFitId).toBe(restored.fits[0].id);
  expect(restored.fitCounter).toBe(1);
});

it("restores an empty dataset state as one blank fit", () => {
  const restored = restoreDatasetFits(undefined);
  expect(restored.fits).toEqual([createFit("fit-0", "A")]);
});

it("keeps several fits through a save and reopen, and mirrors fit A for older versions", () => {
  const a = { ...createFit("a", "A", { equation: "a*x" }), fitState: "mock", result: { k: 1 } };
  const c = { ...createFit("c", "C", { equation: "a*x^2", minX: "0", maxX: "2" }), label: "Curva" };
  const saved = JSON.parse(
    JSON.stringify(serializeDatasetFits({ fits: [a, c], activeFitId: "c", fitCounter: 3 })),
  );
  expect(saved).toMatchObject({ equation: "a*x", fitState: "mock", result: { k: 1 } });
  const restored = restoreDatasetFits(saved);
  expect(restored.activeFitId).toBe("c");
  expect(restored.fitCounter).toBe(3);
  expect(restored.fits.map((fit) => [fit.id, fit.letter, fit.label, fit.equation])).toEqual([
    ["a", "A", "", "a*x"],
    ["c", "C", "Curva", "a*x^2"],
  ]);
  expect(restored.fits[1]).toMatchObject({ minX: "0", maxX: "2" });
});

it("keeps an edit made to fit A by a version without multiple fits", () => {
  const a = {
    ...createFit("a", "A", { equation: "a*x" }),
    label: "Reta",
    fitState: "mock",
    result: { k: 1 },
  };
  const b = createFit("b", "B", { equation: "a*x^2" });
  const saved = JSON.parse(
    JSON.stringify(serializeDatasetFits({ fits: [a, b], activeFitId: "a", fitCounter: 2 })),
  );
  // The older version edits the legacy fields, clears the result and writes `fits` back as is.
  const edited = { ...saved, equation: "a*x+b", fitState: "idle", linePoints: [] };
  delete edited.result;
  const restored = restoreDatasetFits(edited);
  expect(restored.fits[0]).toMatchObject({
    id: "a",
    letter: "A",
    label: "Reta",
    equation: "a*x+b",
    fitState: "idle",
    linePoints: [],
  });
  expect(restored.fits[0].result).toBeUndefined();
  expect(restored.fits[1].equation).toBe("a*x^2");
});

it("repairs duplicate ids and letters, skips malformed fits, and falls back to the first fit", () => {
  const restored = restoreDatasetFits({
    fits: [
      { id: "x", letter: "A", equation: "a" },
      null,
      { id: "x", letter: "A", equation: "b", useSy: "yes" },
    ],
    activeFitId: "missing",
    fitCounter: 1,
  });
  expect(restored.fits.map((fit) => fit.id)).toEqual(["x", "x-1"]);
  expect(restored.fits.map((fit) => fit.letter)).toEqual(["A", "C"]);
  expect(restored.fits[1].useSy).toBe(true);
  expect(restored.activeFitId).toBe("x");
  expect(restored.fitCounter).toBe(3);
});

it("duplicates the configuration and result under a new letter, without the label", () => {
  const source = {
    ...createFit("a", "A", { equation: "a*x", minX: "2" }),
    label: "Reta",
    visible: false,
    result: { k: 1 },
  };
  expect(duplicateFit(source, "b", "B")).toEqual({
    ...source,
    id: "b",
    letter: "B",
    label: "",
    visible: true,
  });
});

it("gives each letter its own line pattern, never the dataset's for later fits", () => {
  expect(fitLinePattern("solid", "A")).toBe("solid");
  expect(["B", "C", "D", "E"].map((l) => fitLinePattern("solid", l))).toEqual([
    "dashed",
    "dotted",
    "dashdot",
    "dashed",
  ]);
  expect(fitLinePattern("dashed", "B")).toBe("solid");
});

it("shades the dataset colour for later fits and leaves other formats alone", () => {
  expect(fitColor("#364cff", "A")).toBe("#364cff");
  expect(fitColor("#000", "B")).toBe("#616161");
  expect(fitColor("#ffffff", "C")).toBe("#bcbec0");
  expect(fitColor("#364cff", "B")).not.toBe(fitColor("#364cff", "C"));
  expect(fitColor("rgb(1,2,3)", "B")).toBe("rgb(1,2,3)");
});

it("names fits by label or letter only when the dataset has several", () => {
  const fit = createFit("b", "B");
  expect(fitDisplayName("Ensaio", fit, false)).toBe("Ensaio");
  expect(fitDisplayName("Ensaio", fit, true)).toBe("Ensaio · B");
  expect(fitDisplayName("Ensaio", { ...fit, label: " Reta " }, true)).toBe("Ensaio · Reta");
});

it("describes the X range in Portuguese", () => {
  expect(describeRange({ minX: "", maxX: "" })).toBe("todos os pontos");
  expect(describeRange({ minX: "0.5", maxX: "" })).toBe("x ≥ 0,5");
  expect(describeRange({ minX: "", maxX: "3" })).toBe("x ≤ 3");
  expect(describeRange({ minX: "1", maxX: "2.5" })).toBe("1 a 2,5");
});

it("lines up parameter rows only between fits with the same function", () => {
  const fits = [
    { ...createFit("a", "A", { equation: "a*exp(-x/t)" }), result: result(["a", "t"]) },
    { ...createFit("b", "B", { equation: "a*x + b" }), result: result(["a", "b"]) },
    { ...createFit("c", "C", { equation: "a*x+b", minX: "2" }), result: result(["a", "b"]) },
    createFit("d", "D"),
  ];
  expect(groupParametersByEquation(fits)).toEqual([
    { equation: "a*exp(-x/t)", fitIds: ["a"], parameters: ["a", "t"] },
    { equation: "a*x + b", fitIds: ["b", "c"], parameters: ["a", "b"] },
  ]);
});

it("summarises a closed fit row: Chi², sum of squares, failure or nothing", async () => {
  const { fitStatus } = await import("../../src/features/analysis/fit/dataset-fits");
  const fit = createFit("f", "A", { equation: "a*x" });
  expect(fitStatus(fit)).toEqual({ text: "—", failed: false });
  expect(fitStatus({ ...fit, fitState: "error" })).toEqual({ text: "Falhou", failed: true });
  const result = { chiSquared: 12.345, hasUncertainty: true };
  expect(fitStatus({ ...fit, result }).text).toBe("χ² 12,3");
  expect(fitStatus({ ...fit, result: { ...result, hasUncertainty: false } }).text).toBe("Σr² 12,3");
});
