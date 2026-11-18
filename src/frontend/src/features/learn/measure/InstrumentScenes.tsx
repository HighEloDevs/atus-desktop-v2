/**
 * @module
 * Vector drawings of the simulated instruments, generated from the value being measured.
 *
 * Every tick, number and highlight is placed from the same millimetre scale, so a drawing
 * for any length is correct without a photograph per value. Scenes are `<g>` groups meant
 * to sit inside an `<svg>` that also holds {@link InstrumentDefs}; the loupe reuses a scene
 * through `<use>`.
 */

import { CALIPER, caliperX, RULER, rulerX } from "./geometry";
import type { MeasureHighlight } from "./measure-lesson";
import { caliperReading, RULER_MAX_MM, VERNIER_DIVISION_MM, VERNIER_LINES } from "./reading";

/** Analysis colour used for every highlight. */
const COBALT = "#364cff";
/** Colour of engraved ticks and numbers. */
const ENGRAVED = "#1d2226";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/**
 * Gradients and texture of brushed steel and brass.
 * @param props.id - Prefix that keeps the ids unique in the document.
 */
export function InstrumentDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e9ecee" />
        <stop offset=".45" stopColor="#c7ccd0" />
        <stop offset=".55" stopColor="#d9dde0" />
        <stop offset="1" stopColor="#a9afb4" />
      </linearGradient>
      <linearGradient id={`${id}-steel-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9ced2" />
        <stop offset="1" stopColor="#8e959b" />
      </linearGradient>
      <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b8903a" />
        <stop offset=".35" stopColor="#f0d68a" />
        <stop offset=".6" stopColor="#d4ae55" />
        <stop offset="1" stopColor="#8f6c24" />
      </linearGradient>
      <pattern id={`${id}-brush`} width="40" height="3" patternUnits="userSpaceOnUse">
        <line x1="0" y1="1" x2="40" y2="1" stroke="#fff" strokeOpacity=".35" strokeWidth=".5" />
        <line
          x1="10"
          y1="2.4"
          x2="34"
          y2="2.4"
          stroke="#6b7278"
          strokeOpacity=".18"
          strokeWidth=".5"
        />
      </pattern>
    </defs>
  );
}

function Band({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return (
    <rect
      data-highlight=""
      x={x}
      y={y}
      width={width}
      height={height}
      rx={2}
      fill={COBALT}
      fillOpacity={0.18}
      stroke={COBALT}
      strokeWidth={1.2}
    />
  );
}

function Mark({ x, y1, y2, width = 2 }: { x: number; y1: number; y2: number; width?: number }) {
  return (
    <line data-highlight="" x1={x} y1={y1} x2={x} y2={y2} stroke={COBALT} strokeWidth={width} />
  );
}

/**
 * Millimetre ruler with a brass piece resting on the zero.
 * @param props.id - Prefix of {@link InstrumentDefs}.
 * @param props.sceneId - Id of the group, for the loupe.
 * @param props.length - Piece length in millimetres.
 * @param props.highlights - Marks to draw.
 */
export function RulerScene({
  id,
  sceneId,
  length,
  highlights = [],
}: {
  id: string;
  sceneId?: string;
  length: number;
  highlights?: MeasureHighlight[];
}) {
  const { top, scale, x0 } = RULER;
  const width = RULER_MAX_MM * scale + 36;
  const whole = Math.floor(length);
  const ticks = [];
  for (let mm = 0; mm <= RULER_MAX_MM; mm++) {
    const x = rulerX(mm);
    const size = mm % 10 === 0 ? 24 : mm % 5 === 0 ? 16 : 10;
    ticks.push(
      <line
        key={mm}
        x1={x}
        y1={top}
        x2={x}
        y2={top + size}
        stroke={ENGRAVED}
        strokeWidth={mm % 10 === 0 ? 1.3 : 0.9}
      />,
    );
    if (mm % 10 === 0)
      ticks.push(
        <text
          key={`n${mm}`}
          x={x}
          y={top + 40}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={12}
          fill={ENGRAVED}
        >
          {mm / 10}
        </text>,
      );
  }
  return (
    <g id={sceneId} data-instrument="ruler">
      <rect
        x={x0 - 18}
        y={top}
        width={width}
        height={58}
        rx={3}
        fill={`url(#${id}-steel)`}
        stroke="#8d9397"
      />
      <rect x={x0 - 18} y={top} width={width} height={58} rx={3} fill={`url(#${id}-brush)`} />
      {ticks}
      <text x={rulerX(RULER_MAX_MM) - 6} y={top + 52} textAnchor="end" fontSize={8} fill="#4b5359">
        cm · menor divisão 1 mm
      </text>
      <rect
        data-piece=""
        x={x0}
        y={top - 44}
        width={length * scale}
        height={44}
        rx={1.5}
        fill={`url(#${id}-brass)`}
        stroke="#7a5a1c"
        strokeWidth={0.8}
      />
      <rect
        x={x0 + 3}
        y={top - 38}
        width={Math.max(0, length * scale - 6)}
        height={5}
        fill="#fff"
        fillOpacity={0.25}
      />
      {highlights.includes("zero") && <Mark x={rulerX(0)} y1={top - 52} y2={top + 26} />}
      {highlights.includes("division") && (
        <Band x={rulerX(10)} y={top - 2} width={scale} height={14} />
      )}
      {highlights.includes("endInterval") && (
        <Band x={rulerX(whole)} y={top - 2} width={scale} height={14} />
      )}
      {highlights.includes("uncertainty") && (
        <Band x={rulerX(length - 0.5)} y={top - 2} width={scale} height={14} />
      )}
      {highlights.includes("end") && <Mark x={rulerX(length)} y1={top - 52} y2={top + 4} />}
    </g>
  );
}

/**
 * Vernier caliper of 0,05 mm, optionally holding a brass piece between the jaws.
 * @param props.id - Prefix of {@link InstrumentDefs}.
 * @param props.sceneId - Id of the group, for the loupe.
 * @param props.hundredths - Opening in hundredths of millimetre.
 * @param props.piece - Draws the piece between the jaws.
 * @param props.highlights - Marks to draw.
 */
export function CaliperScene({
  id,
  sceneId,
  hundredths,
  piece = false,
  highlights = [],
}: {
  id: string;
  sceneId?: string;
  hundredths: number;
  piece?: boolean;
  highlights?: MeasureHighlight[];
}) {
  const { base, scale, x0, scaleMm } = CALIPER;
  const { mm, coincidentMm, value } = caliperReading(hundredths);
  const xv = caliperX(value);
  const step = VERNIER_DIVISION_MM * scale;
  const main = [];
  for (let m = 0; m <= scaleMm; m++) {
    const x = caliperX(m);
    const size = m % 10 === 0 ? 18 : m % 5 === 0 ? 13 : 9;
    main.push(
      <line
        key={m}
        x1={x}
        y1={base}
        x2={x}
        y2={base - size}
        stroke={ENGRAVED}
        strokeWidth={m % 10 === 0 ? 1.2 : 0.8}
      />,
    );
    if (m % 10 === 0)
      main.push(
        <text
          key={`n${m}`}
          x={x}
          y={base - 23}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={11}
          fill={ENGRAVED}
        >
          {m / 10}
        </text>,
      );
  }
  const vernier = [];
  for (let k = 0; k <= VERNIER_LINES; k++) {
    const x = xv + k * step;
    vernier.push(
      <line
        key={k}
        x1={x}
        y1={base}
        x2={x}
        y2={base + (k % 2 === 0 ? 14 : 9)}
        stroke={ENGRAVED}
        strokeWidth={0.8}
      />,
    );
    if (k % 2 === 0)
      vernier.push(
        <text
          key={`n${k}`}
          x={x}
          y={base + 26}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={8.5}
          fill={ENGRAVED}
        >
          {k / 2}
        </text>,
      );
  }
  const slider = 434;
  return (
    <g id={sceneId} data-instrument="caliper">
      <rect
        x={x0 - 60}
        y={base - 50}
        width={1070}
        height={50}
        fill={`url(#${id}-steel)`}
        stroke="#8d9397"
      />
      <rect x={x0 - 60} y={base - 50} width={1070} height={50} fill={`url(#${id}-brush)`} />
      <path
        d={`M${x0 - 60} ${base} H${x0} V${base + 150} L${x0 - 14} ${base + 178} L${x0 - 60} ${base + 60} Z`}
        fill={`url(#${id}-steel-dark)`}
        stroke="#7d848a"
      />
      {main}
      <text x={caliperX(scaleMm) - 2} y={base - 38} textAnchor="end" fontSize={8} fill="#4b5359">
        cm
      </text>
      {piece && (
        <rect
          data-piece=""
          x={x0}
          y={base + 62}
          width={value * scale}
          height={76}
          fill={`url(#${id}-brass)`}
          stroke="#7a5a1c"
          strokeWidth={0.8}
        />
      )}
      <path
        d={`M${xv} ${base} H${xv + 46} V${base + 60} L${xv + 14} ${base + 178} L${xv} ${base + 150} Z`}
        fill={`url(#${id}-steel-dark)`}
        stroke="#7d848a"
      />
      <rect
        x={xv - 2}
        y={base - 58}
        width={slider}
        height={9}
        rx={2}
        fill={`url(#${id}-steel-dark)`}
        stroke="#7d848a"
      />
      <rect
        x={xv + 330}
        y={base - 70}
        width={34}
        height={13}
        rx={3}
        fill={`url(#${id}-steel-dark)`}
        stroke="#7d848a"
      />
      <rect
        x={xv - 2}
        y={base}
        width={slider}
        height={44}
        fill={`url(#${id}-steel)`}
        stroke="#8d9397"
      />
      <rect x={xv - 2} y={base} width={slider} height={44} fill={`url(#${id}-brush)`} />
      {vernier}
      <text x={xv + 424} y={base + 39} textAnchor="end" fontSize={8} fill="#4b5359">
        0,05 mm
      </text>
      {highlights.includes("vernierZero") && (
        <>
          <Band x={caliperX(mm) - 3} y={base - 16} width={xv - caliperX(mm) + 6} height={16} />
          <Mark x={xv} y1={base - 4} y2={base + 16} />
        </>
      )}
      {highlights.includes("coincident") && (
        <Mark x={caliperX(coincidentMm)} y1={base - 20} y2={base + 18} width={2.4} />
      )}
    </g>
  );
}
