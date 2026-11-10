const LATEX_FUNCTIONS = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sinh",
  "cosh",
  "tanh",
  "exp",
  "log",
  "log10",
  "sqrt",
  "abs",
] as const;

/**
 * Converts ATUS equation syntax (mathjs-compatible) to a KaTeX-ready LaTeX fragment.
 * Returns null for empty input.
 */
export function equationToLatex(equation: string): string | null {
  const trimmed = equation.trim();
  if (!trimmed) return null;

  let latex = trimmed.replace(/\*\*/g, "^");

  for (const fn of LATEX_FUNCTIONS) {
    latex = latex.replace(new RegExp(`\\b${fn}\\b`, "gi"), `\\${fn}`);
  }

  latex = latex.replace(/\s*\*\s*/g, " \\cdot ");

  latex = latex.replace(/\^(\([^)]+\)|[a-zA-Z_][a-zA-Z0-9_]*|\d+(?:\.\d+)?)/g, "^{$1}");

  latex = latex.replace(/\s*([+\-/(),])\s*/g, " $1 ");

  return latex.replace(/\s+/g, " ").trim();
}
