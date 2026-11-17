/**
 * @module
 * Channel through which the app tells a running lesson what the student did.
 *
 * Outside a lesson the context holds a function that does nothing, so components
 * report events unconditionally and stay unaware of lessons.
 */

import { createContext, useContext } from "react";
import type { LessonEvent } from "./lesson";

/** Receives an app event; does nothing outside a lesson. */
export type LessonEventSink = (event: LessonEvent) => void;

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
