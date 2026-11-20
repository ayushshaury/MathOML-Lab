"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CellMatrix = string[][];

/** Interactive matrix grid input with add/remove row/column. */
export function MatrixInput({
  label,
  values,
  onChange,
  minSize = 1,
  maxSize = 6,
}: {
  label: string;
  values: CellMatrix;
  onChange: (m: CellMatrix) => void;
  minSize?: number;
  maxSize?: number;
}) {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;

  const setCell = (r: number, c: number, v: string) => {
    const next = values.map((row) => [...row]);
    next[r][c] = v;
    onChange(next);
  };
  const addRow = () => {
    if (rows >= maxSize) return;
    onChange([...values, new Array(cols).fill("")]);
  };
  const addCol = () => {
    if (cols >= maxSize) return;
    onChange(values.map((row) => [...row, ""]));
  };
  const removeRow = () => {
    if (rows <= minSize) return;
    onChange(values.slice(0, -1));
  };
  const removeCol = () => {
    if (cols <= minSize) return;
    onChange(values.map((row) => row.slice(0, -1)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {label} <span className="text-xs">({rows}×{cols})</span>
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={removeRow} disabled={rows <= minSize} title="Remove row">
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={addRow} disabled={rows >= maxSize} title="Add row">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-2" aria-hidden />
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={removeCol} disabled={cols <= minSize} title="Remove column">
            <Minus className="h-3.5 w-3.5 rotate-45" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={addCol} disabled={cols >= maxSize} title="Add column">
            <Plus className="h-3.5 w-3.5 rotate-45" />
          </Button>
        </div>
      </div>
      <div className="flex items-stretch gap-1.5">
        <div className={cn("border-l-2 border-r-2 border-muted-foreground/40 rounded-sm px-0.5 flex flex-col justify-center")} aria-hidden />
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(3.5rem, 1fr))` }}>
          {values.map((row, r) =>
            row.map((cell, c) => (
              <input
                key={`${r}-${c}`}
                value={cell}
                onChange={(e) => setCell(r, c, e.target.value)}
                inputMode="decimal"
                placeholder="0"
                aria-label={`${label} row ${r + 1} column ${c + 1}`}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-center font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            ))
          )}
        </div>
        <div className={cn("border-l-2 border-r-2 border-muted-foreground/40 rounded-sm px-0.5 flex flex-col justify-center")} aria-hidden />
      </div>
    </div>
  );
}

export function cellsToMatrix(cells: CellMatrix): { matrix: number[][] | null; error?: string } {
  const m: number[][] = [];
  for (let r = 0; r < cells.length; r++) {
    const row: number[] = [];
    for (let c = 0; c < cells[r].length; c++) {
      const v = cells[r][c].trim();
      if (v === "" || !Number.isFinite(Number(v))) {
        return { matrix: null, error: `Cell (${r + 1}, ${c + 1}) is not a valid number.` };
      }
      row.push(Number(v));
    }
    m.push(row);
  }
  const width = m[0]?.length ?? 0;
  if (!m.every((r) => r.length === width)) {
    return { matrix: null, error: "The matrix grid is ragged — every row needs the same number of columns." };
  }
  return { matrix: m };
}

export function makeCells(rows: number, cols: number, fill?: number[][]): CellMatrix {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (fill && fill[r] && fill[r][c] !== undefined ? String(fill[r][c]) : ""))
  );
}
