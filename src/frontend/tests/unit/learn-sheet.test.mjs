// @vitest-environment jsdom
/** The simulated spreadsheet of the lessons: selecting cells and copying them. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
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
import { MockSpreadsheet } from "../../src/features/learn/MockSpreadsheet";
import {
  bounds,
  cellName,
  contains,
  coversData,
  rangeToTsv,
} from "../../src/features/learn/sheet-range";

const header = ["t (s)", "y (m)", "σy (m)"];
const rows = [
  [0, 0.011, 0.004],
  [0.05, 0.03, 0.004],
];

describe("sheet ranges", () => {
  it("normalizes corners and tests membership", () => {
    const range = { r0: 2, c0: 2, r1: 0, c1: 1 };
    expect(bounds(range)).toEqual({ top: 0, bottom: 2, left: 1, right: 2 });
    expect(contains(range, 1, 1)).toBe(true);
    expect(contains(range, 1, 0)).toBe(false);
    expect(contains(null, 0, 0)).toBe(false);
  });

  it("requires every data row and exactly the lesson columns", () => {
    expect(coversData({ r0: 1, c0: 0, r1: 2, c1: 2 }, 2, 3)).toBe(true);
    expect(coversData({ r0: 0, c0: 0, r1: 2, c1: 2 }, 2, 3)).toBe(true);
    expect(coversData({ r0: 2, c0: 0, r1: 2, c1: 2 }, 2, 3)).toBe(false);
    expect(coversData({ r0: 1, c0: 0, r1: 2, c1: 1 }, 2, 3)).toBe(false);
    expect(coversData({ r0: 1, c0: 0, r1: 3, c1: 3 }, 2, 3)).toBe(false);
    expect(coversData(null, 2, 3)).toBe(false);
  });

  it("copies like a spreadsheet: tabs, decimal comma and blank cells", () => {
    expect(cellName(13, 2)).toBe("C14");
    expect(rangeToTsv(header, rows, { r0: 0, c0: 0, r1: 1, c1: 3 })).toBe(
      "t (s)\ty (m)\tσy (m)\t\n0\t0,011\t0,004\t",
    );
  });
});

describe("MockSpreadsheet", () => {
  let root;
  let node;
  let onCopied;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node);
    onCopied = vi.fn();
    act(() =>
      root.render(
        createElement(MockSpreadsheet, {
          fileName: "bolinha.xlsx",
          header,
          rows,
          modifier: "⌘",
          onCopied,
        }),
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    node.remove();
    vi.clearAllMocks();
  });

  const cells = () => [...node.querySelectorAll("td")];
  const cell = (row, column) => cells()[row * 4 + column];
  const status = () => node.querySelector('[role="status"]').textContent;
  function copy() {
    const data = new Map();
    const event = new Event("copy", { bubbles: true, cancelable: true });
    event.clipboardData = { setData: (type, value) => data.set(type, value) };
    act(() => document.dispatchEvent(event));
    return { text: data.get("text/plain"), prevented: event.defaultPrevented };
  }

  it("ignores a copy with nothing selected", () => {
    expect(status()).toBe("Arraste para selecionar e copie com ⌘+C");
    expect(copy()).toEqual({ text: undefined, prevented: false });
    expect(onCopied).not.toHaveBeenCalled();
  });

  it("selects by dragging and keeps the text selected for the system copy", () => {
    act(() => cell(1, 0).dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    act(() => cell(2, 2).dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => window.dispatchEvent(new MouseEvent("mouseup")));
    act(() => cell(2, 1).dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(status()).toBe("Selecionado: A2:C3");
    expect(cell(1, 1).getAttribute("aria-selected")).toBe("true");
    const area = node.querySelector("textarea");
    expect(area.value).toBe("0\t0,011\t0,004\n0,05\t0,03\t0,004");
    expect(document.activeElement).toBe(area);

    const { text, prevented } = copy();
    expect(text).toBe(area.value);
    expect(prevented).toBe(true);
    expect(onCopied).toHaveBeenCalledOnce();
    expect(status()).toBe("Copiado: A2:C3");
  });

  it("warns when the copied cells miss part of the data", () => {
    act(() => cell(1, 0).dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    act(() =>
      cell(2, 1).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, shiftKey: true })),
    );
    expect(status()).toBe("Selecionado: A2:B3");
    copy();
    expect(onCopied).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledWith(
      "Faltam dados na seleção",
      expect.objectContaining({ description: "Selecione de A2 até C3, com as três colunas." }),
    );
  });

  it("selects whole columns from the headers and all data from the button", () => {
    const heads = [...node.querySelectorAll("thead th")];
    act(() => heads[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    act(() =>
      heads[3].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, shiftKey: true })),
    );
    expect(status()).toBe("Selecionado: A1:C3");
    const button = [...node.querySelectorAll("button")].find(
      (b) => b.textContent === "Selecionar dados",
    );
    act(() => button.click());
    expect(status()).toBe("Selecionado: A1:C3");
    copy();
    expect(onCopied).toHaveBeenCalledOnce();
  });
});
