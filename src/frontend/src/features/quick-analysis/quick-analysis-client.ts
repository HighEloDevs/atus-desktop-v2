/**
 * @module
 * Frontend side of the quick analysis hand-off: the native commands and the project snapshot
 * that the main window creates from a submitted analysis.
 */

import { invoke } from "@tauri-apps/api/core";
import type { ChartPoint } from "@/components/chart/Chart";
import { newSnapshot, type ProjectSnapshot } from "@/features/projects/project-client";

/** Label of the quick analysis window, as created by the native core. */
export const QUICK_WINDOW_LABEL = "quick";
/** Event the main window receives when a quick analysis waits to be taken. */
export const QUICK_REQUESTED_EVENT = "quick-analysis-requested";
/** Event the quick window receives each time it is shown. */
export const QUICK_SHOWN_EVENT = "quick-analysis-shown";
/** Name of the dataset created from a quick analysis. */
export const QUICK_DATASET_NAME = "Dados da análise rápida";

/** Equation and points submitted from the quick window. */
export type QuickAnalysis = { equation: string; points: ChartPoint[] };

/** Native quick analysis commands. Each method rejects with a readable message on failure. */
export const quickAnalysisClient = {
  /** Validates and hands the analysis to the main window, hiding the quick window. */
  submit: (analysis: QuickAnalysis) => invoke<void>("quick_submit", { analysis }),
  /** Hides the quick window without submitting. */
  dismiss: () => invoke<void>("quick_dismiss"),
  /** Removes and returns the analysis waiting for the main window, if any. */
  take: () => invoke<QuickAnalysis | null>("take_quick_analysis"),
};

/**
 * Builds a new project snapshot whose first analysis holds the submitted points as one dataset
 * with the submitted equation. Display and fit options keep the analysis screen defaults.
 *
 * @param analysis - Submitted equation and points.
 * @returns A fresh project snapshot, ready for `projectClient.create`.
 * @example
 * projectClient.create(quickAnalysisSnapshot({ equation: "a*x", points }));
 */
export function quickAnalysisSnapshot({ equation, points }: QuickAnalysis): ProjectSnapshot {
  const snapshot = newSnapshot();
  snapshot.analyses[0].datasets = [
    {
      id: crypto.randomUUID(),
      name: QUICK_DATASET_NAME,
      points: points.map(({ x, y, sx, sy }) => ({ x, y, sx: sx ?? null, sy: sy ?? null })),
      state: { equation: equation.trim() },
    },
  ];
  return snapshot;
}
