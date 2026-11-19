"use client";

import { useMemo, useState } from "react";
import { ToolShell, ExampleChips, SolveButton } from "@/components/math/ToolShell";
import { EquationEditor } from "@/components/math/EquationEditor";
import { Plot2D, analyzeCurve, PLOT_COLORS, signedArea, tangentLine } from "@/components/math/Plot2D";
import { Plot3D } from "@/components/math/Plot3D";
import { differentiateSteps } from "@/lib/math/differentiate";
import { type PlotSpec } from "@/lib/math/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Eye, EyeOff, Sparkles, Activity, Layers } from "lucide-react";
import { toast } from "sonner";

/* ================================================================== */
/* 2D graphing calculator                                              */
/* ================================================================== */

interface FnEntry {
  id: number;
  expr: string;
  visible: boolean;
}

const PRESET_2D_CURVES = [
  { name: "Sine & Parabola", fns: ["sin(x)", "x^2/8 - 2"] },
  { name: "Damped Harmonic", fns: ["exp(-0.2*x)*sin(3*x)"] },
  { name: "Polynomial Cubic", fns: ["x^3 - 3*x"] },
  { name: "Gaussian Bell", fns: ["exp(-x^2/2)"] },
  { name: "Animated Parameter a", fns: ["sin(a*x)"] },
  { name: "Rational Witch", fns: ["8 / (x^2 + 4)"] },
];

export function Graph2DTool() {
  const [fns, setFns] = useState<FnEntry[]>([
    { id: 1, expr: "sin(x)", visible: true },
    { id: 2, expr: "x^2/8 - 2", visible: true },
  ]);
  const [showDeriv, setShowDeriv] = useState(false);
  const [tangentAt, setTangentAt] = useState("");
  const [areaFrom, setAreaFrom] = useState("0");
  const [areaTo, setAreaTo] = useState("3.14159");
  const [areaFn, setAreaFn] = useState("sin(x)");
  const [analysis, setAnalysis] = useState<{ expr: string; data: ReturnType<typeof analyzeCurve> } | null>(null);
  const [areaValue, setAreaValue] = useState<number | null>(null);

  const spec = useMemo<PlotSpec>(() => {
    const curves: { label: string; expr: string; color: string; dashed?: boolean }[] = fns
      .filter((f) => f.visible && f.expr.trim())
      .map((f, i) => ({ label: `y${i + 1} = ${f.expr}`, expr: f.expr, color: PLOT_COLORS[i % PLOT_COLORS.length] }));

    // derivative overlay of the first visible function
    if (showDeriv && curves.length) {
      try {
        const d = differentiateSteps(curves[0].expr, "x", 1);
        if (d.resultText) curves.push({ label: `d/dx [${curves[0].expr}]`, expr: d.resultText, color: "#dc2626", dashed: true });
      } catch { /* ignore */ }
    }
    const tangent = tangentAt.trim() && Number.isFinite(Number(tangentAt)) && curves.length
      ? { expr: curves[0].expr, at: Number(tangentAt) }
      : undefined;
    const area = areaFn.trim() && Number.isFinite(Number(areaFrom)) && Number.isFinite(Number(areaTo))
      ? { expr: areaFn, from: Number(areaFrom), to: Number(areaTo) }
      : undefined;
    return { curves, tangent, area };
  }, [fns, showDeriv, tangentAt, areaFn, areaFrom, areaTo]);

  const computeArea = () => {
    try {
      const v = signedArea(areaFn, Number(areaFrom), Number(areaTo));
      setAreaValue(v);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const analyze = () => {
    const first = fns.find((f) => f.visible && f.expr.trim());
    if (!first) return;
    const data = analyzeCurve(first.expr);
    if (!data) {
      toast.error("Could not analyse this function");
      return;
    }
    setAnalysis({ expr: first.expr, data });
  };

  const loadPreset = (presetFns: string[]) => {
    setFns(presetFns.map((expr, i) => ({ id: Date.now() + i, expr, visible: true })));
    toast.success("Loaded preset curves");
  };

  return (
    <ToolShell
      toolId="graph-2d"
      inputPanel={
        <div className="space-y-5">
          {/* Preset Chips */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Presets &amp; Curves:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_2D_CURVES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => loadPreset(p.fns)}
                  className="rounded-full border bg-background/80 hover:bg-accent px-2.5 py-1 text-xs font-medium transition-all hover:border-emerald-500/50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Functions List */}
          <div className="space-y-2.5">
            <p className="text-sm font-semibold">Active Functions</p>
            {fns.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs" style={{ background: PLOT_COLORS[i % PLOT_COLORS.length] }} aria-hidden />
                <Input
                  value={f.expr}
                  onChange={(e) => setFns((fs) => fs.map((x) => (x.id === f.id ? { ...x, expr: e.target.value } : x)))}
                  placeholder="e.g. sin(x)"
                  className="font-mono h-10 shadow-none focus-visible:ring-1"
                  aria-label={`Function ${i + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 hover:bg-muted"
                  title={f.visible ? "Hide curve" : "Show curve"}
                  onClick={() => setFns((fs) => fs.map((x) => (x.id === f.id ? { ...x, visible: !x.visible } : x)))}
                >
                  {f.visible ? <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <EyeOff className="h-4 w-4 opacity-40" />}
                </Button>
                {fns.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove function"
                    onClick={() => setFns((fs) => fs.filter((x) => x.id !== f.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {fns.length < 8 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-lg border-dashed"
                onClick={() => setFns((fs) => [...fs, { id: Date.now(), expr: "", visible: true }])}
              >
                <Plus className="h-3.5 w-3.5" /> Add another curve
              </Button>
            )}
          </div>

          {/* Analysis & Derivative Tools */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="show-deriv" className="cursor-pointer font-medium">Derivative Overlay</Label>
                <p className="text-xs text-muted-foreground">Plot d/dx [f(x)] tangent slope curve</p>
              </div>
              <Switch id="show-deriv" checked={showDeriv} onCheckedChange={setShowDeriv} />
            </div>

            <div className="flex items-end gap-2.5">
              <div className="flex-1">
                <Label htmlFor="tangent-x" className="text-xs font-medium">Tangent line at x =</Label>
                <Input id="tangent-x" value={tangentAt} onChange={(e) => setTangentAt(e.target.value)} className="mt-1 font-mono" inputMode="decimal" placeholder="1" />
              </div>
              <SolveButton onClick={analyze} label="Analyse Curve" className="h-10 gap-1.5" />
            </div>

            {/* Area Integral Calculator */}
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Area Under Curve (Definite Integral)
              </p>
              <EquationEditor value={areaFn} onChange={setAreaFn} placeholder="sin(x)" ocr={false} />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="area-from" className="text-xs">From</Label>
                  <Input id="area-from" value={areaFrom} onChange={(e) => setAreaFrom(e.target.value)} className="mt-1 font-mono h-9" inputMode="decimal" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="area-to" className="text-xs">To</Label>
                  <Input id="area-to" value={areaTo} onChange={(e) => setAreaTo(e.target.value)} className="mt-1 font-mono h-9" inputMode="decimal" />
                </div>
                <Button onClick={computeArea} className="h-9 font-semibold">
                  Compute Area
                </Button>
              </div>
              {areaValue !== null && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm font-mono text-emerald-700 dark:text-emerald-300">
                  ∫ from {areaFrom} to {areaTo} = <strong>{areaValue.toFixed(6)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      resultPanel={
        <div className="space-y-4">
          <Plot2D spec={spec} height={460} />
          {analysis && analysis.data && (
            <div className="rounded-xl border bg-card/80 p-4 space-y-2 text-sm shadow-xs">
              <p className="font-semibold flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Curve Analysis — f(x) = <span className="font-mono text-emerald-600 dark:text-emerald-400">{analysis.expr}</span>
              </p>
              <p><span className="text-muted-foreground">Roots (x-intercepts):</span> <span className="font-mono">{analysis.data.roots.length ? analysis.data.roots.map((r) => r.toFixed(4)).join(", ") : "none found"}</span></p>
              <p><span className="text-muted-foreground">y-intercept:</span> <span className="font-mono">{analysis.data.yIntercept !== null ? analysis.data.yIntercept.toFixed(4) : "undefined"}</span></p>
              <p><span className="text-muted-foreground">Extrema:</span> <span className="font-mono">{analysis.data.extrema.length ? analysis.data.extrema.map((e) => `${e.kind}(${e.x.toFixed(3)}, ${e.y.toFixed(3)})`).join(", ") : "none found"}</span></p>
              <p><span className="text-muted-foreground">Inflection points:</span> <span className="font-mono">{analysis.data.inflection.length ? analysis.data.inflection.map((x) => x.toFixed(3)).join(", ") : "none found"}</span></p>
            </div>
          )}
          {tangentAt.trim() && Number.isFinite(Number(tangentAt)) && (spec.curves?.length ?? 0) > 0 && <TangentInfo expr={spec.curves![0].expr} at={Number(tangentAt)} />}
        </div>
      }
    />
  );
}

function TangentInfo({ expr, at }: { expr: string; at: number }) {
  const tl = tangentLine(expr, at);
  if (!tl) return null;
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm space-y-1">
      <p className="font-semibold">Tangent line at x = {at}</p>
      <p className="font-mono">Point: ({tl.point.x.toFixed(4)}, {tl.point.y.toFixed(4)})</p>
      <p className="font-mono">Equation: y = {tl.tex.replace(/\\,|y = /g, "")}</p>
    </div>
  );
}

/* ================================================================== */
/* 3D surface plotter                                                  */
/* ================================================================== */

const PRESET_3D_SURFACES = [
  { name: "Ripple Waves", expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)" },
  { name: "Monkey Saddle", expr: "x^3 - 3*x*y^2" },
  { name: "Egg-Crate", expr: "sin(x)*cos(y)" },
  { name: "Hyperbolic Paraboloid", expr: "x^2 - y^2" },
  { name: "Gaussian Peak", expr: "4*exp(-(x^2 + y^2)/4)" },
  { name: "Animated Surface a", expr: "sin(a*x)*cos(a*y)" },
];

export function Graph3DTool() {
  const [expr, setExpr] = useState("sin(x)*cos(y)");

  return (
    <ToolShell
      toolId="graph-3d"
      inputPanel={
        <div className="space-y-4">
          <EquationEditor
            value={expr}
            onChange={setExpr}
            label="Surface z = f(x, y)"
            placeholder="e.g. sin(x)*cos(y)"
          />

          {/* Preset Surfaces Gallery */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Iconic 3D Surfaces:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_3D_SURFACES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr(p.expr)}
                  className={cn(
                    "rounded-xl border p-2.5 text-left transition-all hover:shadow-xs",
                    expr === p.expr
                      ? "border-emerald-600 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300"
                      : "bg-card/70 hover:bg-accent"
                  )}
                >
                  <p className="text-xs font-medium">{p.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{p.expr}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Interactive 3D Navigation Guide</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><strong>Click &amp; Drag</strong> anywhere on the surface to rotate view angles freely.</li>
              <li><strong>Scroll Wheel / Pinch</strong> to zoom smoothly in and out.</li>
              <li>Use the top-right toolbar to toggle <strong>Auto-Rotation</strong>, choose <strong>Palettes</strong>, or switch to <strong>Wireframe</strong> / <strong>Contours</strong> mode.</li>
              <li>Include variable <code className="font-mono text-emerald-600 dark:text-emerald-400">a</code> (e.g. <code className="font-mono">sin(a*x)*cos(a*y)</code>) to animate the surface dynamically!</li>
            </ul>
          </div>
        </div>
      }
      resultPanel={
        <div className="space-y-3">
          <Plot3D expr={expr} height={500} />
        </div>
      }
    />
  );
}
