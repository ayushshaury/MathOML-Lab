"use client";

import { useState } from "react";
import { ToolShell, ExampleChips, SolveButton } from "@/components/math/ToolShell";
import { EquationEditor } from "@/components/math/EquationEditor";
import { StepsView } from "@/components/math/Steps";
import { Plot2D } from "@/components/math/Plot2D";
import { solveEquation, solveSystem } from "@/lib/math/equations";
import { algebraSteps, type AlgebraOp } from "@/lib/math/algebra";
import { useMathLab } from "@/lib/store";
import { EXAMPLES } from "@/lib/tools";
import type { Solution } from "@/lib/math/core";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Shared runner: shows a spinner while the engine computes. */
function useSolver() {
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(false);
  const run = (solver: () => Solution) => {
    setLoading(true);
    window.setTimeout(() => {
      try {
        setSolution(solver());
      } catch (e) {
        setSolution({ title: "Error", steps: [], error: (e as Error).message });
      } finally {
        setLoading(false);
      }
    }, 30);
  };
  return { solution, loading, run };
}

function ResultArea({ solution, loading, plot }: { solution: Solution | null; loading: boolean; plot?: Solution["plot"] }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <p className="text-sm">Running the maths engine…</p>
      </div>
    );
  }
  if (!solution) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2 text-center">
        <p className="text-sm font-medium">Solution will appear here</p>
        <p className="text-xs max-w-xs">Enter a problem on the left and press Solve. Every step of the method will be explained.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <StepsView solution={solution} />
      {(plot ?? solution.plot) && <Plot2D spec={plot ?? solution.plot} height={320} />}
    </div>
  );
}

/* ================================================================== */
/* Equation solver                                                     */
/* ================================================================== */

export function EquationSolverTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const { solution, loading, run } = useSolver();
  return (
    <ToolShell
      toolId="equation-solver"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={() => input.trim() && run(() => solveEquation(input))}
            label="Equation"
            placeholder="e.g. x^2 - 5*x + 6 = 0"
          />
          <ExampleChips examples={EXAMPLES["equation-solver"]} onPick={setInput} />
          <div className="mt-4">
            <SolveButton onClick={() => input.trim() && run(() => solveEquation(input))} loading={loading} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Works with linear, quadratic, cubic and higher-degree polynomial equations, and falls back to
            numeric root finding for anything else (e.g. sin(x) = x/2).
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Expression tool (simplify / expand / factor)                        */
/* ================================================================== */

export function AlgebraTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const [op, setOp] = useState<AlgebraOp>("simplify");
  const { solution, loading, run } = useSolver();
  return (
    <ToolShell
      toolId="algebra-tool"
      inputPanel={
        <div>
          <Tabs value={op} onValueChange={(v) => setOp(v as AlgebraOp)} className="mb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="simplify">Simplify</TabsTrigger>
              <TabsTrigger value="expand">Expand</TabsTrigger>
              <TabsTrigger value="factor">Factor</TabsTrigger>
            </TabsList>
          </Tabs>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={() => input.trim() && run(() => algebraSteps(input, op))}
            label="Expression"
            placeholder="e.g. (x + 3)*(x - 2)"
          />
          <ExampleChips examples={EXAMPLES["algebra-tool"]} onPick={setInput} />
          <div className="mt-4">
            <SolveButton onClick={() => input.trim() && run(() => algebraSteps(input, op))} loading={loading} label={op === "simplify" ? "Simplify" : op === "expand" ? "Expand" : "Factor"} />
          </div>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* System of equations                                                 */
/* ================================================================== */

export function SystemSolverTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "2*x + 3*y = 8\nx - y = 1");
  const { solution, loading, run } = useSolver();
  const equations = input.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <ToolShell
      toolId="system-solver"
      inputPanel={
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Equations (one per line)</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={"2*x + 3*y = 8\nx - y = 1"}
            aria-label="System of equations"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <ExampleChips examples={EXAMPLES["system-solver"]} onPick={setInput} />
          <div className="mt-4">
            <SolveButton
              onClick={() => equations.length >= 2 && run(() => solveSystem(equations))}
              loading={loading}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Provide as many equations as unknowns (2×2, 3×3, …). The solution shows the augmented matrix,
            every row operation of Gaussian elimination and the back-substitution.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

export { ResultArea, useSolver };
