// @vitest-environment jsdom
/** Chart image export: desktop (native plugins) and browser fallbacks, UI states and errors. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notify }));
const api = vi.hoisted(() => ({
  render: vi.fn(),
  isTauri: vi.fn(),
  invoke: vi.fn(),
  save: vi.fn(),
  writeImage: vi.fn(),
}));
vi.mock("html2canvas-pro", () => ({ default: api.render }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: api.isTauri, invoke: api.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: api.save }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeImage: api.writeImage }));
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
import { errorMessage, renderImage } from "../../src/components/chart/export-image";

let root;
let node;
let graphic;
let canvas;

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom's Blob lacks arrayBuffer(), which every real webview provides.
  Blob.prototype.arrayBuffer ??= function () {
    return Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  graphic = document.createElement("div");
  canvas = {
    toBlob: vi.fn((callback, type) => callback(new Blob(["img"], { type }))),
  };
  api.render.mockResolvedValue(canvas);
  api.isTauri.mockReturnValue(true);
  api.invoke.mockResolvedValue(undefined);
  api.writeImage.mockResolvedValue(undefined);
  api.save.mockResolvedValue("/Users/ana/grafico.png");
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
/** Options of the most recent error snackbar. */
const lastError = () => notify.error.mock.lastCall[1];
function button(text) {
  return [...node.querySelectorAll("button")].find((item) => item.textContent.includes(text));
}

it("disables both segments when there is no chart data", async () => {
  await render(true);
  expect(button("Copiar imagem").disabled).toBe(true);
  expect(node.querySelector('[aria-label="Mais opções de exportação"]').disabled).toBe(true);
});

it("copies a PNG through the native clipboard plugin in one click", async () => {
  await render();
  await act(async () => button("Copiar imagem").click());
  expect(api.render).toHaveBeenCalledWith(
    graphic,
    expect.objectContaining({ scale: 2, backgroundColor: "#ffffff" }),
  );
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png", undefined);
  expect(api.writeImage).toHaveBeenCalledWith(expect.any(Uint8Array));
  expect(notify.success).toHaveBeenLastCalledWith("Imagem copiada", { id: "chart-export" });
});

it.each([
  ["PNG", "png", "png", undefined],
  ["JPEG", "jpeg", "jpg", 0.92],
])("saves %s through the dialog and the native write command", async (label, format, ext, q) => {
  api.save.mockResolvedValue(`/Users/ana/Meus gráficos/grafico.${ext}`);
  await render();
  await act(async () => button(label).click());
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), `image/${format}`, q);
  expect(api.save).toHaveBeenCalledWith({
    defaultPath: `grafico.${ext}`,
    filters: [{ name: label, extensions: [ext] }],
  });
  const [command, body, options] = api.invoke.mock.calls[0];
  expect(command).toBe("export_image_write");
  expect(body).toBeInstanceOf(Uint8Array);
  expect(options.headers.path).toBe(encodeURIComponent(`/Users/ana/Meus gráficos/grafico.${ext}`));
  expect(notify.success).toHaveBeenLastCalledWith("Imagem salva", {
    id: "chart-export",
    description: `/Users/ana/Meus gráficos/grafico.${ext}`,
  });
});

it("writes nothing when the save dialog is cancelled", async () => {
  api.save.mockResolvedValue(null);
  await render();
  await act(async () => button("PNG").click());
  expect(api.invoke).not.toHaveBeenCalled();
  expect(notify.info).toHaveBeenLastCalledWith("Exportação cancelada", { id: "chart-export" });
});

it("downloads through an object URL in a plain browser", async () => {
  api.isTauri.mockReturnValue(false);
  const clicks = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    clicks.push({ name: this.download, href: this.href });
  });
  URL.createObjectURL = vi.fn(() => "blob:demo");
  URL.revokeObjectURL = vi.fn();
  await render();
  await act(async () => button("JPEG").click());
  expect(clicks).toEqual([{ name: "grafico.jpg", href: "blob:demo" }]);
  expect(api.save).not.toHaveBeenCalled();
});

it("copies with the Clipboard API in a plain browser and reports when it is missing", async () => {
  api.isTauri.mockReturnValue(false);
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
  await act(async () => button("Copiar imagem").click());
  expect(write.mock.calls[0][0][0].data["image/png"]).toBeInstanceOf(Blob);
  expect(notify.success).toHaveBeenCalledTimes(1);

  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  await act(async () => button("Copiar imagem").click());
  expect(lastError().description).toBe("Este navegador não permite copiar imagens.");
});

it("shows the real error, never claims success, and retries", async () => {
  api.writeImage.mockRejectedValueOnce("clipboard-manager.write_image not allowed");
  await render();
  await act(async () => button("Copiar imagem").click());
  expect(lastError().description).toBe("clipboard-manager.write_image not allowed");
  expect(notify.success).not.toHaveBeenCalled();
  await act(async () => lastError().actions[0].onClick());
  expect(lastError().actions[0].label).toBe("Tentar de novo");
  expect(notify.success).toHaveBeenLastCalledWith("Imagem copiada", { id: "chart-export" });
});

it("reports rendering, encoding and write failures", async () => {
  await render();
  api.render.mockRejectedValueOnce(new Error("canvas unavailable"));
  await act(async () => button("PNG").click());
  expect(lastError().description).toBe("canvas unavailable");

  canvas.toBlob.mockImplementationOnce((callback) => callback(null));
  await act(async () => button("PNG").click());
  expect(lastError().description).toContain("Não foi possível gerar a imagem");

  api.invoke.mockRejectedValueOnce("Não foi possível gravar o arquivo: permissão negada");
  await act(async () => button("PNG").click());
  expect(lastError().description).toContain("permissão negada");
});

it("copies with the keyboard shortcut and ignores it when disabled", async () => {
  const press = () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "C", shiftKey: true, metaKey: true, ctrlKey: true }),
    );
  await render(true);
  await act(async () => press());
  expect(api.render).not.toHaveBeenCalled();

  await render(false);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const event = new KeyboardEvent("keydown", {
    cancelable: true,
    key: "C",
    shiftKey: true,
    metaKey: isMac,
    ctrlKey: !isMac,
  });
  await act(async () => window.dispatchEvent(event));
  expect(api.writeImage).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

it("does not bind Cmd/Ctrl+Shift+S, which belongs to Save As", async () => {
  await render();
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "S", shiftKey: true, metaKey: isMac, ctrlKey: !isMac }),
    ),
  );
  expect(api.render).not.toHaveBeenCalled();
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
    button("Copiar imagem").click();
    await Promise.resolve();
  });
  expect(button("Copiando").disabled).toBe(true);
  await act(async () => button("PNG").click());
  expect(api.render).toHaveBeenCalledTimes(1);
  await act(async () => finish(canvas));
  expect(button("Copiar imagem").disabled).toBe(false);
});

it("extracts readable messages from unknown failures", () => {
  expect(errorMessage("texto")).toBe("texto");
  expect(errorMessage(new Error("falha"))).toBe("falha");
  expect(errorMessage(undefined)).toBe("erro desconhecido.");
});

/**
 * Regression: html2canvas skips every <svg> when its (synchronous) SVG feature test fails, as in
 * WKWebView, so exports had no axes or points. The chart SVGs must reach it as PNG images.
 */
it("hands chart SVGs to html2canvas as pre-rasterized PNG images", async () => {
  graphic.innerHTML = '<svg role="img" width="40" height="20"><circle r="3" /></svg>';
  const svg = graphic.querySelector("svg");
  svg.getBoundingClientRect = () => ({ width: 40, height: 20 });
  const draw = vi.fn();
  vi.stubGlobal(
    "Image",
    class {
      decode = () => Promise.resolve();
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AAAA");

  await renderImage(graphic, "png");

  expect(draw).toHaveBeenCalledOnce();
  const { onclone } = api.render.mock.lastCall[1];
  const cloned = document.implementation.createHTMLDocument();
  cloned.body.innerHTML = graphic.innerHTML;
  onclone(cloned);
  expect(cloned.querySelector("svg")).toBeNull();
  const img = cloned.querySelector("img");
  expect(img.getAttribute("src")).toBe("data:image/png;base64,AAAA");
  expect([img.width, img.height]).toEqual([40, 20]);
});
