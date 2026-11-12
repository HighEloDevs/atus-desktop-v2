/**
 * @module
 * Safe HTML markup for chart labels that may embed inline LaTeX.
 */

import katex from "katex";

const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Converts a chart label into HTML, rendering `$...$` segments with KaTeX.
 *
 * Text outside the math delimiters is HTML-escaped, so the result is safe to
 * inject as markup. Invalid LaTeX is rendered as an inline KaTeX error instead
 * of throwing.
 * @param value - Label text as typed by the user.
 * @returns An HTML string for the label.
 * @example
 * renderLabelHtml("Tempo $t^2$ (s)"); // "Tempo <span class=\"katex\">…</span> (s)"
 */
export function renderLabelHtml(value: string): string {
  return value
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.startsWith("$") && part.endsWith("$")
        ? katex.renderToString(part.slice(1, -1), { throwOnError: false })
        : part.replace(/[&<>"']/g, (character) => htmlEscapes[character]),
    )
    .join("");
}
