// @vitest-environment jsdom
/** Accessible editing and alignment of chart labels. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { EditableChartLabel } from "../../src/components/chart/EditableChartLabel";

let root;
let node;
let changed;
let alignmentChanged;

function Harness({ initial = "Título", orientation = "horizontal" }) {
  const [value, setValue] = useState(initial);
  const [alignment, setAlignment] = useState("center");
  return createElement(EditableChartLabel, {
    label: "Título do gráfico",
    placeholder: "Adicionar título",
    value,
    orientation,
    alignment,
    onChange: (next) => {
      changed(next);
      setValue(next);
    },
    onAlignmentChange: (next) => {
      alignmentChanged(next);
      setAlignment(next);
    },
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  changed = vi.fn();
  alignmentChanged = vi.fn();
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
});
async function render(props) {
  await act(async () => root.render(createElement(Harness, props)));
}
async function startEdit() {
  await act(async () => node.querySelector("button").click());
  return node.querySelector("input");
}
async function setInput(input, value) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async () => {
    set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("edits a label and commits on Enter", async () => {
  await render();
  const input = await startEdit();
  expect(document.activeElement).toBe(input);
  await setInput(input, "Nova curva");
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })),
  );
  expect(changed).toHaveBeenCalledWith("Nova curva");
  expect(node.querySelector("button").textContent).toBe("Nova curva");
});

it("cancels edits on Escape without calling onChange", async () => {
  await render();
  const input = await startEdit();
  await setInput(input, "Descartar");
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })),
  );
  expect(changed).not.toHaveBeenCalled();
  expect(node.querySelector("button").textContent).toBe("Título");
});

it("renders formulae while escaping ordinary HTML and marks empty placeholders for export", async () => {
  await render({ initial: "<img src=x> $x^2$" });
  expect(node.querySelector("img")).toBeNull();
  expect(node.querySelector(".katex")).not.toBeNull();
  expect(node.textContent).toContain("<img src=x>");
  await act(async () => root.unmount());
  root = createRoot(node);
  await render({ initial: "" });
  expect(node.querySelector('[data-html2canvas-ignore="true"]').textContent).toBe(
    "Adicionar título",
  );
});

it("moves horizontal and vertical alignments using arrow keys", async () => {
  await render();
  await act(async () =>
    node
      .querySelector("button")
      .dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" })),
  );
  expect(alignmentChanged).toHaveBeenLastCalledWith("left");
  await act(async () =>
    node
      .querySelector("button")
      .dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })),
  );
  expect(alignmentChanged).toHaveBeenLastCalledWith("center");
  await render({ orientation: "vertical" });
  await act(async () =>
    node
      .querySelector("button")
      .dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })),
  );
  expect(alignmentChanged).toHaveBeenLastCalledWith("right");
});

it("adjusts font size with the wheel, respecting the lower bound", async () => {
  await render();
  const button = node.querySelector("button");
  await act(async () => {
    for (let i = 0; i < 20; i++)
      button.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 1 }));
  });
  expect(button.style.fontSize).toBe("8px");
  await act(async () =>
    button.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: -1 })),
  );
  expect(button.style.fontSize).toBe("9px");
});

it("aligns the label by dragging and suppresses the following click", async () => {
  await render();
  const button = node.querySelector("button");
  button.setPointerCapture = () => {};
  node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 100 });
  const event = (type, x) => {
    const e = new MouseEvent(type, { bubbles: true, button: 0, clientX: x });
    Object.defineProperty(e, "pointerId", { value: 1 });
    return e;
  };
  await act(async () => button.dispatchEvent(event("pointerdown", 150)));
  await act(async () => button.dispatchEvent(event("pointermove", 270)));
  expect(button.style.transform).toContain("120px");
  await act(async () => button.dispatchEvent(event("pointerup", 270)));
  expect(alignmentChanged).toHaveBeenLastCalledWith("right");
  await act(async () => button.click());
  expect(node.querySelector("input")).toBeNull();
});
