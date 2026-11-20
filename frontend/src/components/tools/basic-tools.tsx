"use client";

import { useState } from "react";
import { ToolShell, SolveButton } from "@/components/math/ToolShell";
import { ResultArea, useSolver } from "./algebra-tools";
import { shapeSolution, coordinateGeometry, SHAPES } from "@/lib/math/geometry";
import { analyzeSequence, evaluateTerm, sumSeries, seriesConvergence, type SequenceResult } from "@/lib/math/sequences";
import { evaluateSteps } from "@/lib/math/algebra";
import { ExampleChips } from "@/components/math/ToolShell";
import { EquationEditor } from "@/components/math/EquationEditor";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXAMPLES } from "@/lib/tools";

/* ================================================================== */
/* Geometry calculator                                                 */
/* ================================================================== */

export function GeometryTool() {
  const [shape, setShape] = useState("circle");
  const def = SHAPES.find((s) => s.key === shape)!;
  const [values, setValues] = useState<Record<string, string>>({ r: "5" });
  const [coord, setCoord] = useState({ x1: "0", y1: "0", x2: "3", y2: "4" });
  const [mode, setMode] = useState<"shape" | "coords">("shape");
  const { solution, loading, run } = useSolver();

  const pickShape = (k: string) => {
    setShape(k);
    const d = SHAPES.find((s) => s.key === k)!;
    const init: Record<string, string> = {};
    d.inputs.forEach((inp) => (init[inp.split(" ")[0]] = "2"));
    setValues(init);
  };

  const solve = () => {
    if (mode === "coords") {
      const { x1, y1, x2, y2 } = coord;
      run(() => coordinateGeometry(Number(x1), Number(y1), Number(x2), Number(y2)));
      return;
    }
    const nums: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      if (!Number.isFinite(Number(v))) return;
      nums[k] = Number(v);
    }
    run(() => shapeSolution(shape, nums));
  };

  return (
    <ToolShell
      toolId="geometry"
      inputPanel={
        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "shape" | "coords")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="shape">Shapes & solids</TabsTrigger>
              <TabsTrigger value="coords">Coordinate geometry</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "shape" ? (
            <>
              <div>
                <Label className="mb-2 block">Shape</Label>
                <Select value={shape} onValueChange={pickShape}>
                  <SelectTrigger aria-label="Shape">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHAPES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {def.inputs.map((inp) => {
                  const key = inp.split(" ")[0];
                  return (
                    <div key={key}>
                      <Label htmlFor={`geo-${key}`}>{inp}</Label>
                      <Input
                        id={`geo-${key}`}
                        value={values[key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        className="mt-1.5 font-mono"
                        inputMode="decimal"
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(["x1", "y1", "x2", "y2"] as const).map((k) => (
                <div key={k}>
                  <Label htmlFor={`cg-${k}`}>{k}</Label>
                  <Input
                    id={`cg-${k}`}
                    value={coord[k]}
                    onChange={(e) => setCoord((c) => ({ ...c, [k]: e.target.value }))}
                    className="mt-1.5 font-mono"
                    inputMode="decimal"
                  />
                </div>
              ))}
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
/* Sequences & series                                                  */
/* ================================================================== */

export function SequencesTool() {
  const [mode, setMode] = useState<"detect" | "term" | "sum" | "convergence">("detect");
  const [numbers, setNumbers] = useState("2, 5, 8, 11, 14");
  const [formula, setFormula] = useState("3*n - 1");
  const [nValue, setNValue] = useState("10");
  const [sumExpr, setSumExpr] = useState("k^2");
  const [sumFrom, setSumFrom] = useState("1");
  const [sumTo, setSumTo] = useState("10");
  const [convExpr, setConvExpr] = useState("1/n^2");
  const { solution, loading, run } = useSolver();
  const [seqInfo, setSeqInfo] = useState<SequenceResult | null>(null);

  const solve = () => {
    if (mode === "detect") {
      const nums = numbers.split(/[\s,;]+/).map(Number).filter(Number.isFinite);
      run(() => {
        const r = analyzeSequence(nums);
        setSeqInfo(r);
        return r;
      });
    } else if (mode === "term") {
      run(() => evaluateTerm(formula, Number(nValue) || 1));
    } else if (mode === "sum") {
      run(() => sumSeries(sumExpr, Number(sumFrom) || 1, Number(sumTo) || 10));
    } else {
      run(() => seriesConvergence(convExpr));
    }
  };

  return (
    <ToolShell
      toolId="sequences"
      inputPanel={
        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="detect">Detect pattern</TabsTrigger>
              <TabsTrigger value="term">nth term</TabsTrigger>
              <TabsTrigger value="sum">Series sum</TabsTrigger>
              <TabsTrigger value="convergence">Convergence</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "detect" && (
            <div>
              <Label htmlFor="seq-numbers" className="mb-2 block">Terms of the sequence</Label>
              <Input
                id="seq-numbers"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                className="font-mono"
                placeholder="2, 5, 8, 11, 14"
              />
              <ExampleChips examples={EXAMPLES.sequences} onPick={setNumbers} />
            </div>
          )}
          {mode === "term" && (
            <div className="space-y-3">
              <div>
                <Label className="mb-2 block">Formula for aₙ (in terms of n)</Label>
                <EquationEditor value={formula} onChange={setFormula} onEnter={solve} placeholder="e.g. 3*n - 1" ocr={false} />
              </div>
              <div>
                <Label htmlFor="seq-n" className="mb-2 block">Which term n</Label>
                <Input id="seq-n" value={nValue} onChange={(e) => setNValue(e.target.value)} className="font-mono w-28" inputMode="numeric" />
              </div>
            </div>
          )}
          {mode === "sum" && (
            <div className="space-y-3">
              <div>
                <Label className="mb-2 block">Summand (in terms of k)</Label>
                <EquationEditor value={sumExpr} onChange={setSumExpr} onEnter={solve} placeholder="e.g. k^2" ocr={false} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="sum-from" className="mb-2 block">From k =</Label>
                  <Input id="sum-from" value={sumFrom} onChange={(e) => setSumFrom(e.target.value)} className="font-mono" inputMode="numeric" />
                </div>
                <div>
                  <Label htmlFor="sum-to" className="mb-2 block">To k =</Label>
                  <Input id="sum-to" value={sumTo} onChange={(e) => setSumTo(e.target.value)} className="font-mono" inputMode="numeric" />
                </div>
              </div>
            </div>
          )}
          {mode === "convergence" && (
            <div>
              <Label className="mb-2 block">Series Σ aₙ (in terms of n)</Label>
              <EquationEditor value={convExpr} onChange={setConvExpr} onEnter={solve} placeholder="e.g. 1/n^2" ocr={false} />
            </div>
          )}
          <SolveButton onClick={solve} loading={loading} label="Analyse" />
          {seqInfo?.nthTermTex && mode === "detect" && (
            <div className="rounded-lg bg-emerald-600/10 border border-emerald-600/30 p-3 text-sm">
              Detected: <strong>{seqInfo.title}</strong>
            </div>
          )}
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Scientific calculator                                               */
/* ================================================================== */

export function CalculatorTool() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const { solution, loading, run } = useSolver();

  const solve = () => {
    if (!input.trim()) return;
    run(() => {
      const r = evaluateSteps(input);
      if (!r.error && r.resultText) setHistory((h) => [{ q: input, a: r.resultText! }, ...h].slice(0, 10));
      return r;
    });
  };

  return (
    <ToolShell
      toolId="calculator"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={solve}
            label="Expression"
            placeholder="e.g. sqrt(144) + 3^3"
          />
          <ExampleChips examples={EXAMPLES.calculator} onPick={setInput} />
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label="=" />
          </div>
          {history.length > 0 && (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">History</p>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {history.map((h, i) => (
                  <button
                    key={i}
                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors flex justify-between gap-2 font-mono text-sm"
                    onClick={() => setInput(h.q)}
                  >
                    <span className="text-muted-foreground truncate">{h.q}</span>
                    <span className="font-semibold shrink-0">= {h.a}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}
