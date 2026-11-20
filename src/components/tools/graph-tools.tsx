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

/* ================================================================== */
/* 3D surface plotter & Advanced Topology Studio                      */
/* ================================================================== */

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
  // Physics & Quantum Field Theory
  {
    id: "sombrero",
    name: "Sombrero / Mexican Hat",
    category: "physics",
    expr: "(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)",
    badge: "Quantum Field Theory",
    description: "Higgs field potential demonstrating spontaneous symmetry breaking in quantum electrodynamics.",
    mathInsight: "Features an unstable local maximum at the origin surrounded by a continuous ring of stable vacuum minima."
  },
  {
    id: "quantum-wavepacket",
    name: "Quantum Probability Wavepacket",
    category: "physics",
    expr: "4 * x^2 * y^2 * exp(-(x^2 + y^2))",
    badge: "Quantum Mechanics",
    description: "2D spatial probability density |ψ(x,y)|² of an excited state in a 2D quantum harmonic oscillator.",
    mathInsight: "Exhibits four symmetric probability lobes where particle detection probability reaches its peak."
  },
  {
    id: "bessel-shockwave",
    name: "Bessel Shockwave Interference",
    category: "physics",
    expr: "cos(2.5*sqrt(x^2 + y^2)) * exp(-0.25*sqrt(x^2 + y^2))",
    badge: "Wave Optics",
    description: "Cylindrical wave propagation radiating outward with exponential spatial dissipation.",
    mathInsight: "Models laser diffraction Airy rings and sound wave propagation from a localized point impulse."
  },
  {
    id: "double-well",
    name: "Double-Well Potential",
    category: "physics",
    expr: "(x^2 - 4)^2 / 8 + y^2 / 2",
    badge: "Quantum Tunneling",
    description: "Bistable quantum potential barrier modeling inversion tunneling in ammonia and superconducting flux qubits.",
    mathInsight: "Two symmetric global potential wells at x = ±2 separated by an energy barrier at x = 0."
  },
  {
    id: "chladni-plate",
    name: "Chladni Acoustic Resonance",
    category: "physics",
    expr: "cos(2*x)*cos(3*y) - cos(3*x)*cos(2*y)",
    badge: "Acoustics & Waves",
    description: "Vibrational eigenmode of a clamped square plate demonstrating acoustic standing waves and nodal lines.",
    mathInsight: "Zero-elevation nodal lines represent quiescent regions where sand grains accumulate during acoustic excitation."
  },

  // Machine Learning & Optimization Landscapes
  {
    id: "rosenbrock",
    name: "Rosenbrock's 'Banana' Valley",
    category: "optimization",
    expr: "log(1 + (1 - x)^2 + 10*(y - x^2)^2) / 3",
    badge: "Machine Learning",
    description: "The classic non-convex benchmark for gradient descent, Adam, and second-order optimization algorithms.",
    mathInsight: "Finding the shallow curved parabolic valley is easy, but navigating along the valley floor to the global minimum (1,1) is notoriously slow."
  },
  {
    id: "ackley",
    name: "Ackley's Multimodal Hell",
    category: "optimization",
    expr: "-10*exp(-0.2*sqrt(0.5*(x^2 + y^2))) - 0.5*(cos(2*pi*x) + cos(2*pi*y)) + 10",
    badge: "Global Optimization",
    description: "Formidable optimization benchmark containing hundreds of deceptive local minima surrounding a steep global well.",
    mathInsight: "Standard benchmark used to test evolutionary, genetic, and simulated annealing algorithms."
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

  // Wave Dynamics & Vortices
  {
    id: "vortex-spiral",
    name: "Vortex Spiral Whirlpool",
    category: "waves",
    expr: "sin(3*atan2(y, x) + sqrt(x^2 + y^2))",
    badge: "Fluid Mechanics",
    description: "Rotating logarithmic spiral vortex demonstrating angular momentum and circulation in fluids.",
    mathInsight: "Combines radial distance with azimuthal angle atan2(y, x) to create multi-arm spiral waveforms."
  },
  {
    id: "ripple-wave",
    name: "Ripple Wave Interference",
    category: "waves",
    expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)",
    badge: "Wave Dynamics",
    description: "Circular wave packet radiating from a central focal point with spherical damping.",
    mathInsight: "Analogous to the circular J₀(r) Bessel function of wave diffraction."
  },
  {
    id: "egg-crate",
    name: "Egg-Crate Crystal Potential",
    category: "waves",
    expr: "sin(x)*cos(y)",
    badge: "Solid State Physics",
    description: "Periodic 2D potential lattice simulating electrons moving through a crystal semiconductor.",
    mathInsight: "Forms an infinite regular checkerboard of alternating peaks, saddles, and potential wells."
  },
  {
    id: "cross-wave",
    name: "Cross-Wave Superposition",
    category: "waves",
    expr: "sin(x) + sin(y) + sin(x + y)",
    badge: "Wave Superposition",
    description: "Superposition of three non-collinear harmonic plane waves forming a hexagonal standing pattern.",
    mathInsight: "Demonstrates wave interference symmetry and hexagonal crystal lattice packing."
  },

  // Topological & Dynamic (Parameter a)
  {
    id: "torus-ring",
    name: "Torus Ring Slicing",
    category: "topology",
    expr: "sqrt(max(0, 9 - (sqrt(x^2 + y^2) - 4)^2))",
    badge: "Topology",
    description: "Upper dome of a donut torus with major radius R=4 and tube radius r=3.",
    mathInsight: "Genus-1 topological manifold with Euler characteristic χ = 0."
  },
  {
    id: "gaussian-soliton",
    name: "Gaussian Bell Soliton",
    category: "topology",
    expr: "4*exp(-(x^2 + y^2)/4)",
    badge: "Probability & Solitons",
    description: "Bivariate Gaussian normal distribution and localized solitary wave packet.",
    mathInsight: "Fundamental basis function in radial basis networks, diffusion equations, and quantum ground states."
  },
  {
    id: "gravity-funnel",
    name: "Gravitational Potential Well",
    category: "topology",
    expr: "-3 / (sqrt(x^2 + y^2) + 0.5)",
    badge: "General Relativity",
    description: "Spacetime curvature funnel illustrating gravitational potential Φ = -GM/r around a central mass.",
    mathInsight: "Models geodesic deflection and orbital capture in curved spacetime."
  },
  {
    id: "animated-lattice",
    name: "Dynamic Wavenumber Lattice (a)",
    category: "topology",
    expr: "sin(a*x)*cos(a*y)",
    badge: "Dynamic Parameter",
    description: "Multivariable wave lattice with parameter a controlling spatial frequency.",
    mathInsight: "Use the animated parameter slider in the 3D canvas to watch dynamic wave compression."
  },
  {
    id: "traveling-wavepacket",
    name: "Traveling Wavepacket (a)",
    category: "topology",
    expr: "cos(a*x - y) * exp(-(x^2 + y^2)/8)",
    badge: "Wave Dispersion",
    description: "Phase velocity modulation of a Gaussian localized spatial wavepacket.",
    mathInsight: "Demonstrates how envelope localization confines high-frequency phase oscillations."
  },
  {
    id: "breather-soliton",
    name: "Pulsating Breather Soliton (a)",
    category: "topology",
    expr: "2 * a * cos(sqrt(x^2 + y^2)) * exp(-abs(x)/2)",
    badge: "Nonlinear Dynamics",
    description: "Pulsating localized breather solution to nonlinear Schrödinger and Sine-Gordon wave equations.",
    mathInsight: "Exhibits periodic breathing amplitude without dispersing into the background."
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
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-2 shadow-xs transition-all">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan-400 uppercase">
                  {activeSurface.badge}
                </span>
                <button
                  type="button"
                  onClick={copyFormula}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-cyan-400 transition-colors"
                  title="Copy formula"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground">{activeSurface.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {activeSurface.description}
                </p>
              </div>

              <div className="pt-1.5 border-t border-cyan-500/20 text-[11px] text-cyan-400/90 leading-relaxed font-sans">
                <strong className="text-foreground">Mathematical Insight: </strong>
                {activeSurface.mathInsight}
              </div>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> 3D Surface Library ({ADVANCED_3D_SURFACES.length}):
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: "all", label: "All (24)" },
                { id: "physics", label: "🔬 Quantum & Physics" },
                { id: "optimization", label: "🤖 ML & Optimization" },
                { id: "geometry", label: "📐 Differential Geometry" },
                { id: "waves", label: "🌊 Wave Dynamics" },
                { id: "topology", label: "🎨 Topology & Dynamic" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn(
                    "rounded-xl px-2.5 py-1 text-xs font-semibold transition-all shrink-0 active:scale-95",
                    selectedCat === cat.id
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                      : "border border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
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
                    "rounded-2xl border p-3 text-left transition-all hover:shadow-md group relative overflow-hidden",
                    expr === s.expr
                      ? "border-cyan-500 bg-cyan-500/10 font-semibold shadow-xs"
                      : "border-border/60 bg-card/60 hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold truncate group-hover:text-cyan-400 transition-colors">
                      {s.name}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">
                      {s.badge}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">{s.expr}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Navigation Guide */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Info className="h-4 w-4 text-cyan-400" /> Interactive Studio Guide
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Orbit &amp; Angle:</strong> Click &amp; drag anywhere on the canvas to rotate freely.</li>
              <li><strong>Continuous Zoom:</strong> Scroll wheel or pinch gestures to zoom smoothly.</li>
              <li><strong>Colormaps &amp; Modes:</strong> Use the top-right toolbar to toggle <strong>Hologram Point Matrix</strong>, <strong>Contours</strong>, <strong>Wireframe</strong>, or <strong>Shaded Surface</strong>.</li>
              <li><strong>Dynamic Parameter a:</strong> Select any dynamic preset or include variable <code className="font-mono text-cyan-400">a</code> (e.g. <code className="font-mono">sin(a*x)*cos(a*y)</code>) to activate live animated sliders!</li>
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
