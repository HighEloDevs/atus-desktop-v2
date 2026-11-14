// @vitest-environment jsdom
/** Update button, banner and confirmation: what each state shows and what each control does. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { UpdateBanner } from "../../src/features/updates/UpdateBanner";
import { UpdateButton } from "../../src/features/updates/UpdateButton";
import { UpdateDialog } from "../../src/features/updates/UpdateDialog";
import { INERT_UPDATE, UpdateContext } from "../../src/features/updates/update-context";
import { RELEASES_URL } from "../../src/features/updates/update-client";

let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

/** Fresh action spies on top of the inert context. */
function actions() {
  return {
    check: vi.fn(),
    retry: vi.fn(),
    download: vi.fn(),
    cancelDownload: vi.fn(),
    install: vi.fn(),
    dismissBanner: vi.fn(),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    openReleases: vi.fn(),
  };
}

/** Renders `element` with the given update context values. */
async function show(element, value) {
  await act(async () =>
    root.render(
      createElement(UpdateContext.Provider, { value: { ...INERT_UPDATE, ...value } }, element),
    ),
  );
}
const click = (element) => act(async () => element.click());
const buttonNamed = (name) =>
  [...document.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent.trim() === name,
  );

const ready = { kind: "ready", version: "0.3.0", notes: "Resumo da versão." };

it.each([
  { kind: "idle" },
  { kind: "checking" },
  { kind: "upToDate" },
  { kind: "unavailable", reason: "developmentBuild" },
])("shows no button while there is nothing to do (%j)", async (state) => {
  await show(createElement(UpdateButton), { state });
  expect(node.querySelector("button")).toBeNull();
});

it("offers to download an announced update", async () => {
  const spies = actions();
  await show(createElement(UpdateButton), {
    ...spies,
    state: { kind: "available", version: "0.3.0", notes: null },
  });
  const button = buttonNamed("Baixar atualização");
  expect(button.title).toBe("Baixar a versão 0.3.0");
  await click(button);
  expect(spies.download).toHaveBeenCalledTimes(1);
});

it("shows the download progress, with a way to cancel it", async () => {
  const spies = actions();
  await show(createElement(UpdateButton), {
    ...spies,
    state: { kind: "downloading", version: "0.3.0", downloaded: 36_700_000, total: 91_647_590 },
  });
  const trigger = buttonNamed("Baixando 40%");
  expect(trigger.className).toContain("tabular-nums");
  await click(trigger);
  const bar = document.querySelector('[role="progressbar"]');
  expect(bar.getAttribute("aria-valuenow")).toBe("40");
  expect(document.body.textContent).toContain("Baixando o ATUS 0.3.0");
  expect(document.body.textContent).toContain("35,0 MB de 87,4 MB");
  expect(document.body.textContent).toContain("Você continua trabalhando");
  await click(buttonNamed("Cancelar"));
  expect(spies.cancelDownload).toHaveBeenCalledTimes(1);
});

it("shows an unknown-size download without a percentage", async () => {
  await show(createElement(UpdateButton), {
    state: { kind: "downloading", version: "0.3.0", downloaded: 1_048_576, total: null },
  });
  await click(buttonNamed("Baixando"));
  expect(document.querySelector('[role="progressbar"]').hasAttribute("aria-valuenow")).toBe(false);
  expect(document.body.textContent).toContain("1,0 MB");
  expect(document.body.textContent).not.toContain(" de ");
});

it("marks a downloaded update with a coral dot and opens the confirmation", async () => {
  const spies = actions();
  await show(createElement(UpdateButton), { ...spies, state: ready });
  const button = buttonNamed("Atualizar");
  expect(button.title).toBe("Atualizar para a versão 0.3.0");
  expect(button.querySelector(".bg-brand-coral")).not.toBeNull();
  await click(button);
  expect(spies.openDialog).toHaveBeenCalledTimes(1);
});

it("shows that it is installing, and cannot be clicked", async () => {
  await show(createElement(UpdateButton), {
    state: { kind: "installing", version: "0.3.0", startedAt: 1 },
  });
  const button = buttonNamed("Instalando…");
  expect(button.disabled).toBe(true);
  expect(button.querySelector(".animate-spin")).not.toBeNull();
});

it("offers to try again after a failure, with the reason as the tooltip", async () => {
  const spies = actions();
  await show(createElement(UpdateButton), {
    ...spies,
    state: { kind: "error", stage: "download", message: "Sem conexão." },
  });
  const button = buttonNamed("Tentar de novo");
  expect(button.title).toBe("Sem conexão.");
  await click(button);
  expect(spies.retry).toHaveBeenCalledTimes(1);
});

it("explains why it must be installed by hand and opens the releases page", async () => {
  const spies = actions();
  await show(createElement(UpdateButton), {
    ...spies,
    state: {
      kind: "manual",
      version: "0.3.0",
      reason: "readOnlyLocation",
      url: RELEASES_URL,
      notes: null,
    },
  });
  await click(buttonNamed("Baixar 0.3.0"));
  expect(document.body.textContent).toContain("pasta Aplicativos");
  await click(
    [...document.querySelectorAll("button")]
      .filter((item) => item.textContent.includes("Baixar 0.3.0"))
      .at(-1),
  );
  expect(spies.openReleases).toHaveBeenCalledTimes(1);
});

it("shows only the icon in the compact variant, with the label for assistive technology", async () => {
  await show(createElement(UpdateButton, { compact: true, className: "ml-auto" }), {
    state: ready,
  });
  const button = node.querySelector("button");
  expect(button.getAttribute("aria-label")).toBe("Atualizar");
  expect(button.textContent).toBe("");
  expect(button.className).toContain("ml-auto");
  expect(button.querySelector(".bg-brand-coral").className).toContain("absolute");
  await show(createElement(UpdateButton, { compact: true }), {
    state: { kind: "downloading", version: "0.3.0", downloaded: 10, total: 100 },
  });
  expect(node.querySelector("button").getAttribute("aria-label")).toBe("Baixando 10%");
});

it("announces a downloaded update in the banner, which installs or closes", async () => {
  const spies = actions();
  await show(createElement(UpdateBanner), { ...spies, state: ready, bannerVisible: true });
  const banner = node.querySelector('[role="status"]');
  expect(banner.textContent).toContain("Nova versão · 0.3.0");
  expect(banner.textContent).toContain("O ATUS 0.3.0 está pronto para instalar");
  expect(banner.textContent).toContain("Resumo da versão.");
  await click(buttonNamed("Atualizar e reiniciar"));
  expect(spies.install).toHaveBeenCalledTimes(1);
  await click(buttonNamed("Fechar até amanhã"));
  expect(spies.dismissBanner).toHaveBeenCalledTimes(1);
});

it("falls back to a generic line when the release has no summary", async () => {
  await show(createElement(UpdateBanner), {
    state: { kind: "ready", version: "0.3.0", notes: null },
    bannerVisible: true,
  });
  expect(node.textContent).toContain("A atualização já foi baixada.");
});

it("announces an update to install by hand with a download button", async () => {
  const spies = actions();
  await show(createElement(UpdateBanner), {
    ...spies,
    state: {
      kind: "manual",
      version: "0.3.0",
      reason: "installFailed",
      url: RELEASES_URL,
      notes: null,
    },
    bannerVisible: true,
  });
  expect(node.textContent).toContain("Há uma nova versão do ATUS");
  expect(node.textContent).toContain("atualizada manualmente");
  expect(buttonNamed("Atualizar e reiniciar")).toBeUndefined();
  await click(buttonNamed("Baixar"));
  expect(spies.openReleases).toHaveBeenCalledTimes(1);
});

it("shows no banner when it is not due, or the update is not offered", async () => {
  await show(createElement(UpdateBanner), { state: ready, bannerVisible: false });
  expect(node.innerHTML).toBe("");
  await show(createElement(UpdateBanner), { state: { kind: "upToDate" }, bannerVisible: true });
  expect(node.innerHTML).toBe("");
});

it("asks before installing, and says what will happen", async () => {
  const spies = actions();
  await show(createElement(UpdateDialog), { ...spies, state: ready, dialogOpen: true });
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Atualizar para o ATUS 0.3.0");
  expect(dialog.textContent).toContain("Resumo da versão.");
  expect(dialog.textContent).toContain("salva o projeto aberto, instala a atualização e reinicia");
  await click(buttonNamed("Atualizar e reiniciar"));
  expect(spies.install).toHaveBeenCalledTimes(1);
  await click(buttonNamed("Depois"));
  expect(spies.closeDialog).toHaveBeenCalledTimes(1);
});

it("closes the confirmation with Escape", async () => {
  const spies = actions();
  await show(createElement(UpdateDialog), {
    ...spies,
    state: { kind: "ready", version: "0.3.0", notes: null },
    dialogOpen: true,
  });
  expect(document.querySelector('[role="dialog"]').textContent).toContain("já foi baixada");
  await act(async () =>
    document
      .querySelector('[role="dialog"]')
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(spies.closeDialog).toHaveBeenCalled();
});

it("keeps the confirmation closed until asked", async () => {
  await show(createElement(UpdateDialog), { state: ready, dialogOpen: false });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
