// @vitest-environment jsdom
/** News page: version list, notes, gallery with keyboard, video, failing images and the update footer. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify }));
const external = vi.hoisted(() => ({ openExternal: vi.fn() }));
vi.mock("@/lib/open-external", () => external);
import { NewsPage } from "../../src/features/news/NewsPage";
import { parseChangelog } from "../../src/features/news/changelog";
import { INERT_UPDATE, UpdateContext } from "../../src/features/updates/update-context";
import { RELEASES_URL } from "../../src/features/updates/update-client";
import { RAW, VIDEO_URL, rawChangelog } from "../fixtures/changelog-fixture.mjs";

const versions = parseChangelog(rawChangelog());
let root;
let node;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  external.openExternal.mockResolvedValue(undefined);
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.restoreAllMocks();
});

/** Renders the page with the given props and update context values. */
async function show(props = {}, value = {}) {
  const onSelect = props.onSelect ?? vi.fn();
  await act(async () =>
    root.render(
      createElement(
        UpdateContext.Provider,
        { value: { ...INERT_UPDATE, ...value } },
        createElement(NewsPage, {
          versions,
          installed: "0.2.4",
          selected: "0.3.0",
          ...props,
          onSelect,
        }),
      ),
    ),
  );
  return onSelect;
}
const click = (element) => act(async () => element.click());
const keyDown = (element, key) =>
  act(async () =>
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })),
  );
const named = (name) =>
  [...document.querySelectorAll("button")].find(
    (item) => item.getAttribute("aria-label") === name || item.textContent.trim() === name,
  );
const dialog = () => document.querySelector('[role="dialog"]');

it("lists the versions newest first, flagging the new ones and marking the installed one", async () => {
  await show();
  const items = [...node.querySelectorAll("aside li button")];
  expect(items.map((item) => item.textContent.match(/^\d+\.\d+\.\d+/)[0])).toEqual([
    "0.3.0",
    "0.2.4",
    "0.2.3",
  ]);
  expect(items[0].textContent).toContain("nova");
  expect(items[1].textContent).toContain("instalada");
  expect(items[2].textContent).not.toMatch(/nova|instalada/);
  expect(items[0].getAttribute("aria-current")).toBe("true");
  expect(items[1].hasAttribute("aria-current")).toBe(false);
});

it("shows the notes of the selected version", async () => {
  await show();
  const article = node.querySelector("article[aria-label='Novidades da versão 0.3.0']");
  expect(article.textContent).toContain("Versão 0.3.0");
  expect(article.textContent).toMatch(/2 de dez\.? de 2026/);
  expect(article.querySelector("h2").textContent).toBe("Resíduos à vista");
  expect(article.textContent).toContain("O ajuste agora mostra onde ele erra.");
  const cover = article.querySelector('img[alt="Capa da versão 0.3.0"]');
  expect(cover.getAttribute("src")).toBe(`${RAW}/assets/v0.3.0/cover.svg`);
  expect(cover.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(article.textContent).toContain("Painel de resíduos");
  expect(article.querySelector("code").textContent).toBe("Resíduos");
  expect(article.textContent).toContain("Melhorias");
  expect(article.textContent).toContain("O tooltip responde às setas do teclado.");
  expect(article.textContent).toContain("Correções");
  expect(article.textContent).toContain("O MSI instala na pasta certa.");
});

it("lets the person pick another version, and falls back to the newest for an unknown one", async () => {
  const onSelect = await show();
  await click([...node.querySelectorAll("aside li button")][1]);
  expect(onSelect).toHaveBeenCalledWith("0.2.4");
  await show({ selected: "9.9.9" });
  expect(node.querySelector("article h2").textContent).toBe("Resíduos à vista");
});

it("goes back to the top when another version is shown", async () => {
  const scrollTo = vi.fn();
  HTMLElement.prototype.scrollTo = scrollTo;
  await show();
  scrollTo.mockClear();
  await show({ selected: "0.2.4" });
  expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  delete HTMLElement.prototype.scrollTo;
});

it("says there is nothing to show without any notes", async () => {
  await show({ versions: [] });
  expect(node.textContent).toContain("Ainda não há novidades para mostrar.");
});

it("shows a section only when it has content", async () => {
  await show({ selected: "0.2.3" });
  const article = node.querySelector("article");
  expect(article.textContent).toContain("Novidades");
  expect(article.textContent).not.toContain("Melhorias");
  expect(article.textContent).not.toContain("Correções");
  expect(article.querySelector("img")).toBeNull();
});

it("shows the images of a feature as a gallery that opens enlarged", async () => {
  await show({ selected: "0.2.4" });
  const thumbs = [...node.querySelectorAll("figure button")];
  expect(thumbs.map((item) => item.getAttribute("aria-label"))).toEqual([
    "Ampliar: Menu do botão de cópia",
    "Ampliar: Salvar como PNG ou JPEG",
    "Ampliar: Atalho em ação",
  ]);
  expect(node.querySelector("figcaption").textContent).toBe("Menu do botão de cópia");
  expect(dialog()).toBeNull();
  await click(thumbs[0]);
  expect(dialog().textContent).toContain("Menu do botão de cópia");
  expect(dialog().textContent).toContain("1 / 3");
  expect(dialog().querySelector("img").getAttribute("src")).toBe(`${RAW}/assets/v0.2.4/menu.png`);
});

it("moves through the enlarged images with the arrow keys and the buttons, and closes with Escape", async () => {
  await show({ selected: "0.2.4" });
  await click(node.querySelector("figure button"));
  await keyDown(dialog(), "ArrowRight");
  expect(dialog().textContent).toContain("2 / 3");
  expect(dialog().textContent).toContain("Salvar como PNG ou JPEG");
  await keyDown(dialog(), "ArrowRight");
  await keyDown(dialog(), "ArrowRight");
  expect(dialog().textContent).toContain("1 / 3");
  await keyDown(dialog(), "ArrowLeft");
  expect(dialog().textContent).toContain("3 / 3");
  await click(named("Imagem anterior"));
  expect(dialog().textContent).toContain("2 / 3");
  await click(named("Próxima imagem"));
  expect(dialog().textContent).toContain("3 / 3");
  await keyDown(dialog(), "Home");
  expect(dialog().textContent).toContain("3 / 3");
  await keyDown(dialog(), "Escape");
  expect(dialog()).toBeNull();
  await click(node.querySelector("figure button"));
  await click(named("Fechar"));
  expect(dialog()).toBeNull();
});

it("has no navigation for a single image", async () => {
  const single = parseChangelog({
    schema: 1,
    versions: [
      {
        ...rawChangelog().versions[2],
        features: [
          {
            title: "Uma",
            text: ["x"],
            images: [{ alt: "Só uma", url: `${RAW}/one.png` }],
            video: null,
          },
        ],
      },
    ],
  });
  await show({ versions: single, selected: "0.2.3" });
  await click(node.querySelector("figure button"));
  expect(dialog().textContent).not.toContain("/ 1");
  expect(named("Próxima imagem")).toBeUndefined();
  await keyDown(dialog(), "ArrowRight");
  expect(dialog().textContent).toContain("Só uma");
});

it("shows a quiet placeholder when an image cannot load", async () => {
  await show();
  const cover = node.querySelector('img[alt="Capa da versão 0.3.0"]');
  await act(async () => cover.dispatchEvent(new Event("error")));
  const placeholder = node.querySelector('[role="img"][aria-label="Capa da versão 0.3.0"]');
  expect(placeholder.textContent).toBe("Imagem indisponível");
  expect(node.querySelector('img[alt="Capa da versão 0.3.0"]')).toBeNull();
});

it("shows a video as a poster that opens YouTube in the browser", async () => {
  await show();
  const video = named('Assistir "Resíduos em 40 segundos" no YouTube (abre no navegador)');
  expect(video.querySelector("img").getAttribute("src")).toBe(`${RAW}/assets/v0.3.0/poster.png`);
  expect(video.textContent).toContain("YouTube ↗");
  await click(video);
  expect(external.openExternal).toHaveBeenCalledWith(VIDEO_URL);
  // A video with no poster gets the generic one.
  const plain = named('Assistir "Análise rápida" no YouTube (abre no navegador)');
  expect(plain.querySelector("img")).toBeNull();
  expect(plain.querySelector('svg[role="img"]')).not.toBeNull();
});

it("reports when the browser cannot be opened for a video", async () => {
  external.openExternal.mockRejectedValue(new Error("denied"));
  await show();
  await click(named('Assistir "Análise rápida" no YouTube (abre no navegador)'));
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível abrir o navegador",
    expect.objectContaining({ description: "Tente novamente." }),
  );
});

it("renders the formatting and links of the notes", async () => {
  await show();
  const text = [...node.querySelectorAll("article p")].find((item) =>
    item.textContent.includes("Veja"),
  );
  expect(text.querySelector("strong").textContent).toBe("mais");
  expect(text.querySelector("a").getAttribute("href")).toBe(
    "https://github.com/HighEloDevs/atus-desktop-v2",
  );
});

const footer = () => node.querySelector("aside > div:last-child");

it("says the installed version is the newest when no update is waiting, and can look again", async () => {
  const check = vi.fn();
  await show({ installed: "0.3.0" }, { state: { kind: "upToDate" }, check });
  expect(footer().textContent).toContain("Você está na versão 0.3.0");
  await click(named("Procurar atualizações"));
  expect(check).toHaveBeenCalledTimes(1);
});

it("shows that it is looking for updates", async () => {
  await show({}, { state: { kind: "checking" } });
  const looking = named("Procurando…");
  expect(looking.disabled).toBe(true);
  expect(looking.querySelector(".animate-spin")).not.toBeNull();
  expect(named("Procurar atualizações")).toBeUndefined();
});

it("installs a downloaded update from the foot of the list", async () => {
  const install = vi.fn();
  await show({}, { state: { kind: "ready", version: "0.3.0", notes: null }, install });
  expect(footer().textContent).toContain("ATUS 0.3.0 baixado e pronto.");
  await click(named("Atualizar e reiniciar"));
  expect(install).toHaveBeenCalledTimes(1);
});

it("shows a download in progress, with the install button disabled", async () => {
  await show({}, { state: { kind: "downloading", version: "0.3.0", downloaded: 25, total: 100 } });
  expect(footer().textContent).toContain("Baixando o ATUS 0.3.0 · 25%");
  expect(named("Atualizar e reiniciar").disabled).toBe(true);
  await show({}, { state: { kind: "downloading", version: "0.3.0", downloaded: 25, total: null } });
  expect(footer().textContent).toContain("Baixando o ATUS 0.3.0");
  expect(footer().textContent).not.toContain("%");
});

it("offers to download an announced update", async () => {
  const download = vi.fn();
  await show({}, { state: { kind: "available", version: "0.3.0", notes: null }, download });
  await click(named("Baixar atualização"));
  expect(download).toHaveBeenCalledTimes(1);
});

it("shows that it is installing", async () => {
  await show({}, { state: { kind: "installing", version: "0.3.0", startedAt: 1 } });
  expect(named("Instalando…").disabled).toBe(true);
});

it("shows a failure and retries", async () => {
  const retry = vi.fn();
  await show({}, { state: { kind: "error", stage: "download", message: "Sem conexão." }, retry });
  expect(footer().textContent).toContain("Sem conexão.");
  await click(named("Tentar de novo"));
  expect(retry).toHaveBeenCalledTimes(1);
});

it("explains an update to install by hand and opens the releases page", async () => {
  const openReleases = vi.fn();
  await show(
    {},
    {
      state: {
        kind: "manual",
        version: "0.3.0",
        reason: "readOnlyLocation",
        url: RELEASES_URL,
        notes: null,
      },
      openReleases,
    },
  );
  expect(footer().textContent).toContain("pasta Aplicativos");
  await click(named("Baixar 0.3.0"));
  expect(openReleases).toHaveBeenCalledTimes(1);
});

it("keeps the update status at the bottom of the page on a narrow window", async () => {
  await show({}, { state: { kind: "ready", version: "0.3.0", notes: null } });
  const small = node.querySelector(".sm\\:hidden");
  expect(small.textContent).toContain("Atualizar e reiniciar");
});
