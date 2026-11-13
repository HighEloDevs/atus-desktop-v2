/**
 * @module
 * Empty state of the analysis page: a small mascot that waits for data.
 */

import { useEffect, useRef } from "react";

/** Properties of {@link EmptyState}. */
export interface EmptyStateProps {
  /** Label of the primary modifier key shown in the hint, for example `⌘` or `Ctrl`. */
  modifier: string;
}

const PUPIL_REACH = 5;

/**
 * Shows the mascot with the import hint in place of the chart. Its pupils follow the pointer and
 * it blinks and floats; animations stop with `prefers-reduced-motion` (see `globals.css`).
 *
 * @param props - See {@link EmptyStateProps}.
 * @example
 * <EmptyState modifier="⌘" />
 */
export function EmptyState({ modifier }: EmptyStateProps) {
  const mascot = useRef<SVGSVGElement>(null);
  const left = useRef<SVGCircleElement>(null);
  const right = useRef<SVGCircleElement>(null);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const svg = mascot.current;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const scale = box.width / 112 || 1;
      for (const [pupil, eyeX] of [
        [left.current, 42],
        [right.current, 72],
      ] as const) {
        const dx = event.clientX - (box.left + eyeX * scale);
        const dy = event.clientY - (box.top + 58 * scale);
        const length = Math.hypot(dx, dy) || 1;
        const reach = Math.min(PUPIL_REACH, length / 40);
        pupil?.setAttribute(
          "transform",
          `translate(${(dx / length) * reach} ${(dy / length) * reach})`,
        );
      }
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      data-testid="analysis-empty"
      className="analysis-empty absolute inset-0 grid place-items-center p-6"
    >
      <div className="grid max-w-[340px] justify-items-center gap-3.5 text-center">
        <svg
          ref={mascot}
          className="atus-mascot h-28 w-28 overflow-visible"
          viewBox="0 0 112 112"
          aria-hidden="true"
        >
          <line
            x1="56"
            y1="8"
            x2="56"
            y2="22"
            stroke="#20272c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="48"
            y1="8"
            x2="64"
            y2="8"
            stroke="#20272c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M18 26 H80 L96 42 V92 a8 8 0 0 1 -8 8 H26 a8 8 0 0 1 -8 -8 Z" fill="#20272c" />
          <path d="M80 26 L96 42 H84 a4 4 0 0 1 -4 -4 Z" fill="#f25a3c" />
          <ellipse cx="42" cy="58" rx="12" ry="13" fill="#f7f7f3" />
          <ellipse cx="72" cy="58" rx="12" ry="13" fill="#f7f7f3" />
          <g className="atus-mascot-eye">
            <circle ref={left} cx="42" cy="58" r="6" fill="#364cff" />
          </g>
          <g className="atus-mascot-eye">
            <circle ref={right} cx="72" cy="58" r="6" fill="#364cff" />
          </g>
          <path d="M48 82 H66" stroke="#f7f7f3" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        <div className="atus-mascot-shadow -mt-1.5 h-2 w-16 rounded-full bg-[#20272c]/10" />
        <h2 className="text-[18px] font-semibold tracking-tight">Esperando seus dados</h2>
        <p className="text-[13px] leading-5 text-[#66716e]">
          Cole uma tabela com{" "}
          <kbd className="rounded border border-b-2 border-[#d8ded7] bg-white px-1.5 font-mono text-[11px] text-[#20272c]">
            {modifier} B
          </kbd>{" "}
          ou importe um arquivo CSV, TXT ou DAT pelo painel Dados.
        </p>
      </div>
    </div>
  );
}
