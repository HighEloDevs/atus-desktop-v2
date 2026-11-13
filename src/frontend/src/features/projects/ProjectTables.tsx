/**
 * @module
 * Home tables for recent projects and all projects, with management actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileWarning, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { EmptyRecentProjects } from "./EmptyRecentProjects";
import { DeleteProjectDialog, RenameProjectDialog } from "./ProjectDialogs";
import { formatModified, formatSize } from "./format-project";
import {
  chooseProject,
  fileName,
  forgetProject,
  projectClient,
  recentPaths,
  replaceRecentPath,
  type ProjectDetails,
} from "./project-client";

type Filter = "active" | "archived" | "all";
type Sort = "modified" | "name";
type Pending = { kind: "rename" | "delete"; project: ProjectDetails } | null;

const filters: { value: Filter; label: string }[] = [
  { value: "active", label: "Ativos" },
  { value: "archived", label: "Arquivados" },
  { value: "all", label: "Todos" },
];

/** Reports a project-list failure as a global snackbar. */
function reportError(title: string, reason: unknown) {
  notify.error(title, { description: String(reason), id: "project-list-error" });
}

/** Directory part of a path, for the location column. */
function directoryOf(path: string) {
  return path.replace(/[\\/][^\\/]*$/, "");
}

function ActionsMenu({
  project,
  onOpen,
  onRename,
  onArchive,
  onDelete,
  onReveal,
  onForget,
}: {
  project: ProjectDetails;
  onOpen: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReveal: () => void;
  onForget?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${project.name}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {project.available ? (
          <>
            <DropdownMenuItem onSelect={onOpen}>Abrir</DropdownMenuItem>
            <DropdownMenuItem onSelect={onRename}>Renomear…</DropdownMenuItem>
            <DropdownMenuItem onSelect={onReveal}>Mostrar na pasta</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              {project.archived ? "Desarquivar" : "Arquivar"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete}>Excluir…</DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={onOpen}>Localizar…</DropdownMenuItem>
        )}
        {onForget && (
          <>
            {project.available && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={onForget}>Remover dos recentes</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NameCell({ project, onOpen }: { project: ProjectDetails; onOpen: () => void }) {
  return (
    <TableCell className="max-w-[260px]">
      <button
        type="button"
        title={project.path}
        className="flex w-full min-w-0 flex-col rounded-sm text-left"
        onClick={onOpen}
      >
        <span className="flex items-center gap-2 truncate font-medium">
          {!project.available && <FileWarning aria-hidden="true" size={14} className="shrink-0" />}
          <span className="truncate">{project.name}</span>
          {project.archived && (
            <span className="rounded bg-muted px-1.5 text-[11px] font-normal text-muted-foreground">
              Arquivado
            </span>
          )}
        </span>
        {!project.available && (
          <span className="text-xs font-normal text-[#8d432a]">
            Arquivo indisponível · Localizar
          </span>
        )}
        {project.error && (
          <span className="text-xs font-normal text-[#8d432a]">Não foi possível ler o arquivo</span>
        )}
      </button>
    </TableCell>
  );
}

/**
 * Shows the recent-projects and all-projects tables and runs rename, archive, delete and reveal.
 * @param props - Callback that opens a selected or relocated project.
 * @returns The rendered React element.
 */
export function ProjectTables({
  onOpen,
}: {
  onOpen: (path: string, replaces?: string) => Promise<void>;
}) {
  const [revision, setRevision] = useState(0);
  const [recent, setRecent] = useState<ProjectDetails[]>([]);
  const [all, setAll] = useState<ProjectDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [sort, setSort] = useState<Sort>("modified");
  const [pending, setPending] = useState<Pending>(null);
  const reload = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    async function load() {
      const [folder, archived] = await Promise.all([
        projectClient.list().catch((reason: unknown) => {
          if (active) reportError("Não foi possível listar a pasta de projetos", reason);
          return [] as string[];
        }),
        projectClient.listArchived().catch(() => [] as string[]),
      ]);
      const recents = recentPaths();
      const details = await projectClient.details([
        ...new Set([...recents, ...folder, ...archived]),
      ]);
      if (!active) return;
      const byPath = new Map(details.map((item) => [item.path, item]));
      setRecent(recents.flatMap((path) => byPath.get(path) ?? []));
      setAll([...folder, ...archived].flatMap((path) => byPath.get(path) ?? []));
      setLoading(false);
    }
    void load().catch((reason) => {
      if (active) {
        reportError("Não foi possível carregar os projetos", reason);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [revision]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((item) => filter === "all" || item.archived === (filter === "archived"))
      .filter((item) => item.name.toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name, "pt-BR")
          : (b.modified ?? 0) - (a.modified ?? 0),
      );
  }, [all, query, filter, sort]);

  async function locate(path: string) {
    try {
      const replacement = await chooseProject();
      if (replacement) await onOpen(replacement, path);
    } catch (reason) {
      reportError("Não foi possível localizar o projeto", reason);
    }
  }

  async function rename(project: ProjectDetails, name: string) {
    const next = await projectClient.rename(project.path, name);
    replaceRecentPath(project.path, next);
    setPending(null);
    reload();
    notify.success("Projeto renomeado", {
      description: name.trim(),
      actions: [
        {
          label: "Desfazer",
          onClick: () => {
            void projectClient
              .rename(next, project.name)
              .then((back) => replaceRecentPath(next, back))
              .catch((reason) => reportError("Não foi possível desfazer", reason))
              .finally(reload);
          },
        },
      ],
    });
  }

  async function toggleArchive(project: ProjectDetails) {
    const archiving = !project.archived;
    try {
      const next = await (archiving
        ? projectClient.archive(project.path)
        : projectClient.unarchive(project.path));
      replaceRecentPath(project.path, next);
      notify.success(archiving ? "Projeto arquivado" : "Projeto restaurado", {
        description: project.name,
        actions: [
          {
            label: "Desfazer",
            onClick: () => {
              void (archiving ? projectClient.unarchive(next) : projectClient.archive(next))
                .then((back) => replaceRecentPath(next, back))
                .catch((reason) => reportError("Não foi possível desfazer", reason))
                .finally(reload);
            },
          },
        ],
      });
    } catch (reason) {
      reportError("Não foi possível alterar o arquivamento", reason);
    }
    reload();
  }

  async function remove(project: ProjectDetails) {
    setPending(null);
    try {
      await projectClient.remove(project.path);
      forgetProject(project.path);
      notify.success("Projeto movido para a Lixeira", { description: project.name });
    } catch (reason) {
      reportError("Não foi possível excluir o projeto", reason);
    }
    reload();
  }

  function reveal(project: ProjectDetails) {
    void Promise.resolve(projectClient.reveal(project.path)).catch((reason) =>
      reportError("Não foi possível abrir a pasta", reason),
    );
  }

  function menu(project: ProjectDetails, fromRecents: boolean) {
    return (
      <ActionsMenu
        project={project}
        onOpen={() => void (project.available ? onOpen(project.path) : locate(project.path))}
        onRename={() => setPending({ kind: "rename", project })}
        onArchive={() => void toggleArchive(project)}
        onDelete={() => setPending({ kind: "delete", project })}
        onReveal={() => reveal(project)}
        onForget={
          fromRecents
            ? () => {
                forgetProject(project.path);
                reload();
              }
            : undefined
        }
      />
    );
  }

  const open = (project: ProjectDetails) => () =>
    void (project.available ? onOpen(project.path) : locate(project.path));

  return (
    <>
      <section aria-labelledby="recent-heading" className="mt-6">
        <h2 id="recent-heading" className="mb-3 text-sm font-semibold">
          Projetos recentes
        </h2>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando projetos…
          </p>
        ) : recent.length === 0 ? (
          <EmptyRecentProjects />
        ) : (
          <div className="rounded-md border border-border bg-white">
            <Table aria-labelledby="recent-heading">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modificado</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((project) => (
                  <TableRow key={project.path}>
                    <NameCell project={project} onOpen={open(project)} />
                    <TableCell>{formatModified(project.modified)}</TableCell>
                    <TableCell
                      dir="auto"
                      title={project.path}
                      className="max-w-[320px] truncate text-xs text-muted-foreground"
                    >
                      {directoryOf(project.path)}
                    </TableCell>
                    <TableCell className="text-right">{menu(project, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="all-heading" className="mt-8">
        <h2 id="all-heading" className="mb-3 text-sm font-semibold">
          Todos os projetos
        </h2>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Buscar projetos"
            placeholder="Buscar por nome…"
            className="h-8 max-w-[280px] bg-white"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div role="group" aria-label="Filtro" className="flex gap-1">
            {filters.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filter === value ? "default" : "outline"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div role="group" aria-label="Ordenação" className="flex gap-1">
            {(
              [
                ["modified", "Recentes"],
                ["name", "A–Z"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={sort === value ? "default" : "outline"}
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {loading ? null : visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
            Nenhum projeto encontrado.
          </p>
        ) : (
          <div className="rounded-md border border-border bg-white">
            <Table aria-labelledby="all-heading">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modificado</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((project) => (
                  <TableRow key={project.path}>
                    <NameCell project={project} onOpen={open(project)} />
                    <TableCell>{formatModified(project.modified)}</TableCell>
                    <TableCell>{formatSize(project.size)}</TableCell>
                    <TableCell
                      dir="auto"
                      title={project.path}
                      className="max-w-[320px] truncate text-xs text-muted-foreground"
                    >
                      {directoryOf(project.path)}
                    </TableCell>
                    <TableCell className="text-right">{menu(project, false)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {pending?.kind === "rename" && (
        <RenameProjectDialog
          key={pending.project.path}
          name={pending.project.name || fileName(pending.project.path)}
          onSubmit={(name) => rename(pending.project, name)}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.kind === "delete" && (
        <DeleteProjectDialog
          name={pending.project.name}
          onConfirm={() => void remove(pending.project)}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
