// @vitest-environment jsdom
/** Inline text of the notes: formatting, links to allowed places only, and no markup. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify }));
const external = vi.hoisted(() => ({ openExternal: vi.fn() }));
vi.mock("@/lib/open-external", () => external);
import { Inline } from "../../src/features/news/Inline";

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
});

const render = (text) => act(async () => root.render(createElement(Inline, { text })));

it("formats bold, italic and code", async () => {
  await render("Veja **negrito**, *itálico* e `⌃⌘B` no texto.");
  expect(node.querySelector("strong").textContent).toBe("negrito");
  expect(node.querySelector("em").textContent).toBe("itálico");
  expect(node.querySelector("code").textContent).toBe("⌃⌘B");
  expect(node.textContent).toBe("Veja negrito, itálico e ⌃⌘B no texto.");
});

it("keeps plain text, stray asterisks and incomplete markers as they are", async () => {
  await render("2 * 3 * 4 = 24, **aberto e `solto");
  expect(node.textContent).toBe("2 * 3 * 4 = 24, **aberto e `solto");
  expect(node.querySelector("strong, em, code")).toBeNull();
});

it("shows markup literally, so it cannot run", async () => {
  await render('<img src=x onerror="alert(1)"> <script>alert(1)</script> **<b>x</b>**');
  expect(node.querySelector("img, script, b")).toBeNull();
  expect(node.textContent).toContain('<img src=x onerror="alert(1)">');
  expect(node.textContent).toContain("<script>alert(1)</script>");
  expect(node.querySelector("strong").textContent).toBe("<b>x</b>");
});

it("opens a link to an allowed place in the browser, with the normalized address", async () => {
  await render("Veja o [projeto](https://github.com/HighEloDevs/atus-desktop-v2).");
  const link = node.querySelector("a");
  expect(link.textContent).toBe("projeto");
  expect(link.getAttribute("href")).toBe("https://github.com/HighEloDevs/atus-desktop-v2");
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => link.dispatchEvent(click));
  expect(click.defaultPrevented).toBe(true);
  expect(external.openExternal).toHaveBeenCalledWith(
    "https://github.com/HighEloDevs/atus-desktop-v2",
  );
});

it("shows only the label of a link to anywhere else", async () => {
  for (const url of [
    "https://example.com/x",
    "http://atusweb.com.br/",
    "javascript:void0",
    "https://github.com/HighEloDevs/../Evil/x",
  ]) {
    await render(`Veja [aqui](${url}) agora.`);
    expect(node.querySelector("a")).toBeNull();
    expect(node.textContent).toBe("Veja aqui agora.");
  }
});

it("reports when the browser cannot be opened", async () => {
  external.openExternal.mockRejectedValue(new Error("denied"));
  await render("[site](https://atusweb.com.br/)");
  await act(async () => node.querySelector("a").click());
  expect(notify.error).toHaveBeenCalledWith(
    "Não foi possível abrir o navegador",
    expect.objectContaining({ description: "Tente novamente." }),
  );
});
