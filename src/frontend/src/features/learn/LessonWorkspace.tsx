/**
 * @module
 * Runs a lesson: the intro, the simulated spreadsheet and the real analysis screen with
 * the guided overlay on top.
 */

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Play, X } from "lucide-react";
import { AnalysisPage } from "@/features/analysis/AnalysisPage";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import type { Lesson, LessonEvent } from "./lesson";
import { LessonEventContext } from "./lesson-events";
import { createLessonFitService, isEquivalentModel } from "./lesson-fit-service";
import { initialLessonState, isStepDone, lessonReducer, withModifier } from "./lesson-flow";
import { createLessonTour } from "./lesson-tour";
import { LessonGuide } from "./LessonGuide";
import { MockSpreadsheet } from "./MockSpreadsheet";

/** Class on `<html>` that lifts dialogs, menus and toasts above the lesson overlay. */
export const LESSON_ACTIVE_CLASS = "lesson-active";

/** App dialogs and menus that take Esc before the lesson; the driver.js balloon is excluded. */
const OPEN_LAYERS = '[role="dialog"]:not(.driver-popover), [role="menu"]';

/**
 * Full-screen lesson runner.
 *
 * The analysis runs without a project (nothing is saved) and with the lesson's fit
 * service. App components report what the student did through {@link LessonEventContext}.
 * @param props.lesson - Lesson to run.
 * @param props.onExit - Leaves the lesson and returns to the Aprender tab.
 */
export function LessonWorkspace({ lesson, onExit }: { lesson: Lesson; onExit: () => void }) {
  const [state, dispatch] = useReducer(
    (current: typeof initialLessonState, action: Parameters<typeof lessonReducer>[2]) =>
      lessonReducer(lesson, current, action),
    initialLessonState,
  );
  const step = lesson.steps[state.index];
  const done = isStepDone(step, state);
  const last = state.index === lesson.steps.length - 1;
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const fitService = useMemo(() => createLessonFitService(lesson), [lesson]);
  const report = useCallback(
    (event: LessonEvent, detail?: string) => {
      // The app reports every edit of the equation; the step waits for the lesson's model.
      if (event === "equation.changed") {
        if (isEquivalentModel(detail ?? "", lesson.fit.equation))
          dispatch({ type: "event", event: "equation.matched" });
        return;
      }
      dispatch({ type: "event", event });
    },
    [lesson],
  );

  // The balloon is created once, so its exit button only raises a flag the effect below reads.
  const [leaving, setLeaving] = useState(false);
  const tour = useMemo(
    () =>
      createLessonTour({
        onNext: () => dispatch({ type: "next" }),
        onPause: () => dispatch({ type: "pause" }),
        onExit: () => setLeaving(true),
        onBlocked: () =>
          notify.info("Conclua este passo para continuar", {
            description: "Esc pausa a lição e libera o ATUS.",
            id: "lesson-blocked",
          }),
      }),
    [],
  );

  useEffect(() => {
    if (state.finished || leaving) onExit();
  }, [state.finished, leaving, onExit]);

  useEffect(() => {
    document.documentElement.classList.add(LESSON_ACTIVE_CLASS);
    return () => {
      document.documentElement.classList.remove(LESSON_ACTIVE_CLASS);
      tour.hide();
    };
  }, [tour]);

  useEffect(() => {
    if (state.paused || !step.target) {
      tour.hide();
      return;
    }
    tour.show({
      target: step.target,
      title: withModifier(step.title, modifier),
      body: withModifier(step.body, modifier),
      why: step.why && withModifier(step.why, modifier),
      progress: `${state.index} de ${lesson.steps.length - 1}`,
      done,
      nextLabel: last ? "Concluir" : "Próximo",
      focus: step.focus,
      aside: step.aside,
    });
  }, [tour, step, state.paused, state.index, done, last, modifier, lesson.steps.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || state.index === 0) return;
      // An open dialog or menu closes first; Esc pauses only when nothing else uses it.
      // The lesson balloon itself has role="dialog" and does not count. The listener runs in
      // the capture phase on window, before Radix closes the layer on the document, so the
      // layer is still there to be seen.
      if (document.querySelector(OPEN_LAYERS)) return;
      dispatch({ type: state.paused ? "resume" : "pause" });
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [state.index, state.paused]);

  return (
    <div className="h-screen min-h-0 bg-background">
      {step.view === "intro" ? (
        <LessonGuide lesson={lesson} onStart={() => dispatch({ type: "next" })} onExit={onExit} />
      ) : step.view === "sheet" ? (
        <MockSpreadsheet
          fileName={lesson.dataset.sheetName}
          header={lesson.dataset.columns}
          rows={lesson.dataset.rows}
          modifier={modifier}
          onCopied={() => report("sheet.copied")}
        />
      ) : (
        <LessonEventContext.Provider value={report}>
          <AnalysisPage
            title={`Lição · ${lesson.title}`}
            fitService={fitService}
            finderPath={null}
            onOpenFinderProject={async () => {}}
            onCancelFinderProject={() => {}}
            onBack={onExit}
          />
        </LessonEventContext.Provider>
      )}
      {state.paused && (
        <div
          role="region"
          aria-label="Controles da lição"
          className="lesson-controls fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-white py-1.5 pr-1.5 pl-3 text-[12px] shadow-lg"
        >
          <span className="font-medium">Lição pausada</span>
          <span className="text-muted-foreground">
            Passo {state.index} de {lesson.steps.length - 1}
          </span>
          <Button type="button" size="sm" onClick={() => dispatch({ type: "resume" })}>
            <Play aria-hidden="true" /> Continuar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onExit}>
            <X aria-hidden="true" /> Sair da lição
          </Button>
        </div>
      )}
    </div>
  );
}
