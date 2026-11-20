// @vitest-environment jsdom
/**
 * The Aprender tab and the gravity lesson end to end: the real analysis screen with the
 * lesson fit service, the app events that complete each step, the rigid script and pause.
 * driver.js is replaced by a recorder; its own drawing is not under test.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
const bridge = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  invoke: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: bridge.isTauri, invoke: bridge.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: bridge.listen }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../../src/features/projects/ProjectTables", () => ({ ProjectTables: () => null }));
vi.mock("../../src/components/chart/Chart", () => ({
  Chart: ({ series, graphicRef }) =>
    createElement(
      "div",
      { "data-testid": "chart", ref: graphicRef },
      series.map((s) => `${s.points.length}:${s.linePoints.length}`).join(";"),
    ),
}));
const exporter = vi.hoisted(() => ({
  renderImage: vi.fn(async () => new Blob()),
  copyImage: vi.fn(async () => {}),
  saveImage: vi.fn(async () => null),
  errorMessage: (error) => String(error),
}));
vi.mock("../../src/components/chart/export-image", () => exporter);
const tours = vi.hoisted(() => []);
vi.mock("driver.js", () => ({
  driver: (config) => {
    const tour = { config, highlight: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
    tours.push(tour);
    return tour;
  },
}));
vi.mock("driver.js/dist/driver.css", () => ({}));
import App from "../../src/App";
import { gravityLesson } from "../../src/features/learn/lessons/gravity";
import { rangeToTsv } from "../../src/features/learn/sheet-range";

// The free-fall test runs the whole lesson: ~16 s on the slow macOS Intel runner, over the 15 s default.
vi.setConfig({ testTimeout: 60000 });

let root;
let node;
let readText;
let writeText;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  tours.length = 0;
  localStorage.clear();
  Object.defineProperty(navigator, "platform", { value: "Linux", configurable: true });
  readText = vi.fn();
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    value: { readText, writeText },
    configurable: true,
  });
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

const all = () => [...document.body.querySelectorAll("button")];
const button = (name) =>
  all().find((b) => b.textContent.trim() === name || b.getAttribute("aria-label") === name);
const click = (element) => act(async () => element.click());
const step = () => tours.at(-1)?.highlight.mock.lastCall?.[0];
const target = () => {
  const element = step()?.element;
  return element && `[data-tour="${element.dataset.tour}"]`;
};
const canContinue = () => step()?.popover.showButtons.includes("next");
const next = () => act(async () => step().popover.onNextClick());
const key = (init, at = window) =>
  act(async () =>
    at.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })),
  );

async function openLesson() {
  await act(async () => root.render(createElement(App)));
  const item = [...node.querySelectorAll("aside nav button")].find((b) =>
    b.textContent.includes("Aprender"),
  );
  await click(item);
  expect(item.getAttribute("aria-current")).toBe("page");
  expect(node.querySelector("header").textContent).toContain("Aprender");
  expect(node.textContent).toContain("Pêndulo simples");
  await click(all().find((b) => b.textContent.includes("Queda livre com faiscador")));
  expect(document.documentElement.classList.contains("lesson-active")).toBe(true);
  expect(node.querySelector("h1").textContent).toBe("Queda livre com faiscador");
  expect(node.textContent).toContain("metade da menor divisão");
  expect(tours).toHaveLength(0);
}

async function copyFromSheet() {
  await click(button("Começar a análise"));
  expect(target()).toBe('[data-tour="lesson-sheet"]');
  // Everything the step needs sits inside the highlight; the overlay blocks the rest.
  expect(button("Selecionar dados").closest('[data-tour="lesson-sheet"]')).not.toBeNull();
  expect(canContinue()).toBe(false);
  await click(button("Selecionar dados"));
  const event = new Event("copy", { bubbles: true, cancelable: true });
  event.clipboardData = { setData: vi.fn() };
  await act(async () => document.dispatchEvent(event));
  // Copying moves on by itself to the analysis screen.
}

async function pasteAndFit() {
  expect(target()).toBe('[data-tour="analysis-canvas"]');
  const { columns, rows } = gravityLesson.dataset;
  readText.mockResolvedValue(rangeToTsv(columns, rows, { r0: 0, c0: 0, r1: 17, c1: 2 }));
  await key({ code: "KeyB", ctrlKey: true });
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("17:0");

  // Writing the model and running the fit are two steps; each moves on by itself.
  expect(target()).toBe('[data-tour="fit-equation"]');
  expect(document.querySelector(target()).querySelector("input")).not.toBeNull();
  const input = node.querySelector('input[aria-label^="Função de ajuste"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const type = (text) =>
    act(async () => {
      set.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await type("a*x + b");
  expect(target()).toBe('[data-tour="fit-equation"]');
  await click(button("Executar ajustes Ctrl ↵"));
  expect(notify.error).toHaveBeenCalledWith(
    expect.stringContaining("Falha no ajuste"),
    expect.objectContaining({ description: "Nesta lição, use o modelo v0 + a*x." }),
  );
  expect(target()).toBe('[data-tour="fit-equation"]');
  // Any form of the same model counts.
  await type("a*x + v0");
  expect(target()).toBe('[data-tour="fit-run"]');
  expect(document.querySelector(target()).textContent).toContain("Executar ajustes");
  expect(canContinue()).toBe(false);
  await key({ code: "Enter", ctrlKey: true });
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("17:81");
  expect(node.textContent).toContain("9,78 ± 0,03");
  expect(node.textContent).toContain("Lição · Queda livre com faiscador");
}

it("runs the free-fall lesson from the Aprender tab to the end", async () => {
  await openLesson();
  await copyFromSheet();
  await pasteAndFit();

  // Ver detalhes sits on the result card: clicking it completes the step.
  expect(target()).toBe('[data-tour="analysis-results"]');
  expect(canContinue()).toBe(false);
  await click(document.querySelector('[data-tour="fit-details"]'));
  expect(target()).toBe('[data-tour="copy-parameters"]');
  expect(canContinue()).toBe(false);
  // Closing the dialog before copying goes back to opening it.
  await key({ key: "Escape" }, document.querySelector('[role="dialog"]'));
  expect(target()).toBe('[data-tour="analysis-results"]');
  await click(document.querySelector('[data-tour="fit-details"]'));
  expect(target()).toBe('[data-tour="copy-parameters"]');
  // The balloon sits outside the dialog: using it must not close the report.
  const balloon = document.createElement("div");
  balloon.className = "driver-popover";
  document.body.append(balloon);
  await act(async () => {
    balloon.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    balloon.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
  balloon.remove();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(target()).toBe('[data-tour="copy-parameters"]');

  await click(document.querySelector('[data-tour="copy-parameters"]'));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining("9.783"));
  expect(target()).toBe('[data-tour="fit-details-dialog"]');
  expect(canContinue()).toBe(false);
  // The dialog is open: Esc closes it, which completes the step, and does not pause.
  await key({ key: "Escape" }, document.querySelector('[role="dialog"]'));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(node.textContent).not.toContain("Lição pausada");

  // A read-only step continues with Próximo.
  expect(target()).toBe('[data-tour="analysis-chart"]');
  expect(canContinue()).toBe(true);
  await next();
  expect(target()).toBe('[data-tour="chart-export"]');
  await click(button("Copiar imagem"));
  expect(exporter.copyImage).toHaveBeenCalledOnce();

  expect(step().popover.title).toBe("Lição concluída");
  expect(step().popover.nextBtnText).toBe("Concluir");
  await next();
  expect(tours.at(-1).destroy).toHaveBeenCalled();
  expect(document.documentElement.classList.contains("lesson-active")).toBe(false);
  expect(node.querySelector("h1").textContent).toBe("Aprender");
});

it("keeps the script rigid and pauses with Esc", async () => {
  await openLesson();
  await copyFromSheet();

  // A click outside the highlight only explains what is missing.
  tours.at(-1).config.overlayClickBehavior();
  expect(notify.info).toHaveBeenCalledWith(
    "Conclua este passo para continuar",
    expect.objectContaining({ id: "lesson-blocked" }),
  );
  // Continuing before the step is done does nothing.
  await next();
  expect(target()).toBe('[data-tour="analysis-canvas"]');

  // driver.js's balloon has role="dialog"; it must not keep Esc from pausing.
  const balloon = document.createElement("div");
  balloon.className = "driver-popover";
  balloon.setAttribute("role", "dialog");
  document.body.append(balloon);
  const destroyed = tours.at(-1).destroy;
  await key({ key: "Escape" });
  balloon.remove();
  expect(destroyed).toHaveBeenCalled();
  expect(node.textContent).toContain("Lição pausada");
  await click(button("Continuar"));
  expect(target()).toBe('[data-tour="analysis-canvas"]');
  // The controls ride on the balloon while the lesson runs, never over the highlight.
  expect(node.querySelector(".lesson-controls")).toBeNull();
  const footer = document.createElement("div");
  const balloonButton = () => document.createElement("button");
  await act(async () =>
    step().popover.onPopoverRender({
      footer,
      previousButton: balloonButton(),
      nextButton: balloonButton(),
    }),
  );
  const [pause, exit] = footer.querySelectorAll("button");
  await click(pause);
  expect(node.textContent).toContain("Lição pausada");
  await click(button("Continuar"));

  // Leaving never depends on pausing first.
  await click(exit);
  expect(node.querySelector("h1").textContent).toBe("Aprender");
});

it("quits the app at once from any step of a lesson, which has nothing to save", async () => {
  const handlers = {};
  bridge.isTauri.mockReturnValue(true);
  bridge.listen.mockImplementation(async (event, handler) => {
    handlers[event] = handler;
    return () => {};
  });
  await openLesson();
  await act(async () => handlers["app-quit-requested"]());
  expect(bridge.invoke).toHaveBeenCalledWith("app_quit");
  await copyFromSheet();
  bridge.invoke.mockClear();
  await act(async () => handlers["app-quit-requested"]());
  expect(bridge.invoke).toHaveBeenCalledWith("app_quit");
});

it("leaves from the intro back to the tab", async () => {
  await openLesson();
  await key({ key: "Escape" }); // nothing to pause on the intro
  await click(button("Voltar a Aprender"));
  expect(node.querySelector("h1").textContent).toBe("Aprender");
});
