"use client";

import { useState } from "react";
import { ToolShell, SolveButton } from "@/components/math/ToolShell";
import { EquationEditor } from "@/components/math/EquationEditor";
import { ResultArea, useSolver } from "./algebra-tools";
import { solveODE } from "@/lib/math/odes";
import { gradientSteps, divergenceSteps, curlSteps } from "@/lib/math/vectorcalc";
import { solveTrigEquation, verifyIdentity, evalTrig } from "@/lib/math/trig";
import { EXAMPLES } from "@/lib/tools";
import { ExampleChips } from "@/components/math/ToolShell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ================================================================== */
/* ODE solver                                                          */
/* ================================================================== */

export function OdeSolverTool() {
  const [input, setInput] = useState("y' + 2*y = e^(-x)");
  const [hasIC, setHasIC] = useState(true);
  const [x0, setX0] = useState("0");
  const [y0, setY0] = useState("1");
  const [y1, setY1] = useState("0");
  const { solution, loading, run } = useSolver();

  const solve = () => {
    if (!input.trim()) return;
    const ics = hasIC
      ? { x0: Number(x0) || 0, y0: Number(y0), y1: Number(y1) || undefined }
      : {};
    if (hasIC && !Number.isFinite(Number(y0))) return;
    run(() => solveODE(input, ics));
  };

  return (
    <ToolShell
      toolId="ode-solver"
      inputPanel={
        <div>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={solve}
            label="Differential equation (use y' and y'')"
            placeholder="e.g. y'' - 3*y' + 2*y = 0"
          />
          <ExampleChips examples={EXAMPLES["ode-solver"]} onPick={setInput} />
          <div className="mt-4 flex items-center gap-3">
            <Switch id="ode-ic" checked={hasIC} onCheckedChange={setHasIC} />
            <Label htmlFor="ode-ic" className="cursor-pointer">Initial conditions (IVP)</Label>
          </div>
          {hasIC && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ode-x0">x₀</Label>
                <Input id="ode-x0" value={x0} onChange={(e) => setX0(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="ode-y0">y(x₀)</Label>
                <Input id="ode-y0" value={y0} onChange={(e) => setY0(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="ode-y1">y′(x₀)</Label>
                <Input id="ode-y1" value={y1} onChange={(e) => setY1(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" placeholder="2nd order" />
              </div>
            </div>
          )}
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label="Solve ODE" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Methods: direct integration · separable variables · integrating factor · characteristic
            equation with undetermined coefficients · numeric RK4 with direction field.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Vector calculus (gradient / divergence / curl)                      */
/* ================================================================== */

export function VectorCalculusTool() {
  const [mode, setMode] = useState<"gradient" | "divergence" | "curl">("gradient");
  const [scalar, setScalar] = useState("x^2*y + y^2*z");
  const [fx, setFx] = useState("x*y");
  const [fy, setFy] = useState("y*z");
  const [fz, setFz] = useState("x*z");
  const { solution, loading, run } = useSolver();

  const solve = () => {
    if (mode === "gradient") run(() => gradientSteps(scalar, ["x", "y", "z"]));
    else if (mode === "divergence") run(() => divergenceSteps([fx, fy, fz], ["x", "y", "z"]));
    else run(() => curlSteps([fx, fy, fz], ["x", "y", "z"]));
  };

  return (
    <ToolShell
      toolId="vector-calculus"
      inputPanel={
        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="gradient">∇f gradient</TabsTrigger>
              <TabsTrigger value="divergence">∇·F divergence</TabsTrigger>
              <TabsTrigger value="curl">∇×F curl</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "gradient" ? (
            <div>
              <EquationEditor
                value={scalar}
                onChange={setScalar}
                onEnter={solve}
                label="Scalar field f(x, y, z)"
                placeholder="e.g. x^2*y + y^2*z"
              />
              <ExampleChips examples={EXAMPLES["vector-calculus"]} onPick={setScalar} />
            </div>
          ) : (
            <div className="space-y-3">
              <EquationEditor value={fx} onChange={setFx} onEnter={solve} label="F₁(x, y, z) — i component" placeholder="e.g. x*y" />
              <EquationEditor value={fy} onChange={setFy} onEnter={solve} label="F₂(x, y, z) — j component" placeholder="e.g. y*z" />
              <EquationEditor value={fz} onChange={setFz} onEnter={solve} label="F₃(x, y, z) — k component" placeholder="e.g. x*z" />
            </div>
          )}
          <SolveButton onClick={solve} loading={loading} label="Compute" />
          <p className="text-xs text-muted-foreground">
            Gradient works on a scalar field; divergence and curl need a 3-component vector field.
          </p>
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Trigonometry toolkit                                                */
/* ================================================================== */

export function TrigSolverTool() {
  const [mode, setMode] = useState<"solve" | "identity" | "eval">("solve");
  const [input, setInput] = useState("sin(x) = 0.5");
  const [angle, setAngle] = useState("30");
  const [degrees, setDegrees] = useState(true);
  const { solution, loading, run } = useSolver();

  const solve = () => {
    if (!input.trim()) return;
    if (mode === "solve") run(() => solveTrigEquation(input, degrees));
    else if (mode === "identity") run(() => verifyIdentity(input));
    else run(() => evalTrig(input, Number(angle) || 0, degrees));
  };

  return (
    <ToolShell
      toolId="trig-solver"
      inputPanel={
        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="solve">Solve equation</TabsTrigger>
              <TabsTrigger value="identity">Verify identity</TabsTrigger>
              <TabsTrigger value="eval">Evaluate</TabsTrigger>
            </TabsList>
          </Tabs>
          <EquationEditor
            value={input}
            onChange={setInput}
            onEnter={solve}
            label={
              mode === "solve" ? "Trigonometric equation"
              : mode === "identity" ? "Identity to verify (with = sign)"
              : "Expression in terms of x"
            }
            placeholder={mode === "solve" ? "e.g. 2*sin(x) - 1 = 0" : mode === "identity" ? "e.g. sin(x)^2 + cos(x)^2 = 1" : "e.g. sin(x)*cos(x)"}
          />
          <ExampleChips examples={EXAMPLES["trig-solver"]} onPick={setInput} />
          <div className="flex items-center gap-3">
            <Switch id="trig-deg" checked={degrees} onCheckedChange={setDegrees} />
            <Label htmlFor="trig-deg" className="cursor-pointer">Degrees (otherwise radians)</Label>
          </div>
          {mode === "eval" && (
            <div>
              <Label htmlFor="trig-angle">Angle {degrees ? "(degrees)" : "(radians)"}</Label>
              <Input id="trig-angle" value={angle} onChange={(e) => setAngle(e.target.value)} className="mt-1.5 font-mono w-28" inputMode="decimal" />
            </div>
          )}
          <SolveButton onClick={solve} loading={loading} label={mode === "solve" ? "Solve" : mode === "identity" ? "Verify" : "Evaluate"} />
        </div>
      }
      resultPanel={<ResultArea solution={solution} loading={loading} />}
    />
  );
}
