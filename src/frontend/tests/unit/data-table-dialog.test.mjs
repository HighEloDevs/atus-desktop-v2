// @vitest-environment jsdom
/** Read-only data table: counts, sticky header, missing uncertainties and closing. */
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DataTableDialog } from "../../src/features/analysis/DataTableDialog";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
let host;

async function show(dataset, onClose = () => {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(DataTableDialog, { dataset, onClose })));
  return document.querySelector('[role="dialog"]');
}

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
});

it("renders nothing while there is no dataset", async () => {
  expect(await show(null)).toBeNull();
});

it("lists many points in one scrollable table with a sticky header", async () => {
  const points = Array.from({ length: 200 }, (_, i) => ({ x: i, y: i * i, sy: 0.01, sx: 0.02 }));
  const dialog = await show({ name: "grande.csv", points });
  expect(dialog.textContent).toContain("200 pontos");
  expect(dialog.querySelectorAll("tbody tr")).toHaveLength(200);
  expect(dialog.querySelector("thead").className).toContain("sticky");
  expect([...dialog.querySelectorAll("th")].map((h) => h.textContent)).toEqual([
    "#",
    "x",
    "y",
    "σy",
    "σx",
  ]);
});

it("uses the singular for one point and a dash for absent uncertainties", async () => {
  const dialog = await show({ name: "um.csv", points: [{ x: 1.5, y: 2 }] });
  expect(dialog.textContent).toContain("1 ponto");
  expect(dialog.textContent).not.toContain("1 pontos");
  const cells = [...dialog.querySelectorAll("tbody td")].map((c) => c.textContent);
  expect(cells).toEqual(["1", "1,5", "2", "—", "—"]);
});

it("exposes the exact value as the cell title", async () => {
  const dialog = await show({ name: "p.csv", points: [{ x: 0.1234567890123456, y: 1 }] });
  expect(dialog.querySelector('td[title="0,1234567890123456"]')).not.toBeNull();
});

it("offers only a close action and calls onClose", async () => {
  const onClose = vi.fn();
  const dialog = await show({ name: "a.csv", points: [{ x: 1, y: 2 }] }, onClose);
  const labels = [...dialog.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels).toEqual(["Fechar"]);
  await act(async () => dialog.querySelector("button").click());
  expect(onClose).toHaveBeenCalled();
});
