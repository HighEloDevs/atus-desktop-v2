import { describe, expect, test } from "vitest";
import {
  detectDelimiter,
  splitLine,
  sampleDataLines,
} from "../../src/features/analysis/data-import/detect-delimiter.ts";
import { parseLocaleNumber } from "../../src/features/analysis/data-import/parse-locale-number.ts";
import { textParser } from "../../src/features/analysis/data-import/text-data-parser.ts";

describe("localized experimental data", () => {
  test.each([
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["  -1,5e+2  ", -150],
    [".25", 0.25],
  ])("parses %s as %f", (input, expected) => {
    expect(parseLocaleNumber(input)).toBe(expected);
  });

  test.each(["", "1,2,3", "1.2.3,4,5", "1.2.3,45.6", "12x", "Infinity"])(
    "rejects malformed number %s",
    (input) => expect(parseLocaleNumber(input)).toBeNaN(),
  );

  test("detects columns without confusing decimal commas", () => {
    expect(detectDelimiter("1,5\t2,3\n3,5\t4,3")).toBe("\t");
    expect(detectDelimiter("1,5;2,3\n3,5;4,3")).toBe(";");
    expect(detectDelimiter("   ")).toBe(",");
    expect(splitLine(" 1   2\t3 ", " ")).toEqual(["1", "2", "3"]);
    expect(sampleDataLines("header\n\n1;2\n3;4")).toEqual(["1;2", "3;4"]);
  });

  test("imports one column as y values with generated x values", () => {
    expect(textParser.parse("y\n1,5\n2,5", { separator: ";" })).toEqual([
      { x: 0, y: 1.5, sx: 0, sy: 0 },
      { x: 1, y: 2.5, sx: 0, sy: 0 },
    ]);
  });

  test("maps optional uncertainty columns in the documented order", () => {
    expect(textParser.parse("1;2;0,3;0,4\n5;6;0,7;0,8", { separator: ";" })).toEqual([
      { x: 1, y: 2, sx: 0.4, sy: 0.3 },
      { x: 5, y: 6, sx: 0.8, sy: 0.7 },
    ]);
  });

  test.each([
    ["1;2\n3;", /linha 2.*coluna vazia/],
    ["1;2\n3;4;5;6;7", /linha 2.*4 colunas/],
    ["1\n2;3", /Formato misto/],
    ["1;2\n3;foo4", /linha 2.*número válido/],
    ["1;2;0,1\n3;4;bad5", /incerteza y/],
    ["1;2;0,1;0,2\n3;4;0,1;bad5", /incerteza x/],
    ["apenas cabeçalho", /Nenhum dado válido/],
  ])("reports invalid rows with useful context", (input, error) => {
    expect(() => textParser.parse(input, { separator: ";" })).toThrow(error);
  });
});
