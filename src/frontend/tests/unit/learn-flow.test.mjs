/** Rigid script of a lesson: events, next, going back and pause. */
import { describe, expect, it } from "vitest";
import {
  canGoTo,
  findWaitingStep,
  initialLessonState,
  isStepDone,
  lessonReducer,
  withModifier,
} from "../../src/features/learn/lesson-flow";

const lesson = {
  steps: [
    { id: "intro", view: "intro" },
    { id: "copy", view: "sheet", waitFor: "sheet.copied" },
    { id: "paste", view: "analysis", waitFor: "dataset.created" },
    { id: "read", view: "analysis" },
    { id: "fit", view: "analysis", waitFor: "fit.succeeded" },
  ],
};
const dialogLesson = {
  steps: [
    { id: "open", view: "analysis", waitFor: "details.opened" },
    { id: "copy", view: "analysis", waitFor: "params.copied", revertOn: "details.closed" },
    { id: "export", view: "analysis", waitFor: "chart.exported" },
  ],
};
const runDialog = (actions, state = initialLessonState) =>
  actions.reduce((current, action) => lessonReducer(dialogLesson, current, action), state);
const run = (actions, state = initialLessonState) =>
  actions.reduce((current, action) => lessonReducer(lesson, current, action), state);

describe("lessonReducer", () => {
  it("moves past a step without waitFor and stops at one that waits", () => {
    const state = run([{ type: "next" }, { type: "next" }]);
    expect(state.index).toBe(1);
    expect(isStepDone(lesson.steps[1], state)).toBe(false);
  });

  it("moves on by itself as soon as the step's event happens", () => {
    let state = run([{ type: "next" }, { type: "event", event: "dataset.created" }]);
    expect(state).toMatchObject({ index: 1, completed: [] });
    state = run([{ type: "event", event: "sheet.copied" }], state);
    expect(state).toMatchObject({ index: 2, reached: 2, completed: ["copy"] });
    expect(run([{ type: "event", event: "sheet.copied" }], state)).toBe(state);
  });

  it("ignores an event whose step sits behind another step that still waits", () => {
    const state = run([{ type: "next" }, { type: "event", event: "fit.succeeded" }]);
    expect(state).toMatchObject({ index: 1, completed: [] });
  });

  it("completes a later step when only read-only steps sit in between", () => {
    const reading = run([
      { type: "next" },
      { type: "event", event: "sheet.copied" },
      { type: "event", event: "dataset.created" },
    ]);
    expect(reading.index).toBe(3);
    expect(findWaitingStep(lesson, reading, "fit.succeeded")).toBe(4);
    const fitted = run([{ type: "event", event: "fit.succeeded" }], reading);
    expect(fitted).toMatchObject({ index: 4, reached: 4 });
    expect(fitted.completed).toContain("fit");
  });

  it("never completes a step on another screen", () => {
    expect(findWaitingStep(lesson, initialLessonState, "sheet.copied")).toBe(-1);
  });

  it("finishes after the last step instead of moving past it", () => {
    const end = { ...initialLessonState, index: 4, reached: 4, completed: ["fit"] };
    const finished = run([{ type: "next" }], end);
    expect(finished).toMatchObject({ index: 4, finished: true });
    expect(run([{ type: "next" }], finished)).toBe(finished);
  });

  it("goes back only to steps reached on the same screen", () => {
    const state = run([
      { type: "next" },
      { type: "event", event: "sheet.copied" },
      { type: "event", event: "dataset.created" },
    ]);
    expect(state.index).toBe(3);
    expect(canGoTo(lesson, state, 2)).toBe(true);
    expect(canGoTo(lesson, state, 1)).toBe(false);
    expect(canGoTo(lesson, state, 4)).toBe(false);
    expect(canGoTo(lesson, state, 3)).toBe(false);
    expect(canGoTo(lesson, state, -1)).toBe(false);
    expect(run([{ type: "go", index: 1 }], state)).toBe(state);
    expect(run([{ type: "go", index: 2 }], state).index).toBe(2);
  });

  it("freezes while paused until resumed", () => {
    const paused = run([{ type: "next" }, { type: "pause" }]);
    expect(paused.paused).toBe(true);
    expect(canGoTo(lesson, paused, 0)).toBe(false);
    expect(run([{ type: "event", event: "sheet.copied" }, { type: "pause" }], paused)).toBe(paused);
    const resumed = run([{ type: "resume" }], paused);
    expect(resumed.paused).toBe(false);
    expect(run([{ type: "resume" }], resumed)).toBe(resumed);
  });

  it("restarts from the intro", () => {
    expect(run([{ type: "next" }, { type: "pause" }, { type: "restart" }])).toEqual(
      initialLessonState,
    );
  });
});

describe("steps inside a modal dialog", () => {
  it("move on as soon as their event happens", () => {
    const state = runDialog([{ type: "event", event: "details.opened" }]);
    expect(state).toMatchObject({ index: 1, reached: 1, completed: ["open"] });
    const copied = runDialog([{ type: "event", event: "params.copied" }], state);
    expect(copied).toMatchObject({ index: 2, completed: ["open", "copy"] });
  });

  it("go back when the dialog closes before the step is done", () => {
    const opened = runDialog([{ type: "event", event: "details.opened" }]);
    const closed = runDialog([{ type: "event", event: "details.closed" }], opened);
    expect(closed).toMatchObject({ index: 0, completed: [] });
    const copied = runDialog(
      [
        { type: "event", event: "details.opened" },
        { type: "event", event: "params.copied" },
        { type: "event", event: "details.closed" },
      ],
      closed,
    );
    expect(copied.index).toBe(2);
  });

  it("stay on the last step after its event", () => {
    const end = { ...initialLessonState, index: 2, reached: 2 };
    const done = runDialog([{ type: "event", event: "chart.exported" }], end);
    expect(done).toMatchObject({ index: 2, completed: ["export"] });
  });
});

it("replaces the modifier placeholder", () => {
  expect(withModifier("Cole com {mod}+B; {mod}+1", "⌘")).toBe("Cole com ⌘+B; ⌘+1");
});
