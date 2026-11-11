import assert from "node:assert/strict";
import { afterAll, beforeAll, test } from "vitest";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

let dom;
let root;
let previousGlobals;
let FinderProjectDialog;

beforeAll(async () => {
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  previousGlobals = Object.fromEntries(
    [
      "window",
      "document",
      "navigator",
      "HTMLElement",
      "Element",
      "Node",
      "NodeFilter",
      "getComputedStyle",
      "MutationObserver",
      "CustomEvent",
      "Event",
      "KeyboardEvent",
      "IS_REACT_ACT_ENVIRONMENT",
    ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Element",
    "Node",
    "NodeFilter",
    "getComputedStyle",
    "MutationObserver",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
  ]) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: dom.window[key],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ FinderProjectDialog } = await import("../../src/features/projects/FinderProjectDialog.tsx"));
  root = createRoot(document.getElementById("root"));
});

afterAll(async () => {
  if (root) await act(async () => root.unmount());
  dom?.window.close();
  for (const [key, descriptor] of Object.entries(previousGlobals ?? {})) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

test("Finder confirmation is modal, displays the full path, and cancels or confirms", async () => {
  const path = "/Users/test/Experimentos/Queda livre.atus";
  let cancelled = 0;
  let opened = null;
  const props = {
    path,
    opening: false,
    onCancel: () => cancelled++,
    onOpen: (value) => {
      opened = value;
    },
  };
  await act(async () => root.render(createElement(FinderProjectDialog, props)));
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.match(dialog.textContent, /Abrir outro projeto/);
  assert.ok(dialog.textContent.includes(path));
  const cancel = [...dialog.querySelectorAll("button")].find(
    (button) => button.textContent === "Cancelar",
  );
  const open = [...dialog.querySelectorAll("button")].find(
    (button) => button.textContent === "Abrir projeto",
  );
  await act(async () => cancel.click());
  assert.equal(cancelled, 1);
  await act(async () => open.click());
  assert.equal(opened, path);
  await act(async () =>
    root.render(createElement(FinderProjectDialog, { ...props, opening: true })),
  );
  assert.ok(
    [...document.querySelectorAll('[role="dialog"] button')].every((button) => button.disabled),
  );
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  assert.equal(cancelled, 1);
  await act(async () =>
    root.render(createElement(FinderProjectDialog, { ...props, opening: false })),
  );
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  assert.equal(cancelled, 2);
  await act(async () => root.render(createElement(FinderProjectDialog, { ...props, path: null })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
});
