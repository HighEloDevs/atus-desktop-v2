/**
 * @module
 * Home tables for recent projects and all projects, with management actions.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileChartColumn,
  FileSearch,
  FileWarning,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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

/** Number of projects shown in the recent table. */
const RECENT_LIMIT = 5;
const PAGE_SIZES = [5, 10, 20] as const;
const DEFAULT_PAGE_SIZE = 10;

const sorts: { value: Sort; label: string }[] = [
  { value: "modified", label: "Recentes" },
  { value: "name", label: "A–Z" },
];

/** Item count shown next to a section title. */
function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
      {n}
    </span>
  );
}

/** Compact segmented control built from shadcn buttons. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-0.5 rounded-md border border-input bg-white p-0.5"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="xs"
          variant={value === option.value ? "default" : "ghost"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

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
  onRename,
  onArchive,
  onDelete,
  onReveal,
  onForget,
}: {
  project: ProjectDetails;
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
        {project.available && (
          <>
            <DropdownMenuItem onSelect={onRename}>Renomear…</DropdownMenuItem>
            <DropdownMenuItem onSelect={onReveal}>Mostrar na pasta</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onArchive}>
              {project.archived ? "Desarquivar" : "Arquivar"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete}>Excluir…</DropdownMenuItem>
          </>
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

const headClass =
  "h-9 bg-[#fafbf8] px-4 text-[11px] font-medium uppercase tracking-[.04em] text-muted-foreground";
const cellClass = "px-4 py-2.5";

function NameCell({ project }: { project: ProjectDetails }) {
  return (
    <TableCell className={`${cellClass} max-w-[280px]`}>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded ${project.available ? "bg-[#eef0ff] text-ring" : "bg-[#fff1e8] text-[#8d432a]"}`}
        >
          {project.available ? (
            <FileChartColumn aria-hidden="true" size={16} />
          ) : (
            <FileWarning aria-hidden="true" size={16} />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{project.name}</span>
            {project.archived && (
              <span className="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">
                Arquivado
              </span>
            )}
          </span>
          {!project.available && (
            <span className="block truncate text-xs text-[#8d432a]">Arquivo indisponível</span>
          )}
          {project.error && (
            <span className="block truncate text-xs text-[#8d432a]">
              Não foi possível ler o arquivo
            </span>
          )}
        </span>
      </div>
    </TableCell>
  );
}

/** One project table; `columns` picks the recent or the complete layout. */
function ProjectsTable({
  labelledBy,
  columns,
  projects,
  onOpen,
  renderMenu,
}: {
  labelledBy: string;
  columns: "recent" | "all";
  projects: ProjectDetails[];
  onOpen: (project: ProjectDetails) => void;
  renderMenu: (project: ProjectDetails) => ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <Table aria-labelledby={labelledBy} className="text-[13px]">
        <TableHeader className="[&_tr]:border-border">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className={headClass}>Nome</TableHead>
            <TableHead className={headClass}>Modificado</TableHead>
            {columns === "all" && <TableHead className={headClass}>Tamanho</TableHead>}
            <TableHead className={headClass}>Local</TableHead>
            <TableHead className={`${headClass} w-[88px]`}>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.path} className="border-border hover:bg-[#f1f3ff]">
              <NameCell project={project} />
              <TableCell className={`${cellClass} text-muted-foreground`}>
                {formatModified(project.modified)}
              </TableCell>
              {columns === "all" && (
                <TableCell className={`${cellClass} text-muted-foreground`}>
                  {formatSize(project.size)}
                </TableCell>
              )}
              <TableCell
                dir="auto"
                title={project.path}
                className={`${cellClass} max-w-[260px] truncate font-mono text-xs text-muted-foreground`}
              >
                {directoryOf(project.path)}
              </TableCell>
              <TableCell className="px-2 py-1.5">
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title={project.available ? "Abrir projeto" : "Localizar arquivo"}
                    aria-label={`${project.available ? "Abrir" : "Localizar"} ${project.name}`}
                    className="text-ring hover:text-ring"
                    onClick={() => onOpen(project)}
                  >
                    {project.available ? (
                      <ArrowUpRight aria-hidden="true" />
                    ) : (
                      <FileSearch aria-hidden="true" />
                    )}
                  </Button>
                  {renderMenu(project)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
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
      setRecent(recents.flatMap((path) => byPath.get(path) ?? []).slice(0, RECENT_LIMIT));
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
          : (b.modified ?? 0) - (a.modified ?? 0) || a.name.localeCompare(b.name, "pt-BR"),
      );
  }, [all, query, filter, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  // Clamp instead of resetting so deleting the last item of a page lands on the previous page.
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

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

  const open = (project: ProjectDetails) =>
    void (project.available ? onOpen(project.path) : locate(project.path));

  return (
    <>
      <section aria-labelledby="recent-heading" className="mt-6">
        <h2 id="recent-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
          Projetos recentes
          {!loading && recent.length > 0 && <Count n={recent.length} />}
        </h2>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando projetos…
          </p>
        ) : recent.length === 0 ? (
          <EmptyRecentProjects />
        ) : (
          <ProjectsTable
            labelledBy="recent-heading"
            columns="recent"
            projects={recent}
            onOpen={open}
            renderMenu={(project) => menu(project, true)}
          />
        )}
      </section>

      <section aria-labelledby="all-heading" className="mt-8">
        <h2 id="all-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
          Todos os projetos
          {!loading && <Count n={visible.length} />}
        </h2>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            type="search"
            aria-label="Buscar projetos"
            placeholder="Buscar por nome…"
            className="h-8 max-w-[260px] bg-white"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          <Segmented
            label="Filtro"
            value={filter}
            options={filters}
            onChange={(value) => {
              setFilter(value);
              setPage(0);
            }}
          />
          <Segmented
            label="Ordenação"
            value={sort}
            options={sorts}
            onChange={(value) => {
              setSort(value);
              setPage(0);
            }}
          />
        </div>
        {loading ? null : visible.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">
            Nenhum projeto encontrado.
          </p>
        ) : (
          <>
            <ProjectsTable
              labelledBy="all-heading"
              columns="all"
              projects={pageItems}
              onOpen={open}
              renderMenu={(project) => menu(project, false)}
            />
            <nav
              aria-label="Paginação"
              className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
            >
              <span role="status">
                {currentPage * pageSize + 1}–{currentPage * pageSize + pageItems.length} de{" "}
                {visible.length}
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  Por página
                  <NativeSelect
                    size="sm"
                    aria-label="Projetos por página"
                    className="w-[4.5rem] bg-white"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(0);
                    }}
                  >
                    {PAGE_SIZES.map((size) => (
                      <NativeSelectOption key={size} value={size}>
                        {size}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
                <span>
                  Página {currentPage + 1} de {pageCount}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Página anterior"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Próxima página"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </nav>
          </>
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
