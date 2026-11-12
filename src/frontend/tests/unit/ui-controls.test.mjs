// @vitest-environment jsdom
/** Accessible shared input behavior. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "../../src/components/ui/checkbox";
import { Slider } from "../../src/components/ui/slider";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "../../src/components/ui/native-select";

let root;
let node;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

it("toggles an accessible checkbox and notifies the consumer", async () => {
  const change = vi.fn();
  await act(async () =>
    root.render(createElement(Checkbox, { "aria-label": "Ativar", onCheckedChange: change })),
  );
  const checkbox = node.querySelector('[role="checkbox"]');
  expect(checkbox.getAttribute("aria-checked")).toBe("false");
  await act(async () => checkbox.click());
  expect(checkbox.getAttribute("aria-checked")).toBe("true");
  expect(change).toHaveBeenCalledWith(true);
});

it("provides keyboard-accessible slider values with the configured bounds", async () => {
  const change = vi.fn();
  await act(async () =>
    root.render(
      createElement(Slider, {
        "aria-label": "Raio",
        defaultValue: [5],
        min: 1,
        max: 10,
        onValueChange: change,
      }),
    ),
  );
  const thumb = node.querySelector('[role="slider"]');
  expect(thumb.getAttribute("aria-valuenow")).toBe("5");
  await act(async () =>
    thumb.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })),
  );
  expect(change).toHaveBeenCalledWith([6]);
});

it("supports labelled native option groups and disabled selections", async () => {
  await act(async () =>
    root.render(
      createElement(
        NativeSelect,
        { "aria-label": "Unidade", disabled: true },
        createElement(
          NativeSelectOptGroup,
          { label: "Tempo" },
          createElement(NativeSelectOption, { value: "s" }, "segundos"),
        ),
      ),
    ),
  );
  const select = node.querySelector("select");
  expect(select.disabled).toBe(true);
  expect(select.querySelector("optgroup").label).toBe("Tempo");
  expect(select.value).toBe("s");
});
