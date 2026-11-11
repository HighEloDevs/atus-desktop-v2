import { create, all, isSymbolNode } from "mathjs";
import type { MathJsInstance, EvalFunction } from "mathjs";

/**
 * Compiles and evaluates mathematical expressions with mathjs.
 *
 * Variable values can be supplied by position or by name. This interpreter
 * evaluates expressions only; it does not perform scientific fitting.
 *
 * @module function-interpreter
 */

export interface FunctionInterpreterOptions {
  /**
   * Names of variables in the order they should be passed
   * If not specified, variables are detected automatically in alphabetical order
   */
  variables?: string[];
}

/**
 * Evaluates one expression using detected or explicitly ordered variables.
 *
 * @example
 * const model = new FunctionInterpreter("a*x+b", { variables: ["a", "x", "b"] });
 * model.execute(2, 3, 1); // 7
 */
export class FunctionInterpreter {
  private compiledFunction: EvalFunction | null = null;
  private expression: string;
  private variables: string[];
  private math: MathJsInstance;

  /**
   * Creates an interpreter and normalizes the exponent operator.
   *
   * @param expression - Mathjs expression to evaluate.
   * @param options - Optional variable order; detected variables are used when omitted.
   */
  constructor(expression: string, options: FunctionInterpreterOptions = {}) {
    // Replace exponential operator ** with ^
    this.expression = expression.trim().replace(/\*\*/g, "^");

    // Create a math.js instance with full functionality
    this.math = create(all);

    // If variables are not specified, detect them automatically
    if (options.variables && options.variables.length > 0) {
      this.variables = options.variables;
    } else {
      this.variables = this.extractVariables(this.expression);
    }
  }

  /**
   * Compiles the expression for subsequent evaluation.
   * @returns This interpreter.
   * @throws If mathjs cannot compile the expression.
   */
  compile(): this {
    try {
      // Use math.js compile method for safe expression compilation
      this.compiledFunction = this.math.compile(this.expression);
    } catch (error) {
      throw new Error(
        `Error compiling expression: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    return this;
  }

  /**
   * Evaluates the expression, compiling it on first use.
   * @param values - One value for each variable, in the order from getVariables().
   * @returns The result converted to a number.
   * @throws If the value count is wrong, compilation fails, or evaluation fails.
   */
  execute(...values: number[]): number {
    if (!this.compiledFunction) {
      this.compile();
    }

    if (!this.compiledFunction) {
      throw new Error("Expression could not be compiled");
    }

    if (values.length !== this.variables.length) {
      throw new Error(
        `Number of values (${values.length}) does not match number of variables (${this.variables.length}): [${this.variables.join(", ")}]`,
      );
    }

    try {
      // Build scope object with variable names and values
      const scope: Record<string, number> = {};
      this.variables.forEach((variable, index) => {
        scope[variable] = values[index];
      });

      // Evaluate using math.js with the scope
      const result = this.compiledFunction.evaluate(scope);

      // Ensure we return a number
      return typeof result === "number" ? result : Number(result);
    } catch (error) {
      throw new Error(
        `Error executing expression: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  /**
   * Evaluates the expression using an object keyed by variable name.
   * @param namedValues - Values for all required variables; extra keys are ignored.
   * @returns The result converted to a number.
   * @throws If a variable is missing or evaluation fails.
   * @example
   * new FunctionInterpreter("a*x+b").executeWithNames({ x: 5, a: 2, b: 3 }); // 13
   */
  executeWithNames(namedValues: Record<string, number>): number {
    const values = this.variables.map((variable) => {
      if (!(variable in namedValues)) {
        throw new Error(`Variable '${variable}' was not provided`);
      }
      return namedValues[variable];
    });

    return this.execute(...values);
  }

  /**
   * Evaluates the expression or returns a fallback after logging an error.
   * @param defaultValue - Value returned if evaluation fails.
   * @param values - Values in the order from getVariables().
   * @returns The evaluated number or the fallback.
   */
  executeOrDefault(defaultValue: number, ...values: number[]): number {
    try {
      return this.execute(...values);
    } catch (error) {
      console.error("Error executing expression:", error);
      return defaultValue;
    }
  }

  /**
   * Returns a copy of the variable order used for positional evaluation.
   * @returns Variable names in evaluation order.
   */
  getVariables(): string[] {
    return [...this.variables];
  }

  /**
   * Returns the trimmed expression with exponent operators normalized to ^.
   * @returns The normalized expression.
   */
  toString(): string {
    return this.expression;
  }

  /**
   * Extracts variable names from a mathematical expression using math.js parser
   */
  private extractVariables(expression: string): string[] {
    try {
      // Parse the expression using math.js
      const node = this.math.parse(expression);

      // Get math.js built-in constants and functions
      const mathConstants = new Set([
        "e",
        "E",
        "pi",
        "PI",
        "i",
        "Infinity",
        "NaN",
        "true",
        "false",
        "null",
        "undefined",
      ]);

      const mathFunctions = new Set(
        Object.keys(this.math).filter(
          (key) => typeof (this.math as unknown as Record<string, unknown>)[key] === "function",
        ),
      );

      const variables = new Set<string>();

      // Traverse the expression tree to find symbol nodes
      node.traverse((node) => {
        if (isSymbolNode(node)) {
          const name = node.name;
          // Exclude math.js constants and functions
          if (!mathConstants.has(name) && !mathFunctions.has(name)) {
            variables.add(name);
          }
        }
      });

      // Return in alphabetical order for consistency
      return Array.from(variables).sort();
    } catch {
      // Fallback to regex-based extraction if parsing fails
      return this.extractVariablesWithRegex(expression);
    }
  }

  /**
   * Fallback method to extract variables using regex
   */
  private extractVariablesWithRegex(expression: string): string[] {
    // Keywords and mathematical functions that are not variables
    const keywords = new Set([
      "Math",
      "PI",
      "E",
      "abs",
      "acos",
      "acosh",
      "acot",
      "acoth",
      "acsc",
      "acsch",
      "asec",
      "asech",
      "asin",
      "asinh",
      "atan",
      "atan2",
      "atanh",
      "cbrt",
      "ceil",
      "cos",
      "cosh",
      "cot",
      "coth",
      "csc",
      "csch",
      "exp",
      "floor",
      "log",
      "log10",
      "log2",
      "max",
      "min",
      "pow",
      "random",
      "round",
      "sec",
      "sech",
      "sign",
      "sin",
      "sinh",
      "sqrt",
      "tan",
      "tanh",
      "true",
      "false",
      "null",
      "undefined",
      "Infinity",
      "NaN",
      "parseInt",
      "parseFloat",
      "isNaN",
      "isFinite",
      "pi",
      "e",
      "i",
    ]);

    // Regex to find identifiers
    const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const variables = new Set<string>();

    let match;
    while ((match = identifierRegex.exec(expression)) !== null) {
      const identifier = match[1];

      // Ignore keywords and mathematical functions
      if (!keywords.has(identifier)) {
        variables.add(identifier);
      }
    }

    return Array.from(variables);
  }

  /**
   * Checks whether an expression compiles without evaluating it.
   * @param expression - Expression to compile.
   * @returns Validation status and, on failure, the compilation error message.
   */
  static validate(expression: string): { valid: boolean; error?: string } {
    try {
      const interpreter = new FunctionInterpreter(expression);
      interpreter.compile();
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Creates an interpreter and evaluates it with detected variable order.
   * @param expression - Expression to evaluate.
   * @param values - Values in detected variable order.
   * @returns The evaluated number.
   * @throws If compilation, value binding, or evaluation fails.
   */
  static executeOnce(expression: string, ...values: number[]): number {
    const interpreter = new FunctionInterpreter(expression);
    return interpreter.execute(...values);
  }
}

/**
 * Creates an interpreter without compiling or evaluating the expression.
 * @param expression - Mathjs expression to interpret.
 * @param options - Optional variable order.
 * @returns A new interpreter.
 */
export function interpretExpression(
  expression: string,
  options?: FunctionInterpreterOptions,
): FunctionInterpreter {
  return new FunctionInterpreter(expression, options);
}
