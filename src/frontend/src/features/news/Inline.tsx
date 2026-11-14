/**
 * @module
 * Renders the inline formatting of release notes as React elements, never as HTML.
 */

import type { ReactNode } from "react";
import { notify } from "@/lib/notify";
import { openExternal } from "@/lib/open-external";
import { isAllowedLink } from "./changelog";

// A bold or italic marker must touch the text it wraps, so `2 * 3 * 4` stays text.
const TOKEN =
  /(\*\*(?!\s)[^*\n]+?(?<!\s)\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\*(?!\s)[^*\n]+?(?<!\s)\*)/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function renderPart(part: string, key: number): ReactNode {
  if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
    return <strong key={key}>{part.slice(2, -2)}</strong>;
  }
  if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
    return (
      <code
        key={key}
        className="rounded border border-border border-b-2 bg-card px-1.5 py-0.5 font-mono text-[11.5px] text-foreground"
      >
        {part.slice(1, -1)}
      </code>
    );
  }
  const link = LINK.exec(part);
  if (link) {
    const [, label, url] = link;
    // A link to anywhere else is shown as plain text: the app would not open it anyway.
    if (!isAllowedLink(url)) return label;
    // Open the normalized address, so `..` segments cannot step outside the allowed place.
    const target = new URL(url).href;
    return (
      <a
        key={key}
        href={target}
        rel="noreferrer"
        className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
        onClick={(event) => {
          event.preventDefault();
          void openExternal(target).catch(() =>
            notify.error("Não foi possível abrir o navegador", {
              description: "Tente novamente.",
              id: "news-link-error",
            }),
          );
        }}
      >
        {label}
      </a>
    );
  }
  if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
    return <em key={key}>{part.slice(1, -1)}</em>;
  }
  return part;
}

/**
 * Text with `**bold**`, `*italic*`, `` `code` `` and `[label](https://...)`.
 *
 * Everything is built from text nodes, so markup in the notes is shown literally and cannot run.
 * Links open in the browser only when they point to an allowed place ({@link isAllowedLink});
 * otherwise only their label is shown.
 *
 * @param props - `text`, the note's inline text.
 * @returns The formatted content.
 */
export function Inline({ text }: { text: string }) {
  return <>{text.split(TOKEN).map(renderPart)}</>;
}
