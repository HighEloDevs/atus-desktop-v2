// @vitest-environment jsdom
/** The driver.js adapter: rigid configuration, the continue button and late targets. */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const instances = vi.hoisted(() => []);
vi.mock("driver.js", () => ({
  driver: vi.fn((config) => {
    const instance = { config, highlight: vi.fn(), refresh: vi.fn(), destroy: vi.fn() };
    instances.push(instance);
    return instance;
  }),
}));
vi.mock("driver.js/dist/driver.css", () => ({}));
import {
  addBalloonControls,
  canScroll,
  createLessonTour,
  focusStep,
  scrollUnderOverlay,
  waitForTarget,
} from "../../src/features/learn/lesson-tour";

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

describe("balloon controls", () => {
  const popover = () => {
    const footer = document.createElement("div");
    footer.style.display = "none";
    const previousButton = document.createElement("button");
    const nextButton = document.createElement("button");
    footer.append(previousButton, nextButton);
    return { footer, previousButton, nextButton };
  };

  it("puts Pausar and Sair da lição on every balloon, after Próximo in the DOM", () => {
    const handlers = { onNext: vi.fn(), onBlocked: vi.fn(), onPause: vi.fn(), onExit: vi.fn() };
    const tour = createLessonTour(handlers);
    tour.show(view);
    const dom = popover();
    instances[0].highlight.mock.calls[0][0].popover.onPopoverRender(dom);
    expect(dom.footer.style.display).toBe("flex");
    expect(dom.previousButton.style.display).toBe("none");
    // A step that is not done shows no continue button even with the footer visible.
    expect(dom.nextButton.style.display).toBe("none");
    const [pause, exit] = dom.footer.querySelectorAll(".lesson-balloon-controls button");
    // Last in the DOM, so the button driver.js focuses first is Próximo, not Pausar.
    expect(dom.footer.lastElementChild.className).toBe("lesson-balloon-controls");
    pause.click();
    exit.click();
    expect(handlers.onPause).toHaveBeenCalledOnce();
    expect(handlers.onExit).toHaveBeenCalledOnce();
  });

  it("shows Próximo once the step is done", () => {
    const dom = popover();
    addBalloonControls(dom, true, { onPause: vi.fn(), onExit: vi.fn() });
    expect(dom.nextButton.style.display).toBe("block");
    const css = readFileSync(`${process.cwd()}/src/styles/globals.css`, "utf8");
    expect(css).toMatch(/\.lesson-balloon-controls \{[^}]*order: -1;/);
  });
});

describe("scrolling under the overlay", () => {
  const box = (overflowY, { top = 0, height = 100, scrollHeight = 300 } = {}) => {
    const element = document.createElement("div");
    element.style.overflowY = overflowY;
    Object.defineProperty(element, "clientHeight", { value: height });
    Object.defineProperty(element, "scrollHeight", { value: scrollHeight });
    element.scrollTop = top;
    element.scrollBy = vi.fn();
    return element;
  };
  const wheel = (target, init = {}) => {
    const event = new WheelEvent("wheel", { deltaY: 120, clientX: 10, clientY: 10, ...init });
    Object.defineProperty(event, "target", { value: target });
    return event;
  };
  afterEach(() => {
    document.body.className = "";
    delete document.elementsFromPoint;
  });

  it("tells whether an element can still scroll that way", () => {
    expect(canScroll(box("auto"), 0, 50)).toBe(true);
    expect(canScroll(box("auto", { top: 200 }), 0, 50)).toBe(false);
    expect(canScroll(box("auto", { top: 200 }), 0, -50)).toBe(true);
    expect(canScroll(box("auto"), 0, -50)).toBe(false);
    expect(canScroll(box("hidden"), 0, 50)).toBe(false);
    expect(canScroll(box("visible"), 0, 0)).toBe(false);
    const wide = document.createElement("div");
    wide.style.overflowX = "scroll";
    Object.defineProperty(wide, "clientWidth", { value: 100 });
    Object.defineProperty(wide, "scrollWidth", { value: 300 });
    expect(canScroll(wide, 40, 0)).toBe(true);
    wide.scrollLeft = 10;
    expect(canScroll(wide, -40, 0)).toBe(true);
  });

  it("scrolls the nearest scrollable element under the cursor, skipping driver.js layers", () => {
    document.body.classList.add("driver-active");
    const list = box("auto");
    const inner = document.createElement("p");
    list.append(inner);
    const overlay = document.createElement("svg");
    overlay.className = "driver-overlay";
    document.body.append(list, overlay);
    let probed = false;
    document.elementsFromPoint = vi.fn(() => {
      probed = document.documentElement.classList.contains("lesson-probe");
      return [overlay, inner, list, document.body];
    });
    expect(scrollUnderOverlay(wheel(document.body, { deltaMode: 1, deltaY: 3 }))).toBe(list);
    expect(probed).toBe(true);
    expect(document.documentElement.classList.contains("lesson-probe")).toBe(false);
    expect(list.scrollBy).toHaveBeenCalledWith({ left: 0, top: 48 });
    // Nothing scrollable that way: the wheel is left alone.
    expect(scrollUnderOverlay(wheel(document.body, { deltaY: -120 }))).toBeNull();
  });

  it("leaves the wheel alone inside the highlight or with no lesson overlay", () => {
    document.elementsFromPoint = vi.fn(() => []);
    expect(scrollUnderOverlay(wheel(document.body))).toBeNull();
    document.body.classList.add("driver-active");
    const active = document.createElement("div");
    active.className = "driver-active-element";
    expect(scrollUnderOverlay(wheel(active))).toBeNull();
    expect(scrollUnderOverlay(wheel(document.body, { deltaMode: 2 }))).toBeNull();
    expect(document.elementsFromPoint).toHaveBeenCalledOnce();
  });

  it("listens to the wheel while a step is shown and refreshes the highlight", () => {
    const tour = createLessonTour({ onNext: vi.fn(), onBlocked: vi.fn() });
    tour.show(view);
    document.body.classList.add("driver-active");
    const list = box("auto");
    document.body.append(list);
    document.elementsFromPoint = () => [list];
    // Tours of earlier tests were never hidden, so count only what this one adds.
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    const withTour = list.scrollBy.mock.calls.length;
    expect(instances.at(-1).refresh).toHaveBeenCalledOnce();
    tour.hide();
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    expect(list.scrollBy.mock.calls.length - withTour).toBe(withTour - 1);
  });
});

describe("focus while a step waits", () => {
  const html = (markup) => {
    document.body.innerHTML = markup;
    return document.body.firstElementChild;
  };

  it("focuses the highlighted control, the first control inside, or the preferred one", () => {
    const run = html('<button data-tour="fit-run">Executar</button>');
    expect(focusStep(run)).toBe(run);
    const field = html('<div data-tour="fit-equation"><span></span><input /></div>');
    expect(focusStep(field)).toBe(field.querySelector("input"));
    const card = html(
      '<div data-tour="analysis-results"><button>Recolher</button><button data-tour="fit-details">Ver detalhes</button></div>',
    );
    expect(focusStep(card, "fit-details").textContent).toBe("Ver detalhes");
    expect(document.activeElement.textContent).toBe("Ver detalhes");
  });

  it("takes the focus off the balloon when the highlight has no control", () => {
    const canvas = html('<div data-tour="analysis-canvas"><p>Vazio</p></div>');
    const balloon = document.createElement("div");
    balloon.className = "driver-popover";
    const pause = document.createElement("button");
    balloon.append(pause);
    document.body.append(balloon);
    pause.focus();
    expect(focusStep(canvas)).toBeNull();
    expect(document.activeElement).toBe(document.body);
    // Focus elsewhere in the app is left alone.
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    expect(focusStep(undefined)).toBeNull();
    expect(document.activeElement).toBe(other);
  });

  it("moves the focus after driver.js focuses the balloon, only while the step waits", async () => {
    document.body.innerHTML = '<div data-tour="analysis-panel"><input /></div>';
    const tour = createLessonTour({ onNext: vi.fn(), onBlocked: vi.fn() });
    const render = (done) => {
      tour.show({ ...view, done });
      const footer = document.createElement("div");
      const nextButton = document.createElement("button");
      footer.append(nextButton);
      document.body.append(footer);
      instances[0].highlight.mock.lastCall[0].popover.onPopoverRender({
        footer,
        previousButton: document.createElement("button"),
        nextButton,
      });
      nextButton.focus(); // what driver.js does right after the hook
      return nextButton;
    };
    render(false);
    await Promise.resolve();
    expect(document.activeElement.tagName).toBe("INPUT");
    const next = render(true);
    await Promise.resolve();
    expect(document.activeElement).toBe(next);
  });
});
