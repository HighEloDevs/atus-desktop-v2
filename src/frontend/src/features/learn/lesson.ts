/**
 * @module
 * Data model of the lessons in the Aprender tab.
 *
 * A lesson is plain data: texts, media, the sample dataset, a ready fit result
 * and the ordered steps. The generic lesson runner reads this manifest, so a new
 * experiment needs a new manifest, not new interface code.
 */

/**
 * Events the app reports to a running lesson; a step waits for one of them.
 *
 * `equation.changed` carries the typed text as detail; the lesson runner turns it into
 * `equation.matched` when the text is the lesson's model, and steps wait for the latter.
 */
export type LessonEvent =
  | "sheet.copied"
  | "dataset.created"
  | "equation.changed"
  | "equation.matched"
  | "fit.succeeded"
  | "details.opened"
  | "details.closed"
  | "params.copied"
  | "chart.exported";

/** Screen a step runs on. */
export type LessonView = "intro" | "sheet" | "analysis";

/**
 * One step of a lesson.
 *
 * `target` is the value of a `data-tour` attribute on a real component; the runner
 * highlights it and blocks the rest of the screen. A step with `waitFor` moves on by itself
 * as soon as the app reports that event; a step without it is read and continued with
 * **Próximo**.
 */
export type LessonStep = {
  /** Stable identifier, used to save progress. */
  id: string;
  view: LessonView;
  /** Short label for the step list. */
  label: string;
  /** `data-tour` value of the element to highlight; omitted on the intro. */
  target?: string;
  title: string;
  /** Instruction text. May contain `{mod}`, replaced by ⌘ or Ctrl. */
  body: string;
  /** Optional line explaining why the step matters. */
  why?: string;
  /** Event that completes the step. */
  waitFor?: LessonEvent;
  /**
   * `data-tour` value of the control that gets the keyboard focus while the step waits, when
   * it is not the first control of the highlight.
   */
  focus?: string;
  /** Event that undoes the previous step, as closing a dialog the step needs open. */
  revertOn?: LessonEvent;
};

/** Fit parameter with its uncertainty, as the fit service reports it. */
export type LessonParameter = { name: string; value: number; uncertainty: number };

/**
 * Ready result of the lesson fit.
 *
 * The lesson does not depend on the scientific engine: its fit service answers with
 * these values. A unit test solves the dataset again and checks them, so they are
 * real numbers and not placeholders.
 */
export type LessonFitResult = {
  /** Model the student must type, written with `x` as the horizontal variable. */
  equation: string;
  /** Free parameters in alphabetical order, the order the fit controls use. */
  parameters: LessonParameter[];
  /** Covariance matrix in the order of `parameters`. */
  covariance: number[][];
  chiSquared: number;
};

/** A fit result quoted by the guide page, with the equation that produced it. */
export type GuideFit = {
  equation: string;
  parameters: LessonParameter[];
};

/** One dataset drawn on a guide plot, optionally with its fitted curve. */
export type GuideSeries = {
  label: string;
  /** `data` is the series under study (cobalt); `muted` is a comparison (graphite). */
  tone: "data" | "muted";
  /** Rows as [x, y, sy]. */
  rows: [number, number, number][];
  fit?: GuideFit;
};

/**
 * Content block of the guide page. Texts are trusted HTML from the manifest; equations are
 * LaTeX; figures are bundled images (animated SVG or GIF).
 */
export type GuideBlock =
  | { kind: "text"; html: string }
  | { kind: "equation"; latex: string; note?: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "figure"; src: string; alt: string; caption: string }
  | {
      kind: "callout";
      /**
       * `hypothesis` states an assumption, `systematic` a systematic error, `mitigation` how to
       * reduce one, and `rule` a convention.
       */
      tone: "hypothesis" | "systematic" | "mitigation" | "rule";
      title: string;
      html: string;
    }
  | {
      kind: "table";
      caption: string;
      head: string[];
      rows: string[][];
      align?: ("left" | "right")[];
    }
  | {
      kind: "plot";
      caption: string;
      xLabel: string;
      yLabel: string;
      series: GuideSeries[];
    };

/** A titled section of the guide page. */
export type GuideSection = { id: string; title: string; blocks: GuideBlock[] };

/** The page that explains the experiment before the guided steps. */
export type LessonGuide = {
  /** Opening paragraph, as trusted HTML. */
  lead: string;
  sections: GuideSection[];
};

/** A lesson of the Aprender tab. */
export type Lesson = {
  id: string;
  /** Lesson format; only `experiment` exists for now. */
  kind: "experiment";
  track: "experiments";
  version: number;
  title: string;
  summary: string;
  /** Approximate duration in minutes. */
  minutes: number;
  /** Short topic tags shown on the card. */
  topics: string[];
  /** Image or GIF shown on the card and on the intro (bundled URL). */
  cover: string;
  /**
   * The page read before the guided steps: how the model is reached, the method, the
   * measurement, its systematic errors and the limits of the model.
   */
  guide: LessonGuide;
  dataset: {
    /** File name shown on the simulated spreadsheet. */
    sheetName: string;
    columns: [string, string, string];
    /** Rows as [x, y, sy]. */
    rows: [number, number, number][];
  };
  fit: LessonFitResult;
  steps: LessonStep[];
};

/** A card announced in a track before its lesson exists. */
export type UpcomingLesson = { title: string; topics: string[] };
