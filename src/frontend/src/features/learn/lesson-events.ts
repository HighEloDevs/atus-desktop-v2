/**
 * @module
 * Channel through which the app tells a running lesson what the student did.
 *
 * Outside a lesson the context holds a function that does nothing, so components
 * report events unconditionally and stay unaware of lessons.
 */

import { createContext, useContext } from "react";
import type { LessonEvent } from "./lesson";

/**
 * Receives an app event; does nothing outside a lesson.
 * @param event - What the student did.
 * @param detail - Extra data of the event, as the typed text of `equation.changed`.
 */
export type LessonEventSink = (event: LessonEvent, detail?: string) => void;

/** Context with the event sink of the running lesson. */
export const LessonEventContext = createContext<LessonEventSink>(() => {});

/**
 * Returns the function that reports an event to the running lesson.
 * @returns The sink of the nearest lesson, or a no-op outside one.
 * @example
 * const report = useLessonEvent();
 * report("fit.succeeded");
 */
export function useLessonEvent(): LessonEventSink {
  return useContext(LessonEventContext);
}

/** The lesson balloon and the paused-lesson bar, which sit outside the app's dialogs. */
export const LESSON_LAYERS = ".driver-popover, .lesson-controls";

/**
 * Keeps a modal dialog open when the student uses the lesson controls.
 *
 * Radix closes a dialog on any interaction outside it, and the lesson balloon and bar are
 * outside: **Pausar** would close the report that the current step needs open. Pass this as
 * the dialog's `onInteractOutside`; outside a lesson those layers do not exist.
 * @param event - Radix outside-interaction event.
 * @example
 * <Dialog.Content onInteractOutside={keepOpenForLesson}>…</Dialog.Content>
 */
export function keepOpenForLesson(event: { target: EventTarget | null; preventDefault(): void }) {
  if (event.target instanceof Element && event.target.closest(LESSON_LAYERS))
    event.preventDefault();
}
