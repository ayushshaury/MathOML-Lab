"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Sigma, Search, Home, ArrowRight,
  Equal, Shuffle, Layers, TrendingUp, SquareStack, MoveRight, GitBranch, Infinity as InfinityIcon,
  ListOrdered, Grid3x3, SquareDashed, Waves, Compass, Triangle, Shapes, BarChart3, Dice5,
  LineChart, Mountain, Calculator, ScanLine, Github, Brain, ChevronRight, ChevronDown,
  PanelLeft, PanelLeftClose, X, FlaskConical, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMathLab } from "@/lib/store";
import { CATEGORIES, TOOLS, searchTools, toolsByCategory, getTool, type Category } from "@/lib/tools";
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
  FlaskConical, Eigenvector: Grid3x3,
};

function CatIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Sigma;
  return <Cmp className={className} />;
}

/* ------------------------------------------------------------------ */
/* Lazy Tool Loading                                                   */
/* ------------------------------------------------------------------ */

const loading = () => (
  <div className="flex flex-col items-center justify-center py-28 gap-3">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
    <span className="text-xs font-medium text-zinc-400">Loading workspace…</span>
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
  "eda-studio": dynamic(() => import("@/components/tools/eda-tool").then((m) => m.EDATool), { loading }),
};

/* ------------------------------------------------------------------ */
/* Search Palette (Spotlight / Raycast / Notion Quick Jump)           */
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
        placeholder="Search tools, calculus, matrices, graphing, or EDA…"
        className="text-sm font-sans"
      />
      <CommandList className="max-h-[60vh] p-2">
        <CommandEmpty className="py-8 text-center text-xs text-zinc-500">
          {query ? `No tools match “${query}”.` : "Type to search all 26 tools."}
        </CommandEmpty>
        {[...grouped.entries()].map(([catId, tools]) => {
          const cat = CATEGORIES.find((c) => c.id === catId);
          if (!cat) return null;
          return (
            <CommandGroup key={catId} heading={cat.name} className="text-xs font-medium text-zinc-500">
              {tools.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`${t.name} ${t.keywords.join(" ")}`}
                  onSelect={() => pick(t.id)}
                  className="rounded-xl px-3 py-2 cursor-pointer aria-selected:bg-zinc-100"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 mr-2.5 shrink-0">
                    <CatIcon name={t.icon} className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-medium text-sm text-zinc-900">{t.name}</span>
                  <span className="ml-auto text-xs text-zinc-400 hidden sm:block truncate max-w-56">{t.description}</span>
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
/* Workspace Sidebar                                                  */
/* ------------------------------------------------------------------ */

function WorkspaceSidebar({
  open,
  onCloseMobile,
  onToggleDesktop,
}: {
  open: boolean;
  onCloseMobile: () => void;
  onToggleDesktop: () => void;
}) {
  const { view, goHome, openTool, setSearchOpen, history } = useMathLab();
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    "data-ml": true,
    graphing: true,
    calculus: false,
    algebra: false,
    stats: false,
  });

  useEffect(() => {
    if (view === "home") return;
    const activeTool = getTool(view);
    if (activeTool) {
      setExpandedCats((prev) => (prev[activeTool.category] ? prev : { ...prev, [activeTool.category]: true }));
    }
  }, [view]);

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navigate = (id: string) => {
    if (id === "home") goHome();
    else openTool(id);
    onCloseMobile();
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#f7f7f5] border-r border-black/[0.06] text-[#37352f] select-none transition-all duration-200 ease-out",
        open ? "w-64" : "w-0 overflow-hidden border-r-0"
      )}
    >
      {/* Workspace Header */}
      <div className="h-12 px-3.5 flex items-center justify-between border-b border-black/[0.05] shrink-0">
        <button
          onClick={() => navigate("home")}
          className="flex items-center gap-2 hover:bg-black/[0.04] rounded-lg px-2 py-1 transition-colors"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1d1d1f] text-white shadow-2xs">
            <Sigma className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold text-sm tracking-tight text-[#1d1d1f]">MathOML</span>
        </button>

        <button
          onClick={onToggleDesktop}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-[#37352f]/60 hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors"
          title="Collapse sidebar (⌘\)"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>

        <button
          onClick={onCloseMobile}
          className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-[#37352f]/60 hover:text-[#1d1d1f] hover:bg-black/[0.05]"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Search */}
      <div className="p-2.5 shrink-0">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 rounded-lg bg-white/80 hover:bg-white border border-black/[0.07] px-2.5 py-1.5 text-xs text-[#37352f]/70 hover:text-[#1d1d1f] shadow-2xs transition-all"
        >
          <Search className="h-3.5 w-3.5 text-[#37352f]/50 shrink-0" />
          <span className="truncate font-medium">Search</span>
          <kbd className="ml-auto font-mono text-[10px] text-[#37352f]/40 bg-black/[0.04] px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Scrollable Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-4">
        <button
          onClick={() => navigate("home")}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors text-left",
            view === "home"
              ? "bg-black/[0.07] text-[#1d1d1f] font-semibold"
              : "text-[#37352f]/80 hover:bg-black/[0.04] font-medium"
          )}
        >
          <Home className={cn("h-4 w-4 shrink-0", view === "home" ? "text-[#0071e3]" : "text-[#37352f]/55")} />
          <span>Overview</span>
        </button>

        <div className="space-y-1">
          <div className="px-2.5 py-0.5 text-[11px] font-medium text-[#37352f]/50">
            Categories
          </div>
          {CATEGORIES.map((cat) => {
            const tools = toolsByCategory(cat.id);
            const isExpanded = !!expandedCats[cat.id];
            const hasActiveChild = tools.some((t) => t.id === view);

            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCat(cat.id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors text-left",
                    hasActiveChild ? "text-[#1d1d1f] font-semibold" : "text-[#37352f]/80 hover:bg-black/[0.04] font-medium"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-[#37352f]/40 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-[#37352f]/40 shrink-0" />
                  )}
                  <CatIcon name={cat.icon} className="h-3.5 w-3.5 text-[#37352f]/55 shrink-0 mr-0.5" />
                  <span className="truncate">{cat.name}</span>
                </button>

                {isExpanded && (
                  <div className="pl-5 mt-0.5 space-y-0.5">
                    {tools.map((t) => {
                      const active = view === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => navigate(t.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-colors text-left truncate",
                            active
                              ? "bg-black/[0.07] text-[#1d1d1f] font-semibold"
                              : "text-[#37352f]/75 hover:bg-black/[0.04]"
                          )}
                        >
                          <CatIcon name={t.icon} className={cn("h-3 w-3 shrink-0", active ? "text-[#0071e3]" : "text-[#37352f]/45")} />
                          <span className="truncate">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent History */}
        {history.length > 0 && (
          <div className="space-y-0.5 pt-2 border-t border-black/[0.05]">
            <div className="px-2.5 py-1 text-[11px] font-medium text-[#37352f]/50 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Recent
            </div>
            {history.slice(0, 4).map((h, i) => {
              const t = getTool(h.toolId);
              if (!t) return null;
              return (
                <button
                  key={`${h.toolId}-${i}`}
                  onClick={() => navigate(h.toolId)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs text-[#37352f]/70 hover:bg-black/[0.04] truncate text-left"
                >
                  <CatIcon name={t.icon} className="h-3 w-3 text-[#37352f]/50 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky Top Breadcrumb Toolbar (Apple Finder / Notion Top Bar)      */
/* ------------------------------------------------------------------ */

function TopBar({
  sidebarOpen,
  onToggleSidebar,
  onOpenMobileSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}) {
  const { view, goHome, setSearchOpen } = useMathLab();
  const activeTool = view !== "home" ? getTool(view) : undefined;
  const activeCategory = activeTool ? CATEGORIES.find((c) => c.id === activeTool.category) : undefined;

  return (
    <header className="sticky top-0 z-30 h-12 w-full border-b border-black/[0.06] bg-white/85 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Desktop Collapse/Expand Toggle */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            title="Show sidebar (⌘\)"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {/* Mobile Drawer Trigger */}
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
          aria-label="Open menu"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
          <button
            onClick={goHome}
            className={cn(
              "hover:bg-zinc-100 px-1.5 py-0.5 rounded-md transition-colors",
              view === "home" ? "font-semibold text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            Home
          </button>
          {activeCategory && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
              <span className="truncate hidden sm:inline text-zinc-500">{activeCategory.name}</span>
            </>
          )}
          {activeTool && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
              <span className="font-semibold text-zinc-900 truncate">{activeTool.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-50 hover:bg-zinc-100 px-3 py-1 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <Search className="h-3 w-3" />
          <span>Search</span>
          <kbd className="font-mono text-[10px] text-zinc-400">⌘K</kbd>
        </button>

        <a
          href="https://github.com/ayushshaury/MathOML-Lab"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          title="GitHub Repository"
        >
          <Github className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Preview Window                                         */
/* ------------------------------------------------------------------ */

function HeroPlayground({ onOpenTool }: { onOpenTool: (id: string) => void }) {
  const [tab, setTab] = useState<"3d" | "2d" | "solver" | "calc">("3d");
  const [expr3d, setExpr3d] = useState("(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)");
  const [expr2d, setExpr2d] = useState("sin(x) + cos(2*x)/2");
  const [problemType, setProblemType] = useState<"derivative" | "integral" | "equation">("derivative");
  const [quickInput, setQuickInput] = useState("sin(pi/4) * sqrt(2)");

  const quickResult = useMemo(() => {
    if (!quickInput.trim()) return "";
    try {
      const res = math.evaluate(preprocess(quickInput));
      if (typeof res === "number") return fmt(res, 6);
      if (res && typeof res === "object" && "toString" in res) return res.toString();
      return String(res);
    } catch {
      return "Invalid expression";
    }
  }, [quickInput]);

  const spec2d = useMemo(() => ({
    curves: [{ label: `f(x) = ${expr2d}`, expr: expr2d, color: "#0071e3" }],
  }), [expr2d]);

  const liveSolution = useMemo(() => {
    try {
      if (problemType === "derivative") return differentiateSteps("x^3 * sin(x)", "x", 1);
      if (problemType === "integral") return integrateSteps("x^2 + 3*x", "x", false);
      return solveEquation("x^2 - 5*x + 6 = 0");
    } catch {
      return null;
    }
  }, [problemType]);

  return (
    <div className="w-full rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.025),0_8px_24px_rgba(0,0,0,0.03)] overflow-hidden text-left">
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200/70 bg-zinc-50/70 px-4 sm:px-5 py-2.5 gap-3">
        <span className="text-xs font-semibold text-zinc-700">Interactive Scratchpad</span>

        {/* Segmented Control */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-zinc-200/60 border border-zinc-200/70">
          {[
            { id: "3d", label: "3D Surface", icon: Mountain },
            { id: "2d", label: "2D Graph", icon: LineChart },
            { id: "solver", label: "Steps", icon: Equal },
            { id: "calc", label: "Calculate", icon: Calculator },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                tab === t.id
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <t.icon className="h-3 w-3" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenTool(
            tab === "3d" ? "graph-3d" : tab === "2d" ? "graph-2d" : tab === "solver" ? "equation-solver" : "calculator"
          )}
          className="text-xs gap-1 font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-lg h-7 px-2.5"
        >
          {tab === "3d" ? "Open 3D Plotter" : tab === "2d" ? "Open 2D Grapher" : tab === "solver" ? "Open Solver" : "Open Calculator"}{" "}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Tab 1: 3D Surface */}
      {tab === "3d" && (
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-medium text-zinc-400 shrink-0">Presets:</span>
              {[
                { name: "Sombrero", expr: "(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)" },
                { name: "Ripple", expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)" },
                { name: "Rosenbrock", expr: "log(1 + (1 - x)^2 + 10*(y - x^2)^2) / 3" },
                { name: "Ackley", expr: "-10*exp(-0.2*sqrt(0.5*(x^2 + y^2))) - 0.5*(cos(2*pi*x) + cos(2*pi*y)) + 10" },
                { name: "Saddle", expr: "x^3 - 3*x*y^2" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr3d(p.expr)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all shrink-0",
                    expr3d === p.expr
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-2xs"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/70 px-2.5 py-1 text-xs font-mono text-zinc-700">
              <span className="text-zinc-400">z =</span> {expr3d}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-zinc-200/80 bg-white">
            <Plot3D expr={expr3d} height={340} />
          </div>
        </div>
      )}

      {/* Tab 2: 2D Graph */}
      {tab === "2d" && (
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-medium text-zinc-400 shrink-0">Presets:</span>
              {[
                { name: "Harmonic", expr: "sin(x) + cos(2*x)/2" },
                { name: "Cubic", expr: "x^3 - 3*x" },
                { name: "Damped Sine", expr: "exp(-0.2*x)*sin(3*x)" },
                { name: "Gaussian", expr: "exp(-x^2/2)" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr2d(p.expr)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all shrink-0",
                    expr2d === p.expr
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-2xs"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/70 px-2.5 py-1 text-xs font-mono text-zinc-700">
              <span className="text-zinc-400">f(x) =</span> {expr2d}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-zinc-200/80 bg-white">
            <Plot2D spec={spec2d} height={340} />
          </div>
        </div>
      )}

      {/* Tab 3: Derivation Steps */}
      {tab === "solver" && (
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">Example:</span>
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
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-2xs"
                    : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {liveSolution && (
            <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/40 p-4 max-h-[340px] overflow-y-auto">
              <StepsView solution={liveSolution} />
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Quick Calculator */}
      {tab === "calc" && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Expression Evaluation</label>
            <Input
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="e.g. sqrt(144) * 5 + sin(pi/6)"
              className="font-mono text-base bg-white rounded-xl border-zinc-200 h-11"
            />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-1">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Result</div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-zinc-900 tabular-nums">
              {quickResult || "0"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-400 mr-1">Try:</span>
            {["sin(pi/3)", "sqrt(256) / 4", "2^10 - 1000", "log(100, 10)", "cos(pi/4)^2 + sin(pi/4)^2"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setQuickInput(f)}
                className="rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1 text-xs font-mono text-zinc-600 transition-colors"
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
/* Quick Search Bar                                                   */
/* ------------------------------------------------------------------ */

function HeroSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");
  const results = useMemo(() => searchTools(value).slice(0, 6), [value]);

  return (
    <div className="relative w-full">
      <form
        className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white shadow-2xs px-3.5 py-1 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-[#0071e3]/15 transition-all"
        onSubmit={(e) => {
          e.preventDefault();
          if (results.length) onSearch(results[0].id);
          else if (value.trim()) onSearch("equation-solver");
        }}
      >
        <Search className="h-4 w-4 text-zinc-400 shrink-0" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search EDA, machine learning, derivatives, matrices, OCR..."
          className="border-0 shadow-none focus-visible:ring-0 h-9 text-sm bg-transparent placeholder:text-zinc-400 text-zinc-900"
          aria-label="Search workspace"
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0 gap-1 rounded-lg font-medium bg-[#1d1d1f] hover:bg-zinc-800 text-white h-7 px-3 text-xs"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Button>
      </form>

      {value && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden text-left">
          {results.length === 0 ? (
            <p className="p-4 text-xs text-zinc-500">
              Press Enter to open Equation Solver.
            </p>
          ) : (
            results.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category);
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0"
                  onClick={() => onSearch(t.id)}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 shrink-0">
                    <CatIcon name={t.icon} className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{t.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{t.description}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-medium text-zinc-400 shrink-0 border border-zinc-200 rounded px-1.5 py-0.5">
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
/* Compact Notion Tool Card                                           */
/* ------------------------------------------------------------------ */

function ToolCard({ toolId, onOpen }: { toolId: string; onOpen: (id: string) => void }) {
  const tool = TOOLS.find((t) => t.id === toolId)!;

  return (
    <button
      onClick={() => onOpen(tool.id)}
      className="group flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white p-3.5 text-left hover:border-zinc-300 hover:shadow-xs transition-all"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 group-hover:bg-[#1d1d1f] group-hover:text-white transition-colors shrink-0 mt-0.5">
        <CatIcon name={tool.icon} className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm text-zinc-900 truncate">{tool.name}</p>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-700 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
        <p className="text-xs text-zinc-500 mt-0.5 leading-snug line-clamp-1">{tool.description}</p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Home View                                                          */
/* ------------------------------------------------------------------ */

function HomeView() {
  const { openTool } = useMathLab();
  const [selectedCat, setSelectedCat] = useState<string>("all");

  const filteredCategories = useMemo(() => {
    if (selectedCat === "all") return CATEGORIES;
    return CATEGORIES.filter((c) => c.id === selectedCat);
  }, [selectedCat]);

  return (
    <div className="space-y-10 pb-12 max-w-5xl mx-auto">
      {/* Header & Search */}
      <section className="pt-2 sm:pt-4 space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
            MathOML
          </h1>
          <p className="text-sm text-zinc-500 max-w-2xl">
            Exploratory data analysis, interactive machine learning, 2D/3D graphing, and step-by-step symbolic mathematics.
          </p>
        </div>

        <HeroSearch onSearch={(id) => openTool(id)} />
      </section>

      {/* Primary Workspaces */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Primary Workspaces
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: "eda-studio",
              title: "EDA Studio",
              desc: "Upload CSV files, inspect statistics, render 2D/3D Plotly charts, clean data, and export PDFs.",
              icon: BarChart3,
              accent: "bg-sky-50 text-[#0071e3] border-sky-100",
            },
            {
              id: "ml-arena",
              title: "Machine Learning",
              desc: "Regression, SVM, KNN, optimizers, K-Means, PCA, and Q-Learning simulations.",
              icon: Brain,
              accent: "bg-indigo-50 text-indigo-600 border-indigo-100",
            },
            {
              id: "graph-3d",
              title: "3D & 2D Graphing",
              desc: "Multivariable surface plotting, parameter sliders, contour maps, and implicit curves.",
              icon: Mountain,
              accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
            },
            {
              id: "image-to-equation",
              title: "Image to Equation",
              desc: "Extract handwritten or printed expressions and matrices from photos.",
              icon: ScanLine,
              accent: "bg-amber-50 text-amber-700 border-amber-100",
            },
          ].map((card) => (
            <button
              key={card.id}
              onClick={() => openTool(card.id)}
              className="group rounded-2xl border border-zinc-200/80 bg-white p-5 text-left apple-card flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", card.accent)}>
                  <card.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{card.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{card.desc}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs font-medium text-zinc-500 group-hover:text-zinc-900 transition-colors">
                <span>Open</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Interactive Scratchpad */}
      <section>
        <HeroPlayground onOpenTool={(id) => openTool(id)} />
      </section>

      {/* Categorized Tools Directory */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/70 pb-3">
          <h2 className="text-base font-bold tracking-tight text-zinc-900">All Tools</h2>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCat("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0",
                selectedCat === "all"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
              )}
            >
              All ({TOOLS.length})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0",
                  selectedCat === cat.id
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {filteredCategories.map((cat: Category) => {
            const tools = toolsByCategory(cat.id);
            return (
              <div key={cat.id} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <CatIcon name={cat.icon} className="h-3.5 w-3.5 text-zinc-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{cat.name}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tools.map((t) => (
                    <ToolCard key={t.id} toolId={t.id} onOpen={openTool} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Application Shell (Desktop Sidebar + Sticky Workspace)        */
/* ------------------------------------------------------------------ */

export default function Page() {
  const { view, viewNonce } = useMathLab();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const Tool = TOOL_COMPONENTS[view];

  // Keyboard shortcut ⌘\ or Ctrl+\ to toggle sidebar cleanly (just like Notion & VS Code)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  return (
    <div className="flex min-h-screen w-full bg-[#fbfbfa]">
      {/* Desktop Sticky Collapsible Notion Sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">
        <WorkspaceSidebar
          open={sidebarOpen}
          onCloseMobile={() => setMobileDrawerOpen(false)}
          onToggleDesktop={() => setSidebarOpen((p) => !p)}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs" onClick={() => setMobileDrawerOpen(false)} />
          <div className="relative z-10 h-full">
            <WorkspaceSidebar
              open={true}
              onCloseMobile={() => setMobileDrawerOpen(false)}
              onToggleDesktop={() => {}}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          onOpenMobileSidebar={() => setMobileDrawerOpen(true)}
        />

        <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8">
          {view === "home" ? <HomeView /> : Tool ? <Tool key={`${view}-${viewNonce}`} /> : <HomeView />}
        </main>

        <footer className="mt-auto border-t border-black/[0.05] bg-white/60">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center gap-3 justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-700">MathOML</span>
              <span>— Mathematics, Data Analysis &amp; Machine Learning</span>
            </div>
            <a
              href="https://github.com/ayushshaury/MathOML-Lab"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 flex items-center gap-1 transition-colors"
            >
              <Github className="h-3.5 w-3.5" /> Source
            </a>
          </div>
        </footer>
      </div>

      <SearchPalette />
    </div>
  );
}
