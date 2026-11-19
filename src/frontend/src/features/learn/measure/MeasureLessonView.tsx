/**
 * @module
 * Screen of a Como medir lesson: the simulated instrument with its loupe and a side panel
 * with the guided steps, the free exploration (caliper and micrometer) and the practice with
 * correction. What depends on the instrument comes from its {@link InstrumentKit}.
 */

import { useId, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Segmented } from "@/components/chart/PopoverFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { lensRect } from "./geometry";
import { InstrumentDefs } from "./InstrumentScenes";
import { instrumentKit, type InstrumentKit } from "./instrument-kits";
import {
  fillTemplate,
  focusMm,
  templateValues,
  type MeasureHighlight,
  type MeasureLesson,
} from "./measure-lesson";
import type { MeasureCheck } from "./reading";

type Mode = "guide" | "explore" | "practice";

/**
 * Side view of a ruler read from above and from the side.
 */
function ParallaxFigure() {
  return (
    <svg
      viewBox="0 0 280 96"
      className="h-auto w-full max-w-[280px]"
      role="img"
      aria-label="Olho na vertical lê certo; olho inclinado lê a mais"
    >
      <rect x="20" y="62" width="240" height="12" fill="#d3d7da" stroke="#8d9397" />
      <rect x="20" y="40" width="120" height="22" fill="#d4ae55" />
      <line x1="140" y1="8" x2="140" y2="62" stroke="#364cff" strokeWidth="1.6" />
      <circle cx="140" cy="8" r="5" fill="#fff" stroke="#20272c" />
      <circle cx="140" cy="8" r="2" fill="#20272c" />
      <line
        x1="70"
        y1="10"
        x2="152"
        y2="66"
        stroke="#f25a3c"
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <circle cx="70" cy="10" r="5" fill="#fff" stroke="#20272c" />
      <circle cx="70" cy="10" r="2" fill="#20272c" />
      <text x="148" y="22" fontSize="10" fill="#364cff">
        certo
      </text>
      <text x="160" y="90" fontSize="10" fill="#b3321a">
        de lado: lê a mais
      </text>
    </svg>
  );
}

/**
 * Runs an instrument lesson.
 * @param props.lesson - Lesson manifest.
 * @param props.onExit - Returns to the Aprender tab.
 * @param props.random - Uniform source for practice pieces; tests pass a fixed one.
 */
export function MeasureLessonView({
  lesson,
  onExit,
  random = Math.random,
}: {
  lesson: MeasureLesson;
  onExit: () => void;
  random?: () => number;
}) {
  const id = `m${useId().replace(/[^\w-]/g, "")}`;
  const sceneId = `${id}-scene`;
  const kit = instrumentKit(lesson);
  const explorer = kit.explore;
  const [mode, setMode] = useState<Mode>("guide");
  const [stepIndex, setStepIndex] = useState(0);
  const [explore, setExplore] = useState(explorer?.start ?? 0);
  const [piece, setPiece] = useState<number | null>(null);
  const [practiceLens, setPracticeLens] = useState(0);
  const [value, setValue] = useState("");
  const [uncertainty, setUncertainty] = useState("");
  const [check, setCheck] = useState<MeasureCheck | null>(null);
  const [score, setScore] = useState({ hits: 0, tries: 0, answered: false });
  const [drag, setDrag] = useState<{ x: number; start: number } | null>(null);

  const newPiece = (previous: number | null) => {
    setPiece(kit.draw(random, previous ?? undefined));
    setPracticeLens(0);
    setValue("");
    setUncertainty("");
    setCheck(null);
    setScore((s) => ({ ...s, answered: false }));
  };
  const changeMode = (next: Mode) => {
    setMode(next);
    if (next === "practice" && piece === null) newPiece(null);
  };

  const step = lesson.steps[stepIndex];
  const example = lesson.example;
  const exampleUnits = Math.round(example * kit.units);
  const values = templateValues(lesson.instrument, example, lesson.vernier);
  const fill = (text: string) => fillTemplate(text, values);

  // What the stage shows in the current mode, in the kit unit.
  let units: number;
  let highlights: MeasureHighlight[] = [];
  let lensMm: number;
  let showPiece = true;
  if (mode === "guide") {
    units = step.closed ? 0 : exampleUnits;
    showPiece = !step.closed;
    highlights = step.highlight ?? [];
    lensMm = focusMm(lesson.instrument, step.focus, example, lesson.vernier);
  } else if (mode === "explore" && explorer) {
    units = explore;
    showPiece = false;
    highlights = explorer.highlights;
    lensMm = explorer.lensMm(explore);
  } else {
    units = piece ?? exampleUnits;
    lensMm = practiceLens;
  }
  const lens = lensRect(lesson.instrument, lensMm);

  const exploring = mode === "explore" && explorer !== undefined;
  const move = (next: number) => {
    if (!explorer) return;
    const { step: unit, max } = explorer;
    setExplore(Math.max(0, Math.min(max, unit * Math.round(next / unit))));
  };
  const svgX = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const [x0, , width] = kit.viewBox.split(" ").map(Number);
    return box.width ? x0 + ((event.clientX - box.left) * width) / box.width : 0;
  };
  const sliderProps =
    exploring && explorer
      ? {
          tabIndex: 0,
          role: "slider",
          "aria-label": explorer.ariaLabel,
          "aria-valuemin": 0,
          "aria-valuemax": explorer.max / kit.units,
          "aria-valuenow": explore / kit.units,
          "aria-valuetext": explorer.valueText(explore),
          onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
            const sign = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!sign) return;
            event.preventDefault();
            move(explore + sign * (event.shiftKey ? explorer.bigStep : explorer.step));
          },
          onPointerDown: (event: PointerEvent<SVGSVGElement>) => {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setDrag({ x: svgX(event), start: explore });
          },
          onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
            if (drag) move(drag.start + ((svgX(event) - drag.x) / kit.svgPerMm) * kit.units);
          },
          onPointerUp: () => setDrag(null),
          onPointerCancel: () => setDrag(null),
        }
      : { role: "img", "aria-label": kit.label };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (piece === null) return;
    const result = kit.check(value, uncertainty, piece);
    setCheck(result);
    if (!score.answered)
      setScore((s) => ({
        hits: s.hits + (result.correct ? 1 : 0),
        tries: s.tries + 1,
        answered: true,
      }));
  };

  const modes: { value: Mode; label: string }[] = [
    { value: "guide", label: "Guia" },
    ...(explorer ? [{ value: "explore" as const, label: "Explorar" }] : []),
    { value: "practice", label: "Praticar" },
  ];
  const nextMode: Mode = explorer ? "explore" : "practice";

  return (
    <section aria-labelledby="measure-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">
          <ArrowLeft aria-hidden="true" /> Aprender
        </Button>
        <h1
          id="measure-title"
          className="text-[28px] leading-tight font-semibold tracking-[-.045em]"
        >
          {lesson.title}
        </h1>
        <div className="ml-auto w-full max-w-[260px]">
          <Segmented label="Modo da lição" value={mode} options={modes} onChange={changeMode} />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3 rounded-md bg-[#e9ece7] p-3">
          <svg
            data-testid="instrument"
            viewBox={kit.viewBox}
            className={`block h-auto w-full touch-none ${exploring ? "cursor-ew-resize rounded-sm focus-visible:outline-3 focus-visible:outline-brand-coral" : ""}`}
            {...sliderProps}
          >
            <InstrumentDefs id={id} />
            {kit.scene({ id, sceneId, units, piece: showPiece, highlights })}
            <rect
              data-lens=""
              {...lens}
              rx={3}
              fill="none"
              stroke="#20272c"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          </svg>
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="relative aspect-[3/2] overflow-hidden rounded-md border-3 border-foreground bg-white">
              <svg
                data-testid="loupe"
                viewBox={`${lens.x} ${lens.y} ${lens.width} ${lens.height}`}
                className="block size-full"
                aria-hidden="true"
              >
                <use href={`#${sceneId}`} />
              </svg>
              <span className="absolute top-1.5 left-2 rounded-sm bg-foreground px-1.5 text-[10px] font-semibold text-white">
                Lupa
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-[12px] text-muted-foreground">
              {mode === "practice" ? (
                <div className="flex flex-col gap-2.5 rounded-md border border-border bg-white px-3 py-2.5">
                  <span id={`${id}-lens`} className="font-medium text-foreground">
                    Mover a lupa
                  </span>
                  <Slider
                    aria-labelledby={`${id}-lens`}
                    min={0}
                    max={kit.lensMax}
                    step={0.1}
                    value={[practiceLens]}
                    onValueChange={([next]) => setPracticeLens(next)}
                  />
                  <span>{kit.practiceHint}</span>
                </div>
              ) : exploring && explorer ? (
                <>
                  <output
                    aria-live="polite"
                    className="rounded-md border border-border bg-white px-3 py-2 font-mono text-[14px] text-foreground tabular-nums"
                  >
                    {explorer.readout(explore)}
                  </output>
                  <span>{explorer.lensHint}</span>
                </>
              ) : (
                <span>A lupa acompanha cada passo do guia.</span>
              )}
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-white p-4 text-[13px]">
          {mode === "guide" && (
            <>
              <ol className="flex list-none flex-col gap-0.5 p-0">
                {lesson.steps.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={index === stepIndex ? "step" : undefined}
                      onClick={() => setStepIndex(index)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted aria-[current=step]:bg-muted aria-[current=step]:font-semibold aria-[current=step]:text-foreground"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums ${index === stepIndex ? "border-foreground bg-foreground text-white" : index < stepIndex ? "border-muted bg-muted text-foreground" : "border-border"}`}
                      >
                        {index < stepIndex ? "✓" : index + 1}
                      </span>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ol>
              <div
                aria-live="polite"
                className="flex flex-col gap-2.5 border-t border-border pt-3 leading-5"
              >
                <h2 className="text-[14px] font-semibold">{step.label}</h2>
                <p dangerouslySetInnerHTML={{ __html: fill(step.html) }} />
                {step.figure === "parallax" && <ParallaxFigure />}
                {step.rule && (
                  <div className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2">
                    <span className="text-[11px] text-muted-foreground">Cálculo</span>
                    <strong className="font-mono text-[14px]">{fill(step.rule)}</strong>
                  </div>
                )}
                {step.result && (
                  <p className="font-mono text-[16px] font-semibold text-[#364cff]">
                    {fill(step.result)}
                  </p>
                )}
                {step.note && (
                  <p
                    className="text-[12px] text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: fill(step.note) }}
                  />
                )}
                {step.why && (
                  <p
                    className="border-l-2 border-border pl-2 text-[12px] text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: fill(step.why) }}
                  />
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={stepIndex === 0}
                    onClick={() => setStepIndex(stepIndex - 1)}
                  >
                    Voltar
                  </Button>
                  {stepIndex < lesson.steps.length - 1 ? (
                    <Button size="sm" onClick={() => setStepIndex(stepIndex + 1)}>
                      Próximo
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => changeMode(nextMode)}>
                      {nextMode === "explore" ? "Explorar" : "Praticar"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {exploring && explorer && (
            <>
              <h2 className="text-[14px] font-semibold">{explorer.title}</h2>
              <p className="leading-5">{explorer.intro}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => move(explore - explorer.step)}>
                  − {explorer.stepLabel}
                </Button>
                <Button variant="outline" size="sm" onClick={() => move(explore + explorer.step)}>
                  + {explorer.stepLabel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => move(explore - explorer.bigStep)}
                >
                  − {explorer.bigStepLabel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => move(explore + explorer.bigStep)}
                >
                  + {explorer.bigStepLabel}
                </Button>
              </div>
              <p className="border-l-2 border-border pl-2 text-[12px] leading-5 text-muted-foreground">
                {explorer.why}
              </p>
              <Button size="sm" className="self-start" onClick={() => changeMode("practice")}>
                Praticar
              </Button>
            </>
          )}

          {mode === "practice" && (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-semibold">Meça a peça</h2>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {score.hits} de {score.tries} certas
                </span>
              </div>
              <p className="leading-5">
                Leia o comprimento e escreva a medida com a incerteza de leitura. As peças são
                simuladas.
              </p>
              <form onSubmit={submit} noValidate className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
                    Comprimento (mm)
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={kit.placeholder}
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      className="font-mono"
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
                    Incerteza ± (mm)
                    <Input
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={kit.placeholder}
                      value={uncertainty}
                      onChange={(event) => setUncertainty(event.target.value)}
                      className="font-mono"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Conferir
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => newPiece(piece)}>
                    Nova peça
                  </Button>
                </div>
              </form>
              <div aria-live="polite">
                {check && piece !== null && (
                  <Feedback check={check} kit={kit} piece={piece} value={value} />
                )}
              </div>
            </>
          )}

          <details className="border-t border-border pt-3 text-[11px] leading-4 text-muted-foreground">
            <summary className="cursor-pointer">Referências</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
              {lesson.references.map((reference) => (
                <li key={reference}>{reference}</li>
              ))}
            </ul>
          </details>
        </aside>
      </div>
    </section>
  );
}

/**
 * Verdict on a practice answer.
 * @param props.check - Result of the checker.
 * @param props.kit - Instrument of the lesson.
 * @param props.piece - Simulated position, in the kit unit.
 * @param props.value - Value typed by the student.
 */
function Feedback({
  check,
  kit,
  piece,
  value,
}: {
  check: MeasureCheck;
  kit: InstrumentKit;
  piece: number;
  value: string;
}) {
  if (!check.correct)
    return (
      <div className="flex flex-col gap-1 rounded-md border-l-3 border-brand-coral bg-muted px-3 py-2 leading-5">
        <strong className="text-destructive">Ainda não</strong>
        {check.messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    );
  const { title, detail } = kit.success(piece, value);
  return (
    <div className="flex flex-col gap-1 rounded-md bg-[#e2f2e9] px-3 py-2 leading-5 text-success">
      <strong>{title}</strong>
      <p className="text-foreground">{detail}</p>
    </div>
  );
}
