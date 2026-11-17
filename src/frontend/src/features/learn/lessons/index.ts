/**
 * @module
 * Catalog of the Aprender tab.
 */

import type { Lesson, UpcomingLesson } from "../lesson";
import { gravityLesson } from "./gravity";

/** Lessons available now, in display order. */
export const lessons: Lesson[] = [gravityLesson];

/** Lessons announced as "Em breve" in the Experimentos track. */
export const upcomingLessons: UpcomingLesson[] = [
  { title: "Pêndulo simples", topics: ["período", "linearização"] },
  { title: "Lei de Hooke", topics: ["ajuste linear"] },
];
