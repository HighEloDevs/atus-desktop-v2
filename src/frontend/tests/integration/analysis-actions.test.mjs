// @vitest-environment jsdom
/** Dataset action behavior with menu and desktop integration simulated. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));
vi.mock("../../src/features/projects/useProjectSave", () => ({
  useProjectSave: () => ({ project: null, status: "Salvo", error: "", canLeave: async () => true }),
}));
vi.mock("../../src/components/chart/Chart", () => ({
  Chart: ({ series }) =>
    createElement(
      "div",
      { "data-testid": "chart" },
      series.map((s) => `${s.name}:${s.points.length}`).join(";"),
    ),
}));
vi.mock("../../src/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => createElement(Fragment, null, children),
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children }) => createElement("div", null, children),
  DropdownMenuItem: ({ children, onSelect }) =>
    createElement("button", { onClick: onSelect }, children),
  DropdownMenuSeparator: () => null,
  DropdownMenuLabel: ({ children }) => createElement("span", null, children),
}));
import { AnalysisPage } from "../../src/features/analysis/AnalysisPage";

let root;
let node;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
        finderPath: null,
        projectError: "",
        onOpenFinderProject: vi.fn(),
        onCancelFinderProject: vi.fn(),
      }),
    ),
  );
  const input = node.querySelector('input[type="file"][multiple]');
  Object.defineProperty(input, "files", {
    value: [{ name: "a.csv", size: 10, text: async () => "1;2\n2;3" }],
    configurable: true,
  });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

it("renames an imported series and retains its points", async () => {
  await render();
  await act(async () => button("Renomear").click());
  const input = node.querySelector('input[aria-label="Renomear conjunto"]');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, "Medição");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })),
  );
  expect(node.querySelector('[data-testid="chart"]').textContent).toBe("Medição:2");
});

it("removes a series and returns to the empty state", async () => {
  await render();
  await act(async () => button("Remover").click());
  expect(node.querySelector('[data-testid="chart"]')).toBeNull();
  expect(node.textContent).toContain("Comece sua análise");
});

it("opens the table showing imported points", async () => {
  await render();
  await act(async () => button("Ver tabela").click());
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Dados: a.csv");
  expect(dialog.querySelectorAll("tbody tr")).toHaveLength(2);
});
