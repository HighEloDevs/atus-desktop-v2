import { create, all, isSymbolNode } from "mathjs";
import type { MathJsInstance, EvalFunction } from "mathjs";

/**
 * FunctionInterpreter
 *
 * A class to interpret and execute mathematical expressions as functions.
 * Example: "a*x + b" where a, x, b are variables
 */

export interface FunctionInterpreterOptions {
  /**
   * Names of variables in the order they should be passed
   * If not specified, variables are detected automatically in alphabetical order
   */
  variables?: string[];
}

export class FunctionInterpreter {
  private compiledFunction: EvalFunction | null = null;
  private expression: string;
  private variables: string[];
  private math: MathJsInstance;

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
   * Compiles the expression into an executable function
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
   * Executes the compiled expression with the provided values
   * The values must be in the same order as the variables
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
   * Executes the expression with named values
   * Example: executeWithNames({ x: 5, a: 2, b: 3 }) for "a*x + b"
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
   * Executes the expression and returns the result or default value in case of error
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
   * Returns the detected variables in the expression
   */
  getVariables(): string[] {
    return [...this.variables];
  }

  /**
   * Returns the original expression
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
   * Validates if an expression can be compiled without executing it
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
   * Creates an interpreter and executes immediately
   */
  static executeOnce(expression: string, ...values: number[]): number {
    const interpreter = new FunctionInterpreter(expression);
    return interpreter.execute(...values);
  }
}

/**
 * Helper to quickly create and use an expression interpreter
 */
export function interpretExpression(
  expression: string,
  options?: FunctionInterpreterOptions,
): FunctionInterpreter {
  return new FunctionInterpreter(expression, options);
}
