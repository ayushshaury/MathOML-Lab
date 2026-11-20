"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Sigma, Search, Sun, Moon, Home, ArrowRight, Sparkles,
  Equal, Shuffle, Layers, TrendingUp, SquareStack, MoveRight, GitBranch, Infinity as InfinityIcon,
  ListOrdered, Grid3x3, SquareDashed, Waves, Compass, Triangle, Shapes, BarChart3, Dice5,
  LineChart, Mountain, Calculator, ScanLine, FlaskRound, BookOpen, ExternalLink, Play, Github,
  Terminal, Zap, CheckCircle2, Cpu, Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useMathLab } from "@/lib/store";
import { CATEGORIES, TOOLS, searchTools, toolsByCategory, type Category } from "@/lib/tools";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Plot2D } from "@/components/math/Plot2D";
import { Plot3D } from "@/components/math/Plot3D";
import { differentiateSteps } from "@/lib/math/differentiate";
import { integrateSteps } from "@/lib/math/integrals";
import { solveEquation } from "@/lib/math/equations";
import { math, preprocess, fmt } from "@/lib/math/core";
import { StepsView } from "@/components/math/Steps";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Icon Mapping                                                        */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sigma, Equal, Shuffle, Layers, TrendingUp, SquareStack, MoveRight, GitBranch,
  Infinity: InfinityIcon, ListOrdered, Grid3x3, SquareDashed, Waves, Compass,
  Triangle, Shapes, BarChart3, Dice5, LineChart, Mountain, Calculator, ScanLine, Brain,
};

function CatIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Sigma;
  return <Cmp className={className} />;
}

/* Category Accent Styles */
const CAT_STYLES: Record<string, { bg: string; text: string; border: string; glow: string; gradient: string }> = {
  emerald: { bg: "bg-emerald-500", text: "text-emerald-500 dark:text-emerald-400", border: "hover:border-emerald-500/50", glow: "glow-emerald", gradient: "from-emerald-500/20 via-transparent to-transparent" },
  amber: { bg: "bg-amber-500", text: "text-amber-500 dark:text-amber-400", border: "hover:border-amber-500/50", glow: "glow-amber", gradient: "from-amber-500/20 via-transparent to-transparent" },
  rose: { bg: "bg-rose-500", text: "text-rose-500 dark:text-rose-400", border: "hover:border-rose-500/50", glow: "glow-rose", gradient: "from-rose-500/20 via-transparent to-transparent" },
  cyan: { bg: "bg-cyan-500", text: "text-cyan-500 dark:text-cyan-400", border: "hover:border-cyan-500/50", glow: "glow-cyan", gradient: "from-cyan-500/20 via-transparent to-transparent" },
  violet: { bg: "bg-violet-500", text: "text-violet-500 dark:text-violet-400", border: "hover:border-violet-500/50", glow: "glow-violet", gradient: "from-violet-500/20 via-transparent to-transparent" },
  orange: { bg: "bg-orange-500", text: "text-orange-500 dark:text-orange-400", border: "hover:border-orange-500/50", glow: "glow-orange", gradient: "from-orange-500/20 via-transparent to-transparent" },
  lime: { bg: "bg-lime-500", text: "text-lime-500 dark:text-lime-400", border: "hover:border-lime-500/50", glow: "glow-lime", gradient: "from-lime-500/20 via-transparent to-transparent" },
  sky: { bg: "bg-sky-500", text: "text-sky-500 dark:text-sky-400", border: "hover:border-sky-500/50", glow: "glow-sky", gradient: "from-sky-500/20 via-transparent to-transparent" },
  teal: { bg: "bg-teal-500", text: "text-teal-500 dark:text-teal-400", border: "hover:border-teal-500/50", glow: "glow-teal", gradient: "from-teal-500/20 via-transparent to-transparent" },
  indigo: { bg: "bg-indigo-500", text: "text-indigo-500 dark:text-indigo-400", border: "hover:border-indigo-500/50", glow: "glow-indigo", gradient: "from-indigo-500/20 via-transparent to-transparent" },
  slate: { bg: "bg-slate-500", text: "text-slate-500 dark:text-slate-400", border: "hover:border-slate-500/50", glow: "glow-slate", gradient: "from-slate-500/20 via-transparent to-transparent" },
};

/* ------------------------------------------------------------------ */
/* Lazy Tool Loading                                                   */
/* ------------------------------------------------------------------ */

const loading = () => (
  <div className="flex flex-col items-center justify-center py-28 gap-4">
    <div className="relative">
      <div className="h-12 w-12 rounded-full border-2 border-emerald-500/20 animate-ping" />
      <span className="absolute inset-0 m-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
    <span className="text-xs font-mono text-muted-foreground animate-pulse">Launching High-Precision CAS Engine…</span>
  </div>
);

const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  "equation-solver": dynamic(() => import("@/components/tools/algebra-tools").then((m) => m.EquationSolverTool), { loading }),
  "algebra-tool": dynamic(() => import("@/components/tools/algebra-tools").then((m) => m.AlgebraTool), { loading }),
  "system-solver": dynamic(() => import("@/components/tools/algebra-tools").then((m) => m.SystemSolverTool), { loading }),
  derivative: dynamic(() => import("@/components/tools/calculus-tools").then((m) => m.DerivativeTool), { loading }),
  "partial-derivative": dynamic(() => import("@/components/tools/calculus-tools").then((m) => m.PartialDerivativeTool), { loading }),
  integral: dynamic(() => import("@/components/tools/calculus-tools").then((m) => m.IntegralTool), { loading }),
  limit: dynamic(() => import("@/components/tools/calculus-tools").then((m) => m.LimitTool), { loading }),
  taylor: dynamic(() => import("@/components/tools/calculus-tools").then((m) => m.TaylorTool), { loading }),
  "matrix-calculator": dynamic(() => import("@/components/tools/matrix-tools").then((m) => m.MatrixCalculatorTool), { loading }),
  determinant: dynamic(() => import("@/components/tools/matrix-tools").then((m) => m.DetInverseTool), { loading }),
  eigen: dynamic(() => import("@/components/tools/matrix-tools").then((m) => m.EigenTool), { loading }),
  "ode-solver": dynamic(() => import("@/components/tools/advanced-tools").then((m) => m.OdeSolverTool), { loading }),
  "vector-calculus": dynamic(() => import("@/components/tools/advanced-tools").then((m) => m.VectorCalculusTool), { loading }),
  "trig-solver": dynamic(() => import("@/components/tools/advanced-tools").then((m) => m.TrigSolverTool), { loading }),
  geometry: dynamic(() => import("@/components/tools/basic-tools").then((m) => m.GeometryTool), { loading }),
  sequences: dynamic(() => import("@/components/tools/basic-tools").then((m) => m.SequencesTool), { loading }),
  calculator: dynamic(() => import("@/components/tools/basic-tools").then((m) => m.CalculatorTool), { loading }),
  statistics: dynamic(() => import("@/components/tools/stats-tools").then((m) => m.StatisticsTool), { loading }),
  probability: dynamic(() => import("@/components/tools/stats-tools").then((m) => m.ProbabilityTool), { loading }),
  regression: dynamic(() => import("@/components/tools/stats-tools").then((m) => m.RegressionTool), { loading }),
  hypothesis: dynamic(() => import("@/components/tools/stats-tools").then((m) => m.HypothesisTool), { loading }),
  "graph-2d": dynamic(() => import("@/components/tools/graph-tools").then((m) => m.Graph2DTool), { loading }),
  "graph-3d": dynamic(() => import("@/components/tools/graph-tools").then((m) => m.Graph3DTool), { loading }),
  "image-to-equation": dynamic(() => import("@/components/tools/image-tool").then((m) => m.ImageToEquationTool), { loading }),
  "ml-arena": dynamic(() => import("@/components/tools/ml-arena-tool").then((m) => m.MLArenaTool), { loading }),
};

/* ------------------------------------------------------------------ */
/* Search Palette                                                      */
/* ------------------------------------------------------------------ */

function SearchPalette() {
  const { searchOpen, setSearchOpen, openTool } = useMathLab();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchTools(query), [query]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof TOOLS>();
    (query ? results : TOOLS).forEach((t) => {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    });
    return map;
  }, [query, results]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [searchOpen, setSearchOpen]);

  const pick = (id: string) => {
    openTool(id);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <CommandDialog open={searchOpen} onOpenChange={(o) => { setSearchOpen(o); if (!o) setQuery(""); }}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Type any topic, equation, or instrument — e.g. matrix, integral, 3d, ocr…"
      />
      <CommandList className="max-h-[65vh] p-2">
        <CommandEmpty>
          {query ? `No tools match “${query}”.` : "Type to search the laboratory instruments."}
        </CommandEmpty>
        {[...grouped.entries()].map(([catId, tools]) => {
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return null;
          return (
            <CommandGroup key={catId} heading={cat.name}>
              {tools.map((t) => (
                <CommandItem key={t.id} value={`${t.name} ${t.keywords.join(" ")}`} onSelect={() => pick(t.id)}>
                  <CatIcon name={t.icon} className="mr-2 h-4 w-4 text-emerald-500" />
                  <span className="font-semibold">{t.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground hidden sm:block truncate max-w-56">{t.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header() {
  const { view, goHome, openTool, setSearchOpen } = useMathLab();
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 dark:bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Brand Logo */}
        <button className="flex items-center gap-3 shrink-0 group" onClick={goHome} aria-label="MathOML home">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-all">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-background dark:bg-slate-950/90">
              <Sigma className="h-5 w-5 text-emerald-500 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-lg tracking-tight leading-none">
              Math<span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">OML</span>
            </span>
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase mt-0.5">
              LABORATORY
            </span>
          </div>
        </button>

        {/* Live System Telemetry Status */}
        <div className="hidden xl:inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 ml-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>CAS &amp; ML 25/25 ONLINE • 0ms DELAY</span>
        </div>

        {/* Top Flagship Quick Switcher */}
        <div className="hidden lg:flex items-center gap-1.5 ml-3 border-l border-border/50 pl-3">
          {[
            { id: "ml-arena", label: "ML Arena", icon: Brain, color: "text-indigo-400" },
            { id: "graph-3d", label: "3D Surface", icon: Mountain, color: "text-cyan-400" },
            { id: "graph-2d", label: "2D Grapher", icon: LineChart, color: "text-emerald-400" },
            { id: "image-to-equation", label: "Photo OCR", icon: ScanLine, color: "text-violet-400" },
            { id: "equation-solver", label: "Solver", icon: Equal, color: "text-amber-400" },
            { id: "matrix-calculator", label: "Matrix", icon: Grid3x3, color: "text-rose-400" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTool(item.id)}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5",
                view === item.id
                  ? "bg-foreground/10 text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Bar Trigger */}
        <button
          className="flex-1 max-w-sm flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:border-emerald-500/40 transition-all ml-auto group"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
          <span className="truncate text-xs sm:text-sm">Search 25 math &amp; ML instruments…</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded-lg border bg-background/80 px-1.5 font-mono text-[10px] font-semibold text-muted-foreground ml-auto">
            ⌘K
          </kbd>
        </button>

        {/* Right Action Icons */}
        <nav className="flex items-center gap-1.5" aria-label="Main navigation">
          {view !== "home" && (
            <Button
              variant="outline"
              size="sm"
              onClick={goHome}
              className="gap-1.5 rounded-xl border-border/70 glass-pill"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline font-semibold">Home</span>
            </Button>
          )}

          {/* GitHub Link */}
          <a
            href="https://github.com/ayushshaury/MathOML-Lab"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground"
            title="GitHub Repository"
          >
            <Github className="h-4 w-4" />
          </a>

          {/* Theme Switcher */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-xl hover:bg-muted/70"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 hidden dark:block text-amber-400" />
            <Moon className="h-4 w-4 dark:hidden text-slate-700" />
          </Button>
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Hero Playground                                        */
/* ------------------------------------------------------------------ */

function HeroPlayground({ onOpenTool }: { onOpenTool: (id: string) => void }) {
  const [tab, setTab] = useState<"3d" | "2d" | "solver" | "calc">("3d");

  // 3D preset state
  const [expr3d, setExpr3d] = useState("(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)");
  // 2D preset state
  const [expr2d, setExpr2d] = useState("sin(x) + cos(2*x)/2");
  // Solver preset state
  const [problemType, setProblemType] = useState<"derivative" | "integral" | "equation">("derivative");

  // Mini live expression solver state
  const [quickInput, setQuickInput] = useState("sin(pi/4) * sqrt(2)");

  const quickResult = useMemo(() => {
    if (!quickInput.trim()) return "";
    try {
      const res = math.evaluate(preprocess(quickInput));
      if (typeof res === "number") {
        return fmt(res, 6);
      } else if (res && typeof res === "object" && "toString" in res) {
        return res.toString();
      } else {
        return String(res);
      }
    } catch {
      return "Invalid expression";
    }
  }, [quickInput]);

  const spec2d = useMemo(() => ({
    curves: [
      { label: `f(x) = ${expr2d}`, expr: expr2d, color: "#10b981" },
    ],
  }), [expr2d]);

  const liveSolution = useMemo(() => {
    try {
      if (problemType === "derivative") {
        return differentiateSteps("x^3 * sin(x)", "x", 1);
      } else if (problemType === "integral") {
        return integrateSteps("x^2 + 3*x", "x", false);
      } else {
        return solveEquation("x^2 - 5*x + 6 = 0");
      }
    } catch {
      return null;
    }
  }, [problemType]);

  return (
    <div className="relative mt-8 w-full max-w-5xl mx-auto rounded-3xl glass-panel shadow-2xl overflow-hidden border border-white/10 dark:border-white/10 text-left">
      {/* Glow highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-cyan-400 to-violet-500" />

      {/* Terminal Bar Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/40 bg-muted/20 px-4 sm:px-6 py-3.5 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs font-mono font-bold tracking-wider text-muted-foreground hidden sm:inline">
            MATH.TERMINAL://LIVE_WORKSPACE
          </span>
        </div>

        {/* Tab Selector Pills */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-background/60 border border-border/50">
          {[
            { id: "3d", label: "3D Surface", icon: Mountain, activeClass: "bg-cyan-500 text-slate-950 font-bold shadow-md" },
            { id: "2d", label: "2D Grapher", icon: LineChart, activeClass: "bg-emerald-500 text-slate-950 font-bold shadow-md" },
            { id: "solver", label: "Live Steps", icon: Equal, activeClass: "bg-amber-500 text-slate-950 font-bold shadow-md" },
            { id: "calc", label: "Quick Calc", icon: Calculator, activeClass: "bg-violet-500 text-white font-bold shadow-md" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                tab === t.id ? t.activeClass : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Direct Studio Jump */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenTool(
            tab === "3d" ? "graph-3d" : tab === "2d" ? "graph-2d" : tab === "solver" ? "equation-solver" : "calculator"
          )}
          className="text-xs gap-1.5 font-bold text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl"
        >
          Open Dedicated Studio <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tab 1: 3D Surface */}
      {tab === "3d" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-muted-foreground shrink-0">1-Click Topology:</span>
              {[
                { name: "Sombrero / Higgs", expr: "(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)" },
                { name: "Ripple Wave", expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)" },
                { name: "Quantum Wavepacket", expr: "4 * x^2 * y^2 * exp(-(x^2 + y^2))" },
                { name: "Rosenbrock Banana", expr: "log(1 + (1 - x)^2 + 10*(y - x^2)^2) / 3" },
                { name: "Scherk Minimal", expr: "log(cos(x) / cos(y))" },
                { name: "Ackley Multimodal", expr: "-10*exp(-0.2*sqrt(0.5*(x^2 + y^2))) - 0.5*(cos(2*pi*x) + cos(2*pi*y)) + 10" },
                { name: "Vortex Spiral", expr: "sin(3*atan2(y, x) + sqrt(x^2 + y^2))" },
                { name: "Monkey Saddle", expr: "x^3 - 3*x*y^2" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr3d(p.expr)}
                  className={cn(
                    "rounded-xl border px-3 py-1 text-xs font-mono transition-all shrink-0 active:scale-95",
                    expr3d === p.expr
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-400 font-bold shadow-xs"
                      : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-1 text-xs font-mono text-cyan-400">
              <span className="text-muted-foreground">z =</span> {expr3d}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-border/60 bg-black/40 shadow-inner">
            <Plot3D expr={expr3d} height={380} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>• DRAG TO ORBIT CAMERA • SCROLL TO ZOOM • SHADED WITH DIRECTIONAL LIGHTING</span>
            <span className="text-cyan-400 font-semibold">60 FPS REAL-TIME CANVAS</span>
          </div>
        </div>
      )}

      {/* Tab 2: 2D Graph */}
      {tab === "2d" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-muted-foreground shrink-0">1-Click Curves:</span>
              {[
                { name: "Harmonic Wave", expr: "sin(x) + cos(2*x)/2" },
                { name: "Cubic Polynomial", expr: "x^3 - 3*x" },
                { name: "Damped Sine", expr: "exp(-0.2*x)*sin(3*x)" },
                { name: "Gaussian Bell", expr: "exp(-x^2/2)" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr2d(p.expr)}
                  className={cn(
                    "rounded-xl border px-3 py-1 text-xs font-mono transition-all shrink-0 active:scale-95",
                    expr2d === p.expr
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 font-bold shadow-xs"
                      : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 border border-border/50 px-3 py-1 text-xs font-mono text-emerald-400">
              <span className="text-muted-foreground">f(x) =</span> {expr2d}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-border/60 bg-black/40 shadow-inner">
            <Plot2D spec={spec2d} height={380} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>• HOVER TO TRACE TANGENT &amp; SLOPE • DRAG TO PAN • PINCH/SCROLL TO SCALE</span>
            <span className="text-emerald-400 font-semibold">DYNAMIC CROSSHAIR ACTIVE</span>
          </div>
        </div>
      )}

      {/* Tab 3: Step-by-Step Derivation */}
      {tab === "solver" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Choose Problem:</span>
            {[
              { type: "derivative" as const, label: "d/dx [x³ · sin(x)]" },
              { type: "integral" as const, label: "∫ (x² + 3x) dx" },
              { type: "equation" as const, label: "x² - 5x + 6 = 0" },
            ].map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => setProblemType(p.type)}
                className={cn(
                  "rounded-xl border px-3 py-1 text-xs font-mono transition-all active:scale-95",
                  problemType === p.type
                    ? "border-amber-500 bg-amber-500/20 text-amber-400 font-bold shadow-xs"
                    : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {liveSolution && (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 max-h-[380px] overflow-y-auto shadow-inner">
              <StepsView solution={liveSolution} />
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Quick Calculator */}
      {tab === "calc" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Live Expression Evaluation (Type anything):
            </label>
            <div className="flex gap-2">
              <Input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="e.g. sqrt(144) * 5 + sin(pi/6)"
                className="font-mono text-base bg-background/70 rounded-xl border-border/70 h-12"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 space-y-2">
            <div className="text-xs font-mono text-violet-400 uppercase tracking-widest font-semibold">
              Computed Result:
            </div>
            <div className="text-3xl font-mono font-extrabold text-foreground tracking-tight">
              {quickResult || "0"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Try Instant Formulas:</span>
            {[
              "sin(pi/3)",
              "sqrt(256) / 4",
              "2^10 - 1000",
              "log(100, 10)",
              "cos(pi/4)^2 + sin(pi/4)^2",
            ].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setQuickInput(f)}
                className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-mono hover:border-violet-500/50 hover:text-violet-400 transition-colors"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero Search Bar                                                     */
/* ------------------------------------------------------------------ */

function HeroSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");
  const results = useMemo(() => searchTools(value).slice(0, 6), [value]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <form
        className="flex items-center gap-2 rounded-2xl glass-panel border border-white/10 dark:border-white/15 shadow-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all"
        onSubmit={(e) => {
          e.preventDefault();
          if (results.length) onSearch(results[0].id);
          else if (value.trim()) onSearch("equation-solver");
        }}
      >
        <Search className="h-5 w-5 text-emerald-500 shrink-0" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask any math question or tool name (e.g. integral, eigenvalues, 3D, OCR)..."
          className="border-0 shadow-none focus-visible:ring-0 h-11 text-base bg-transparent"
          aria-label="Search mathematics laboratory"
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0 gap-1.5 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md"
        >
          Explore <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      {value && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-border/80 glass-panel shadow-2xl overflow-hidden backdrop-blur-2xl">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No direct tool name matched — press Enter to launch the Equation Solver with your input.
            </p>
          ) : (
            results.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category);
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
                  onClick={() => onSearch(t.id)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                    <CatIcon name={t.icon} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0 border rounded-md px-2 py-0.5">
                    {cat?.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tool Card with Glowing Cyber Effect                                */
/* ------------------------------------------------------------------ */

function ToolCard({ toolId, onOpen }: { toolId: string; onOpen: (id: string) => void }) {
  const tool = TOOLS.find((t) => t.id === toolId)!;
  const cat = CATEGORIES.find((c) => c.id === tool.category)!;
  const styles = CAT_STYLES[cat.color] ?? CAT_STYLES.emerald;

  return (
    <button
      onClick={() => onOpen(tool.id)}
      className={cn(
        "group relative flex flex-col items-start gap-3 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 text-left shadow-sm transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-emerald-500/40 active:scale-[0.98] overflow-hidden"
      )}
    >
      {/* Top ambient color reflection on hover */}
      <div className={cn("absolute -top-12 -right-12 h-28 w-28 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity", styles.bg)} />

      <div className="flex items-center justify-between w-full">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-110 duration-300", styles.bg)}>
          <CatIcon name={tool.icon} className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-muted/60 border border-border/50 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
          {cat.name}
        </span>
      </div>

      <div className="min-w-0 mt-1">
        <p className="font-bold text-base leading-snug group-hover:text-emerald-400 transition-colors">
          {tool.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      <div className="mt-auto pt-3 w-full border-t border-border/40 flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
        <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-500">
          1-Click Launch
        </span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 text-emerald-500" />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Home View                                                           */
/* ------------------------------------------------------------------ */

function HomeView() {
  const { openTool, setSearchOpen } = useMathLab();
  const [selectedCat, setSelectedCat] = useState<string>("all");

  const filteredCategories = useMemo(() => {
    if (selectedCat === "all") return CATEGORIES;
    return CATEGORIES.filter((c) => c.id === selectedCat);
  }, [selectedCat]);

  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[36px] glass-panel border border-white/10 dark:border-white/10 px-4 sm:px-10 py-14 sm:py-24 text-center shadow-2xl">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[450px] w-[450px] rounded-full bg-emerald-500/15 blur-[120px]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[450px] w-[450px] rounded-full bg-cyan-500/15 blur-[120px]" aria-hidden />

        <div className="relative max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400 mb-6 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 animate-spin" />
            <span>Next-Gen Mathematical Computing &amp; Visualization</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]">
            Compute. Visualize.{" "}
            <span className="text-shimmer">Master Mathematics.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-sm sm:text-lg leading-relaxed">
            Deterministic computer algebra, real-time 3D directional surface shaders, interactive tangent curve tracing, and multi-question automated photo OCR.
          </p>

          {/* Search Bar */}
          <div className="mt-8">
            <HeroSearch onSearch={(id) => openTool(id)} />
          </div>

          {/* ⚡ 1-Click Power Launcher Dock */}
          <div className="mt-8 pt-6 border-t border-border/40">
            <p className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase mb-3.5">
              ⚡ 1-Click Instant Instrument Launch:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: "🤖 ML Arena (RL & 3D Loss)", tool: "ml-arena", color: "hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400 font-bold" },
                { label: "🌊 Ripple Wave 3D", tool: "graph-3d", color: "hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400" },
                { label: "📈 Harmonic Wave 2D", tool: "graph-2d", color: "hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400" },
                { label: "⚡ Derivative Steps", tool: "derivative", color: "hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400" },
                { label: "📸 Multi-Question OCR", tool: "image-to-equation", color: "hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-400" },
                { label: "🧮 Matrix Inversion", tool: "determinant", color: "hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400" },
                { label: "📊 Probability & Stats", tool: "statistics", color: "hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-400" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => openTool(item.tool)}
                  className={cn(
                    "rounded-xl border border-border/60 bg-background/50 backdrop-blur-md px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 shadow-xs",
                    item.color
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Centerpiece: Interactive Hero Playground */}
          <HeroPlayground onOpenTool={(id) => openTool(id)} />
        </div>
      </section>

      {/* Flagship Instruments Showcase */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-mono font-bold text-indigo-400 mb-2">
            <Brain className="h-3.5 w-3.5 animate-pulse" />
            <span>CORE SUITE &amp; ML LABORATORY</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Flagship Intelligence Instruments</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Engineered from scratch for deep intuition, rigorous mathematics, and real-time visualization.
          </p>
        </div>

        {/* Hero Flagship Banner: Machine Learning Arena */}
        <div
          onClick={() => openTool("ml-arena")}
          className="group relative cursor-pointer overflow-hidden rounded-[32px] glass-panel p-6 sm:p-8 border border-indigo-500/40 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/10 hover:border-indigo-500/70 hover:-translate-y-1"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl group-hover:scale-125 transition-transform duration-700" aria-hidden />
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                  <Brain className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-indigo-400 uppercase">
                      New • Flagship Suite
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">• 5 ML Paradigms</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">Machine Learning Arena</h3>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Explore Regression (OLS, Ridge, Lasso, SVR), Classification (Logistic, SVM, Decision Trees, KNN), Optimization (Adam, RMSProp, 3D loss surfaces), Unsupervised (K-Means, PCA), and Tabular Q-Learning Reinforcement Learning in an interactive 5x5 Gridworld with Bellman derivations and from-scratch NumPy code.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Interactive 2D Curves", "3D Loss Landscapes", "Live Q-Learning Gridworld", "LaTeX Equations", "From-Scratch Python Code"].map((tag) => (
                  <span key={tag} className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-mono font-semibold text-indigo-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
              <Button className="w-full sm:w-auto gap-2 rounded-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-950/30 px-6 h-12">
                Launch ML Arena <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:block">
                All 5 ML Branches • Pure Client-Side
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: 3D Surface */}
          <div
            onClick={() => openTool("graph-3d")}
            className="group relative cursor-pointer overflow-hidden rounded-3xl glass-panel p-6 shadow-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-cyan-500/50 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950 shadow-lg">
                  <Mountain className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan-400 uppercase">
                  3D Shaders
                </span>
              </div>
              <h3 className="text-lg font-bold">3D Surface Studio</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Directional lighting model with surface normals. Choose between Viridis, Neon Synthwave, and Plasma colormaps with free orbital camera rotation.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
              Launch Studio <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 2: 2D Grapher */}
          <div
            onClick={() => openTool("graph-2d")}
            className="group relative cursor-pointer overflow-hidden rounded-3xl glass-panel p-6 shadow-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-emerald-500/50 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-lg">
                  <LineChart className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400 uppercase">
                  Curve Tracer
                </span>
              </div>
              <h3 className="text-lg font-bold">2D Graphing Calculator</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Real-time curve snapping, dynamic tangent line tracers, roots and extrema markers, definite area integrals, and dynamic variable sliders.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
              Launch Grapher <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 3: Multi-OCR */}
          <div
            onClick={() => openTool("image-to-equation")}
            className="group relative cursor-pointer overflow-hidden rounded-3xl glass-panel p-6 shadow-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-violet-500/50 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg">
                  <ScanLine className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-violet-400 uppercase">
                  Multi-OCR
                </span>
              </div>
              <h3 className="text-lg font-bold">Photo Worksheet OCR</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Scan multiple numbered questions on worksheets at once. Solves each equation sequentially in an automated step-by-step queue with cyberpunk laser animation.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-violet-400 group-hover:translate-x-1 transition-transform">
              Launch OCR Queue <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Card 4: Matrix & Linear */}
          <div
            onClick={() => openTool("matrix-calculator")}
            className="group relative cursor-pointer overflow-hidden rounded-3xl glass-panel p-6 shadow-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-rose-500/50 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg">
                  <Grid3x3 className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-400 uppercase">
                  Linear Studio
                </span>
              </div>
              <h3 className="text-lg font-bold">Matrix &amp; Linear Algebra</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Decompositions, determinants, eigenvalues, eigenvectors, Gaussian row elimination, matrix inverses, and systems of linear equations.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-rose-400 group-hover:translate-x-1 transition-transform">
              Launch Matrix Lab <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Complete 25-Tool Laboratory Matrix */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div>
            <h2 className="text-xl sm:text-3xl font-black tracking-tight">The 25 Instruments</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Select a discipline or explore the complete suite.</p>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCat("all")}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0",
                selectedCat === "all"
                  ? "bg-foreground text-background shadow-md font-bold"
                  : "border border-border/60 bg-card/60 hover:bg-muted text-muted-foreground"
              )}
            >
              All Instruments ({TOOLS.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = toolsByCategory(cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn(
                    "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5",
                    selectedCat === cat.id
                      ? "bg-foreground text-background shadow-md font-bold"
                      : "border border-border/60 bg-card/60 hover:bg-muted text-muted-foreground"
                  )}
                >
                  <CatIcon name={cat.icon} className="h-3 w-3" />
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories Grid */}
        {filteredCategories.map((cat: Category) => {
          const tools = toolsByCategory(cat.id);
          const styles = CAT_STYLES[cat.color] ?? CAT_STYLES.emerald;
          return (
            <div key={cat.id} className="space-y-3.5 pt-2">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm", styles.bg)}>
                  <CatIcon name={cat.icon} className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold tracking-tight">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tools.map((t) => (
                  <ToolCard key={t.id} toolId={t.id} onOpen={openTool} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Cyber Photo OCR Callout Banner */}
      <section className="relative overflow-hidden rounded-[32px] glass-panel p-8 sm:p-12 border border-violet-500/30 shadow-2xl flex flex-col md:flex-row items-center gap-8 justify-between">
        <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" aria-hidden />

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-mono font-bold text-violet-400 mb-3">
            <ScanLine className="h-3.5 w-3.5" />
            <span>OPTICAL MATHEMATICAL RECOGNITION</span>
          </div>
          <h2 className="font-black text-2xl sm:text-3xl tracking-tight">
            Have handwritten math questions on paper?
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Snap a photo of worksheets with multiple questions. MathOML identifies every equation, queues them sequentially, and computes step-by-step solutions with laser scan animations.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3 shrink-0">
          <Button
            variant="outline"
            className="rounded-2xl glass-pill px-5 h-12"
            onClick={() => setSearchOpen(true)}
          >
            Browse All Tools
          </Button>
          <Button
            className="gap-2 rounded-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-950/20 px-6 h-12"
            onClick={() => openTool("image-to-equation")}
          >
            <ScanLine className="h-4 w-4" /> Launch Photo OCR Queue
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page Export                                                   */
/* ------------------------------------------------------------------ */

export default function Page() {
  const { view, viewNonce } = useMathLab();
  const Tool = TOOL_COMPONENTS[view];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        {view === "home" ? <HomeView /> : Tool ? <Tool key={`${view}-${viewNonce}`} /> : <HomeView />}
      </main>
      <footer className="mt-auto border-t border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center gap-4 justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Sigma className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold text-foreground">MathOML Laboratory</span>
            <span>— Exact Symbolic &amp; Numerical Intelligence.</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ayushshaury/MathOML-Lab"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Github className="h-3.5 w-3.5" /> GitHub Repository
            </a>
            <span>•</span>
            <span>100% Client-Side CAS</span>
          </div>
        </div>
      </footer>
      <SearchPalette />
    </div>
  );
}
