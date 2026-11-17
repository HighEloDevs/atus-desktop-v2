/**
 * @module
 * Pure state machine of a running lesson.
 *
 * The script is rigid: the student moves forward only after the current step is done,
 * cannot jump ahead, may go back to steps already reached, and Esc pauses the lesson.
 */

import type { Lesson, LessonEvent, LessonStep } from "./lesson";

/** Progress of one lesson. */
export type LessonState = {
  /** Index of the current step. */
  index: number;
  /** Highest step index reached so far. */
  reached: number;
  /** Step identifiers whose `waitFor` event already happened. */
  completed: string[];
  /** True while the lesson is paused and the app is free. */
  paused: boolean;
  /** True once the student continued past the last step. */
  finished: boolean;
};

/** Actions accepted by {@link lessonReducer}. */
export type LessonAction =
  | { type: "event"; event: LessonEvent }
  | { type: "next" }
  | { type: "go"; index: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" };

/** State of a lesson that was just opened. */
export const initialLessonState: LessonState = {
  index: 0,
  reached: 0,
  completed: [],
  paused: false,
  finished: false,
};

/**
 * Tells whether a step lets the student continue.
 * @param step - Step to check.
 * @param state - Current progress.
 * @returns True for a step without `waitFor`, or once its event happened.
 */
export function isStepDone(step: LessonStep, state: LessonState): boolean {
  return !step.waitFor || state.completed.includes(step.id);
}

/**
 * Tells whether the step list may jump to a step.
 *
 * Only steps already reached on the same screen are allowed: leaving the analysis
 * to go back to the spreadsheet would discard the pasted data.
 * @param lesson - Lesson being run.
 * @param state - Current progress.
 * @param index - Step to go to.
 * @returns True when {@link lessonReducer} accepts `{ type: "go", index }`.
 */
export function canGoTo(lesson: Lesson, state: LessonState, index: number): boolean {
  return (
    !state.paused &&
    index >= 0 &&
    index <= state.reached &&
    index !== state.index &&
    lesson.steps[index].view === lesson.steps[state.index].view
  );
}

/**
 * Applies an action to the lesson progress.
 *
 * - `event` completes the current step when it is the event that step waits for, and
 *   moves on at once for a step with `advance: "auto"`; events for other steps are ignored,
 *   so acting ahead of the script does not count. The step's `revertOn` event, before the
 *   step is done, returns to the previous step and undoes it.
 * - `next` moves forward only when the current step is done; on the last step it finishes
 *   the lesson.
 * - `go` moves to a step already reached on the same screen (see {@link canGoTo}).
 * - `pause` and `resume` toggle the pause; nothing else changes while paused,
 *   except `resume` and `restart`.
 *
 * @param lesson - Lesson being run.
 * @param state - Current progress.
 * @param action - What happened.
 * @returns The new progress, or the same object when nothing changes.
 * @example
 * let state = initialLessonState;
 * state = lessonReducer(gravityLesson, state, { type: "next" }); // intro → copy
 * state = lessonReducer(gravityLesson, state, { type: "next" }); // ignored: not copied yet
 */
export function lessonReducer(
  lesson: Lesson,
  state: LessonState,
  action: LessonAction,
): LessonState {
  if (action.type === "restart") return initialLessonState;
  if (action.type === "resume") return state.paused ? { ...state, paused: false } : state;
  if (state.paused) return state;
  const step = lesson.steps[state.index];
  switch (action.type) {
    case "pause":
      return { ...state, paused: true };
    case "event": {
      if (step.revertOn === action.event && state.index > 0 && !state.completed.includes(step.id)) {
        const previous = lesson.steps[state.index - 1].id;
        return {
          ...state,
          index: state.index - 1,
          completed: state.completed.filter((id) => id !== previous),
        };
      }
      if (step.waitFor !== action.event || state.completed.includes(step.id)) return state;
      const completed = [...state.completed, step.id];
      if (step.advance === "auto" && state.index < lesson.steps.length - 1) {
        const index = state.index + 1;
        return { ...state, completed, index, reached: Math.max(state.reached, index) };
      }
      return { ...state, completed };
    }
    case "next": {
      if (!isStepDone(step, state) || state.finished) return state;
      if (state.index === lesson.steps.length - 1) return { ...state, finished: true };
      const index = state.index + 1;
      return { ...state, index, reached: Math.max(state.reached, index) };
    }
    case "go":
      if (!canGoTo(lesson, state, action.index)) return state;
      return { ...state, index: action.index };
  }
}

/**
 * Replaces `{mod}` in a step text with the platform modifier key.
 * @param text - Step text.
 * @param modifier - "⌘" on macOS, "Ctrl" elsewhere.
 * @returns The text ready to show.
 */
export function withModifier(text: string, modifier: string): string {
  return text.replaceAll("{mod}", modifier);
}
