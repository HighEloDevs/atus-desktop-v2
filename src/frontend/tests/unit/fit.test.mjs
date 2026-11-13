import { describe, expect, test, vi } from "vitest";
import {
  FunctionInterpreter,
  interpretExpression,
} from "../../src/features/analysis/fit/function-interpreter.ts";
import {
  parseFitParameters,
  resolveFitParameters,
} from "../../src/features/analysis/fit/parse-fit-parameters.ts";
import { defaultFitConfig, validateFitConfig } from "../../src/features/analysis/fit/fit-config.ts";
import { equationToLatex } from "../../src/features/analysis/fit/equation-to-latex.ts";
import { mockFitService } from "../../src/features/analysis/fit/fit-service.ts";

describe("model expressions", () => {
  test("detects variables and evaluates named and positional values", () => {
    const interpreter = interpretExpression("a*x**2 + b + sin(pi/2)");
    expect(interpreter.toString()).toBe("a*x^2 + b + sin(pi/2)");
    expect(interpreter.getVariables()).toEqual(["a", "b", "x"]);
    expect(interpreter.execute(2, 3, 4)).toBe(36);
    expect(interpreter.executeWithNames({ x: 4, a: 2, b: 3 })).toBe(36);
    expect(() => interpreter.execute(1)).toThrow(/Number of values/);
    expect(() => interpreter.executeWithNames({ a: 1 })).toThrow(/Variable 'b'/);
    const copy = interpreter.getVariables();
    copy.push("other");
    expect(interpreter.getVariables()).toEqual(["a", "b", "x"]);
  });
  test("supports variable ordering, validation and fallback", () => {
    expect(FunctionInterpreter.executeOnce("x + 2", 3)).toBe(5);
    expect(new FunctionInterpreter("a-x", { variables: ["x", "a"] }).execute(2, 5)).toBe(3);
    expect(FunctionInterpreter.validate("x +").valid).toBe(false);
    expect(FunctionInterpreter.validate("sin(x)").valid).toBe(true);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(new FunctionInterpreter("a+x").executeOrDefault(99, 1)).toBe(99);
    } finally {
      log.mockRestore();
    }
  });
  test("renders an equation preview", () => {
    expect(equationToLatex("  ")).toBeNull();
    expect(equationToLatex("a*x**2 + sin(x)")).toBe("a \\cdot x^{2} + \\sin ( x )");
  });
});

describe("fit parameters and validation", () => {
  test("parses fixed and bounded parameters, with the last declaration winning", () => {
    expect(parseFitParameters("a=1; b=$2 [0, 3]; a=-1")).toEqual({
      ok: true,
      parameters: [
        { name: "a", value: -1, vary: true, min: null, max: null, source: "explicit" },
        { name: "b", value: 2, vary: false, min: 0, max: 3, source: "explicit" },
      ],
    });
    expect(parseFitParameters("   ")).toEqual({ ok: true, parameters: [] });
    expect(parseFitParameters("nonsense").ok).toBe(false);
    expect(parseFitParameters("a=1, b=2").ok).toBe(false);
    expect(parseFitParameters("a=1 trailing").ok).toBe(false);
  });
  test("merges equation variables and explicit extra parameters", () => {
    expect(resolveFitParameters("c=5; a=$2", "a*x+b")).toEqual({
      ok: true,
      parameters: [
        { name: "a", value: 2, vary: false, min: null, max: null, source: "explicit" },
        { name: "b", value: 1, vary: true, min: null, max: null, source: "implicit" },
        { name: "c", value: 5, vary: true, min: null, max: null, source: "explicit" },
      ],
    });
    expect(resolveFitParameters("", "x")).toEqual({ ok: true, parameters: [] });
    expect(resolveFitParameters("?", "a*x").ok).toBe(false);
  });
  test.each([
    [{ equation: "" }, /Informe uma função/],
    [{ equation: "x +" }, /Função inválida/],
    [{ equation: "a*x", parameters: "a=2[3,4]" }, /limites.*a/],
    [{ equation: "a*x", parameters: "a=2[4,3]" }, /limites.*a/],
    [{ equation: "x", minX: "NaN" }, /intervalo em X/],
    [{ equation: "x", minX: "3", maxX: "2" }, /intervalo em X/],
  ])("rejects invalid configurations", (changes, error) => {
    expect(validateFitConfig({ ...defaultFitConfig, ...changes })).toMatch(error);
  });
  test("accepts boundary values and an open range", () => {
    expect(
      validateFitConfig({
        ...defaultFitConfig,
        equation: "a*x",
        parameters: "a=2[2,3]",
        maxX: "5",
      }),
    ).toBeNull();
  });
});

describe("illustrative fit service", () => {
  const request = {
    version: 1,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 4 },
      { x: 2, y: 2 },
    ],
    equation: "a*x+b",
    parameters: "a=3",
    range: { min: 1 },
    useSx: false,
    useSy: false,
  };
  test("returns a labeled mock based on points within range", async () => {
    const result = await mockFitService.fit(request);
    expect(result.kind).toBe("mock");
    expect(result.curve).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(result.parameters.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: "a", value: 3 },
      { name: "b", value: 1 },
    ]);
  });
  test("labels the report like V1: free parameters, covariance and uncertainty considered", async () => {
    const result = await mockFitService.fit({ ...request, parameters: "a=$3", range: {} });
    expect(result.parameters.map((p) => p.name)).toEqual(["b"]);
    expect(result.covariance).toHaveLength(1);
    expect(result.hasUncertainty).toBe(false);
    expect(result.degreesOfFreedom).toBe(2);
    const sumSquares = result.residuals.reduce((sum, r) => sum + r.residual ** 2, 0);
    expect(result.chiSquared).toBeCloseTo(sumSquares, 12);
    expect(result.uncertaintyUsed).toBeCloseTo(Math.sqrt(sumSquares / 2), 12);
  });
  test("carries each point's sy into its residual", async () => {
    const result = await mockFitService.fit({
      ...request,
      points: [
        { x: 0, y: 0, sy: 0.5 },
        { x: 1, y: 2 },
        { x: 2, y: 2, sy: 0.25 },
      ],
      range: {},
    });
    expect(result.residuals.map((r) => r.sy)).toEqual([0.5, undefined, 0.25]);
  });

  test("weights the residuals by sy when every point has an uncertainty", async () => {
    const points = request.points.map((p) => ({ ...p, sy: 0.5 }));
    const result = await mockFitService.fit({ ...request, points, range: {}, useSy: true });
    expect(result.hasUncertainty).toBe(true);
    expect(result.uncertaintyUsed).toBeNull();
    const expected = result.residuals.reduce((sum, r) => sum + (r.residual / 0.5) ** 2, 0);
    expect(result.chiSquared).toBeCloseTo(expected, 12);
    const partial = [{ ...points[0] }, { ...points[1], sy: 0 }, { ...points[2] }];
    expect(
      (await mockFitService.fit({ ...request, points: partial, range: {}, useSy: true }))
        .hasUncertainty,
    ).toBe(false);
  });
  test("has no uncertainty considered when there are no degrees of freedom", async () => {
    const result = await mockFitService.fit({
      ...request,
      points: request.points.slice(0, 2),
      range: {},
      parameters: "a=1;b=1",
    });
    expect(result.degreesOfFreedom).toBe(0);
    expect(result.uncertaintyUsed).toBe(0);
  });
  test("rejects absent equations, insufficient points, duplicate x and invalid parameters", async () => {
    await expect(mockFitService.fit({ ...request, equation: " " })).rejects.toThrow(/função/);
    await expect(mockFitService.fit({ ...request, range: { min: 2 } })).rejects.toThrow(
      /dois pontos/,
    );
    await expect(
      mockFitService.fit({
        ...request,
        points: [
          { x: 1, y: 2 },
          { x: 1, y: 3 },
        ],
      }),
    ).rejects.toThrow(/x diferentes/);
    await expect(mockFitService.fit({ ...request, parameters: "?" })).rejects.toThrow();
  });
});
