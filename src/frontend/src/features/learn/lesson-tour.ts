/**
 * @module
 * Thin adapter between a running lesson and driver.js, which draws the dimmed overlay,
 * the highlight and the instruction balloon.
 *
 * The lesson state machine decides what to show; this module only draws it. The script is
 * rigid: the balloon has no close button, the keyboard does not move it, clicking outside
 * the highlight only nudges the student, and **Próximo** appears only when the step is done.
 */

import { driver, type Driver } from "driver.js";
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
};

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

/**
 * Creates the overlay of a lesson.
 * @param handlers.onNext - Called by the continue button.
 * @param handlers.onBlocked - Called when the student clicks outside the highlight.
 * @returns The tour controls; nothing is drawn until {@link LessonTour.show}.
 */
export function createLessonTour(handlers: {
  onNext: () => void;
  onBlocked: () => void;
}): LessonTour {
  let instance: Driver | null = null;
  let stopWaiting: (() => void) | null = null;
  const cancelWait = () => {
    stopWaiting?.();
    stopWaiting = null;
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
          },
        });
      stopWaiting = waitForTarget(view.target, draw);
    },
    refresh() {
      instance?.refresh();
    },
    hide() {
      cancelWait();
      instance?.destroy();
      instance = null;
    },
  };
}
