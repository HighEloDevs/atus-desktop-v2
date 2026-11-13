/**
 * @module
 * Small scatter preview of pasted points, with their y uncertainties.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { ChartPoint } from "@/components/chart/Chart";
import { HEIGHT, WIDTH, previewMarks } from "./preview-marks";

/**
 * Renders a scatter of the points in the first series colour, so the person sees the shape of the
 * data before fitting. The drawing follows the size of its container, and points pop in one
 * after the other whenever the data changes.
 *
 * @param props - Points to draw and an accessible description.
 * @returns The rendered element.
 */
export function PointsPreview({ points, label }: { points: ChartPoint[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: WIDTH, height: HEIGHT });
  useLayoutEffect(() => {
    const node = container.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const { width, height } = size;
  const marks = previewMarks(points, width, height);
  const key = points.length ? `${points.length}:${points[0].x}:${points.at(-1)!.y}` : "empty";
  return (
    <div ref={container} className="absolute inset-0">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="size-full">
        {[1, 2, 3].map((i) => (
          <g key={i} stroke="#eef1ec">
            <line x1={0} x2={width} y1={(height * i) / 4} y2={(height * i) / 4} />
            <line y1={0} y2={height} x1={(width * i) / 4} x2={(width * i) / 4} />
          </g>
        ))}
        <g key={key}>
          {marks.map((mark, index) => (
            <g
              key={index}
              className="quick-point"
              style={{ animationDelay: `${Math.min(index, 20) * 30}ms` }}
            >
              {mark.low !== undefined && (
                <line
                  x1={mark.cx}
                  x2={mark.cx}
                  y1={mark.low}
                  y2={mark.high}
                  stroke="#20272c"
                  strokeOpacity={0.5}
                  strokeWidth={1.2}
                />
              )}
              <circle
                cx={mark.cx}
                cy={mark.cy}
                r={4.2}
                fill="#f25a3c"
                stroke="#ffffff"
                strokeWidth={1.2}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
