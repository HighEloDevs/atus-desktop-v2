/**
 * @module
 * Fit service used while a lesson runs.
 *
 * The lesson does not depend on the scientific engine: when the student types the
 * expected model, the service answers with the lesson's ready parameters. Curve,
 * residuals and degrees of freedom are computed from those parameters and the points,
 * so everything the screen shows is consistent.
 */

import { FunctionInterpreter } from "@/features/analysis/fit/function-interpreter";
import type { FitResponse, FitService } from "@/features/analysis/fit/fit-service";
import type { Lesson } from "./lesson";

/** Number of samples drawn on the fitted curve. */
const CURVE_SAMPLES = 80;

/** Sample values used to compare two models without parsing them symbolically. */
const PROBES: Record<string, number>[] = [
  { x: 0.3, a: 0.7 },
  { x: 1.7, a: -0.4 },
  { x: -0.9, a: 2.3 },
  { x: 0.05, a: 11 },
];

/**
 * Tells whether a typed equation is the same model as the lesson's.
 *
 * Both are evaluated at a few points, with the same values for parameters of the
 * same name, so `g*x^2/2 + v0*x + y0` and `y0 + v0*x + 0.5*g*x^2` both match.
 * @param typed - Equation typed by the student.
 * @param expected - Equation of the lesson.
 * @returns True when both use the same variables and agree at every probe.
 */
export function isEquivalentModel(typed: string, expected: string): boolean {
  try {
    const a = new FunctionInterpreter(typed);
    const b = new FunctionInterpreter(expected);
    const names = [...a.getVariables()].sort();
    if (names.join() !== [...b.getVariables()].sort().join()) return false;
    return PROBES.every((probe) => {
      const scope = Object.fromEntries(
        names.map((name, i) => [name, name in probe ? probe[name] : probe.a + 0.37 * (i + 1)]),
      );
      const left = a.executeWithNames(scope);
      const right = b.executeWithNames(scope);
      return Number.isFinite(left) && Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(right));
    });
  } catch {
    return false;
  }
}

/**
 * Creates the fit service of a lesson.
 * @param lesson - Lesson whose ready result is returned.
 * @returns A service that answers the expected model and rejects others with a hint.
 * @throws From `fit`, an Error in Portuguese when the model is not the lesson's one.
 */
export function createLessonFitService(lesson: Lesson): FitService {
  const { equation, parameters, covariance, chiSquared } = lesson.fit;
  return {
    async fit(request) {
      if (!isEquivalentModel(request.equation, equation))
        throw new Error(`Nesta lição, use o modelo ${equation}.`);
      const model = new FunctionInterpreter(request.equation);
      const values = Object.fromEntries(parameters.map((p) => [p.name, p.value]));
      const at = (x: number) => model.executeWithNames({ ...values, x });
      const xs = request.points.map((p) => p.x);
      const min = Math.min(...xs);
      const max = Math.max(...xs);
      const curve = Array.from({ length: CURVE_SAMPLES + 1 }, (_, i) => {
        const x = min + ((max - min) * i) / CURVE_SAMPLES;
        return { x, y: at(x) };
      });
      const response: FitResponse = {
        version: 1,
        kind: "mock",
        equation: request.equation,
        parameters,
        chiSquared,
        degreesOfFreedom: request.points.length - parameters.length,
        hasUncertainty: true,
        uncertaintyUsed: null,
        covariance,
        residuals: request.points.map((p) => ({ x: p.x, residual: p.y - at(p.x), sy: p.sy })),
        curve,
      };
      return response;
    },
  };
}
