/**
 * @module
 * First screen of a lesson: a full page on how the model is reached, the method, the
 * measurement, its systematic errors and the limits of the model, before any analysis.
 */

import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tex } from "@/features/analysis/fit/Tex";
import { GuidePlot } from "./GuidePlot";
import type { GuideBlock, Lesson } from "./lesson";

/** Label and look of each callout tone. */
const CALLOUTS = {
  hypothesis: { label: "Hipótese", className: "border-foreground/50 bg-[#f0f3ee]" },
  systematic: { label: "Erro sistemático", className: "border-brand-coral bg-[#fdf1ed]" },
  mitigation: { label: "Mitigação", className: "border-foreground bg-white" },
  rule: { label: "Regra", className: "border-border bg-white" },
} as const;

const prose = "text-[14px] leading-7 text-[#3a4448] [&_code]:font-mono [&_code]:text-[12.5px]";

/**
 * Renders one block of the guide.
 * @param props.block - Block from the lesson manifest; its HTML is trusted.
 */
function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "text":
      return <p className={prose} dangerouslySetInnerHTML={{ __html: block.html }} />;
    case "equation":
      return (
        <div className="flex flex-col gap-1">
          <div className="overflow-x-auto rounded-md border border-border bg-white px-4 py-3 text-center text-[18px]">
            <Tex latex={block.latex} />
          </div>
          {block.note && (
            <p
              className="text-[12px] leading-5 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: block.note }}
            />
          )}
        </div>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List
          className={`${prose} flex flex-col gap-1.5 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
        >
          {block.items.map((item) => (
            <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </List>
      );
    }
    case "figure":
      return (
        <figure className="m-0 flex flex-col gap-2">
          <img
            src={block.src}
            alt={block.alt}
            className="w-full rounded-md border border-border bg-white"
          />
          <figcaption className="text-[12px] leading-5 text-muted-foreground">
            {block.caption}
          </figcaption>
        </figure>
      );
    case "callout": {
      const tone = CALLOUTS[block.tone];
      return (
        <aside
          aria-label={tone.label}
          className={`rounded-md border border-l-4 border-y-border border-r-border px-4 py-3 ${tone.className}`}
        >
          <p className="text-[10.5px] font-semibold tracking-[.08em] text-muted-foreground uppercase">
            {tone.label}
          </p>
          <p
            className="mt-0.5 text-[14px] font-semibold text-foreground"
            dangerouslySetInnerHTML={{ __html: block.title }}
          />
          <p
            className="mt-1 text-[13.5px] leading-6 text-[#3a4448] [&_code]:font-mono [&_code]:text-[12.5px]"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </aside>
      );
    }
    case "table":
      return (
        <div className="rounded-md border border-border bg-white">
          <Table className="text-[13px] tabular-nums">
            <TableCaption className="mt-0 border-t border-border py-2 text-[12px]">
              {block.caption}
            </TableCaption>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {block.head.map((cell, i) => (
                  <TableHead
                    key={cell || i}
                    className={`h-9 text-[12px] ${block.align?.[i] === "right" ? "text-right" : ""}`}
                    dangerouslySetInnerHTML={{ __html: cell }}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row) => (
                <TableRow key={row.join()} className="border-border hover:bg-transparent">
                  {row.map((cell, i) => (
                    <TableCell
                      key={i}
                      className={block.align?.[i] === "right" ? "text-right font-mono" : ""}
                      dangerouslySetInnerHTML={{ __html: cell }}
                    />
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case "plot":
      return (
        <figure className="m-0 flex flex-col gap-2">
          <div className="overflow-hidden rounded-md border border-border">
            <GuidePlot
              series={block.series}
              xLabel={block.xLabel}
              yLabel={block.yLabel}
              label={block.caption}
            />
          </div>
          <figcaption className="text-[12px] leading-5 text-muted-foreground">
            {block.caption}
          </figcaption>
        </figure>
      );
  }
}

/**
 * The lesson's guide page, followed by the guided analysis.
 * @param props.lesson - Lesson to present.
 * @param props.onStart - Starts the guided steps.
 * @param props.onExit - Returns to the Aprender tab.
 */
export function LessonGuide({
  lesson,
  onStart,
  onExit,
}: {
  lesson: Lesson;
  onStart: () => void;
  onExit: () => void;
}) {
  const { guide } = lesson;
  const start = (
    <Button type="button" onClick={onStart}>
      Começar a análise <ArrowRight aria-hidden="true" />
    </Button>
  );
  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-white px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onExit}
          aria-label="Voltar a Aprender"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <span className="text-[12px] text-muted-foreground">
          Aprender · Experimentos · {lesson.title}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto scroll-smooth">
        <div className="mx-auto grid max-w-[984px] gap-10 px-8 py-10 lg:grid-cols-[200px_minmax(0,680px)]">
          <nav aria-label="Seções" className="hidden lg:block">
            <ol className="sticky top-6 flex list-none flex-col gap-1 p-0 text-[12px]">
              {guide.sections.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#guide-${section.id}`}
                    className="flex gap-2 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <span className="w-4 tabular-nums">{i + 1}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="flex w-full max-w-[680px] min-w-0 flex-col gap-12 justify-self-center lg:justify-self-start">
            <header className="flex flex-col gap-4 border-b border-border pb-8">
              <p className="text-[11px] font-semibold tracking-[.08em] text-muted-foreground uppercase">
                Experimento guiado
              </p>
              <h1 className="text-[32px] leading-tight font-semibold tracking-[-.045em]">
                {lesson.title}
              </h1>
              <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Clock aria-hidden="true" size={13} /> Cerca de {lesson.minutes} minutos · leitura e{" "}
                {lesson.steps.length - 1} passos guiados
              </p>
              <p className="text-[16px] leading-7 text-[#3a4448]">{guide.lead}</p>
              <div>{start}</div>
            </header>
            {guide.sections.map((section, i) => (
              <section
                key={section.id}
                id={`guide-${section.id}`}
                aria-labelledby={`guide-${section.id}-title`}
                className="flex scroll-mt-6 flex-col gap-5"
              >
                <h2
                  id={`guide-${section.id}-title`}
                  className="flex items-baseline gap-3 text-[21px] font-semibold tracking-[-.03em]"
                >
                  <span className="font-mono text-[13px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                {section.blocks.map((block, j) => (
                  <Block key={j} block={block} />
                ))}
              </section>
            ))}
            <footer className="flex flex-col gap-4 rounded-md border border-border bg-white p-5">
              <p className="text-[13px] leading-6 text-[#3a4448]">
                A partir daqui, a lição destaca onde agir e só avança quando cada passo for feito.{" "}
                <kbd className="font-sans font-semibold text-foreground">Esc</kbd> pausa a qualquer
                momento.
              </p>
              <div>{start}</div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
