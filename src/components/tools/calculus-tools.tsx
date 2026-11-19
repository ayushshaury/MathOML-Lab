"use client";

import { useState } from "react";
import { ToolShell, ExampleChips, SolveButton } from "@/components/math/ToolShell";
import { EquationEditor } from "@/components/math/EquationEditor";
import { Plot2D } from "@/components/math/Plot2D";
import { StepsView } from "@/components/math/Steps";
import { ResultArea, useSolver } from "./algebra-tools";
import { differentiateSteps } from "@/lib/math/differentiate";
import { integrateSteps } from "@/lib/math/integrals";
import { limitSteps, continuitySteps } from "@/lib/math/limits";
import { taylorSeries } from "@/lib/math/sequences";
import { useMathLab } from "@/lib/store";
import { EXAMPLES } from "@/lib/tools";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ================================================================== */
/* Derivative calculator                                               */
/* ================================================================== */

export function DerivativeTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const [order, setOrder] = useState(1);
  const { solution, loading, run } = useSolver();
  return (
    <ToolShell
      toolId="derivative"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={() => input.trim() && run(() => differentiateSteps(input, "x", order))}
            label="Function f(x)"
            placeholder="e.g. x^2 * sin(x)"
          />
          <ExampleChips examples={EXAMPLES.derivative} onPick={setInput} />
          <div className="mt-4 grid grid-cols-2 gap-3 items-end">
            <div>
              <Label htmlFor="deriv-order">Order of derivative</Label>
              <Select value={String(order)} onValueChange={(v) => setOrder(Number(v))}>
                <SelectTrigger id="deriv-order" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}. derivative {n === 1 ? "(f′)" : n === 2 ? "(f″)" : `(f${"⁗".repeat(0)}${n})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SolveButton onClick={() => input.trim() && run(() => differentiateSteps(input, "x", order))} loading={loading} label="Differentiate" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Every rule (power, product, quotient, chain, …) is shown and explained as it is applied.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Partial derivatives                                                 */
/* ================================================================== */

export function PartialDerivativeTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const [variable, setVariable] = useState("x");
  const [order, setOrder] = useState(1);
  const { solution, loading, run } = useSolver();
  return (
    <ToolShell
      toolId="partial-derivative"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={() => input.trim() && run(() => differentiateSteps(input, variable, order))}
            label="Function f(x, y, z)"
            placeholder="e.g. x^2*y + sin(x*y)"
          />
          <ExampleChips examples={EXAMPLES["partial-derivative"]} onPick={setInput} />
          <div className="mt-4 grid grid-cols-2 gap-3 items-end">
            <div>
              <Label htmlFor="pd-var">Differentiate with respect to</Label>
              <Select value={variable} onValueChange={setVariable}>
                <SelectTrigger id="pd-var" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["x", "y", "z", "t", "u", "v"].map((v) => (
                    <SelectItem key={v} value={v}>∂/∂{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pd-order">Order</Label>
              <Select value={String(order)} onValueChange={(v) => setOrder(Number(v))}>
                <SelectTrigger id="pd-order" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <SolveButton onClick={() => input.trim() && run(() => differentiateSteps(input, variable, order))} loading={loading} label="Differentiate" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Other variables are treated as constants — exactly what a partial derivative means.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Integral calculator                                                 */
/* ================================================================== */

export function IntegralTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const [definite, setDefinite] = useState(false);
  const [a, setA] = useState("0");
  const [b, setB] = useState("1");
  const { solution, loading, run } = useSolver();
  const solve = () => {
    if (!input.trim()) return;
    if (definite && (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b)))) return;
    run(() => integrateSteps(input, "x", definite, Number(a), Number(b)));
  };

  return (
    <ToolShell
      toolId="integral"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={solve}
            label="Integrand f(x)"
            placeholder="e.g. x^2 + 3*x"
          />
          <ExampleChips examples={EXAMPLES.integral} onPick={setInput} />
          <div className="mt-4 flex items-center gap-3">
            <Switch id="definite" checked={definite} onCheckedChange={setDefinite} />
            <Label htmlFor="definite" className="cursor-pointer">Definite integral (with bounds)</Label>
          </div>
          {definite && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="int-a">Lower bound a</Label>
                <Input id="int-a" value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" className="mt-1.5 font-mono" placeholder="-1" />
              </div>
              <div>
                <Label htmlFor="int-b">Upper bound b</Label>
                <Input id="int-b" value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" className="mt-1.5 font-mono" placeholder="2" />
              </div>
            </div>
          )}
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label="Integrate" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Symbolic antiderivatives with verification by differentiation; definite integrals use the
            Fundamental Theorem of Calculus plus an independent numeric cross-check.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Limit & continuity                                                  */
/* ================================================================== */

export function LimitTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const [point, setPoint] = useState("0");
  const [mode, setMode] = useState<"limit" | "continuity">("limit");
  const { solution, loading, run } = useSolver();
  const solve = () => {
    if (!input.trim()) return;
    const p = point.trim().toLowerCase();
    const target: number | "inf" | "-inf" = p === "inf" || p === "∞" || p === "infinity" ? "inf" : p === "-inf" || p === "-∞" ? "-inf" : Number(p);
    if (mode === "continuity") {
      if (typeof target !== "number") return;
      run(() => continuitySteps(input, "x", target));
    } else {
      run(() => limitSteps(input, "x", target));
    }
  };

  return (
    <ToolShell
      toolId="limit"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={solve}
            label="Function f(x)"
            placeholder="e.g. sin(x)/x"
          />
          <ExampleChips examples={EXAMPLES.limit} onPick={(v) => { setInput(v); setPoint(v.includes("/n") ? "infinity" : "0"); }} />
          <div className="mt-4 grid grid-cols-2 gap-3 items-end">
            <div>
              <Label htmlFor="lim-point">x approaches</Label>
              <Input
                id="lim-point"
                value={point}
                onChange={(e) => setPoint(e.target.value)}
                className="mt-1.5 font-mono"
                placeholder="0, 2, inf, -inf"
                aria-label="Point that x approaches"
              />
            </div>
            <div>
              <Label>Mode</Label>
              <div className="flex rounded-md border p-1 mt-1.5 bg-muted/40">
                <button
                  type="button"
                  className={`flex-1 rounded px-2 py-1.5 text-sm transition-colors ${mode === "limit" ? "bg-background shadow font-medium" : "text-muted-foreground"}`}
                  onClick={() => setMode("limit")}
                >
                  Limit
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded px-2 py-1.5 text-sm transition-colors ${mode === "continuity" ? "bg-background shadow font-medium" : "text-muted-foreground"}`}
                  onClick={() => setMode("continuity")}
                >
                  Continuity
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label={mode === "limit" ? "Compute limit" : "Check continuity"} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Uses direct substitution, a numeric two-sided table, and L&apos;Hôpital&apos;s rule for 0/0 and ∞/∞ forms.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Taylor series                                                       */
/* ================================================================== */

export function TaylorTool() {
  const { pendingInput } = useMathLab();
  const [input, setInput] = useState(pendingInput || "");
  const [at, setAt] = useState("0");
  const [order, setOrder] = useState(5);
  const { solution, loading, run } = useSolver();
  return (
    <ToolShell
      toolId="taylor"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={() => input.trim() && run(() => taylorSeries(input, Number(at) || 0, order))}
            label="Function f(x)"
            placeholder="e.g. sin(x)"
          />
          <ExampleChips examples={EXAMPLES.taylor} onPick={setInput} />
          <div className="mt-4 grid grid-cols-2 gap-3 items-end">
            <div>
              <Label htmlFor="taylor-at">Expand around x =</Label>
              <Input id="taylor-at" value={at} onChange={(e) => setAt(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" placeholder="0" />
            </div>
            <div>
              <Label htmlFor="taylor-order">Degree</Label>
              <Select value={String(order)} onValueChange={(v) => setOrder(Number(v))}>
                <SelectTrigger id="taylor-order" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <SolveButton onClick={() => input.trim() && run(() => taylorSeries(input, Number(at) || 0, order))} loading={loading} label="Expand series" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The graph compares the original function with its Taylor polynomial.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}
