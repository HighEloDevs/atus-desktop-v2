/** Fitted equation with its parameter values, as shown in the chart legend. */
import { expect, it } from "vitest";
import { fittedEquationLatex } from "../../src/features/analysis/fit/fitted-equation";

it("puts each fitted value, rounded to its uncertainty, in place of its symbol", () => {
  expect(
    fittedEquationLatex("a*x+b", [
      { name: "a", value: 1.1834, uncertainty: 0.027 },
      { name: "b", value: 4.08, uncertainty: 0.11 },
    ]),
  ).toBe("f(x) = {1{,}183} \\cdot x + {4{,}08}");
});

it("wraps negative and scaled values and keeps fixed parameters as symbols", () => {
  expect(
    fittedEquationLatex("A*exp(-x/tau)+c", [
      { name: "A", value: -2.5, uncertainty: 0.3 },
      { name: "tau", value: 0.00042, uncertainty: 0.00001 },
    ]),
  ).toBe(
    "f(x) = {\\left(-2{,}5\\right)} \\cdot \\exp ( - x / {\\left(4{,}20 \\times 10^{-4}\\right)} ) + c",
  );
});

it("does not replace a parameter name inside longer names or function calls", () => {
  expect(fittedEquationLatex("a2*x+a", [{ name: "a", value: 3, uncertainty: 0.5 }])).toBe(
    "f(x) = a2 \\cdot x + {3{,}0}",
  );
  expect(fittedEquationLatex("", [])).toBeNull();
  expect(fittedEquationLatex("k*x", [{ name: "k", value: 2, uncertainty: 0 }])).toBe(
    "f(x) = {2} \\cdot x",
  );
});
