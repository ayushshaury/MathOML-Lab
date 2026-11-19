"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Sigma, Search, Sun, Moon, Home, FlaskConical, ArrowRight, Sparkles,
  Equal, Shuffle, Layers, TrendingUp, SquareStack, MoveRight, GitBranch, Infinity as InfinityIcon,
  ListOrdered, Grid3x3, SquareDashed, Waves, Compass, Triangle, Shapes, BarChart3, Dice5,
  LineChart, Mountain, Calculator, ScanLine, FlaskRound, BookOpen, ExternalLink, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useMathLab } from "@/lib/store";
import { CATEGORIES, TOOLS, searchTools, toolsByCategory, type Category } from "@/lib/tools";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import { Plot2D } from "@/components/math/Plot2D";
import { Plot3D } from "@/components/math/Plot3D";
import { differentiateSteps } from "@/lib/math/differentiate";
import { integrateSteps } from "@/lib/math/integrals";
import { solveEquation } from "@/lib/math/equations";
import { StepsView } from "@/components/math/Steps";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* icon map                                                            */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sigma, Equal, Shuffle, Layers, TrendingUp, SquareStack, MoveRight, GitBranch,
  Infinity: InfinityIcon, ListOrdered, Grid3x3, SquareDashed, Waves, Compass,
  Triangle, Shapes, BarChart3, Dice5, LineChart, Mountain, Calculator, ScanLine,
  FlaskConical, FlaskRound,
};

function CatIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Sigma;
  return <Cmp className={className} />;
}

/* category accent styles */
const CAT_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  emerald: { bg: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400", border: "hover:border-emerald-500/50", glow: "from-emerald-500/20" },
  amber: { bg: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", border: "hover:border-amber-500/50", glow: "from-amber-500/20" },
  rose: { bg: "bg-rose-600", text: "text-rose-700 dark:text-rose-400", border: "hover:border-rose-500/50", glow: "from-rose-500/20" },
  cyan: { bg: "bg-cyan-600", text: "text-cyan-700 dark:text-cyan-400", border: "hover:border-cyan-500/50", glow: "from-cyan-500/20" },
  violet: { bg: "bg-violet-600", text: "text-violet-700 dark:text-violet-400", border: "hover:border-violet-500/50", glow: "from-violet-500/20" },
  orange: { bg: "bg-orange-600", text: "text-orange-700 dark:text-orange-400", border: "hover:border-orange-500/50", glow: "from-orange-500/20" },
  lime: { bg: "bg-lime-600", text: "text-lime-700 dark:text-lime-400", border: "hover:border-lime-500/50", glow: "from-lime-500/20" },
  sky: { bg: "bg-sky-600", text: "text-sky-700 dark:text-sky-400", border: "hover:border-sky-500/50", glow: "from-sky-500/20" },
  teal: { bg: "bg-teal-600", text: "text-teal-700 dark:text-teal-400", border: "hover:border-teal-500/50", glow: "from-teal-500/20" },
  slate: { bg: "bg-slate-600", text: "text-slate-700 dark:text-slate-300", border: "hover:border-slate-500/50", glow: "from-slate-500/20" },
};

/* ------------------------------------------------------------------ */
/* lazy tool loading                                                   */
/* ------------------------------------------------------------------ */

const loading = () => (
  <div className="flex items-center justify-center py-24">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
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
};

/* ------------------------------------------------------------------ */
/* search palette                                                      */
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
        placeholder="Search calculators & topics — e.g. derivative, matrix, statistics…"
      />
      <CommandList className="max-h-[65vh]">
        <CommandEmpty>
          {query ? `No tools match “${query}”.` : "Type to search the laboratory."}
        </CommandEmpty>
        {[...grouped.entries()].map(([catId, tools]) => {
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return null;
          return (
            <CommandGroup key={catId} heading={cat.name}>
              {tools.map((t) => (
                <CommandItem key={t.id} value={`${t.name} ${t.keywords.join(" ")}`} onSelect={() => pick(t.id)}>
                  <CatIcon name={t.icon} className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{t.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground hidden sm:block truncate max-w-52">{t.description}</span>
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
/* header                                                              */
/* ------------------------------------------------------------------ */

function Header() {
  const { view, goHome, openTool, setSearchOpen } = useMathLab();
  const { setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 dark:bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center gap-2 sm:gap-4 px-3 sm:px-6">
        <button className="flex items-center gap-2.5 shrink-0 group" onClick={goHome} aria-label="MathLab home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm group-hover:scale-105 transition-all">
            <Sigma className="h-5 w-5" />
          </span>
          <span className="font-bold text-lg tracking-tight hidden xs:block">
            Math<span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Lab</span>
          </span>
        </button>

        {/* Direct quick navigation pills */}
        <div className="hidden lg:flex items-center gap-1.5 ml-2 border-l pl-3">
          <button
            type="button"
            onClick={() => openTool("graph-2d")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
              view === "graph-2d" ? "bg-emerald-500/10 text-emerald-600 font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <LineChart className="h-3.5 w-3.5" /> 2D Grapher
          </button>
          <button
            type="button"
            onClick={() => openTool("graph-3d")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
              view === "graph-3d" ? "bg-cyan-500/10 text-cyan-600 font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Mountain className="h-3.5 w-3.5" /> 3D Studio
          </button>
          <button
            type="button"
            onClick={() => openTool("equation-solver")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
              view === "equation-solver" ? "bg-amber-500/10 text-amber-600 font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Equal className="h-3.5 w-3.5" /> Solver
          </button>
          <button
            type="button"
            onClick={() => openTool("image-to-equation")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
              view === "image-to-equation" ? "bg-violet-500/10 text-violet-600 font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ScanLine className="h-3.5 w-3.5" /> Photo OCR
          </button>
        </div>

        <button
          className="flex-1 max-w-md flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors ml-auto sm:ml-4"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs sm:text-sm">Search 24 calculators &amp; topics…</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium ml-auto">
            ⌘K
          </kbd>
        </button>

        <nav className="flex items-center gap-1" aria-label="Main">
          {view !== "home" && (
            <Button variant="ghost" size="sm" onClick={goHome} className="gap-1.5">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle dark mode"
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
/* Interactive Hero Playground: Hooks users immediately on first visit */
/* ------------------------------------------------------------------ */

function HeroPlayground({ onOpenTool }: { onOpenTool: (id: string) => void }) {
  const [tab, setTab] = useState<"3d" | "2d" | "solver">("3d");

  // 3D preset state
  const [expr3d, setExpr3d] = useState("sin(x)*cos(y)");
  // 2D preset state
  const [expr2d, setExpr2d] = useState("sin(x) + cos(2*x)/2");
  // Solver problem preset
  const [problemType, setProblemType] = useState<"derivative" | "integral" | "equation">("derivative");

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
    <div className="relative mt-8 w-full max-w-4xl mx-auto rounded-3xl border bg-card/75 backdrop-blur-xl shadow-2xl shadow-emerald-950/10 overflow-hidden text-left">
      {/* Tab Header */}
      <div className="flex flex-wrap items-center justify-between border-b bg-muted/40 px-4 py-3 gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background/80 border">
          <button
            type="button"
            onClick={() => setTab("3d")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              tab === "3d" ? "bg-cyan-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mountain className="h-3.5 w-3.5" /> 3D Surface
          </button>
          <button
            type="button"
            onClick={() => setTab("2d")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              tab === "2d" ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LineChart className="h-3.5 w-3.5" /> 2D Grapher
          </button>
          <button
            type="button"
            onClick={() => setTab("solver")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              tab === "solver" ? "bg-amber-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Equal className="h-3.5 w-3.5" /> Step-by-Step Solver
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenTool(tab === "3d" ? "graph-3d" : tab === "2d" ? "graph-2d" : "equation-solver")}
            className="text-xs gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
          >
            Open Full Studio <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tab 1: 3D Surface */}
      {tab === "3d" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Iconic Surfaces:</span>
              {[
                { name: "Egg Crate", expr: "sin(x)*cos(y)" },
                { name: "Ripple Waves", expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)" },
                { name: "Monkey Saddle", expr: "x^3 - 3*x*y^2" },
                { name: "Gaussian Peak", expr: "4*exp(-(x^2 + y^2)/4)" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr3d(p.expr)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-mono transition-all",
                    expr3d === p.expr
                      ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold"
                      : "bg-background/80 hover:bg-accent text-muted-foreground"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              z = {expr3d}
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border">
            <Plot3D expr={expr3d} height={360} />
          </div>
        </div>
      )}

      {/* Tab 2: 2D Graph */}
      {tab === "2d" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Curves:</span>
              {[
                { name: "Harmonic Wave", expr: "sin(x) + cos(2*x)/2" },
                { name: "Polynomial", expr: "x^3 - 3*x" },
                { name: "Damped Sine", expr: "exp(-0.2*x)*sin(3*x)" },
                { name: "Gaussian Bell", expr: "exp(-x^2/2)" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr2d(p.expr)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-mono transition-all",
                    expr2d === p.expr
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "bg-background/80 hover:bg-accent text-muted-foreground"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              y = {expr2d}
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border">
            <Plot2D spec={spec2d} height={360} />
          </div>
        </div>
      )}

      {/* Tab 3: Step-by-Step Derivation */}
      {tab === "solver" && (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Choose Problem:</span>
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
                  "rounded-full border px-3 py-1 text-xs font-mono transition-all",
                  problemType === p.type
                    ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                    : "bg-background/80 hover:bg-accent text-muted-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {liveSolution && (
            <div className="rounded-2xl border bg-background/80 p-4 max-h-[380px] overflow-y-auto">
              <StepsView solution={liveSolution} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero search bar                                                     */
/* ------------------------------------------------------------------ */

function HeroSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");
  const results = useMemo(() => searchTools(value).slice(0, 6), [value]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <form
        className="flex items-center gap-2 rounded-2xl border bg-background/90 shadow-xl shadow-emerald-950/5 px-3.5 py-2 focus-within:ring-2 focus-within:ring-emerald-600/30 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          if (results.length) onSearch(results[0].id);
          else if (value.trim()) onSearch("equation-solver");
        }}
      >
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What math problem do you want to solve?"
          className="border-0 shadow-none focus-visible:ring-0 h-11 text-base sm:text-lg"
          aria-label="Search mathematics laboratory"
        />
        <Button type="submit" size="sm" className="shrink-0 gap-1 rounded-xl shadow-xs">
          Search <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      {value && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border bg-popover shadow-2xl overflow-hidden">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No direct tool match — press Search to launch the Equation Solver with your input.
            </p>
          ) : (
            results.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category);
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors border-b last:border-0"
                  onClick={() => onSearch(t.id)}
                >
                  <CatIcon name={t.icon} className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  </div>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{cat?.name}</span>
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
/* Tool Card with modern glass & hover styling                         */
/* ------------------------------------------------------------------ */

function ToolCard({ toolId, onOpen }: { toolId: string; onOpen: (id: string) => void }) {
  const tool = TOOLS.find((t) => t.id === toolId)!;
  const cat = CATEGORIES.find((c) => c.id === tool.category)!;
  const styles = CAT_STYLES[cat.color] ?? CAT_STYLES.emerald;

  return (
    <button
      onClick={() => onOpen(tool.id)}
      className={cn(
        "group relative flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 sm:p-5 text-left shadow-xs transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99]",
        styles.border
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-xs transition-transform group-hover:scale-105", styles.bg)}>
          <CatIcon name={tool.icon} className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {cat.name}
        </span>
      </div>

      <div className="min-w-0 mt-1">
        <p className="font-bold text-base leading-snug group-hover:text-primary transition-colors">{tool.name}</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{tool.description}</p>
      </div>

      <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
        Launch Calculator <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
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
    <div className="space-y-14 sm:space-y-20">
      {/* High-Impact Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-500/10 via-background to-cyan-500/10 px-4 sm:px-10 py-12 sm:py-20 text-center shadow-lg shadow-emerald-950/5">
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" aria-hidden />

        <div className="relative">
          {/* Live Online Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-6 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            24 Deterministic Mathematical Computing Engines Active
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl sm:text-6xl font-extrabold tracking-tight leading-[1.12]">
            Understand <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Every Math Problem</span> —
            <br className="hidden sm:block" /> Computed Live, Step-by-Step
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground text-sm sm:text-base leading-relaxed">
            Real computer algebra systems with rigorous LaTeX derivations, interactive 2D curve tracing, photorealistic 3D surfaces with directional lighting, and instant photo OCR.
          </p>

          <div className="mt-8">
            <HeroSearch onSearch={(id) => openTool(id)} />
          </div>

          {/* Live Hero Playground right on first visit */}
          <HeroPlayground onOpenTool={(id) => openTool(id)} />
        </div>
      </section>

      {/* Flagship Visualizer Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          onClick={() => openTool("graph-2d")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-500/10 via-card to-card p-6 sm:p-8 shadow-sm transition-all hover:shadow-xl hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <LineChart className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Interactive 2D Canvas
            </span>
          </div>
          <h3 className="text-xl font-bold">2D Graphing Calculator &amp; Curve Tracer</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Multi-curve plotting with live snapping crosshair, instant root &amp; extrema markers, tangent lines, area integrals, polar grids, and dynamic parameter <code className="font-mono text-emerald-600 dark:text-emerald-400">a</code> sliders.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
            Launch 2D Plotter Studio <ArrowRight className="h-4 w-4" />
          </span>
        </div>

        <div
          onClick={() => openTool("graph-3d")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border bg-gradient-to-br from-cyan-500/10 via-card to-card p-6 sm:p-8 shadow-sm transition-all hover:shadow-xl hover:border-cyan-500/50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-600 text-white shadow-md">
              <Mountain className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-600 dark:text-cyan-400">
              3D Surface Engine
            </span>
          </div>
          <h3 className="text-xl font-bold">3D Surface Plotter with Directional Lighting</h3>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Normal-based directional lighting for realistic 3D depth. Supports Neon Synthwave, Viridis, and Sunset colormaps, Wireframe and Contour modes, free orbital camera rotation, and auto-rotation.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">
            Launch 3D Studio <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </section>

      {/* Why MathLab Section */}
      <section className="rounded-3xl border bg-muted/20 p-6 sm:p-10">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Built for Serious Mathematics</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Not LLM approximations. Live deterministic computer algebra verified numerically.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Sigma,
              title: "Deterministic Engines",
              desc: "Powered by mathjs & nerdamer CAS. Exact algebraic factorizations, eigenvalues, and ODE solutions.",
            },
            {
              icon: BookOpen,
              title: "Step-by-Step Rigor",
              desc: "Beginner-friendly explanations for every step, rendered with typographic KaTeX LaTeX quality.",
            },
            {
              icon: Sparkles,
              title: "Zero Server Latency",
              desc: "Computes entirely client-side in your browser. Complete privacy with zero lag or data sharing.",
            },
            {
              icon: ScanLine,
              title: "Camera & Photo OCR",
              desc: "Snap handwritten formulas on paper or whiteboards and convert them instantly to computer algebra.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card/80 p-5 shadow-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
                <item.icon className="h-5 w-5" />
              </span>
              <h4 className="font-bold text-sm">{item.title}</h4>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Category Filter Bar */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Explore the Complete Lab</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Select a category or browse all 24 working instruments.</p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCat("all")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0",
                selectedCat === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "border bg-background hover:bg-accent text-muted-foreground"
              )}
            >
              All Tools ({TOOLS.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = toolsByCategory(cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5",
                    selectedCat === cat.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border bg-background hover:bg-accent text-muted-foreground"
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
            <div key={cat.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-xs", styles.bg)}>
                  <CatIcon name={cat.icon} className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold tracking-tight">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tools.map((t) => (
                  <ToolCard key={t.id} toolId={t.id} onOpen={openTool} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA Banner */}
      <section className="rounded-3xl border bg-gradient-to-r from-emerald-500/10 via-card to-cyan-500/10 p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6 justify-between shadow-sm">
        <div>
          <h2 className="font-bold text-xl">Have a handwritten problem on paper?</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Take a picture or upload an image and let MathLab convert it to clean computer-algebra syntax, then solve it with complete step-by-step reasoning.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          <Button variant="outline" className="rounded-xl" onClick={() => setSearchOpen(true)}>
            Browse All Tools
          </Button>
          <Button className="gap-2 rounded-xl shadow-xs" onClick={() => openTool("image-to-equation")}>
            <ScanLine className="h-4 w-4" /> Photo to Equation
          </Button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  const { view, viewNonce } = useMathLab();
  const Tool = TOOL_COMPONENTS[view];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-6 sm:py-10">
        {view === "home" ? <HomeView /> : Tool ? <Tool key={`${view}-${viewNonce}`} /> : <HomeView />}
      </main>
      <footer className="mt-auto border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center gap-3 justify-between text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium">
            <Sigma className="h-3.5 w-3.5 text-emerald-600" />
            MathLab — The Digital Mathematics Laboratory. Real CAS Engines: mathjs · nerdamer · KaTeX.
          </p>
          <p>Every problem is calculated live with numerical &amp; symbolic verification.</p>
        </div>
      </footer>
      <SearchPalette />
    </div>
  );
}
