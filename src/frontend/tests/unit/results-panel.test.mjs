// @vitest-environment jsdom
/** Explicitly simulated results, details, clipboard and focus feedback. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ResultsPanel } from "../../src/features/analysis/fit/ResultsPanel";

let root;
let node;
let highlight;
const item = {
  id: "a",
  name: "Ensaio",
  color: "#123456",
  result: {
    equation: "a*x",
    parameters: [{ name: "a", value: 1.25, uncertainty: 0.1 }],
    chiSquared: 2.5,
    degreesOfFreedom: 3,
  },
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  highlight = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});
async function render(results) {
  await act(async () =>
    root.render(createElement(ResultsPanel, { results, onHighlight: highlight })),
  );
}
function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

it("shows an empty state and clears highlighted series when collapsed", async () => {
  await render([]);
  expect(node.textContent).toContain("Nenhum ajuste calculado");
  await act(async () => button("Resultados da análise").click());
  expect(highlight).toHaveBeenCalledWith(null);
  expect(button("Resultados da análise").getAttribute("aria-expanded")).toBe("false");
});

it("highlights the selected series on hover and shows its simulated parameters", async () => {
  await render([item]);
  expect(node.textContent).toContain("Parâmetros simulados");
  expect(node.textContent).toContain("1,25 ± 0,1");
  const card = node.querySelector("article");
  await act(async () => card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
  expect(highlight).toHaveBeenCalledWith("a");
  await act(async () => card.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  expect(highlight).toHaveBeenLastCalledWith(null);
  await act(async () => button("Resultados da análise").click());
  expect(node.textContent).toContain("1 ajuste(s)");
});

it("copies labelled simulated values and reports clipboard failures", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  await render([item]);
  await act(async () => button("Copiar").click());
  expect(writeText).toHaveBeenCalledWith("SIMULAÇÃO — valores fictícios\na = 1.25 ± 0.1");
  expect(node.querySelector('[role="status"]').textContent).toContain("copiados");
  writeText.mockRejectedValueOnce(new Error("denied"));
  await act(async () => button("Copiar").click());
  expect(node.querySelector('[role="status"]').textContent).toContain("Não foi possível");
});

it("opens details with a warning that the numbers are fictitious", async () => {
  await render([item]);
  await act(async () => button("Ver detalhes").click());
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain("Nenhum ajuste científico foi executado");
  expect(dialog.textContent).toContain("Graus de liberdade simulados");
  expect(dialog.textContent).toContain("2,5");
  await act(async () =>
    [...dialog.querySelectorAll("button")].find((b) => b.textContent === "Fechar").click(),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
