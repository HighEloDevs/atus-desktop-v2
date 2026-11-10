import { FunctionInterpreter } from "./function-interpreter";
import { resolveFitParameters } from "./parse-fit-parameters";

export type FitConfig = {
  equation: string;
  parameters: string;
  minX: string;
  maxX: string;
  useSx: boolean;
  useSy: boolean;
};

export const defaultFitConfig: FitConfig = {
  equation: "",
  parameters: "",
  minX: "",
  maxX: "",
  useSx: true,
  useSy: true,
};

export function validateFitConfig(config: FitConfig): string | null {
  if (!config.equation.trim()) return "Informe uma função de ajuste.";
  const expression = FunctionInterpreter.validate(config.equation);
  if (!expression.valid) return `Função inválida: ${expression.error}`;
  const parsed = resolveFitParameters(config.parameters, config.equation);
  if (!parsed.ok) return parsed.error;
  for (const param of parsed.parameters) {
    if (
      (param.min !== null && param.max !== null && param.min > param.max) ||
      (param.min !== null && param.value < param.min) ||
      (param.max !== null && param.value > param.max)
    )
      return `Confira os limites e o valor inicial de ${param.name}.`;
  }
  const min = config.minX === "" ? undefined : Number(config.minX);
  const max = config.maxX === "" ? undefined : Number(config.maxX);
  if (
    (min !== undefined && !Number.isFinite(min)) ||
    (max !== undefined && !Number.isFinite(max)) ||
    (min !== undefined && max !== undefined && min > max)
  )
    return "Confira os limites do intervalo em X.";
  return null;
}
