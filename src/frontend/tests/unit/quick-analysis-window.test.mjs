// @vitest-environment jsdom
/** The quick analysis window: clipboard on show, validation, keyboard and submission. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const api = vi.hoisted(() => ({
  isTauri: vi.fn(),
  invoke: vi.fn(),
  listen: vi.fn(),
  readText: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: api.isTauri, invoke: api.invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: api.listen }) }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: api.readText }));
import { QuickAnalysisWindow } from "../../src/features/quick-analysis/QuickAnalysisWindow";

const DATA = "t\tx\tσx\n0,1\t1,02\t0,05\n0,2\t2,05\t0,05\n0,3\t2,98\t0,05";
let root;
let node;
let handlers;
let unlisten;

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
  handlers = {};
  unlisten = vi.fn();
  api.isTauri.mockReturnValue(true);
  api.invoke.mockResolvedValue(undefined);
  api.readText.mockResolvedValue(DATA);
  api.listen.mockImplementation(async (event, handler) => {
    handlers[event] = handler;
    return unlisten;
  });
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

async function render() {
  await act(async () => root.render(createElement(QuickAnalysisWindow)));
}
async function show() {
  await act(async () => handlers["quick-analysis-shown"]());
}
const equation = () => node.querySelector('input[aria-label="Função de ajuste"]');
async function type(value) {
  const input = equation();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(init, target = window) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}
function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}
const rows = () => node.querySelectorAll("tbody tr");
const alerts = () => [...node.querySelectorAll('[role="alert"]')].map((item) => item.textContent);

it("reads data from the clipboard when shown and submits with Cmd+Enter", async () => {
  await render();
  expect(node.textContent).toContain("Cole os dados");
  expect(node.textContent).toContain("⌃");
  await show();
  expect(rows()).toHaveLength(3);
  expect(node.textContent).toContain("3 pontos");
  expect(node.textContent).toContain("do clipboard");
  expect(node.querySelectorAll(".quick-point circle")).toHaveLength(3);
  await type("R * x");
  expect(node.textContent).toContain("Parâmetros");
  expect(node.textContent).toContain("livre");
  await key({ code: "Enter", key: "Enter", metaKey: true }, equation());
  expect(api.invoke).toHaveBeenCalledWith("quick_submit", {
    analysis: {
      equation: "R * x",
      points: [
        { x: 0.1, y: 1.02, sx: 0, sy: 0.05 },
        { x: 0.2, y: 2.05, sx: 0, sy: 0.05 },
        { x: 0.3, y: 2.98, sx: 0, sy: 0.05 },
      ],
    },
  });
  expect(rows()).toHaveLength(0);
  expect(equation().value).toBe("R * x");
});

it("submits only the data when the equation is left empty", async () => {
  await render();
  await show();
  expect(node.textContent).toContain("(opcional)");
  expect(node.textContent).toContain("Sem função, o ATUS abre só com os dados");
  expect(button("Abrir no ATUS")).toBeTruthy();
  await type("a*x");
  expect(node.textContent).not.toContain("Sem função");
  expect(button("Ajustar no ATUS")).toBeTruthy();
  await type("  ");
  await act(async () => button("Abrir no ATUS").click());
  expect(api.invoke).toHaveBeenCalledWith("quick_submit", {
    analysis: {
      equation: "",
      points: expect.arrayContaining([expect.objectContaining({ x: 0.1 })]),
    },
  });
  expect(alerts()).toEqual([]);
});

it("ignores a clipboard that is not data and keeps data already entered", async () => {
  api.readText.mockResolvedValueOnce("uma frase qualquer com 1 número");
  await render();
  await show();
  expect(rows()).toHaveLength(0);
  expect(alerts()).toEqual([]);
  api.readText.mockRejectedValueOnce(new Error("negado"));
  await show();
  expect(alerts()).toEqual([]);
  await act(async () => button("Colar do clipboard").click());
  expect(rows()).toHaveLength(3);
  api.readText.mockResolvedValueOnce("9\t9\n8\t8");
  await show();
  expect(rows()).toHaveLength(3);
});

it("explains what is missing instead of submitting", async () => {
  api.readText.mockResolvedValue("");
  await render();
  await act(async () => button("Abrir no ATUS").click());
  expect(alerts()).toEqual(["Cole ao menos um ponto."]);
  expect(api.invoke).not.toHaveBeenCalled();
  await type("sin(");
  expect(alerts()[0]).toContain("Função inválida");
  expect(equation().getAttribute("aria-invalid")).toBe("true");
  await key({ code: "Enter", key: "Enter", metaKey: true }, equation());
  expect(api.invoke).not.toHaveBeenCalled();
  await act(async () => button("Colar do clipboard").click());
  expect(alerts()).toContain("A área de transferência está vazia.");
});

it("pastes with Cmd+V or Cmd+B outside the equation and closes with Esc", async () => {
  await render();
  await key({ code: "KeyV", key: "v", metaKey: true });
  expect(rows()).toHaveLength(3);
  await act(async () => node.querySelector('[aria-label="Limpar dados"]').click());
  expect(rows()).toHaveLength(0);
  await key({ code: "KeyV", key: "v", metaKey: true }, equation());
  expect(rows()).toHaveLength(0);
  await key({ code: "KeyB", key: "b", metaKey: true });
  expect(rows()).toHaveLength(3);
  await key({ code: "Escape", key: "Escape" });
  expect(api.invoke).toHaveBeenCalledWith("quick_dismiss");
  await act(async () => node.querySelector('[aria-label="Fechar análise rápida"]').click());
  expect(api.invoke).toHaveBeenCalledTimes(2);
});

it("takes several lines pasted into the equation as data", async () => {
  await render();
  const paste = (text) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    event.clipboardData = { getData: () => text };
    equation().dispatchEvent(event);
    return event;
  };
  let event;
  await act(async () => (event = paste("a*x + b")));
  expect(event.defaultPrevented).toBe(false);
  await act(async () => (event = paste("1;2\n3;4")));
  expect(event.defaultPrevented).toBe(true);
  expect(rows()).toHaveLength(2);
  expect(node.textContent).not.toContain("do clipboard");
});

it("lets a different separator fix unreadable data", async () => {
  api.readText.mockResolvedValue("1;2;3;4;5\n2;3;4;5;6");
  await render();
  await act(async () => button("Colar do clipboard").click());
  const select = node.querySelector('select[aria-label="Separador dos dados"]');
  const choose = async (value) =>
    act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await choose(";");
  expect(alerts()[0]).toContain("4 colunas");
  await choose(" ");
  expect(rows()).toHaveLength(0);
  api.readText.mockResolvedValue("1;2;-1");
  await choose(";");
  await act(async () => button("Colar do clipboard").click());
  expect(alerts()[0]).toContain("incertezas não podem ser negativas");
  api.readText.mockResolvedValue("1;2\n2;4");
  await act(async () => button("Colar do clipboard").click());
  expect(rows()).toHaveLength(2);
});

it("shows a native submission failure and allows retrying", async () => {
  api.invoke.mockRejectedValueOnce("Não foi possível abrir o ATUS");
  await render();
  await show();
  await type("a*x");
  await act(async () => button("Ajustar no ATUS").click());
  expect(alerts()).toEqual(["Não foi possível abrir o ATUS"]);
  expect(rows()).toHaveLength(3);
  await type("a*x + b");
  expect(alerts()).toEqual([]);
  await key({ code: "Enter", key: "Enter", metaKey: true });
  expect(api.invoke).toHaveBeenLastCalledWith("quick_submit", expect.anything());
});

it("uses Ctrl outside macOS and works without the desktop bridge", async () => {
  Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true });
  api.isTauri.mockReturnValue(false);
  Object.defineProperty(navigator, "clipboard", {
    value: { readText: async () => "1 2\n2 4" },
    configurable: true,
  });
  await render();
  expect(api.listen).not.toHaveBeenCalled();
  expect(node.textContent).toContain("Win");
  await key({ code: "KeyV", key: "v", ctrlKey: true });
  expect(rows()).toHaveLength(2);
  await key({ code: "Escape", key: "Escape" });
  expect(api.invoke).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  root = createRoot(node);
});

it("stops listening for the shown event when unmounted", async () => {
  await render();
  const handler = handlers["quick-analysis-shown"];
  await act(async () => root.render(null));
  expect(unlisten).toHaveBeenCalled();
  await act(async () => handler());
  expect(api.readText).not.toHaveBeenCalled();
});
