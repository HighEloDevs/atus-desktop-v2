/**
 * @module
 * Empty state for the recent-project list.
 */

import { FileClock } from "lucide-react";

import { Empty } from "@/components/ui/empty";

/**
 * Renders the message shown when no recent projects are available.
 * @returns The rendered React element.
 */
export function EmptyRecentProjects() {
  return (
    <Empty
      icon={FileClock}
      title="Nenhum projeto recente"
      description="As análises que você criar ou abrir aparecerão aqui para você retomar."
    />
  );
}
