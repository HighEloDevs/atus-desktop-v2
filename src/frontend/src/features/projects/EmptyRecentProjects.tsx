import { FileClock } from "lucide-react";

export function EmptyRecentProjects() {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-border bg-white px-5 py-6 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-md bg-[#eef0ff] text-ring">
        <FileClock aria-hidden="true" size={19} strokeWidth={1.75} />
      </span>
      <p className="text-sm font-semibold">Nenhum projeto recente</p>
      <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
        As análises que você criar ou abrir aparecerão aqui para você retomar.
      </p>
    </div>
  );
}
