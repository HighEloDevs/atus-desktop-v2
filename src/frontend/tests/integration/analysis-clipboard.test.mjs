// @vitest-environment jsdom
/** Clipboard shortcuts and the separator dialog in the analysis workspace. */
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
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({
    project: null,
    status: "Salvo",
    error: "",
    canLeave: async () => true,
    flush: async () => true,
    saveAs: async () => {},
  }),
}));
vi.mock("../../src/components/chart/Chart", () => ({
  Chart: ({ series }) =>
    createElement(
      "div",
      { "data-testid": "chart" },
      series.map((s) => `${s.name}:${s.points.length}:${s.linePoints.length}`).join(";"),
    ),
}));
import { AnalysisPage } from "../../src/features/analysis/AnalysisPage";

const NAME = "Dados colados do clipboard";
let root;
let node;
let readText;

beforeEach(() => {
  Object.values(notify).forEach((fn) => fn.mockClear());
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  readText = vi.fn();
  Object.defineProperty(navigator, "clipboard", { value: { readText }, configurable: true });
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render() {
  await act(async () =>
    root.render(
      createElement(AnalysisPage, {
        onBack: vi.fn(),
        project: null,
        finderPath: null,
        onOpenFinderProject: vi.fn(),
        onCancelFinderProject: vi.fn(),
      }),
    ),
  );
}

async function press(code, target = window, init = {}) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        code,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

async function paste(text) {
  readText.mockResolvedValue(text);
  await press("KeyB");
}

const chart = () => node.querySelector('[data-testid="chart"]')?.textContent;
const errorTitle = () => notify.error.mock.lastCall?.[0] ?? "";
const errorText = () =>
  notify.error.mock.lastCall
    ?.flat()
    .map((x) => x?.description ?? x)
    .join(" ") ?? "";
const dialog = () => document.body.querySelector('[role="dialog"]');

async function setSelect(select, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  await act(async () => {
    set.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function setInput(label, value) {
  const input = node.querySelector(`input[aria-label="${label}"]`);
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("Ctrl+B creates a dataset from the clipboard and announces it", async () => {
  await render();
  expect(node.textContent).toContain("1–9");
  await paste("x;y\n1;2\n2;4");
  expect(chart()).toBe(`${NAME}:2:0`);
  expect(notify.success).toHaveBeenLastCalledWith("Dados colados importados com sucesso.");
  await paste("5,5\t6,5");
  expect(chart()).toBe(`${NAME}:2:0;${NAME}:1:0`);
});

it("Ctrl+N replaces the data of dataset N and keeps its fit configuration", async () => {
  await render();
  await paste("1;2\n2;4");
  await paste("9;9");
  await setInput(`Função de ajuste de ${NAME}`, "a*x");
  readText.mockResolvedValue("1;1\n2;2\n3;3\n4;4");
  await press("Digit1");
  expect(chart()).toBe(`${NAME}:4:0;${NAME}:1:0`);
  expect(node.querySelector(`input[aria-label="Função de ajuste de ${NAME}"]`).value).toBe("a*x");
  expect(notify.success.mock.lastCall[0]).toContain("Dados do conjunto 1");
});

it("reports a missing dataset index without reading the clipboard", async () => {
  await render();
  await paste("1;2");
  await press("Digit3");
  expect(errorTitle()).toBe("Não há conjunto de dados 3.");
  expect(readText).toHaveBeenCalledTimes(1);
});

it("reports empty and denied clipboards and keeps existing data", async () => {
  await render();
  await paste("1;2\n2;4");
  await paste("   ");
  expect(errorTitle()).toBe("A área de transferência está vazia.");
  readText.mockRejectedValue(new Error("denied"));
  await press("KeyB");
  expect(errorTitle()).toContain("Verifique as permissões");
  expect(chart()).toBe(`${NAME}:2:0`);
});

it("rejects clipboard data with negative uncertainties without opening the dialog", async () => {
  await render();
  await paste("1;2;-1");
  expect(errorTitle()).toBe("Dados inválidos");
  expect(errorText()).toContain("incertezas não podem ser negativas");
  expect(dialog()).toBeNull();
  expect(chart()).toBeUndefined();
});

it("opens the separator dialog on a parse failure and retries with the chosen separator", async () => {
  await render();
  await setSelect(node.querySelector('select[aria-label="Separador de importação"]'), ",");
  await paste("1;2\n3;4");
  expect(chart()).toBeUndefined();
  expect(dialog().textContent).toContain(NAME);
  expect(dialog().textContent).toContain("Erro na linha");
  readText.mockClear();
  await press("KeyB");
  expect(readText).not.toHaveBeenCalled();
  await setSelect(dialog().querySelector("select"), ";");
  await act(async () =>
    [...dialog().querySelectorAll("button")]
      .find((item) => item.textContent === "Tentar novamente")
      .click(),
  );
  expect(dialog()).toBeNull();
  expect(chart()).toBe(`${NAME}:2:0`);
  expect(notify.success.mock.lastCall[0]).toContain("importados com sucesso");
});

it("keeps the dialog open with the new error when the retry still fails", async () => {
  await render();
  await paste("a;b\nc;d");
  const retry = () =>
    act(async () =>
      [...dialog().querySelectorAll("button")]
        .find((item) => item.textContent === "Tentar novamente")
        .click(),
    );
  await retry();
  expect(dialog()).not.toBeNull();
  await act(async () =>
    [...dialog().querySelectorAll("button")]
      .find((item) => item.textContent === "Cancelar")
      .click(),
  );
  expect(dialog()).toBeNull();
  expect(chart()).toBeUndefined();
});

it("opens the separator dialog for file imports and replacements too", async () => {
  await render();
  const input = node.querySelector('input[type="file"][multiple]');
  Object.defineProperty(input, "files", {
    value: [{ name: "dados.txt", size: 10, text: async () => "1|2\n3|4" }],
    configurable: true,
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(dialog().textContent).toContain("dados.txt");
  await act(async () =>
    [...dialog().querySelectorAll("button")]
      .find((item) => item.textContent === "Cancelar")
      .click(),
  );
  expect(dialog()).toBeNull();
  await paste("1;2\n2;3");
  const replace = node.querySelector('input[type="file"]:not([multiple])');
  Object.defineProperty(replace, "files", {
    value: [{ name: "novo.txt", size: 10, text: async () => "1|2\n3|4" }],
    configurable: true,
  });
  await act(async () => replace.dispatchEvent(new Event("change", { bubbles: true })));
  expect(dialog().textContent).toContain("novo.txt");
  expect(chart()).toBe(`${NAME}:2:0`);
});

it("ignores the shortcuts in text fields, and with other modifiers", async () => {
  await render();
  readText.mockResolvedValue("1;2");
  const field = document.createElement("input");
  node.appendChild(field);
  await press("KeyB", field);
  await press("KeyB", window, { shiftKey: true });
  await press("Space");
  expect(readText).not.toHaveBeenCalled();
  expect(chart()).toBeUndefined();
});

it("imports clipboard text above 1 MB without a size error", async () => {
  await render();
  const rows = Array.from({ length: 140000 }, (_, i) => `${i};${i}`).join("\n");
  expect(rows.length).toBeGreaterThan(1024 * 1024);
  await paste(rows);
  expect(chart()).toBe(`${NAME}:140000:0`);
  expect(notify.error).not.toHaveBeenCalled();
});

it("Ctrl+Enter runs the fits and shows a success toast, even from the equation input", async () => {
  await render();
  await paste("1;2\n2;4");
  await setInput(`Função de ajuste de ${NAME}`, "a*x");
  const input = node.querySelector(`input[aria-label="Função de ajuste de ${NAME}"]`);
  await press("Enter", input);
  expect(chart()).toBe(`${NAME}:2:2`);
  expect(notify.success).toHaveBeenLastCalledWith("Ajuste executado com sucesso", {
    id: "fit-success",
  });
});

it("Ctrl+Enter does nothing without an equation", async () => {
  await render();
  await paste("1;2\n2;4");
  notify.success.mockClear();
  await press("Enter");
  expect(chart()).toBe(`${NAME}:2:0`);
  expect(notify.success).not.toHaveBeenCalled();
});

it("Ctrl+Enter reports the failure instead of a success toast for an invalid equation", async () => {
  await render();
  await paste("1;2\n2;4");
  await setInput(`Função de ajuste de ${NAME}`, "sin(");
  notify.success.mockClear();
  await press("Enter");
  expect(errorTitle()).toContain("Falha no ajuste");
  expect(notify.success).not.toHaveBeenCalled();
});
