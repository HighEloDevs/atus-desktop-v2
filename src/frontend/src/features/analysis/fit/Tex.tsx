/**
 * @module
 * Inline KaTeX rendering for equations and parameter symbols.
 */

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders a LaTeX fragment with KaTeX. Invalid input is shown as plain text instead of throwing.
 * @param props - The LaTeX source and an optional class name for the wrapper.
 * @returns A span containing the rendered formula.
 */
export function Tex({ latex, className }: { latex: string; className?: string }) {
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false }), [latex]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
