// @vitest-environment jsdom
/**
 * The screen of a Como medir lesson: guided steps that move the loupe and the highlights,
 * the caliper exploration by keyboard, buttons and drag, and the practice with correction.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MeasureLessonView } from "../../src/features/learn/measure/MeasureLessonView";
import { rulerLesson } from "../../src/features/learn/lessons/ruler";
import { caliperLesson } from "../../src/features/learn/lessons/caliper";
import { micrometerLesson } from "../../src/features/learn/lessons/micrometer";

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
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
});

const render = (lesson, props = {}) =>
  act(() => root.render(createElement(MeasureLessonView, { lesson, onExit: vi.fn(), ...props })));
const button = (name) =>
  [...node.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === name || b.getAttribute("aria-label") === name,
  );
const click = (element) => act(() => element.click());
const instrument = () => node.querySelector('[data-testid="instrument"]');
const loupe = () => node.querySelector('[data-testid="loupe"]').getAttribute("viewBox");
const panel = () => node.querySelector("aside").textContent;
const setInput = (input, text) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
async function answer(value, uncertainty) {
  const [length, error] = node.querySelectorAll("form input");
  await setInput(length, value);
  await setInput(error, uncertainty);
  await act(() =>
    node
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

describe("ruler lesson", () => {
  it("walks the guide with the loupe on each point and ends with the result", async () => {
    const onExit = vi.fn();
    await render(rulerLesson, { onExit });
    expect(node.querySelector("h1").textContent).toBe("Régua");
    // Guia and Praticar only: exploring is a caliper mode.
    expect(button("Explorar")).toBeUndefined();
    expect(node.querySelector('[aria-current="step"]').textContent).toContain("Encoste no zero");
    expect(loupe()).toBe("-2 76 96 64");
    expect(instrument().querySelectorAll("[data-highlight]")).toHaveLength(1);
    // The loupe shows the same drawing.
    const sceneId = instrument().querySelector("[data-instrument]").id;
    expect(node.querySelector('[data-testid="loupe"] use').getAttribute("href")).toBe(
      `#${sceneId}`,
    );

    await click(button("Próximo"));
    expect(node.querySelector('aside svg[role="img"]')).not.toBeNull();
    await click(button("Próximo"));
    expect(panel()).toContain("0,99865");
    await click(button("Próximo"));
    expect(panel()).toContain("entre 42 e 43 mm");
    expect(panel()).toContain("cerca de 42,3 mm");
    expect(loupe()).toBe(`${40 + 42.3 * 12 - 48} 76 96 64`);
    expect(instrument().querySelectorAll("[data-highlight]")).toHaveLength(2);
    await click(button("Próximo"));
    expect(panel()).toContain("1 mm ÷ 2 = 0,5 mm");
    expect(panel()).toContain("L = (42,3 ± 0,5) mm");
    expect(button("Próximo")).toBeUndefined();

    await click(button("Voltar"));
    expect(node.querySelector('[aria-current="step"]').textContent).toContain("dígito duvidoso");
    await click([...node.querySelectorAll("ol button")][0]);
    expect(button("Voltar").disabled).toBe(true);
    await click(button("Aprender"));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("checks practice answers, keeps the score and draws a new piece", async () => {
    await render(rulerLesson, { random: () => 0.5 });
    for (let i = 0; i < 4; i++) await click(button("Próximo"));
    await click(button("Praticar"));
    // 12 mm + 0,5 × 44 mm = 34,0 mm.
    expect(Number(node.querySelector("[data-piece]").getAttribute("width"))).toBeCloseTo(408, 9);
    expect(panel()).toContain("0 de 0 certas");

    await answer("34", "0,5");
    expect(panel()).toContain("Ainda não");
    expect(panel()).toContain("Falta o dígito duvidoso");
    expect(panel()).toContain("0 de 1 certas");
    // A second try on the same piece does not count again.
    await answer("34,1", "0,5");
    expect(panel()).toContain("Certo: L = (34,1 ± 0,5) mm");
    expect(panel()).toContain("A peça simulada mede 34,0 mm");
    expect(panel()).toContain("0 de 1 certas");

    await click(button("Nova peça"));
    expect(Number(node.querySelector("[data-piece]").getAttribute("width"))).toBeCloseTo(528, 9);
    expect(node.querySelector("form input").value).toBe("");
    await answer("44,0", "0,5");
    expect(panel()).toContain("1 de 2 certas");
    // The loupe slider starts at the zero.
    expect(node.querySelector('[role="slider"]').getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("caliper lesson", () => {
  it("shows the closed caliper first, then reads 23,65 mm step by step", async () => {
    await render(caliperLesson);
    expect(node.querySelector("[data-piece]")).toBeNull();
    expect(loupe()).toBe("22 88 96 64");
    await click(button("Próximo"));
    expect(node.querySelector("[data-piece]")).not.toBeNull();
    expect(panel()).toContain("são 23 mm inteiros");
    await click(button("Próximo"));
    expect(panel()).toContain("o traço 13, entre os números 6 e 7");
    expect(loupe()).toBe("512 88 96 64");
    await click(button("Próximo"));
    expect(panel()).toContain("23 + 13 × 0,05 = 23,65 mm");
    expect(instrument().querySelectorAll("[data-highlight]")).toHaveLength(3);
    await click(button("Próximo"));
    expect(panel()).toContain("0,025 mm → 0,03 mm");
    expect(panel()).toContain("L = (23,65 ± 0,03) mm");
    expect(panel()).toContain("(23,650)");
    await click(button("Explorar"));
    expect(instrument().getAttribute("role")).toBe("slider");
  });

  it("moves the jaw by keyboard, buttons and drag, with the reading alongside", async () => {
    await render(caliperLesson);
    await click(button("Explorar"));
    const svg = instrument();
    const output = () => node.querySelector("output").textContent;
    expect(svg.getAttribute("aria-valuetext")).toBe("12,40 mm");
    expect(output()).toBe("12 mm + 8 × 0,05 mm = 12,40 mm");

    const key = (init) =>
      act(() => svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init })));
    await key({ key: "ArrowRight" });
    expect(svg.getAttribute("aria-valuenow")).toBe("12.45");
    expect(output()).toBe("12 mm + 9 × 0,05 mm = 12,45 mm");
    await key({ key: "ArrowLeft", shiftKey: true });
    expect(svg.getAttribute("aria-valuenow")).toBe("11.45");
    await key({ key: "Enter" });
    expect(svg.getAttribute("aria-valuenow")).toBe("11.45");

    await click(button("+ 1 mm"));
    await click(button("+ 0,05 mm"));
    expect(svg.getAttribute("aria-valuenow")).toBe("12.5");
    await click(button("− 0,05 mm"));
    await click(button("− 1 mm"));
    expect(svg.getAttribute("aria-valuenow")).toBe("11.45");
    // The loupe follows the coinciding line: 11 + 2 × 9 = 29 mm.
    expect(loupe()).toBe(`${70 + 29 * 10 - 48} 88 96 64`);

    // One screen pixel is one SVG unit here; 10 units are 1 mm.
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1100, height: 270 });
    const pointer = (type, clientX) =>
      act(() => svg.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX })));
    await pointer("pointerdown", 300);
    await pointer("pointermove", 323);
    expect(svg.getAttribute("aria-valuenow")).toBe("13.75");
    await pointer("pointerup", 323);
    await pointer("pointermove", 500);
    expect(svg.getAttribute("aria-valuenow")).toBe("13.75");
    // The opening stays inside the instrument.
    await pointer("pointerdown", 0);
    await pointer("pointermove", -2000);
    expect(svg.getAttribute("aria-valuenow")).toBe("0");
    await pointer("pointercancel", 0);

    await click(button("Praticar"));
    expect(node.querySelector("output")).toBeNull();
  });

  it("explains a vernier read as tenths and accepts the right answer", async () => {
    await render(caliperLesson, { random: () => 0.25 });
    await click(button("Praticar"));
    // 800 + 0,25 × 4400 = 1900, a whole millimetre, nudged to 19,35 mm.
    await answer("19,7", "0,03");
    expect(panel()).toContain("não 0,1 mm");
    await answer("19,35", "0,03");
    expect(panel()).toContain("Certo: L = (19,35 ± 0,03) mm");
    expect(panel()).toContain("19 mm + 7 × 0,05 mm. O traço 7 do nônio coincide com o traço 33");
  });
});

describe("micrometer lesson", () => {
  it("reads 7,872 mm from sleeve, half millimetre and thimble", async () => {
    await render(micrometerLesson);
    expect(node.querySelector("h1").textContent).toBe("Micrômetro");
    // Closed and empty to check the zero.
    expect(node.querySelector("[data-piece]")).toBeNull();
    await click(button("Próximo"));
    expect(node.querySelector("[data-piece]")).not.toBeNull();
    expect(panel()).toContain("são 7 mm");
    expect(panel()).toContain("também já apareceu: some 0,5 mm");
    expect(instrument().querySelectorAll("[data-highlight]")).toHaveLength(2);
    await click(button("Próximo"));
    expect(panel()).toContain("entre os traços 37 e 38");
    expect(panel()).toContain("cerca de 37,2 divisões");
    await click(button("Próximo"));
    expect(panel()).toContain("7 + 0,5 + 37,2 × 0,01 = 7,872 mm");
    await click(button("Próximo"));
    expect(panel()).toContain("L = (7,872 ± 0,005) mm");
  });

  it("turns the thimble by keys, buttons and drag, and checks a practice reading", async () => {
    await render(micrometerLesson, { random: () => 0.5 });
    for (let i = 0; i < 4; i++) await click(button("Próximo"));
    await click(button("Explorar"));
    const svg = instrument();
    const output = () => node.querySelector("output").textContent;
    expect(output()).toBe("5 mm + 0,5 mm + 28 × 0,01 mm = 5,78 mm");
    await act(() =>
      svg.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })),
    );
    expect(output()).toBe("5 mm + 0,5 mm + 29 × 0,01 mm = 5,79 mm");
    await act(() =>
      svg.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight", shiftKey: true }),
      ),
    );
    expect(output()).toBe("6 mm + 29 × 0,01 mm = 6,29 mm");
    await click(button("− 1 volta"));
    await click(button("− 0,01 mm"));
    expect(svg.getAttribute("aria-valuetext")).toBe("5,78 mm");
    await click(button("+ 0,01 mm"));
    await click(button("+ 1 volta"));
    expect(svg.getAttribute("aria-valuenow")).toBe("6.29");

    // 24 SVG units are 1 mm; the view box starts at x = 0 and is 1660 wide.
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1660, height: 230 });
    const pointer = (type, clientX) =>
      act(() => svg.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX })));
    await pointer("pointerdown", 900);
    await pointer("pointermove", 912);
    await pointer("pointerup", 912);
    expect(svg.getAttribute("aria-valuenow")).toBe("6.79");

    await click(button("Praticar"));
    // 1000 + 0,5 × 23000 µm = 12,500 mm.
    await answer("12,000", "0,005");
    expect(panel()).toContain("Faltou o meio milímetro");
    await answer("12,500", "0,005");
    expect(panel()).toContain("Certo: L = (12,500 ± 0,005) mm");
    expect(panel()).toContain("12 mm + 0,5 mm + 0,0 × 0,01 mm");
  });
});
