/**
 * @module
 * The Aprender tab: guided lessons grouped in tracks.
 */

import { useId } from "react";
import { ArrowRight, Clock } from "lucide-react";
import type { Lesson, UpcomingLesson } from "./lesson";
import { CaliperScene, InstrumentDefs, RulerScene } from "./measure/InstrumentScenes";
import type { MeasureLesson } from "./measure/measure-lesson";

/**
 * Card picture of an instrument lesson, cropped from the instrument drawing itself.
 * @param props.lesson - Lesson whose instrument is drawn.
 */
function MeasureCover({ lesson }: { lesson: MeasureLesson }) {
  const id = `c${useId().replace(/[^\w-]/g, "")}`;
  const ruler = lesson.instrument === "ruler";
  return (
    <svg
      viewBox={ruler ? "20 36 420 130" : "0 40 640 260"}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="h-28 w-full border-b border-border bg-[#f0f3ee]"
    >
      <InstrumentDefs id={id} />
      {ruler ? (
        <RulerScene id={id} length={23.4} />
      ) : (
        <CaliperScene id={id} hundredths={2365} piece />
      )}
    </svg>
  );
}

/** Card frame shared by the lessons of every track. */
const cardClass =
  "group flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-white text-left hover:border-foreground/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-coral";

/**
 * Title of a track with its subtitle.
 * @param props.title - Track name.
 * @param props.subtitle - What the track covers.
 */
function TrackHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-6 flex items-baseline justify-between gap-3">
      <h2 className="text-[11px] font-semibold tracking-[.08em] text-muted-foreground uppercase">
        {title}
      </h2>
      <span className="text-[11px] text-muted-foreground">{subtitle}</span>
    </div>
  );
}

/**
 * Card announced in a track before its lesson exists.
 * @param props.item - Title and topics.
 */
function UpcomingCard({ item }: { item: UpcomingLesson }) {
  return (
    <li
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
  );
}

/**
 * Footer of a card: duration, topics and the arrow.
 * @param props.minutes - Approximate duration.
 * @param props.topics - Short tags.
 */
function CardMeta({ minutes, topics }: { minutes: number; topics: string[] }) {
  return (
    <span className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
        <Clock aria-hidden="true" size={11} /> {minutes} min
      </span>
      {topics.map((topic) => (
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
  );
}

/**
 * Lists the lessons of the Experimentos and Como medir tracks and the ones announced for
 * later.
 * @param props.lessons - Experiment lessons available now.
 * @param props.upcoming - Experiment lessons announced as "Em breve".
 * @param props.onOpen - Opens an experiment lesson.
 * @param props.measureLessons - Instrument lessons available now.
 * @param props.upcomingMeasure - Instruments announced as "Em breve".
 * @param props.onOpenMeasure - Opens an instrument lesson.
 */
export function LearnPage({
  lessons,
  upcoming,
  onOpen,
  measureLessons,
  upcomingMeasure,
  onOpenMeasure,
}: {
  lessons: Lesson[];
  upcoming: UpcomingLesson[];
  onOpen: (lesson: Lesson) => void;
  measureLessons: MeasureLesson[];
  upcomingMeasure: UpcomingLesson[];
  onOpenMeasure: (lesson: MeasureLesson) => void;
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
      <TrackHeading title="Experimentos" subtitle="Da coleta ao relatório" />
      <ul className="mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-0">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <button type="button" onClick={() => onOpen(lesson)} className={cardClass}>
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
                <CardMeta minutes={lesson.minutes} topics={lesson.topics} />
              </span>
            </button>
          </li>
        ))}
        {upcoming.map((item) => (
          <UpcomingCard key={item.title} item={item} />
        ))}
      </ul>
      <TrackHeading title="Como medir" subtitle="Ler o instrumento e escrever a incerteza" />
      <ul className="mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 p-0">
        {measureLessons.map((lesson) => (
          <li key={lesson.id}>
            <button type="button" onClick={() => onOpenMeasure(lesson)} className={cardClass}>
              <MeasureCover lesson={lesson} />
              <span className="flex flex-1 flex-col gap-2 p-3">
                <span className="text-[13px] font-semibold">{lesson.title}</span>
                <span className="text-[12px] leading-5 text-muted-foreground">
                  {lesson.summary}
                </span>
                <CardMeta minutes={lesson.minutes} topics={lesson.topics} />
              </span>
            </button>
          </li>
        ))}
        {upcomingMeasure.map((item) => (
          <UpcomingCard key={item.title} item={item} />
        ))}
      </ul>
    </section>
  );
}
