/**
 * @module
 * Square matrix table used for the covariance and correlation of fitted parameters.
 */

import { heatColor, parameterToLatex } from "./result-format";
import { Tex } from "./Tex";

/**
 * Renders a labelled square matrix, optionally coloured as a heat map.
 * @param props - Parameter names (rows and columns), matrix values, a cell formatter and
 * whether to colour the cells by their value.
 * @returns A horizontally scrollable table with sticky row headers.
 */
export function MatrixTable({
  names,
  values,
  format,
  heat = false,
  label,
}: {
  names: string[];
  values: number[][];
  format: (value: number) => string;
  heat?: boolean;
  label: string;
}) {
  const dense = names.length > 4;
  const cell = dense ? "px-2 py-1.5 text-[11px] min-w-[54px]" : "px-3 py-2.5 text-xs min-w-[64px]";
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="border-collapse font-mono tabular-nums">
        <thead>
          <tr>
            <th className={`${cell} bg-muted`} />
            {names.map((name) => (
              <th key={name} scope="col" className={`${cell} bg-muted font-normal`}>
                <Tex latex={parameterToLatex(name)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, i) => (
            <tr key={names[i]}>
              <th scope="row" className={`${cell} sticky left-0 z-[1] bg-muted font-normal`}>
                <Tex latex={parameterToLatex(names[i])} />
              </th>
              {row.map((value, j) => (
                <td
                  key={names[j]}
                  className={`${cell} border border-white text-center`}
                  style={heat ? { backgroundColor: heatColor(value) } : undefined}
                >
                  {format(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
