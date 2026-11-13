import { describe, expect, test } from "vitest";
import {
  correlationFromCovariance,
  formatSignificant,
  heatColor,
  matrixToLatex,
  parameterToLatex,
  parameterToText,
  parametersToClipboardText,
  residualAxis,
  roundToUncertainty,
  superscript,
} from "../../src/features/analysis/fit/result-format.ts";

describe("number formatting", () => {
  test("uses a decimal comma and scientific notation only at the extremes", () => {
    expect(formatSignificant(10.2)).toBe("10,2");
    expect(formatSignificant(0)).toBe("0");
    expect(formatSignificant(0.00013251)).toBe("1,325×10⁻⁴");
    expect(formatSignificant(12566.4)).toBe("1,257×10⁴");
    expect(formatSignificant(-2.5, 2)).toBe("-2,5");
    expect(formatSignificant(null)).toBe("–");
    expect(formatSignificant(Number.NaN)).toBe("–");
    expect(superscript(-12)).toBe("⁻¹²");
  });
  test("rounds the value to the uncertainty (one digit, two when it starts with 1 or 2)", () => {
    expect(roundToUncertainty(4.8213, 0.0702)).toEqual({
      value: "4,82",
      uncertainty: "0,07",
      exponent: 0,
    });
    expect(roundToUncertainty(1.2741, 0.0131)).toEqual({
      value: "1,274",
      uncertainty: "0,013",
      exponent: 0,
    });
    expect(roundToUncertainty(12566.4, 3.1)).toEqual({
      value: "12566",
      uncertainty: "3",
      exponent: 0,
    });
    expect(roundToUncertainty(1.25, 0.1)).toEqual({
      value: "1,25",
      uncertainty: "0,10",
      exponent: 0,
    });
  });
  test("keeps zero as a plain number and factors out extreme magnitudes", () => {
    expect(roundToUncertainty(0, 0.02)).toEqual({
      value: "0,000",
      uncertainty: "0,020",
      exponent: 0,
    });
    const tiny = roundToUncertainty(-1.1e-6, 9e-7);
    expect(tiny).toEqual({ value: "-1,1", uncertainty: "0,9", exponent: -6 });
    expect(parameterToText(tiny)).toBe("(-1,1 ± 0,9)×10⁻⁶");
    expect(parameterToText(roundToUncertainty(4.8213, 0.0702))).toBe("4,82 ± 0,07");
  });
  test("falls back when the uncertainty is unusable", () => {
    expect(roundToUncertainty(2.5, 0).uncertainty).toBe("0");
    expect(roundToUncertainty(2.5, Number.NaN).uncertainty).toBe("–");
    expect(roundToUncertainty(Number.NaN, 1).value).toBe("–");
  });
});

describe("matrices and clipboard text", () => {
  test("derives the correlation from the covariance", () => {
    const corr = correlationFromCovariance([
      [4, 1],
      [1, 1],
    ]);
    expect(corr).toEqual([
      [1, 0.5],
      [0.5, 1],
    ]);
    expect(
      correlationFromCovariance([
        [0, 0],
        [0, 1],
      ])[0][1],
    ).toBeNaN();
  });
  test("writes LaTeX matrices with decimal commas and exponents", () => {
    expect(
      matrixToLatex(
        [
          [1, -0.25],
          [0.00012, 0],
        ],
        3,
      ),
    ).toBe(
      "\\begin{pmatrix}\n  1 & -0{,}25 \\\\\n  1{,}20 \\times 10^{-4} & 0\n\\end{pmatrix}".replace(
        "1{,}20",
        "1{,}20",
      ),
    );
  });
  test("copies parameters like V1: separator, decimal mark and header", () => {
    const params = [{ name: "a", value: 1.5, uncertainty: 0.1 }];
    expect(
      parametersToClipboardText(params, { separator: "Tabulação", decimal: "Ponto", header: true }),
    ).toBe("\tValor\tIncerteza\na\t1.5\t0.1");
    expect(
      parametersToClipboardText(params, { separator: ";", decimal: "Vírgula", header: false }),
    ).toBe("a;1,5;0,1");
  });
  test("converts parameter names to LaTeX", () => {
    expect(parameterToLatex("V0")).toBe("V_{0}");
    expect(parameterToLatex("V_0")).toBe("V_{0}");
    expect(parameterToLatex("tau")).toBe("\\tau");
    expect(parameterToLatex("omega2")).toBe("\\omega_{2}");
    expect(parameterToLatex("a")).toBe("a");
  });
});

describe("chart helpers", () => {
  test("picks a symmetric axis with round limits", () => {
    expect(residualAxis([0.028, -0.01])).toEqual({
      limit: 0.03,
      ticks: [0.03, 0.015, 0, -0.015, -0.03],
    });
    expect(residualAxis([0, 0]).limit).toBe(1);
    expect(residualAxis([]).ticks).toEqual([1, 0.5, 0, -0.5, -1]);
  });
  test("paints cobalt for positive and coral for negative correlation", () => {
    expect(heatColor(1)).toBe("color-mix(in srgb, #364cff 62%, white)");
    expect(heatColor(-0.5)).toBe("color-mix(in srgb, #f25a3c 31%, white)");
    expect(heatColor(Number.NaN)).toBeUndefined();
  });
});
