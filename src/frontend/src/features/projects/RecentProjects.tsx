import {
  ArrowUpRight,
  FileChartColumn,
  FileWarning,
  FolderOpen,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import {
  chooseProject,
  fileName,
  forgetProject,
  projectClient,
  recentPaths,
} from "./project-client";

export function RecentProjects({
  onOpen,
}: {
  onOpen: (path: string, replaces?: string) => Promise<void>;
}) {
  const [revision, setRevision] = useState(0);
  const [entries, setEntries] = useState<{ path: string; available: boolean; recent: boolean }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const recent = recentPaths();
      const discovered = await projectClient.list().catch((reason: unknown) => {
        if (active) setError(`Não foi possível listar a pasta de projetos: ${String(reason)}`);
        return [] as string[];
      });
      const paths = [...new Set([...recent, ...discovered])];
      const rows = await Promise.all(
        paths.map(async (path) => ({
          path,
          available: discovered.includes(path) || (await projectClient.available(path)),
          recent: recent.includes(path),
        })),
      );
      if (active) {
        setEntries(rows);
        setLoading(false);
      }
    }
    void load().catch((reason) => {
      if (active) {
        setError(String(reason));
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [revision]);

  async function locate(path: string) {
    try {
      const replacement = await chooseProject();
      if (replacement) await onOpen(replacement, path);
    } catch (reason) {
      setError(String(reason));
    }
  }

  return (
    <section aria-labelledby="recent-heading" className="mt-6">
      <h2 id="recent-heading" className="mb-3 text-sm font-semibold">
        Projetos recentes
      </h2>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando projetos…
        </p>
      ) : entries.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-5">
          <FolderOpen aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Nenhum projeto recente</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crie uma análise ou abra um arquivo .atus.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-white">
          {entries.map(({ path, available, recent }) => (
            <li
              key={path}
              className="group flex min-w-0 items-center gap-1 px-2 py-1 first:rounded-t-md last:rounded-b-md hover:bg-[#f1f3ff] focus-within:bg-[#f1f3ff]"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-2 py-2.5 text-left"
                title={path}
                onClick={() => void (available ? onOpen(path) : locate(path))}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded ${available ? "bg-[#eef0ff] text-ring" : "bg-[#fff1e8] text-[#8d432a]"}`}
                >
                  {available ? (
                    <FileChartColumn aria-hidden="true" size={16} />
                  ) : (
                    <FileWarning aria-hidden="true" size={16} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{fileName(path)}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground" dir="auto">
                    {available
                      ? path.replace(/[\\/][^\\/]+$/, "")
                      : "Arquivo indisponível · Localizar"}
                  </span>
                </span>
                {available && (
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground group-hover:text-ring"
                  />
                )}
              </button>
              {recent ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Opções de ${fileName(path)}`}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        forgetProject(path);
                        setRevision((n) => n + 1);
                      }}
                    >
                      Remover dos recentes
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span aria-hidden="true" className="w-8 shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
