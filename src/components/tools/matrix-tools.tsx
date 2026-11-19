"use client";

import { useState, useEffect } from "react";
import { ToolShell, ExampleChips, SolveButton } from "@/components/math/ToolShell";
import { StepsView } from "@/components/math/Steps";
import { ResultArea, useSolver } from "./algebra-tools";
import { MatrixInput, cellsToMatrix, makeCells, type CellMatrix } from "@/components/math/MatrixInput";
import { matrixOpSteps, determinantSteps, inverseSteps, eigenSteps, type Matrix } from "@/lib/math/matrices";
import { useMathLab } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ================================================================== */
/* Matrix calculator (all operations)                                  */
/* ================================================================== */

export function MatrixCalculatorTool() {
  const [a, setA] = useState<CellMatrix>(makeCells(2, 2, [[1, 2], [3, 4]]));
  const [b, setB] = useState<CellMatrix>(makeCells(2, 2, [[5, 6], [7, 8]]));
  const [op, setOp] = useState("+");
  const [scalar, setScalar] = useState("2");
  const { solution, loading, run } = useSolver();

  const needsB = ["+", "-", "*"].includes(op);
  const needsScalar = ["scalar", "^"].includes(op);

  const solve = () => {
    const { matrix: A, error } = cellsToMatrix(a);
    if (error || !A) return;
    if (needsB) {
      const { matrix: B, error: e2 } = cellsToMatrix(b);
      if (e2 || !B) return;
      run(() => matrixOpSteps(A, B, op, 1));
    } else if (needsScalar) {
      const s = Number(scalar);
      if (!Number.isFinite(s)) return;
      run(() => matrixOpSteps(A, null, op, s));
    } else {
      run(() => matrixOpSteps(A, null, op, 1));
    }
  };

  return (
    <ToolShell
      toolId="matrix-calculator"
      inputPanel={
        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Operation</Label>
            <Select value={op} onValueChange={setOp}>
              <SelectTrigger aria-label="Matrix operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="+">A + B (addition)</SelectItem>
                <SelectItem value="-">A − B (subtraction)</SelectItem>
                <SelectItem value="*">A × B (multiplication)</SelectItem>
                <SelectItem value="scalar">k · A (scalar multiple)</SelectItem>
                <SelectItem value="transpose">Aᵀ (transpose)</SelectItem>
                <SelectItem value="^">Aⁿ (matrix power)</SelectItem>
                <SelectItem value="rank">rank(A)</SelectItem>
                <SelectItem value="trace">tr(A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MatrixInput label="Matrix A" values={a} onChange={setA} />
          {needsB && <MatrixInput label="Matrix B" values={b} onChange={setB} />}
          {needsScalar && (
            <div>
              <Label htmlFor="mat-scalar">{op === "scalar" ? "Scalar k" : "Power n"}</Label>
              <Input id="mat-scalar" value={scalar} onChange={(e) => setScalar(e.target.value)} className="mt-1.5 font-mono w-24" inputMode="decimal" />
            </div>
          )}
          <SolveButton onClick={solve} loading={loading} label="Calculate" />
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Determinant & inverse                                               */
/* ================================================================== */

export function DetInverseTool() {
  const [cells, setCells] = useState<CellMatrix>(makeCells(3, 3, [[4, 3, 2], [1, 5, 7], [2, 8, 6]]));
  const [mode, setMode] = useState<"det" | "inv">("det");
  const { solution, loading, run } = useSolver();

  const solve = () => {
    const { matrix, error } = cellsToMatrix(cells);
    if (error || !matrix) return;
    run(() => (mode === "det" ? determinantSteps(matrix) : inverseSteps(matrix)));
  };

  return (
    <ToolShell
      toolId="determinant"
      inputPanel={
        <div className="space-y-5">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "det" | "inv")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="det">Determinant</TabsTrigger>
              <TabsTrigger value="inv">Inverse</TabsTrigger>
            </TabsList>
          </Tabs>
          <MatrixInput label="Matrix" values={cells} onChange={setCells} />
          <SolveButton onClick={solve} loading={loading} label={mode === "det" ? "Compute determinant" : "Compute inverse"} />
          <p className="text-xs text-muted-foreground">
            {mode === "det"
              ? "Cofactor (Laplace) expansion with every minor shown — the 2×2 case uses the Sarrus rule."
              : "Gauss–Jordan elimination on the augmented matrix [A | I] with every row operation shown."}
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Eigenvalues & eigenvectors                                          */
/* ================================================================== */

export function EigenTool() {
  const [cells, setCells] = useState<CellMatrix>(makeCells(2, 2, [[2, 1], [1, 2]]));
  const { solution, loading, run } = useSolver();

  const solve = () => {
    const { matrix, error } = cellsToMatrix(cells);
    if (error || !matrix) return;
    run(() => eigenSteps(matrix as Matrix));
  };

  return (
    <ToolShell
      toolId="eigen"
      inputPanel={
        <div className="space-y-5">
          <MatrixInput label="Square matrix" values={cells} onChange={setCells} />
          <SolveButton onClick={solve} loading={loading} label="Find eigenvalues" />
          <p className="text-xs text-muted-foreground">
            Builds the characteristic polynomial det(A − λI), solves it, then finds an eigenvector for
            each eigenvalue via the nullspace of (A − λI).
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}
