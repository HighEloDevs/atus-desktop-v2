// @vitest-environment jsdom
/** Regression: Tailwind 4 emits oklab/oklch colors, which the original html2canvas rejects. */
import { expect, it } from "vitest";
import html2canvas from "html2canvas-pro";

it.each([
  ["oklab", "oklab(0.62 0.1 0.05)"],
  ["oklch", "oklch(0.6 0.2 30)"],
  ["color-mix", "color-mix(in oklab, #364cff 50%, white)"],
])("renders an element styled with %s without a color parsing error", async (_name, value) => {
  const element = document.createElement("div");
  element.style.backgroundColor = value;
  element.style.color = value;
  element.style.borderColor = value;
  element.textContent = "gráfico";
  document.body.appendChild(element);
  try {
    // jsdom has no 2D canvas, so rendering itself may fail; only the color parser must not.
    await html2canvas(element, { scale: 1 });
  } catch (error) {
    expect(String(error?.message ?? error)).not.toMatch(/unsupported color function/i);
  } finally {
    element.remove();
  }
});
