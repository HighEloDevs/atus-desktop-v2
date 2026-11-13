/**
 * @module
 * Inline editable project title for the analysis header.
 */

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Shows the project name and lets the user rename it in place.
 *
 * Clicking the name or pressing F2 while the page has focus starts editing; Enter commits,
 * Escape cancels, and leaving the field commits. Failures keep the field open with a message.
 *
 * @param props - Current name, a rename callback that rejects with a readable error, and whether
 * renaming is possible (false for unsaved, browser-only projects).
 * @returns The rendered React element.
 */
export function ProjectTitle({
  name,
  onRename,
  editable,
}: {
  name: string;
  onRename: (name: string) => Promise<void>;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editable) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "F2" || event.repeat) return;
      event.preventDefault();
      cancelled.current = false;
      setValue(name);
      setError("");
      setEditing(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, name]);

  async function commit() {
    if (busy.current || cancelled.current) return;
    if (value.trim() === name) {
      setEditing(false);
      return;
    }
    busy.current = true;
    try {
      await onRename(value);
      setEditing(false);
    } catch (reason) {
      setError(String(reason instanceof Error ? reason.message : reason));
    } finally {
      busy.current = false;
    }
  }

  if (!editable) return <h1 className="truncate text-sm leading-5 font-semibold">{name}</h1>;

  if (editing)
    return (
      <div>
        <h1 className="text-sm leading-5 font-semibold">
          <input
            autoFocus
            aria-label="Nome do projeto"
            aria-invalid={error ? true : undefined}
            className="w-full rounded border border-input bg-white px-1 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={() => void commit()}
            onKeyDown={(event) => {
              if (event.key === "Enter") void commit();
              if (event.key === "Escape") {
                cancelled.current = true;
                setEditing(false);
                setError("");
              }
            }}
          />
        </h1>
        {error && (
          <p role="alert" className="text-[11px] text-destructive">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <h1 className="text-sm leading-5 font-semibold">
      <button
        type="button"
        title="Renomear projeto (F2)"
        className="group flex max-w-full items-center gap-1 rounded px-1 -mx-1 hover:bg-muted"
        onClick={() => {
          cancelled.current = false;
          setValue(name);
          setError("");
          setEditing(true);
        }}
      >
        <span className="truncate">{name}</span>
        <Pencil
          aria-hidden="true"
          size={12}
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    </h1>
  );
}
