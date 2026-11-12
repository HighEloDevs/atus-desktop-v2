/**
 * @module
 * Application navigation, project lifecycle, and desktop home screen.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";
import { ProjectQuickActions } from "@/features/projects/ProjectQuickActions";
import { RecentProjects } from "@/features/projects/RecentProjects";
import {
  chooseProject,
  newSnapshot,
  projectClient,
  rememberProject,
  type OpenProject,
} from "@/features/projects/project-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { AnalysisPage } from "@/features/analysis/AnalysisPage";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChevronRight, CircleHelp, FileClock, House, Info } from "lucide-react";

type Page = "home" | "about" | "analysis";

const navigation = [
  { label: "Sobre", icon: Info, page: "about" as const },
  { label: "Changelog", icon: FileClock },
  { label: "Ajuda", icon: CircleHelp },
];

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      <g fill="currentColor">
        <path d="M9 9H42V23H23V42H9Z" />
        <path d="M58 9H91V42H77V23H58Z" />
        <path d="M9 58H23V77H42V91H9Z" />
        <path d="M77 58H91V91H58V77H77Z" />
      </g>
      <circle cx="50" cy="50" r="11" fill="#F25A3C" />
    </svg>
  );
}

function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return (
    <aside className="sidebar flex min-h-0 flex-col border-r border-[#d8ded7] bg-[#eff1ed]">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-[#d8ded7] px-5">
        <BrandMark />
        <span className="text-[17px] font-extrabold tracking-[-.06em]">
          ATUS<span className="text-[#f25a3c]">.</span>
        </span>
        <span className="ml-auto rounded border border-[#d5dbd4] px-1.5 py-0.5 text-[9px] font-semibold text-[#748078]">
          DESKTOP
        </span>
      </div>
      <nav aria-label="Navegação principal" className="px-3 pt-6">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#7c8880]">
          Área de trabalho
        </p>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            aria-current={page === "home" ? "page" : undefined}
            className={`flex h-9 w-full items-center gap-2.5 rounded px-2.5 text-left text-[12px] ${page === "home" ? "bg-[#dfe5dd] font-semibold text-[#20272c]" : "text-[#52625a] hover:bg-[#e6eae4]"}`}
          >
            <House size={15} strokeWidth={1.7} />
            Início
            {page === "home" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#f25a3c]" />}
          </button>
        </div>
        <p className="mt-6 px-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#7c8880]">
          Aplicativo
        </p>
        <div className="mt-2 space-y-0.5">
          {navigation.map(({ label, icon: Icon, ...item }) =>
            item.page ? (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate("about")}
                aria-current={page === item.page ? "page" : undefined}
                className={`flex h-9 w-full items-center gap-2.5 rounded px-2.5 text-left text-[12px] ${page === item.page ? "bg-[#dfe5dd] font-semibold text-[#20272c]" : "text-[#52625a] hover:bg-[#e6eae4]"}`}
              >
                <Icon size={15} strokeWidth={1.7} />
                {label}
                {page === item.page && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#f25a3c]" />
                )}
              </button>
            ) : (
              <div
                key={label}
                aria-disabled="true"
                className="flex h-9 items-center gap-2.5 rounded px-2.5 text-[12px] text-[#87938a]"
              >
                <Icon size={15} strokeWidth={1.7} />
                {label}
                <span className="sr-only"> — em breve</span>
              </div>
            ),
          )}
        </div>
      </nav>
      <div className="mt-auto border-t border-[#d8ded7] px-5 py-4 text-[10px] text-[#7a877e]">
        v0.1.0
      </div>
    </aside>
  );
}

async function openProfile(url: string) {
  if (isTauri()) {
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function App() {
  const [page, setPage] = useState<Page>("home");
  const [profileError, setProfileError] = useState(false);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  const [project, setProject] = useState<OpenProject | null>(null);
  const [projectError, setProjectError] = useState("");
  const opening = useRef(false);
  const [finderPath, setFinderPath] = useState<string | null>(null);
  const runProjectAction = useCallback(
    async (action: () => Promise<OpenProject | null>, replaces?: string) => {
      if (opening.current) return;
      opening.current = true;
      setProjectError("");
      try {
        const opened = await action();
        if (!opened) return;
        setProject(opened);
        setPage("analysis");
        rememberProject(opened.path, replaces);
      } catch (error) {
        setProjectError(String(error));
      } finally {
        opening.current = false;
      }
    },
    [],
  );
  const createProject = useCallback(() => {
    if (!isTauri()) {
      setPage("analysis");
      return;
    }
    void runProjectAction(() => projectClient.create(newSnapshot()));
  }, [runProjectAction]);
  const openProject = (path: string, replaces?: string) =>
    runProjectAction(() => projectClient.open(path), replaces);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.repeat ||
        event.isComposing ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)))
      )
        return;
      if (
        (isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
        event.altKey &&
        !event.shiftKey &&
        event.code === "KeyN"
      ) {
        event.preventDefault();
        if (page !== "analysis") createProject();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isMac, page, createProject]);

  useEffect(() => {
    if (!isTauri() || !isMac) return;
    let active = true;
    async function receive() {
      if (!active) return;
      try {
        const path = await invoke<string | null>("take_finder_project");
        if (active && path) setFinderPath(path);
      } catch (error) {
        if (active) setProjectError(String(error));
      }
    }
    const listener = getCurrentWindow().listen("finder-project-requested", () => void receive());
    void listener.then(receive).catch((error) => {
      if (active) setProjectError(String(error));
    });
    return () => {
      active = false;
      void listener.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [isMac]);

  const openFinderProject = useCallback(
    async (path: string) => {
      await runProjectAction(() => projectClient.open(path));
      setFinderPath((pending) => (pending === path ? null : pending));
    },
    [runProjectAction],
  );

  useEffect(() => {
    if (page === "analysis" || !finderPath) return;
    const timer = window.setTimeout(() => void openFinderProject(finderPath), 0);
    return () => clearTimeout(timer);
  }, [page, finderPath, openFinderProject]);

  if (page === "analysis")
    return (
      <AnalysisPage
        key={project?.path}
        project={project}
        finderPath={finderPath}
        projectError={projectError}
        onOpenFinderProject={openFinderProject}
        onCancelFinderProject={() => setFinderPath(null)}
        onBack={() => {
          setProject(null);
          setPage("home");
        }}
      />
    );

  return (
    <div className="app-shell bg-[#f7f7f3] text-[#20272c]">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d8ded7] bg-[#fafbf8] px-6">
          <div className="flex items-center gap-2 text-[12px] text-[#859188]">
            <span>Área de trabalho</span>
            <ChevronRight size={13} />
            <span className="font-semibold text-[#20272c]">
              {page === "home" ? "Início" : "Sobre"}
            </span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1120px] p-6 sm:p-8">
            {page === "home" ? (
              <>
                <div className="border-b border-border pb-5">
                  <h1 className="text-[28px] leading-tight font-semibold tracking-[-.045em]">
                    Projetos
                  </h1>
                </div>
                <ProjectQuickActions
                  isMac={isMac}
                  onCreate={createProject}
                  onOpen={
                    isTauri()
                      ? () => {
                          void runProjectAction(async () => {
                            const path = await chooseProject();
                            return path ? projectClient.open(path) : null;
                          });
                        }
                      : undefined
                  }
                />
                {projectError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  >
                    {projectError}
                  </p>
                )}
                {isTauri() && <RecentProjects onOpen={openProject} />}
              </>
            ) : (
              <section className="max-w-[980px]" aria-labelledby="about-title">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#d8ded7] bg-white">
                    <BrandMark />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 id="about-title" className="text-[24px] font-semibold tracking-[-.04em]">
                        Sobre o ATUS
                      </h1>
                      <span className="rounded border border-[#d8ded7] bg-[#eff2ed] px-2 py-0.5 text-[10px] font-medium text-[#6b796f]">
                        Desktop · v0.1.0
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-[#758078]">
                      Uma ferramenta aberta para explorar e compreender dados experimentais.
                    </p>
                  </div>
                </div>
                <div className="mt-7 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    <section className="rounded-md border border-[#d8ded7] bg-white">
                      <div className="border-b border-[#e8ece7] px-5 py-4">
                        <h2 className="text-[13px] font-semibold">Nossa história</h2>
                        <p className="mt-1 text-[12px] text-[#87938a]">
                          Uma solução criada a partir de uma necessidade real.
                        </p>
                      </div>
                      <div className="space-y-4 px-5 py-5 text-[13px] leading-[1.8] text-[#52625a]">
                        <p>
                          O ATUS nasceu em 2021, durante a pandemia, para ajudar estudantes e
                          professores do Instituto de Física da USP a superar as dificuldades de
                          acesso às ferramentas de análise usadas nas aulas de Física Experimental.
                        </p>
                        <p>
                          A primeira versão desktop levou a análise para o computador de cada
                          estudante. Desde então, o projeto evolui com o mesmo propósito: tornar a
                          análise científica mais simples e acessível.
                        </p>
                      </div>
                    </section>
                    <section className="rounded-md border border-[#d8ded7] bg-white">
                      <div className="border-b border-[#e8ece7] px-5 py-4">
                        <h2 className="text-[13px] font-semibold">Quem faz o ATUS</h2>
                        <p className="mt-1 text-[12px] text-[#87938a]">
                          Pessoas que dedicam seu tempo ao projeto.
                        </p>
                      </div>
                      <div className="divide-y divide-[#edf0ec]">
                        {[
                          {
                            initials: "WM",
                            name: "Willian Maximo",
                            role: "Infraestrutura e desenvolvimento",
                            url: "https://www.linkedin.com/in/willian-gama-maximo-85297017b/",
                          },
                          {
                            initials: "LT",
                            name: "Leonardo Tamayose",
                            role: "Desenvolvimento de produto",
                            url: "https://www.linkedin.com/in/leoeiji/",
                          },
                          {
                            initials: "GF",
                            name: "Guilherme Ferrari",
                            role: "Análise quantitativa e métodos estatísticos",
                            url: "https://www.linkedin.com/in/ferrarigui/",
                          },
                        ].map((person) => (
                          <div key={person.name} className="flex items-center gap-3 px-5 py-3.5">
                            <span
                              aria-hidden="true"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eff2ed] text-[10px] font-bold text-[#607066]"
                            >
                              {person.initials}
                            </span>
                            <div>
                              <h3 className="text-[13px] font-semibold">{person.name}</h3>
                              <p className="mt-0.5 text-[11px] text-[#849087]">{person.role}</p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Abrir LinkedIn de ${person.name} no navegador`}
                              title={`LinkedIn de ${person.name}`}
                              onClick={() => {
                                setProfileError(false);
                                void openProfile(person.url).catch(() => setProfileError(true));
                              }}
                              className="ml-auto rounded p-2 text-[#66766c] hover:bg-[#eff2ed] hover:text-[#364cff]"
                            >
                              <svg
                                aria-hidden="true"
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.98V9.21h2.95v9.54ZM6.45 7.91a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.84H15.8v-4.64c0-1.11-.02-2.53-1.55-2.53-1.55 0-1.79 1.2-1.79 2.45v4.72H9.52V9.21h2.83v1.3h.04a3.1 3.1 0 0 1 2.8-1.54c3 0 3.56 1.97 3.56 4.53v5.25Z" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {profileError && (
                          <p role="alert" className="px-5 py-3 text-[12px] text-[#a43d35]">
                            Não foi possível abrir o navegador. Tente novamente.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>
                  <div className="space-y-4">
                    <section className="rounded-md border border-[#d8ded7] bg-[#f0f3ee] p-5">
                      <span className="block h-1.5 w-6 rounded-full bg-[#f25a3c]" />
                      <h2 className="mt-4 text-[14px] font-semibold">Ciência mais acessível</h2>
                      <p className="mt-2 text-[12px] leading-6 text-[#65736a]">
                        O ATUS é gratuito e de código aberto, feito para apoiar quem transforma
                        observações em conhecimento.
                      </p>
                    </section>
                    <section className="rounded-md border border-[#d8ded7] bg-white p-5">
                      <h2 className="text-[13px] font-semibold">Contato</h2>
                      <p className="mt-2 text-[12px] leading-5 text-[#758078]">
                        Dúvidas, sugestões ou interesse em contribuir?
                      </p>
                      <p className="mt-3 select-all text-[12px] font-medium text-[#364cff]">
                        atusdevs@gmail.com
                      </p>
                    </section>
                    <section className="rounded-md border border-[#d8ded7] bg-white p-5">
                      <h2 className="text-[13px] font-semibold">Sobre esta versão</h2>
                      <dl className="mt-3 space-y-2.5 text-[12px]">
                        <div className="flex justify-between gap-3">
                          <dt className="text-[#849087]">Aplicativo</dt>
                          <dd className="font-medium">ATUS Desktop</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-[#849087]">Versão</dt>
                          <dd className="font-medium">0.1.0</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-[#849087]">Licença</dt>
                          <dd className="font-medium">Código aberto</dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                </div>
                <p
                  className="mt-9 pb-2 text-center text-[16px] text-[#8a978c]"
                  style={{ fontFamily: "cursive" }}
                >
                  Aqui o mundo é criado, o mundo é lógico
                </p>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
export default App;
