import { useEffect, useRef, useState } from "react";

export type LabelAlignment = "left" | "center" | "right";
import katex from "katex";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  alignment?: LabelAlignment;
  onAlignmentChange?: (alignment: LabelAlignment) => void;
  orientation?: "horizontal" | "vertical";
  initialFontSize?: number;
};

export function EditableChartLabel({
  value,
  onChange,
  label,
  placeholder,
  alignment,
  onAlignmentChange,
  orientation = "horizontal",
  initialFontSize = 11,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const dragRef = useRef<{ start: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button || editing) return;
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      setFontSize((size) => Math.max(8, Math.min(48, size + (event.deltaY < 0 ? 1 : -1))));
    };
    button.addEventListener("wheel", handleWheel, { passive: false });
    return () => button.removeEventListener("wheel", handleWheel);
  }, [editing]);

  const html = value
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.startsWith("$") && part.endsWith("$")
        ? katex.renderToString(part.slice(1, -1), { throwOnError: false })
        : part.replace(
            /[&<>"']/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
          ),
    )
    .join("");

  if (editing) {
    return (
      <Input
        ref={inputRef}
        className="inline-block h-7 w-48 max-w-full text-center text-xs"
        aria-label={label}
        style={{ fontSize }}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      ref={buttonRef}
      aria-label={label}
      className={`min-h-6 max-w-full rounded px-1 hover:bg-[#eff2ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#364cff] ${onAlignmentChange ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-text"}`}
      style={{
        fontSize,
        ...(dragOffset
          ? { transform: `translate${orientation === "vertical" ? "Y" : "X"}(${dragOffset}px)` }
          : {}),
      }}
      onPointerDown={(event) => {
        if (!onAlignmentChange || event.button !== 0) return;
        dragRef.current = {
          start: orientation === "vertical" ? event.clientY : event.clientX,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const delta = (orientation === "vertical" ? event.clientY : event.clientX) - drag.start;
        if (Math.abs(delta) > 5) drag.moved = true;
        if (drag.moved) setDragOffset(delta);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (drag?.moved && onAlignmentChange) {
          const rect = event.currentTarget.parentElement?.getBoundingClientRect();
          const length = orientation === "vertical" ? rect?.height : rect?.width;
          if (rect && length && length > 0) {
            const fraction =
              orientation === "vertical"
                ? (event.clientY - rect.top) / length
                : (event.clientX - rect.left) / length;
            onAlignmentChange(fraction < 1 / 3 ? "left" : fraction < 2 / 3 ? "center" : "right");
          }
          suppressClick.current = true;
        }
        dragRef.current = null;
        setDragOffset(0);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragOffset(0);
      }}
      onKeyDown={(event) => {
        const previous = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
        const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
        if (!onAlignmentChange || (event.key !== previous && event.key !== next)) return;
        event.preventDefault();
        const positions: LabelAlignment[] = ["left", "center", "right"];
        const index = positions.indexOf(alignment ?? "center");
        onAlignmentChange(
          positions[Math.max(0, Math.min(2, index + (event.key === previous ? -1 : 1)))],
        );
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        setDraft(value);
        setEditing(true);
      }}
    >
      {value ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span data-html2canvas-ignore="true" className="text-[#9aa59c]">
          {placeholder}
        </span>
      )}
    </button>
  );
}
