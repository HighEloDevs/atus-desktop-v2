import { FilePlus2, FolderOpen } from "lucide-react";

type ProjectQuickActionsProps = {
  isMac: boolean;
  onCreate: () => void;
  onOpen?: () => void;
};

export function ProjectQuickActions({ isMac, onCreate, onOpen }: ProjectQuickActionsProps) {
  const shortcut = isMac ? "⌘ ⌥ N" : "Ctrl + Alt + N";
  const actions = [
    {
      title: "Nova análise",
      description: "Crie um projeto para importar dados e montar uma análise.",
      icon: FilePlus2,
      onClick: onCreate,
      shortcut,
      keyShortcuts: isMac ? "Meta+Alt+N" : "Control+Alt+N",
    },
    ...(onOpen
      ? [
          {
            title: "Abrir projeto",
            description: "Selecione um arquivo .atus e continue de onde parou.",
            icon: FolderOpen,
            onClick: onOpen,
          },
        ]
      : []),
  ];

  return (
    <section aria-labelledby="quick-actions-heading" className="mt-5">
      <h2 id="quick-actions-heading" className="mb-3 text-sm font-semibold">
        Acesso rápido
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map(({ title, description, icon: Icon, onClick, shortcut, keyShortcuts }) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            aria-keyshortcuts={keyShortcuts}
            className="flex h-full min-w-0 items-center gap-3 rounded-md border border-border bg-white p-4 text-left hover:border-ring hover:bg-[#f1f3ff]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#eef0ff] text-ring">
              <Icon aria-hidden="true" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
            </span>
            {shortcut && (
              <kbd
                aria-hidden="true"
                className="shrink-0 whitespace-nowrap rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground"
              >
                {shortcut}
              </kbd>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
