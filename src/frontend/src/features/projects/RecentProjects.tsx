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
    <section
      aria-labelledby="recent-heading"
      className="mt-8 rounded-md border border-[#d8ded7] bg-white"
    >
      <h2 id="recent-heading" className="border-b px-4 py-3 text-[13px] font-semibold">
        Projetos recentes
      </h2>
      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="p-4 text-xs">
          Carregando projetos…
        </p>
      )}
      {!loading && entries.length === 0 && (
        <p className="p-4 text-xs">Seus projetos aparecerão aqui.</p>
      )}
      <ul className="divide-y">
        {entries.map(({ path, available, recent }) => (
          <li key={path} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
            {available ? (
              <button
                type="button"
                className="font-semibold underline"
                title={path}
                onClick={() => void onOpen(path)}
              >
                {fileName(path)}
              </button>
            ) : (
              <>
                <span title={path}>{fileName(path)} · Arquivo indisponível</span>
                <button type="button" className="underline" onClick={() => void locate(path)}>
                  Localizar
                </button>
              </>
            )}
            {recent && (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  forgetProject(path);
                  setRevision((n) => n + 1);
                }}
              >
                Remover dos recentes
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
