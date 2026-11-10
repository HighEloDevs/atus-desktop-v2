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

export type FitResponse = {
  version: 1;
  kind: "mock";
  curve: ChartPoint[];
  equation: string;
  parameters: { name: string; value: number; uncertainty: number }[];
  chiSquared: number;
  degreesOfFreedom: number;
};

export interface FitService {
  fit(request: FitRequest): Promise<FitResponse>;
}

/** Illustrative diagonal based on the data extent; no equation is evaluated or fitted. */
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
    return {
      version: 1,
      kind: "mock",
      equation: request.equation,
      parameters: parameters.parameters.map((p) => ({
        name: p.name,
        value: p.value,
        uncertainty: 0.1,
      })),
      chiSquared: 1.23,
      degreesOfFreedom: 10,
      curve: [
        { x: minX, y: minY },
        { x: maxX, y: maxY },
      ],
    };
  },
};
