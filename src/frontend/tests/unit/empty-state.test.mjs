// @vitest-environment jsdom
/** Empty state mascot: copy, shortcut hint and pupils following the pointer. */
import { afterEach, beforeEach, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { EmptyState } from "../../src/features/analysis/EmptyState.tsx";

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

it("shows the waiting copy with the platform modifier and no actions", async () => {
  await act(async () => root.render(createElement(EmptyState, { modifier: "Ctrl" })));
  expect(node.textContent).toContain("Esperando seus dados");
  expect(node.querySelector("kbd").textContent).toBe("Ctrl B");
  expect(node.querySelector("button")).toBeNull();
});

it("moves the pupils towards the pointer and stops listening on unmount", async () => {
  await act(async () => root.render(createElement(EmptyState, { modifier: "⌘" })));
  const pupil = node.querySelector("circle");
  await act(async () =>
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 500, clientY: 0 })),
  );
  expect(pupil.getAttribute("transform")).toMatch(/^translate\(/);
  await act(async () => root.render(null));
  expect(() => window.dispatchEvent(new MouseEvent("pointermove"))).not.toThrow();
});
