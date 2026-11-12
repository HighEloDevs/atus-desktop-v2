import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";
import { textParser as parser } from "../../src/features/analysis/data-import/text-data-parser.ts";
import { validateFitConfig } from "../../src/features/analysis/fit/fit-config.ts";
import { mockFitService } from "../../src/features/analysis/fit/fit-service.ts";

test("imported data and uncertainties reach the explicitly simulated fit", async () => {
  const content = await readFile(new URL("../fixtures/analysis-flow.csv", import.meta.url), "utf8");
  const points = parser.parse(content, { separator: "auto" });
  assert.deepEqual(points, [
    { x: 0, y: 1, sx: 0.01, sy: 0.1 },
    { x: 1, y: 3, sx: 0.02, sy: 0.2 },
    { x: 2, y: 5, sx: 0.03, sy: 0.3 },
  ]);
  const config = {
    equation: "a*x+b",
    parameters: "",
    minX: "1",
    maxX: "2",
    useSx: true,
    useSy: true,
  };
  assert.equal(validateFitConfig(config), null);
  const response = await mockFitService.fit({
    version: 1,
    points,
    equation: config.equation,
    parameters: config.parameters,
    range: { min: Number(config.minX), max: Number(config.maxX) },
    useSx: config.useSx,
    useSy: config.useSy,
  });
  assert.equal(response.version, 1);
  assert.equal(response.kind, "mock");
  assert.equal(response.equation, config.equation);
  assert.deepEqual(response.curve, [
    { x: 1, y: 3 },
    { x: 2, y: 5 },
  ]);
});

test("malformed imported data and invalid fit ranges fail before a simulated fit", async () => {
  assert.throws(() => parser.parse("0;1\n2;bad3", { separator: ";" }), /linha 2/);
  const config = {
    equation: "a*x+b",
    parameters: "",
    minX: "3",
    maxX: "1",
    useSx: true,
    useSy: true,
  };
  assert.match(validateFitConfig(config), /intervalo em X/);
  await assert.rejects(
    mockFitService.fit({
      version: 1,
      points: [{ x: 0, y: 1 }],
      equation: config.equation,
      parameters: "",
      range: {},
      useSx: false,
      useSy: false,
    }),
    /pelo menos dois pontos/,
  );
});
