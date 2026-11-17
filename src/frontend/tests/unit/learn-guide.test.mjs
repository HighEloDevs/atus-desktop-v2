// @vitest-environment jsdom
/** The guide page of a lesson: its blocks and the static plot. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { niceTicks, sampleFit } from "../../src/features/learn/guide-plot";
import { LessonGuide } from "../../src/features/learn/LessonGuide";
import { gravityLesson } from "../../src/features/learn/lessons/gravity";

describe("guide plot helpers", () => {
  it("picks round ticks from zero", () => {
    expect(niceTicks(0.6)).toEqual([0, 0.2, 0.4, 0.6]);
    expect(niceTicks(1.808)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(niceTicks(43)).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("samples a fitted curve and nothing without a fit", () => {
    const fit = { equation: "a*x", parameters: [{ name: "a", value: 2, uncertainty: 0 }] };
    const curve = sampleFit({ label: "s", tone: "data", rows: [], fit }, 0, 3);
    expect(curve).toHaveLength(61);
    expect(curve.at(-1)).toEqual([3, 6]);
    expect(sampleFit({ label: "s", tone: "data", rows: [] }, 0, 1)).toEqual([]);
  });
});

describe("LessonGuide", () => {
  let root;
  let node;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node);
  });
  afterEach(() => {
    act(() => root.unmount());
    node.remove();
  });

  it("renders every section with a link, its blocks and two ways to start", () => {
    const onStart = vi.fn();
    const onExit = vi.fn();
    act(() => root.render(createElement(LessonGuide, { lesson: gravityLesson, onStart, onExit })));
    const sections = gravityLesson.guide.sections;
    expect(node.querySelectorAll("nav a")).toHaveLength(sections.length);
    for (const section of sections) {
      const element = node.querySelector(`#guide-${section.id}`);
      expect(element.querySelector("h2").textContent).toContain(section.title);
    }
    const blocks = sections.flatMap((s) => s.blocks);
    const count = (kind) => blocks.filter((b) => b.kind === kind).length;
    expect(node.querySelectorAll("figure img")).toHaveLength(count("figure"));
    expect(node.querySelectorAll("table")).toHaveLength(count("table"));
    expect(node.querySelectorAll("aside")).toHaveLength(count("callout"));
    expect(node.querySelectorAll(".katex")).toHaveLength(count("equation"));
    const plot = node.querySelector('svg[role="img"]');
    expect(plot.querySelectorAll("[data-series] circle")).toHaveLength(34);
    expect(plot.querySelectorAll("polyline")).toHaveLength(2);
    expect(node.textContent).toContain("Erro sistemático");
    expect(node.textContent).toContain("Mitigação");

    const starts = [...node.querySelectorAll("button")].filter(
      (b) => b.textContent.trim() === "Começar a análise",
    );
    expect(starts).toHaveLength(2);
    act(() => starts[1].click());
    expect(onStart).toHaveBeenCalledOnce();
    act(() => node.querySelector('[aria-label="Voltar a Aprender"]').click());
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("sets one width for the whole column instead of one per block", () => {
    act(() =>
      root.render(
        createElement(LessonGuide, { lesson: gravityLesson, onStart: vi.fn(), onExit: vi.fn() }),
      ),
    );
    const article = node.querySelector("article");
    expect(article.className).toContain("max-w-[680px]");
    const widths = [...article.querySelectorAll("[class*='max-w-']")];
    expect(widths).toEqual([]);
    for (const img of article.querySelectorAll("figure img"))
      expect(img.className).toContain("w-full");
  });
});
