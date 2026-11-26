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
import {
  Plus, Trash2, Eye, EyeOff, Sparkles, Activity, Layers,
  Atom, Brain, Compass, Waves, Shapes, Copy, Check, Info, Flame
} from "lucide-react";
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
            <span className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-zinc-400" /> Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_2D_CURVES.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => loadPreset(p.fns)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Functions List */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-zinc-900">Functions</p>
            {fns.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: PLOT_COLORS[i % PLOT_COLORS.length] }} aria-hidden />
                <Input
                  value={f.expr}
                  onChange={(e) => setFns((fs) => fs.map((x) => (x.id === f.id ? { ...x, expr: e.target.value } : x)))}
                  placeholder="e.g. sin(x)"
                  className="font-mono h-9 text-xs border-zinc-200 bg-zinc-50/70 focus:bg-white rounded-xl shadow-none"
                  aria-label={`Function ${i + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 hover:bg-zinc-100"
                  title={f.visible ? "Hide curve" : "Show curve"}
                  onClick={() => setFns((fs) => fs.map((x) => (x.id === f.id ? { ...x, visible: !x.visible } : x)))}
                >
                  {f.visible ? <Eye className="h-4 w-4 text-zinc-700" /> : <EyeOff className="h-4 w-4 opacity-40" />}
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
          <div className="border-t border-zinc-100 pt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 border border-zinc-200/70 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="show-deriv" className="cursor-pointer font-medium text-xs text-zinc-900">Derivative Overlay</Label>
                <p className="text-[11px] text-zinc-500">Plot d/dx [f(x)] tangent slope curve</p>
              </div>
              <Switch id="show-deriv" checked={showDeriv} onCheckedChange={setShowDeriv} />
            </div>

            <div className="flex items-end gap-2.5">
              <div className="flex-1">
                <Label htmlFor="tangent-x" className="text-xs font-medium text-zinc-700">Tangent line at x =</Label>
                <Input id="tangent-x" value={tangentAt} onChange={(e) => setTangentAt(e.target.value)} className="mt-1 font-mono h-9 text-xs border-zinc-200 bg-zinc-50/70 rounded-xl" inputMode="decimal" placeholder="1" />
              </div>
              <SolveButton onClick={analyze} label="Analyze Curve" className="h-9 gap-1.5" />
            </div>

            {/* Area Integral Calculator */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 space-y-3">
              <p className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-zinc-500" /> Definite Integral (Area Under Curve)
              </p>
              <EquationEditor value={areaFn} onChange={setAreaFn} placeholder="sin(x)" ocr={false} />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="area-from" className="text-xs text-zinc-600">From</Label>
                  <Input id="area-from" value={areaFrom} onChange={(e) => setAreaFrom(e.target.value)} className="mt-1 font-mono h-9 text-xs border-zinc-200 bg-white rounded-xl" inputMode="decimal" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="area-to" className="text-xs text-zinc-600">To</Label>
                  <Input id="area-to" value={areaTo} onChange={(e) => setAreaTo(e.target.value)} className="mt-1 font-mono h-9 text-xs border-zinc-200 bg-white rounded-xl" inputMode="decimal" />
                </div>
                <Button onClick={computeArea} className="h-9 font-medium text-xs bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl">
                  Compute
                </Button>
              </div>
              {areaValue !== null && (
                <div className="rounded-lg bg-white border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-900">
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
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 space-y-1.5 text-xs">
              <p className="font-semibold text-zinc-900 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#0071e3]" />
                Curve Analysis — f(x) = <span className="font-mono text-zinc-700">{analysis.expr}</span>
              </p>
              <p><span className="text-zinc-500">Roots:</span> <span className="font-mono text-zinc-800">{analysis.data.roots.length ? analysis.data.roots.map((r) => r.toFixed(4)).join(", ") : "none"}</span></p>
              <p><span className="text-zinc-500">y-intercept:</span> <span className="font-mono text-zinc-800">{analysis.data.yIntercept !== null ? analysis.data.yIntercept.toFixed(4) : "undefined"}</span></p>
              <p><span className="text-zinc-500">Extrema:</span> <span className="font-mono text-zinc-800">{analysis.data.extrema.length ? analysis.data.extrema.map((e) => `${e.kind}(${e.x.toFixed(3)}, ${e.y.toFixed(3)})`).join(", ") : "none"}</span></p>
              <p><span className="text-zinc-500">Inflection points:</span> <span className="font-mono text-zinc-800">{analysis.data.inflection.length ? analysis.data.inflection.map((x) => x.toFixed(3)).join(", ") : "none"}</span></p>
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

/* 3D surface plotter                                                  */



/* 3D surface plotter & Advanced Topology Studio                      */


export interface Surface3DPreset {
  id: string;
  name: string;
  category: "physics" | "optimization" | "geometry" | "waves" | "topology";
  expr: string;
  badge: string;
  description: string;
  mathInsight: string;
}

export const ADVANCED_3D_SURFACES: Surface3DPreset[] = [
  // Classic & Physical Surfaces
  {
    id: "sombrero",
    name: "Sombrero Potential",
    category: "physics",
    expr: "(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)",
    badge: "Radial Symmetry",
    description: "Radially symmetric surface with a central peak surrounded by a circular trough.",
    mathInsight: "Features a local maximum at the origin and a continuous ring of minima around it."
  },
  {
    id: "quantum-wavepacket",
    name: "Four-Lobe Harmonic Surface",
    category: "physics",
    expr: "4 * x^2 * y^2 * exp(-(x^2 + y^2))",
    badge: "Multivariable",
    description: "Symmetric 2D surface 4x²y² exp(-(x² + y²)) with four balanced peak lobes across quadrants.",
    mathInsight: "Zero nodal lines run directly along x = 0 and y = 0, dividing four symmetric maxima."
  },
  {
    id: "bessel-shockwave",
    name: "Damped Radial Wave",
    category: "physics",
    expr: "cos(2.5*sqrt(x^2 + y^2)) * exp(-0.25*sqrt(x^2 + y^2))",
    badge: "Wave Decay",
    description: "Concentric radial oscillations decaying smoothly outward with exponential damping.",
    mathInsight: "Combines circular frequency modulation with exponential radial attenuation."
  },
  {
    id: "double-well",
    name: "Double-Well Potential",
    category: "physics",
    expr: "(x^2 - 4)^2 / 8 + y^2 / 2",
    badge: "Bistable Surface",
    description: "Bistable potential surface containing two symmetric minima separated by a central ridge.",
    mathInsight: "Two global minima at x = ±2 are separated by a local ridge at x = 0."
  },
  {
    id: "chladni-plate",
    name: "Chladni Standing Wave",
    category: "physics",
    expr: "cos(2*x)*cos(3*y) - cos(3*x)*cos(2*y)",
    badge: "Standing Waves",
    description: "Vibrational standing wave pattern on a square domain showing symmetric nodal curves.",
    mathInsight: "Zero-elevation nodal contours mark curves where opposing cosine modes cancel."
  },

  // Optimization Benchmarks
  {
    id: "rosenbrock",
    name: "Rosenbrock's 'Banana' Valley",
    category: "optimization",
    expr: "log(1 + (1 - x)^2 + 10*(y - x^2)^2) / 3",
    badge: "Optimization",
    description: "Classic non-convex benchmark for gradient descent, Adam, and second-order optimizers.",
    mathInsight: "Locating the curved parabolic valley is fast, while converging along its floor to (1, 1) is slow."
  },
  {
    id: "ackley",
    name: "Ackley Benchmark",
    category: "optimization",
    expr: "-10*exp(-0.2*sqrt(0.5*(x^2 + y^2))) - 0.5*(cos(2*pi*x) + cos(2*pi*y)) + 10",
    badge: "Global Optimization",
    description: "Multimodal test surface containing many local minima surrounding a central global minimum.",
    mathInsight: "Standard benchmark used to evaluate global search and gradient-free optimizers."
  },
  {
    id: "himmelblau",
    name: "Himmelblau's 4-Minima Terrain",
    category: "optimization",
    expr: "log(1 + (x^2 + y - 11)^2 + (x + y^2 - 7)^2) / 2",
    badge: "Multivariate Calculus",
    description: "Multi-basin multimodal surface with four identical global minima where f(x,y) = 0.",
    mathInsight: "Minima located at (3, 2), (-2.805, 3.131), (-3.779, -3.283), and (3.584, -1.848)."
  },
  {
    id: "rastrigin",
    name: "Rastrigin's Frequency Lattice",
    category: "optimization",
    expr: "(x^2 - 10*cos(2*pi*x)) + (y^2 - 10*cos(2*pi*y)) + 20",
    badge: "Metaheuristics",
    description: "Highly multimodal surface created by superimposing cosine waves on a paraboloid.",
    mathInsight: "Features regularly spaced sinusoidal traps with global minimum at (0, 0)."
  },
  {
    id: "beale",
    name: "Beale's Function Valley",
    category: "optimization",
    expr: "log(1 + (1.5 - x + x*y)^2 + (2.25 - x + x*y^2)^2 + (2.625 - x + x*y^3)^2) / 4",
    badge: "Convex Analysis",
    description: "Unconstrained optimization problem with sharp corners and flat outer regions.",
    mathInsight: "Global minimum located at (3, 0.5) where the objective evaluates to 0."
  },

  // Differential Geometry & Minimal Surfaces
  {
    id: "scherk",
    name: "Scherk's Minimal Surface",
    category: "geometry",
    expr: "log(cos(x) / cos(y))",
    badge: "Differential Geometry",
    description: "Historic zero-mean-curvature minimal surface discovered by Heinrich Scherk in 1834.",
    mathInsight: "Satisfies the minimal surface equation (1+z_y^2)z_xx - 2z_x z_y z_xy + (1+z_x^2)z_yy = 0."
  },
  {
    id: "monkey-saddle",
    name: "Monkey Saddle",
    category: "geometry",
    expr: "x^3 - 3*x*y^2",
    badge: "Singularity Theory",
    description: "Degenerate critical point with zero Gaussian curvature at the origin and three descending valleys.",
    mathInsight: "Named by mathematicians because a saddle for a monkey requires three depressions: two for legs, one for the tail."
  },
  {
    id: "hyperbolic-paraboloid",
    name: "Hyperbolic Paraboloid",
    category: "geometry",
    expr: "x^2 - y^2",
    badge: "Ruled Surfaces",
    description: "Classic doubly-ruled saddle quadric having negative Gaussian curvature everywhere.",
    mathInsight: "Can be constructed entirely from straight lines even though its surface is curved."
  },
  {
    id: "enneper",
    name: "Enneper's Surface Projection",
    category: "geometry",
    expr: "x - (x^3)/3 + x*y^2",
    badge: "Minimal Surface",
    description: "Explicit geometric projection of Enneper's self-intersecting minimal immersion with rotational symmetry.",
    mathInsight: "Exhibits rotational symmetry and negative Gaussian curvature."
  },

  // Periodic & Spiral Waves
  {
    id: "vortex-spiral",
    name: "Logarithmic Spiral Wave",
    category: "waves",
    expr: "sin(3*atan2(y, x) + sqrt(x^2 + y^2))",
    badge: "Fluid Mechanics",
    description: "Spiral waveform combining radial distance with azimuthal angle atan2(y, x).",
    mathInsight: "Angular phase shifts proportional to radial distance produce multi-arm spiral contours."
  },
  {
    id: "ripple-wave",
    name: "Sinc Radial Wave",
    category: "waves",
    expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)",
    badge: "Wave Propagation",
    description: "Circular wave radiating outward from the origin with 1/r radial attenuation.",
    mathInsight: "2D radial counterpart of the cardinal sine function sin(r)/r."
  },
  {
    id: "egg-crate",
    name: "Periodic Checkerboard Lattice",
    category: "waves",
    expr: "sin(x)*cos(y)",
    badge: "Periodic Lattice",
    description: "Regular 2D lattice of alternating sinusoidal peaks, saddles, and troughs.",
    mathInsight: "Forms an infinite doubly-periodic surface with saddle points where sin(x) and cos(y) vanish."
  },
  {
    id: "cross-wave",
    name: "Three-Wave Superposition",
    category: "waves",
    expr: "sin(x) + sin(y) + sin(x + y)",
    badge: "Superposition",
    description: "Sum of three non-collinear plane waves producing hexagonal periodicity.",
    mathInsight: "Demonstrates constructive and destructive wave interference with sixfold symmetry."
  },

  // Parametric & Classical Surfaces
  {
    id: "torus-ring",
    name: "Torus Upper Surface",
    category: "topology",
    expr: "sqrt(max(0, 9 - (sqrt(x^2 + y^2) - 4)^2))",
    badge: "Topology",
    description: "Upper surface of a torus with major radius R = 4 and minor radius r = 3.",
    mathInsight: "Genus-1 manifold with Euler characteristic χ = 0."
  },
  {
    id: "gaussian-soliton",
    name: "2D Gaussian Surface",
    category: "topology",
    expr: "4*exp(-(x^2 + y^2)/4)",
    badge: "Probability",
    description: "Bivariate Gaussian bell surface 4·exp(-(x² + y²)/4) centered at the origin.",
    mathInsight: "Symmetric exponential decay used in probability density functions and kernel regression."
  },
  {
    id: "gravity-funnel",
    name: "Inverse-Radius Funnel",
    category: "topology",
    expr: "-3 / (sqrt(x^2 + y^2) + 0.5)",
    badge: "Multivariable",
    description: "Radially symmetric potential well -3 / (sqrt(x² + y²) + 0.5) curving steeply at the center.",
    mathInsight: "Regularized 1/r radial profile with continuous gradient across the origin."
  },
  {
    id: "animated-lattice",
    name: "Parametric Frequency Lattice (a)",
    category: "topology",
    expr: "sin(a*x)*cos(a*y)",
    badge: "Parametric",
    description: "Periodic wave surface where parameter a controls spatial frequency.",
    mathInsight: "Adjust parameter a in the 3D plot controls to observe spatial frequency scaling."
  },
  {
    id: "traveling-wavepacket",
    name: "Localized Traveling Wave (a)",
    category: "topology",
    expr: "cos(a*x - y) * exp(-(x^2 + y^2)/8)",
    badge: "Parametric",
    description: "Cosine wave modulated by a Gaussian envelope and phase parameter a.",
    mathInsight: "Shows how a Gaussian envelope confines higher-frequency oscillations."
  },
  {
    id: "breather-soliton",
    name: "Modulated Cosine Surface (a)",
    category: "topology",
    expr: "2 * a * cos(sqrt(x^2 + y^2)) * exp(-abs(x)/2)",
    badge: "Parametric",
    description: "Damped radial cosine wave scaled vertically by parameter a.",
    mathInsight: "Use parameter a to vary oscillation amplitude and invert phase."
  },
];

export function Graph3DTool() {
  const [expr, setExpr] = useState<string>("(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [copied, setCopied] = useState<boolean>(false);

  const filteredSurfaces = useMemo(() => {
    if (selectedCat === "all") return ADVANCED_3D_SURFACES;
    return ADVANCED_3D_SURFACES.filter((s) => s.category === selectedCat);
  }, [selectedCat]);

  const activeSurface = useMemo(() => {
    return ADVANCED_3D_SURFACES.find((s) => s.expr === expr) ?? null;
  }, [expr]);

  const copyFormula = () => {
    navigator.clipboard.writeText(expr);
    setCopied(true);
    toast.success("Formula copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell
      toolId="graph-3d"
      inputPanel={
        <div className="space-y-5">
          <EquationEditor
            value={expr}
            onChange={setExpr}
            label="Surface Equation: z = f(x, y)"
            placeholder="e.g. (1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)"
          />

          {/* Active Surface Mathematical Insight Card */}
          {activeSurface && (
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 space-y-2 transition-all">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
                  {activeSurface.badge}
                </span>
                <button
                  type="button"
                  onClick={copyFormula}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
                  title="Copy formula"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-zinc-900">{activeSurface.name}</h4>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  {activeSurface.description}
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-200/70 text-xs text-zinc-600 leading-relaxed">
                <strong className="text-zinc-900">Insight: </strong>
                {activeSurface.mathInsight}
              </div>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-zinc-400" /> Surface Library ({ADVANCED_3D_SURFACES.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: "all", label: "All" },
                { id: "physics", label: "Physics" },
                { id: "optimization", label: "Optimization" },
                { id: "geometry", label: "Geometry" },
                { id: "waves", label: "Waves" },
                { id: "topology", label: "Topology" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0",
                    selectedCat === cat.id
                      ? "bg-zinc-900 text-white shadow-2xs"
                      : "border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Surfaces Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredSurfaces.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setExpr(s.expr)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all group",
                    expr === s.expr
                      ? "border-zinc-900 bg-zinc-50 shadow-2xs"
                      : "border-zinc-200/80 bg-white hover:border-zinc-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-zinc-900 truncate">
                      {s.name}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-500 truncate">{s.expr}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Guide */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 text-xs text-zinc-500 space-y-1.5">
            <p className="font-semibold text-zinc-900 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-zinc-500" /> Navigation
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Click and drag on the canvas to rotate freely.</li>
              <li>Scroll or pinch to zoom continuously.</li>
              <li>Use the top-right toolbar to toggle Point Cloud, Contours, Wireframe, or Shaded Surface.</li>
              <li>Include parameter <code className="font-mono text-zinc-800">a</code> (e.g. <code className="font-mono">sin(a*x)*cos(a*y)</code>) to enable animation controls.</li>
            </ul>
          </div>
        </div>
      }
      resultPanel={
        <div className="space-y-3">
          <Plot3D expr={expr} height={520} />
        </div>
      }
    />
  );
}
