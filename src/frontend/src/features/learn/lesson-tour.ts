/**
 * @module
 * Thin adapter between a running lesson and driver.js, which draws the dimmed overlay,
 * the highlight and the instruction balloon.
 *
 * The lesson state machine decides what to show; this module only draws it. The script is
 * rigid: the balloon has no close button, the keyboard does not move it, clicking outside
 * the highlight only nudges the student, and **Próximo** appears only when the step is done.
 * The mouse wheel still scrolls what sits under the overlay ({@link scrollUnderOverlay}).
 */

import { driver, type Driver, type PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";

/** What the balloon shows for the current step. */
export type TourView = {
  /** `data-tour` value of the highlighted element. */
  target: string;
  title: string;
  /** Instruction, as trusted HTML from the lesson manifest. */
  body: string;
  why?: string;
  /** Text such as "3 de 10". */
  progress: string;
  /** Whether the step lets the student continue. */
  done: boolean;
  /** Label of the continue button. */
  nextLabel: string;
  /** `data-tour` value of the control to focus inside the highlight, when not its first one. */
  focus?: string;
};

/** Class on `<html>` that briefly turns pointer events back on to find what is under the cursor. */
const PROBE_CLASS = "lesson-probe";

/** driver.js layers, which never scroll. */
const TOUR_LAYERS = ".driver-overlay, .driver-popover";

/**
 * Tells whether an element scrolls in the direction of a wheel movement.
 * @param element - Candidate element.
 * @param dx - Horizontal movement in pixels.
 * @param dy - Vertical movement in pixels.
 * @returns True when its overflow lets it scroll and it is not already at that end.
 */
export function canScroll(element: Element, dx: number, dy: number): boolean {
  const style = getComputedStyle(element);
  const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll";
  const vertical =
    dy !== 0 &&
    scrolls(style.overflowY) &&
    (dy > 0
      ? element.scrollTop + element.clientHeight < element.scrollHeight - 1
      : element.scrollTop > 0);
  const horizontal =
    dx !== 0 &&
    scrolls(style.overflowX) &&
    (dx > 0
      ? element.scrollLeft + element.clientWidth < element.scrollWidth - 1
      : element.scrollLeft > 0);
  return vertical || horizontal;
}

/**
 * Scrolls whatever sits under the dimmed overlay at a wheel event.
 *
 * driver.js turns off pointer events outside the highlight, its overlay included, so a wheel
 * over the rest of the screen lands on the body and nothing scrolls, not even the text a step asks to read. The
 * overlay still blocks clicks; only scrolling passes through. Pointer events are turned back
 * on for the instant of the lookup, without a repaint.
 * @param event - Wheel event on the page.
 * @returns The element scrolled, or `null` when nothing under the cursor can scroll that way.
 */
export function scrollUnderOverlay(event: WheelEvent): Element | null {
  const target = event.target;
  if (!document.body.classList.contains("driver-active")) return null;
  // Inside the highlight the wheel already works.
  if (target instanceof Element && target.closest(".driver-active-element")) return null;
  if (typeof document.elementsFromPoint !== "function") return null;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;
  const root = document.documentElement;
  root.classList.add(PROBE_CLASS);
  const under = document.elementsFromPoint(event.clientX, event.clientY);
  root.classList.remove(PROBE_CLASS);
  const start = under.find((element) => !element.closest(TOUR_LAYERS));
  for (let element = start ?? null; element; element = element.parentElement) {
    if (!canScroll(element, dx, dy)) continue;
    element.scrollBy({ left: dx, top: dy });
    return element;
  }
  return null;
}

/** Controls the overlay of one lesson. */
export type LessonTour = {
  /** Highlights a step, replacing the previous one. */
  show(view: TourView): void;
  /** Recomputes the highlight after the layout changed. */
  refresh(): void;
  /** Removes the overlay, as when the lesson pauses or ends. */
  hide(): void;
};

/** How long the balloon waits for an element that is about to appear (ms). */
const WAIT_FOR_ELEMENT_MS = 2000;

/**
 * Calls `found` with the element of a `data-tour` target, now or as soon as it appears.
 *
 * driver.js only honours `waitForElement` in a multi-step tour, not in `highlight`, and
 * some targets mount a moment after the event that leads to their step (a Radix dialog
 * portals its content on the next render). Highlighting a missing element would draw a
 * centred balloon over a page where nothing can be clicked.
 * @param target - `data-tour` value.
 * @param found - Receives the element once it is in the document, or `undefined` when it
 *   does not appear in time (the balloon is then centred and the lesson controls still work).
 * @returns A function that stops waiting; calling it after `found` ran does nothing.
 */
export function waitForTarget(
  target: string,
  found: (element: Element | undefined) => void,
): () => void {
  const selector = `[data-tour="${target}"]`;
  const now = document.querySelector(selector);
  if (now) {
    found(now);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (!element) return;
    stop();
    found(element);
  });
  const timer = setTimeout(() => {
    stop();
    found(undefined);
  }, WAIT_FOR_ELEMENT_MS);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}

/** Controls the keyboard can reach, in document order. */
const FOCUSABLE =
  'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/**
 * Moves the keyboard focus to where a step that is not done expects the student to act.
 *
 * driver.js focuses the first button of the balloon, which is **Pausar** while the step
 * waits: typing a space there would pause the lesson instead of writing the equation. The
 * focus goes instead to the `preferred` control, to the highlighted element when it is a
 * control, or to the first control inside it. When there is none, the focus leaves the
 * balloon so shortcuts such as {mod}+B reach the app.
 * @param element - Highlighted element, or `undefined` for a centred balloon.
 * @param preferred - `data-tour` value of the control to focus first, if any.
 * @returns The element focused, or `null` when the focus was only released.
 */
export function focusStep(element: Element | undefined, preferred?: string): HTMLElement | null {
  const control =
    (preferred && document.querySelector<HTMLElement>(`[data-tour="${preferred}"]`)) ||
    (element?.matches(FOCUSABLE) ? (element as HTMLElement) : null) ||
    element?.querySelector<HTMLElement>(FOCUSABLE) ||
    null;
  if (control) {
    control.focus({ preventScroll: true });
    return control;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest(".driver-popover")) active.blur();
  return null;
}

/**
 * Adds **Pausar** and **Sair da lição** to the balloon footer.
 *
 * The controls ride on the balloon so they never cover the highlighted element, which a
 * fixed bar would do on some step. driver.js hides the whole footer of a balloon without
 * buttons and leaves its buttons untouched, so the footer is shown again and its buttons are
 * set here: never **Anterior**, **Próximo** only when the step is done.
 * @param popover - Balloon parts, from driver.js `onPopoverRender`.
 * @param done - Whether the step lets the student continue.
 * @param handlers.onPause - Called by **Pausar**.
 * @param handlers.onExit - Called by **Sair da lição**.
 */
export function addBalloonControls(
  popover: Pick<PopoverDOM, "footer" | "previousButton" | "nextButton">,
  done: boolean,
  handlers: { onPause: () => void; onExit: () => void },
): void {
  const { footer } = popover;
  const bar = document.createElement("span");
  bar.className = "lesson-balloon-controls";
  for (const [label, action] of [
    ["Pausar", handlers.onPause],
    ["Sair da lição", handlers.onExit],
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => action());
    bar.append(button);
  }
  // Last in the DOM, first on screen (CSS order): driver.js focuses the first button of the
  // balloon, which must be **Próximo**, not **Pausar**.
  footer.append(bar);
  footer.style.display = "flex";
  popover.previousButton.style.display = "none";
  popover.nextButton.style.display = done ? "block" : "none";
}

/**
 * Creates the overlay of a lesson.
 * @param handlers.onNext - Called by the continue button.
 * @param handlers.onBlocked - Called when the student clicks outside the highlight.
 * @param handlers.onPause - Called by **Pausar** in the balloon.
 * @param handlers.onExit - Called by **Sair da lição** in the balloon.
 * @returns The tour controls; nothing is drawn until {@link LessonTour.show}.
 */
export function createLessonTour(handlers: {
  onNext: () => void;
  onBlocked: () => void;
  onPause: () => void;
  onExit: () => void;
}): LessonTour {
  let instance: Driver | null = null;
  let stopWaiting: (() => void) | null = null;
  const cancelWait = () => {
    stopWaiting?.();
    stopWaiting = null;
  };
  const onWheel = (event: WheelEvent) => {
    if (scrollUnderOverlay(event)) instance?.refresh();
  };
  const ensure = () =>
    (instance ??= driver({
      animate: true,
      allowClose: false,
      allowKeyboardControl: false,
      overlayClickBehavior: () => handlers.onBlocked(),
      overlayColor: "#181d21",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "lesson-popover",
      waitForElement: WAIT_FOR_ELEMENT_MS,
    }));
  return {
    show(view) {
      cancelWait();
      const body = view.why ? `${view.body}<span class="lesson-why">${view.why}</span>` : view.body;
      const draw = (element: Element | undefined) =>
        ensure().highlight({
          element,
          popover: {
            title: view.title,
            description: `${body}<span class="lesson-progress">${view.progress} · Esc pausa</span>`,
            showButtons: view.done ? ["next"] : [],
            nextBtnText: view.nextLabel,
            onNextClick: () => handlers.onNext(),
            onPopoverRender: (popover) => {
              addBalloonControls(popover, view.done, handlers);
              // driver.js focuses the balloon right after this hook; take the focus back after it.
              if (!view.done) queueMicrotask(() => focusStep(element, view.focus));
            },
          },
        });
      stopWaiting = waitForTarget(view.target, draw);
      window.addEventListener("wheel", onWheel, { passive: true });
    },
    refresh() {
      instance?.refresh();
    },
    hide() {
      cancelWait();
      window.removeEventListener("wheel", onWheel);
      instance?.destroy();
      instance = null;
    },
  };
}
