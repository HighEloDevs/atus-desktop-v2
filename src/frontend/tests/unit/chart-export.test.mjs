// @vitest-environment jsdom
/** Chart image export behavior with a simulated canvas and clipboard. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";

const api = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("html2canvas", () => ({ default: api.render }));
vi.mock("../../src/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }) => createElement(Fragment, null, children),
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children }) => createElement("div", null, children),
  DropdownMenuLabel: ({ children }) => createElement("span", null, children),
  DropdownMenuSeparator: () => null,
  DropdownMenuItem: ({ children, onSelect }) =>
    createElement("button", { onClick: onSelect }, children),
}));
import { ChartExportMenu } from "../../src/components/chart/ChartExportMenu";

let root;
let node;
let graphic;
let canvas;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  graphic = document.createElement("div");
  canvas = {
    toDataURL: vi.fn((type) => `data:${type};base64,AA==`),
    toBlob: vi.fn((callback) => callback(new Blob(["png"], { type: "image/png" }))),
  };
  api.render.mockResolvedValue(canvas);
});

afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(disabled = false) {
  await act(async () =>
    root.render(createElement(ChartExportMenu, { graphic: { current: graphic }, disabled })),
  );
}
function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

it("disables the export trigger when there is no chart data", async () => {
  await render(true);
  expect(button("Exportar").disabled).toBe(true);
});

it.each([
  ["PNG", "png"],
  ["JPEG", "jpeg"],
])("exports %s with the correct canvas type and filename", async (label, extension) => {
  const clicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    clicks.push({ name: this.download, href: this.href });
  });
  await render();
  await act(async () => button(`Salvar como ${label}`).click());
  expect(api.render).toHaveBeenCalledWith(graphic, { scale: 2, backgroundColor: "#ffffff" });
  expect(canvas.toDataURL).toHaveBeenCalledWith(`image/${extension}`);
  expect(clicks).toEqual([
    { name: `grafico.${extension}`, href: `data:image/${extension};base64,AA==` },
  ]);
  expect(node.querySelector('[role="status"]').textContent).toBe("Imagem exportada.");
});

it("copies a PNG blob to the clipboard", async () => {
  const write = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { write }, configurable: true });
  vi.stubGlobal(
    "ClipboardItem",
    class {
      constructor(data) {
        this.data = data;
      }
    },
  );
  await render();
  await act(async () => button("Copiar para área").click());
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
  expect(write.mock.calls[0][0][0].data["image/png"]).toBeInstanceOf(Blob);
  expect(node.querySelector('[role="status"]').textContent).toBe("Imagem copiada.");
});

it("reports rendering and unavailable clipboard failures", async () => {
  api.render.mockRejectedValueOnce(new Error("canvas unavailable"));
  await render();
  await act(async () => button("Salvar como PNG").click());
  expect(node.querySelector('[role="status"]').textContent).toContain("Não foi possível");
  api.render.mockResolvedValue(canvas);
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  await act(async () => button("Copiar para área").click());
  expect(node.querySelector('[role="status"]').textContent).toContain("Não foi possível");
});

it("prevents duplicate work while the chart is rendering", async () => {
  let finish;
  api.render.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await act(async () => {
    button("Salvar como PNG").click();
    await Promise.resolve();
  });
  expect(button("Exportando").disabled).toBe(true);
  await act(async () => button("Salvar como JPEG").click());
  expect(api.render).toHaveBeenCalledTimes(1);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await act(async () => finish(canvas));
  expect(button("Exportar").disabled).toBe(false);
});
