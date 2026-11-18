/**
 * @module
 * Catalog of the Aprender tab.
 */

import type { Lesson, UpcomingLesson } from "../lesson";
import type { MeasureLesson } from "../measure/measure-lesson";
import { caliperLesson } from "./caliper";
import { caliper002Lesson } from "./caliper-002";
import { gravityLesson } from "./gravity";
import { rulerLesson } from "./ruler";

/** Lessons available now, in display order. */
export const lessons: Lesson[] = [gravityLesson];

/** Lessons announced as "Em breve" in the Experimentos track. */
export const upcomingLessons: UpcomingLesson[] = [
  { title: "Pêndulo simples", topics: ["período", "linearização"] },
  { title: "Lei de Hooke", topics: ["ajuste linear"] },
];

/** Lessons of the Como medir track, in display order. */
export const measureLessons: MeasureLesson[] = [rulerLesson, caliperLesson, caliper002Lesson];

/** Instruments announced as "Em breve" in the Como medir track. */
export const upcomingMeasureLessons: UpcomingLesson[] = [
  { title: "Micrômetro", topics: ["0,01 mm", "± 0,005 mm"] },
];
