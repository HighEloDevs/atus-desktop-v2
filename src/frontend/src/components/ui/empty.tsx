/**
 * @module
 * Shared empty state: icon tile, title and optional description in a bordered card.
 */

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Props of {@link Empty}. */
export interface EmptyProps {
  /** Icon shown in the tile above the title. */
  icon: LucideIcon;
  /** Short heading describing what is missing. */
  title: string;
  /** Optional hint explaining why it is empty or what to do next. */
  description?: string;
  /** Extra classes for the outer card. */
  className?: string;
}

/**
 * Renders the standard empty state used by lists and tables.
 * @param props - Icon, title, optional description and class name.
 * @returns The rendered React element.
 */
export function Empty({ icon: Icon, title, description, className }: EmptyProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-md border border-border bg-white px-5 py-6 text-center",
        className,
      )}
    >
      <span className="mb-3 grid size-10 place-items-center rounded-md bg-muted text-foreground">
        <Icon aria-hidden="true" size={19} strokeWidth={1.75} />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
