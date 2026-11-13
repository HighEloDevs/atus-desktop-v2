// @vitest-environment jsdom
/** Inline project title editing. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ProjectTitle } from "../../src/features/projects/ProjectTitle";

let root;
let node;
let onRename;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  onRename = vi.fn().mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});

const render = (props = {}) =>
  act(async () =>
    root.render(
      createElement(ProjectTitle, { name: "Pêndulo", editable: true, onRename, ...props }),
    ),
  );
const type = (input, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const key = (el, k) =>
  act(async () => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));

it("is plain text when the project cannot be renamed", async () => {
  await render({ editable: false });
  expect(node.querySelector("button")).toBeNull();
  await key(window, "F2");
  expect(node.querySelector("input")).toBeNull();
});

it("renames on Enter and ignores unchanged names", async () => {
  await render();
  await act(async () => node.querySelector("button").click());
  const input = node.querySelector("input");
  await key(input, "Enter");
  expect(onRename).not.toHaveBeenCalled();
  expect(node.querySelector("input")).toBeNull();
  await act(async () => node.querySelector("button").click());
  const next = node.querySelector("input");
  await type(next, "Queda livre");
  await key(next, "Enter");
  expect(onRename).toHaveBeenCalledWith("Queda livre");
  expect(node.querySelector("input")).toBeNull();
});

it("starts editing with F2 and cancels with Escape without renaming", async () => {
  await render();
  await key(window, "F2");
  const input = node.querySelector("input");
  expect(input.value).toBe("Pêndulo");
  await type(input, "Outro");
  await key(input, "Escape");
  expect(node.querySelector("input")).toBeNull();
  expect(onRename).not.toHaveBeenCalled();
});

it("keeps editing and shows the message when renaming fails", async () => {
  onRename.mockRejectedValue(new Error("Já existe um projeto com esse nome nesta pasta."));
  await render();
  await key(window, "F2");
  const input = node.querySelector("input");
  await type(input, "Outro");
  await key(input, "Enter");
  expect(node.querySelector("input")).not.toBeNull();
  expect(node.querySelector('[role="alert"]').textContent).toContain("Já existe");
});

it("commits when the field loses focus", async () => {
  await render();
  await key(window, "F2");
  const input = node.querySelector("input");
  await type(input, "Mola");
  await act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(onRename).toHaveBeenCalledWith("Mola");
});
