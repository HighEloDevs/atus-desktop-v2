/**
 * @module
 * The Aprender tab: guided lessons grouped in tracks.
 */

import { ArrowRight, Clock } from "lucide-react";
import type { Lesson, UpcomingLesson } from "./lesson";

/**
 * Lists the lessons of the Experimentos track and the ones announced for later.
 * @param props.lessons - Lessons available now.
 * @param props.upcoming - Lessons announced as "Em breve".
 * @param props.onOpen - Opens a lesson.
 */
export function LearnPage({
  lessons,
  upcoming,
  onOpen,
}: {
  lessons: Lesson[];
  upcoming: UpcomingLesson[];
  onOpen: (lesson: Lesson) => void;
}) {
  return (
    <section aria-labelledby="learn-title">
      <div className="border-b border-border pb-5">
        <h1 id="learn-title" className="text-[28px] leading-tight font-semibold tracking-[-.045em]">
          Aprender
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Lições guiadas, do experimento ao resultado com incerteza.
        </p>
      </div>
      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-[.08em] text-muted-foreground uppercase">
          Experimentos
        </h2>
        <span className="text-[11px] text-muted-foreground">Da coleta ao relatório</span>
      </div>
      <ul className="mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-0">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => onOpen(lesson)}
              className="group flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-white text-left hover:border-foreground/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-coral"
            >
              <img
                src={lesson.cover}
                alt=""
                className="h-28 w-full border-b border-border bg-[#f0f3ee] object-cover"
              />
              <span className="flex flex-1 flex-col gap-2 p-3">
                <span className="text-[13px] font-semibold">{lesson.title}</span>
                <span className="text-[12px] leading-5 text-muted-foreground">
                  {lesson.summary}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    <Clock aria-hidden="true" size={11} /> {lesson.minutes} min
                  </span>
                  {lesson.topics.map((topic) => (
                    <span key={topic} className="rounded-full bg-muted px-2 py-0.5">
                      {topic}
                    </span>
                  ))}
                  <ArrowRight
                    aria-hidden="true"
                    size={14}
                    className="ml-auto text-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </span>
            </button>
          </li>
        ))}
        {upcoming.map((item) => (
          <li
            key={item.title}
            aria-disabled="true"
            className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 text-muted-foreground"
          >
            <span className="text-[13px] font-semibold text-foreground/70">{item.title}</span>
            <span className="mt-auto flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-muted px-2 py-0.5">Em breve</span>
              {item.topics.map((topic) => (
                <span key={topic} className="rounded-full bg-muted px-2 py-0.5">
                  {topic}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
