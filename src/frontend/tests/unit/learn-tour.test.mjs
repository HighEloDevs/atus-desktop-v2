// @vitest-environment jsdom
/** The driver.js adapter: rigid configuration, the continue button and late targets. */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const instances = vi.hoisted(() => []);
vi.mock("driver.js", () => ({
  driver: vi.fn((config) => {
    const instance = { config, highlight: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
    instances.push(instance);
    return instance;
  }),
}));
vi.mock("driver.js/dist/driver.css", () => ({}));
import { createLessonTour, waitForTarget } from "../../src/features/learn/lesson-tour";

const view = {
  target: "analysis-panel",
  title: "Escreva o modelo",
  body: "Digite a equação.",
  progress: "3 de 9",
  done: false,
  nextLabel: "Próximo",
};

const anchor = (name) => {
  const element = document.createElement("div");
  element.dataset.tour = name;
  return element;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  instances.length = 0;
  document.body.replaceChildren(anchor("analysis-panel"));
});
afterEach(() => {
  vi.useRealTimers();
});

it("draws nothing until the first step and uses a rigid configuration", () => {
  const onBlocked = vi.fn();
  const tour = createLessonTour({ onNext: vi.fn(), onBlocked });
  tour.refresh();
  tour.hide();
  expect(instances).toHaveLength(0);
  tour.show(view);
  const [{ config }] = instances;
  expect(config).toMatchObject({ allowClose: false, allowKeyboardControl: false });
  config.overlayClickBehavior();
  expect(onBlocked).toHaveBeenCalledOnce();
});

it("shows the continue button only when the step is done", () => {
  const onNext = vi.fn();
  const tour = createLessonTour({ onNext, onBlocked: vi.fn() });
  tour.show(view);
  const [instance] = instances;
  let step = instance.highlight.mock.calls[0][0];
  expect(step.element).toBe(document.querySelector('[data-tour="analysis-panel"]'));
  expect(step.popover.showButtons).toEqual([]);
  expect(step.popover.description).toContain("3 de 9 · Esc pausa");

  tour.show({ ...view, done: true, why: "Porque sim.", nextLabel: "Concluir" });
  step = instance.highlight.mock.calls[1][0];
  expect(instances).toHaveLength(1);
  expect(step.popover.showButtons).toEqual(["next"]);
  expect(step.popover.nextBtnText).toBe("Concluir");
  expect(step.popover.description).toContain('<span class="lesson-why">Porque sim.</span>');
  step.popover.onNextClick();
  expect(onNext).toHaveBeenCalledOnce();
});

it("refreshes and removes the overlay, then creates a new one", () => {
  const tour = createLessonTour({ onNext: vi.fn(), onBlocked: vi.fn() });
  tour.show(view);
  tour.refresh();
  expect(instances[0].refresh).toHaveBeenCalledOnce();
  tour.hide();
  expect(instances[0].destroy).toHaveBeenCalledOnce();
  tour.show(view);
  expect(instances).toHaveLength(2);
});

it("waits for a target that mounts after its step starts, as a dialog's content", async () => {
  const tour = createLessonTour({ onNext: vi.fn(), onBlocked: vi.fn() });
  tour.show({ ...view, target: "copy-parameters" });
  expect(instances).toHaveLength(0);
  const button = anchor("copy-parameters");
  document.body.append(button);
  await flush();
  expect(instances[0].highlight).toHaveBeenCalledOnce();
  expect(instances[0].highlight.mock.calls[0][0].element).toBe(button);
});

it("drops the wait of a step that was replaced or hidden", async () => {
  const tour = createLessonTour({ onNext: vi.fn(), onBlocked: vi.fn() });
  tour.show({ ...view, target: "late" });
  tour.show(view);
  tour.show({ ...view, target: "later" });
  tour.hide();
  document.body.append(anchor("late"), anchor("later"));
  await flush();
  expect(instances).toHaveLength(1);
  expect(instances[0].highlight).toHaveBeenCalledOnce();
  expect(instances[0].highlight.mock.calls[0][0].element.dataset.tour).toBe("analysis-panel");
});

it("gives up on a target that never appears and centres the balloon", () => {
  vi.useFakeTimers();
  const found = vi.fn();
  const stop = waitForTarget("missing", found);
  vi.advanceTimersByTime(1999);
  expect(found).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(found).toHaveBeenCalledWith(undefined);
  stop();
  expect(found).toHaveBeenCalledOnce();
});

it("keeps the lesson controls and toasts clickable under driver.js's pointer lock", () => {
  // driver.js sets `.driver-active * { pointer-events: none }` on everything but the highlight.
  const css = readFileSync(`${process.cwd()}/src/styles/globals.css`, "utf8");
  const rule = css.match(/([^{}]*)\{\s*pointer-events: auto;\s*\}/g)?.join("") ?? "";
  for (const selector of [
    "html.lesson-active .lesson-controls *",
    "html.lesson-active [data-sonner-toaster] *",
  ])
    expect(rule).toContain(selector);
});
