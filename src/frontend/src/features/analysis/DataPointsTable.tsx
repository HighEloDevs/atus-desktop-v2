/**
 * @module
 * Read-only table of a dataset's points, shared by the data dialog and the quick analysis window.
 */

import { cn } from "cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFullPrecision } from "@/lib/format-number";

/** One row of the table; uncertainties are optional. */
export type DataTablePoint = { x: number; y: number; sy?: number; sx?: number };

const numberCell = "text-right font-mono text-[12.5px] tabular-nums";

/**
 * Renders a numeric cell with every digit that preserves the value, or an em dash when absent.
 * The full text is also the tooltip so it can be read and copied from any column width.
 */
function ValueCell({ value }: { value: number | undefined }) {
  if (value === undefined) {
    return <TableCell className={`${numberCell} text-[#a3ada6]`}>—</TableCell>;
  }
  const text = formatFullPrecision(value);
  return (
    <TableCell className={numberCell} title={text}>
      {text}
    </TableCell>
  );
}

type DataPointsTableProps = {
  /** Points in input order. */
  points: DataTablePoint[];
  /** Classes of the scroll container, for example to bound its height. */
  containerClassName?: string;
};

/**
 * Renders the points with a sticky header, a sticky row number and the maximum number of digits.
 * Columns are #, x, y, σy and σx, in that order; absent uncertainties show an em dash.
 *
 * @param props - Points and presentation options.
 * @returns The rendered React element.
 * @example
 * <DataPointsTable points={[{ x: 1, y: 2, sy: 0.1 }]} containerClassName="max-h-64" />
 */
export function DataPointsTable({ points, containerClassName }: DataPointsTableProps) {
  return (
    <Table containerClassName={cn("overflow-auto", containerClassName)} className="min-w-max">
      <TableHeader className="sticky top-0 z-10 bg-[#fafbf8] shadow-[0_1px_0_var(--color-border)] [&_tr]:border-b-0">
        <TableRow className="hover:bg-transparent">
          <TableHead className="sticky left-0 z-20 w-14 bg-[#fafbf8] pl-5 text-[11px] uppercase tracking-[.04em] text-muted-foreground">
            #
          </TableHead>
          {(["x", "y", "σy", "σx"] as const).map((label) => (
            <TableHead
              key={label}
              className="px-4 text-right text-[11px] uppercase tracking-[.04em] text-muted-foreground"
            >
              {/* Uppercase would turn σ into Σ, a different symbol. */}
              {label.startsWith("σ") ? (
                <>
                  <span className="normal-case">σ</span>
                  {label.slice(1)}
                </>
              ) : (
                label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((point, index) => (
          <TableRow key={index} className="group border-[#eef1ec] even:bg-[#fbfbf9]">
            <TableCell className="sticky left-0 bg-white pl-5 text-xs text-muted-foreground group-even:bg-[#fbfbf9] group-hover:bg-[#eff2ed]">
              {index + 1}
            </TableCell>
            <ValueCell value={point.x} />
            <ValueCell value={point.y} />
            <ValueCell value={point.sy} />
            <ValueCell value={point.sx} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
