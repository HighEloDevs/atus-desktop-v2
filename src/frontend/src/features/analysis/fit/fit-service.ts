/**
 * @module
 * Provisional fit service contract and illustrative mock.
 */

import { resolveFitParameters } from "./parse-fit-parameters";
import type { ChartPoint } from "@/components/chart/Chart";

/** Temporary UI contract. The scientific engine's final API is not yet defined. */
export type FitRequest = {
  version: 1;
  points: ChartPoint[];
  equation: string;
  parameters: string;
  range: { min?: number; max?: number };
  useSx: boolean;
  useSy: boolean;
};

/**
 * Fit outcome shown in the results summary.
 *
 * Follows the ATUS V1 report: only free parameters are listed, and `chiSquared`
 * holds the same quantity in both cases. When the points carry no uncertainty
 * (`hasUncertainty` false) the UI labels it "Somatória dos resíduos absolutos ao
 * quadrado" and shows `uncertaintyUsed`; otherwise it labels it "Chi²".
 */
export type FitResponse = {
  version: 1;
  kind: "mock";
  curve: ChartPoint[];
  equation: string;
  /** Free parameters only, in equation order. */
  parameters: { name: string; value: number; uncertainty: number }[];
  chiSquared: number;
  degreesOfFreedom: number;
  /** True when every fitted point had a positive Y uncertainty. */
  hasUncertainty: boolean;
  /** sqrt(chiSquared / degreesOfFreedom); null when `hasUncertainty` is true. */
  uncertaintyUsed: number | null;
  /** Covariance of the free parameters, in the same order as `parameters`. */
  covariance: number[][];
  /** Residual (y − curve) of each fitted point. */
  residuals: { x: number; residual: number }[];
};

export interface FitService {
  fit(request: FitRequest): Promise<FitResponse>;
}

/**
 * Illustrative diagonal based on the data extent; no equation is evaluated or fitted.
 * Residuals, χ² and degrees of freedom are real arithmetic against that diagonal;
 * parameter uncertainties and correlations are fixed placeholders.
 */
export const mockFitService: FitService = {
  async fit(request) {
    if (!request.equation.trim()) throw new Error("Informe uma função de ajuste.");
    const points = request.points.filter(
      (p) =>
        (request.range.min === undefined || p.x >= request.range.min) &&
        (request.range.max === undefined || p.x <= request.range.max),
    );
    if (points.length < 2) throw new Error("São necessários pelo menos dois pontos.");
    const { minX, maxX, minY, maxY } = points.reduce(
      (bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    );
    if (minX === maxX) throw new Error("Os pontos precisam ter valores de x diferentes.");
    const parameters = resolveFitParameters(request.parameters, request.equation);
    if (!parameters.ok) throw new Error(parameters.error);
    const free = parameters.parameters.filter((p) => p.vary);
    const line = (x: number) => minY + ((x - minX) / (maxX - minX)) * (maxY - minY);
    const residuals = points.map((p) => ({ x: p.x, residual: p.y - line(p.x) }));
    const hasUncertainty = request.useSy && points.every((p) => (p.sy ?? 0) > 0);
    const chiSquared = hasUncertainty
      ? points.reduce((sum, p, i) => sum + (residuals[i].residual / (p.sy as number)) ** 2, 0)
      : residuals.reduce((sum, r) => sum + r.residual ** 2, 0);
    const degreesOfFreedom = points.length - free.length;
    const uncertainty = 0.1;
    return {
      version: 1,
      kind: "mock",
      equation: request.equation,
      parameters: free.map((p) => ({ name: p.name, value: p.value, uncertainty })),
      chiSquared,
      degreesOfFreedom,
      hasUncertainty,
      uncertaintyUsed: hasUncertainty
        ? null
        : degreesOfFreedom > 0
          ? Math.sqrt(chiSquared / degreesOfFreedom)
          : 0,
      // Illustrative correlation: alternating sign, decaying with parameter distance.
      covariance: free.map((_, i) =>
        free.map((_, j) =>
          i === j ? uncertainty ** 2 : (-1) ** (i + j) * 0.5 ** Math.abs(i - j) * uncertainty ** 2,
        ),
      ),
      residuals,
      curve: [
        { x: minX, y: minY },
        { x: maxX, y: maxY },
      ],
    };
  },
};
