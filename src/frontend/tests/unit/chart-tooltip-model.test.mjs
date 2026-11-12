/** Formatting, grouping, placement, and ordering behind the chart tooltip. */
import { expect, it } from "vitest";
import {
  describeTooltip,
  formatTooltipValue,
  groupNearbyPoints,
  keyboardOrder,
  placeTooltip,
} from "../../src/components/chart/tooltipModel";
import { renderLabelHtml } from "../../src/components/chart/labelMarkup";

const point = (overrides) => ({
  seriesId: "a",
  seriesName: "Turma A",
  color: "#f25a3c",
  symbol: "circle",
  row: 1,
  x: 1,
  y: 2,
  px: 100,
  py: 100,
  ...overrides,
});

it("formats ordinary values with five significant digits in pt-BR", () => {
  expect(formatTooltipValue(0.25)).toBe("0,25");
  expect(formatTooltipValue(1234.5678)).toBe("1.234,6");
  expect(formatTooltipValue(0)).toBe("0");
  expect(formatTooltipValue(0.0001)).toBe("0,0001");
  expect(formatTooltipValue(123456)).toBe("123.460");
});

it("uses scientific notation for extreme magnitudes and a typographic minus", () => {
  expect(formatTooltipValue(1.602176e-19)).toBe("1,6022 × 10⁻¹⁹");
  expect(formatTooltipValue(6.02214e23)).toBe("6,0221 × 10²³");
  expect(formatTooltipValue(1e6)).toBe("1 × 10⁶");
  expect(formatTooltipValue(-12.5)).toBe("−12,5");
  expect(formatTooltipValue(-0.00002)).toBe("−2 × 10⁻⁵");
});

it("shows a dash for non-finite values", () => {
  expect(formatTooltipValue(Number.NaN)).toBe("—");
  expect(formatTooltipValue(Number.POSITIVE_INFINITY)).toBe("—");
});

it("groups points within the radius with the target first", () => {
  const far = point({ row: 1, px: 10, py: 10 });
  const near = point({ row: 2, px: 103, py: 104 });
  const target = point({ row: 3 });
  const edge = point({ row: 4, px: 107, py: 100 });
  const outside = point({ row: 5, px: 108, py: 100 });
  expect(groupNearbyPoints([far, near, target, edge, outside], target)).toEqual([
    target,
    near,
    edge,
  ]);
  expect(groupNearbyPoints([far, target], target, 200)).toEqual([target, far]);
});

it("orders keyboard navigation left to right, then top to bottom, without mutating", () => {
  const a = point({ row: 1, px: 50, py: 80 });
  const b = point({ row: 2, px: 10, py: 90 });
  const c = point({ row: 3, px: 50, py: 20 });
  const input = [a, b, c];
  expect(keyboardOrder(input)).toEqual([b, c, a]);
  expect(input).toEqual([a, b, c]);
});

it("places the tooltip up and to the right and flips near each edge", () => {
  const size = { width: 100, height: 50 };
  const bounds = { width: 400, height: 300 };
  expect(placeTooltip({ x: 200, y: 150 }, size, bounds)).toEqual({ left: 214, top: 86 });
  expect(placeTooltip({ x: 390, y: 150 }, size, bounds)).toEqual({ left: 276, top: 86 });
  expect(placeTooltip({ x: 200, y: 10 }, size, bounds)).toEqual({ left: 214, top: 24 });
  expect(placeTooltip({ x: 395, y: 5 }, size, bounds)).toEqual({ left: 281, top: 19 });
});

it("keeps the tooltip inside bounds smaller than its preferred position", () => {
  const placed = placeTooltip(
    { x: 60, y: 290 },
    { width: 100, height: 280 },
    { width: 120, height: 300 },
  );
  expect(placed).toEqual({ left: 4, top: 16 });
});

it("describes points for assistive technology with axis names and fallbacks", () => {
  const first = point({ row: 7, x: 0.65, y: 2.62, sx: 0.005, sy: 0.08 });
  const second = point({ seriesName: "Turma B", row: 2, x: 0.65, y: 2.6 });
  expect(describeTooltip([first, second], { x: "L (m)", y: "" })).toBe(
    "Turma A, ponto 7: L (m) 0,65 ± 0,005; y 2,62 ± 0,08. Turma B, ponto 2: L (m) 0,65; y 2,6",
  );
  expect(describeTooltip([second], { x: "", y: "T" })).toBe("Turma B, ponto 2: x 0,65; T 2,6");
});

it("escapes label text and renders inline LaTeX", () => {
  expect(renderLabelHtml(`<b>"T" & 'L'</b>`)).toBe(
    "&lt;b&gt;&quot;T&quot; &amp; &#39;L&#39;&lt;/b&gt;",
  );
  const html = renderLabelHtml("Tempo $t^2$ (s)");
  expect(html).toContain('class="katex"');
  expect(html.startsWith("Tempo ")).toBe(true);
  expect(html.endsWith(" (s)")).toBe(true);
});
