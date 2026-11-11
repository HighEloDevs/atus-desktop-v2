/**
 * @module
 * Parsing and resolution of model parameter constraints.
 */

import { FunctionInterpreter } from "./function-interpreter";

export type ParsedFitParameter = {
  name: string;
  value: number;
  vary: boolean;
  min: number | null;
  max: number | null;
  source: "explicit" | "implicit";
};

export type ParseResult =
  { ok: true; parameters: ParsedFitParameter[] } | { ok: false; error: string };

const ASSIGNMENT_PATTERN =
  /([a-zA-Z_]\w*)\s*=\s*(\$)?\s*([-+]?(?:\d*\.*\d+))\s*(?:\[\s*([-+]?(?:\d*\.*\d+))\s*,\s*([-+]?(?:\d*\.*\d+))\s*\])?/g;

const GAP_PATTERN = /^[;\s]*$/;

function parseConstraintsString(paramString: string): ParseResult {
  if (!paramString.trim()) {
    return { ok: true, parameters: [] };
  }

  const parameters: ParsedFitParameter[] = [];
  const matches = [...paramString.matchAll(ASSIGNMENT_PATTERN)];

  if (matches.length === 0) {
    return { ok: false, error: `Nenhum parâmetro válido encontrado em: ${paramString}` };
  }

  let lastEnd = 0;
  for (const match of matches) {
    const gap = paramString.slice(lastEnd, match.index);
    if (!GAP_PATTERN.test(gap)) {
      return { ok: false, error: `Sintaxe inválida: '${gap.trim()}' em '${paramString}'` };
    }

    const name = match[1];
    const isFixed = Boolean(match[2]);
    const value = parseFloat(match[3]);
    const minVal = match[4];
    const maxVal = match[5];

    const existingIndex = parameters.findIndex((p) => p.name === name);
    const parsed: ParsedFitParameter = {
      name,
      value,
      vary: !isFixed,
      min: minVal !== undefined ? parseFloat(minVal) : null,
      max: maxVal !== undefined ? parseFloat(maxVal) : null,
      source: "explicit",
    };

    if (existingIndex >= 0) {
      parameters[existingIndex] = parsed;
    } else {
      parameters.push(parsed);
    }

    lastEnd = (match.index ?? 0) + match[0].length;
  }

  const tail = paramString.slice(lastEnd);
  if (!GAP_PATTERN.test(tail)) {
    return { ok: false, error: `Sintaxe inválida no final: '${tail.trim()}'` };
  }

  return { ok: true, parameters };
}

function extractEquationParameters(equation: string): string[] {
  const trimmed = equation.trim();
  if (!trimmed) return [];

  try {
    const interpreter = new FunctionInterpreter(trimmed);
    return interpreter.getVariables().filter((name) => name !== "x");
  } catch {
    return [];
  }
}

function fillMissingParameters(
  explicit: ParsedFitParameter[],
  equationParams: string[],
): ParsedFitParameter[] {
  const byName = new Map(explicit.map((p) => [p.name, p]));
  const merged: ParsedFitParameter[] = [];

  for (const name of equationParams) {
    const existing = byName.get(name);
    if (existing) {
      merged.push(existing);
      byName.delete(name);
      continue;
    }

    merged.push({
      name,
      value: 1,
      vary: true,
      min: null,
      max: null,
      source: "implicit",
    });
  }

  for (const extra of byName.values()) {
    merged.push(extra);
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Resolves explicit parameter constraints against variables in a model expression.
 * @param constraints - Parameter text.
 * @param equation - Model expression.
 * @returns A parse result containing parameters or an error.
 */
export function resolveFitParameters(constraints: string, equation: string): ParseResult {
  const parsed = parseConstraintsString(constraints);
  if (!parsed.ok) return parsed;

  const equationParams = extractEquationParameters(equation);
  if (equationParams.length === 0 && parsed.parameters.length === 0) {
    return { ok: true, parameters: [] };
  }

  if (equationParams.length === 0) {
    return {
      ok: true,
      parameters: [...parsed.parameters].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  return {
    ok: true,
    parameters: fillMissingParameters(parsed.parameters, equationParams),
  };
}

/**
 * Parses parameter declarations and bounds from text.
 * @param paramString - Parameter declarations.
 * @returns A parse result containing parsed parameters or an error.
 */
export function parseFitParameters(paramString: string): ParseResult {
  return parseConstraintsString(paramString);
}
