"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import {
  Sigma, Search, Home, ArrowRight,
  Equal, Shuffle, Layers, TrendingUp, SquareStack, MoveRight, GitBranch, Infinity as InfinityIcon,
  ListOrdered, Grid3x3, SquareDashed, Waves, Compass, Triangle, Shapes, BarChart3, Dice5,
  LineChart, Mountain, Calculator, ScanLine, Github, Brain, ChevronRight, ChevronDown,
  PanelLeft, PanelLeftClose, X, FlaskConical, Clock, Sparkles, Cpu, Box, FileSpreadsheet, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMathLab } from "@/lib/store";
import { CATEGORIES, EXAMPLES, TOOLS, searchTools, toolsByCategory, getTool, type Category } from "@/lib/tools";
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

const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

function MathOMLWordmark({ size = "nav" }: { size?: "hero" | "nav" }) {
  if (size === "hero") {
    return (
      <span className="brand-wordmark inline-flex items-baseline text-3xl sm:text-[40px] leading-none tracking-[-0.045em] select-none">
        <span className="font-extrabold text-[#1d1d1f]">Math</span>
        <span className="font-editorial italic font-normal text-[1.1em] bg-gradient-to-br from-[#0071e3] via-[#2563eb] to-[#4f46e5] bg-clip-text text-transparent pl-0.5 pr-1">
          OML
        </span>
      </span>
    );
  }
  return (
    <span className="brand-wordmark inline-flex items-baseline text-[14.5px] leading-none tracking-[-0.03em] select-none">
      <span className="font-bold text-[#1d1d1f]">Math</span>
      <span className="font-editorial italic font-normal text-[1.08em] text-[#0071e3] pl-[1px] pr-0.5">
        OML
      </span>
    </span>
  );
}

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
          {query ? `No results for “${query}”.` : "Search calculators, solvers, graphing, or EDA."}
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
          <span className="apple-clay-dark flex h-6 w-6 items-center justify-center rounded-md text-white">
            <Sigma className="h-3.5 w-3.5" />
          </span>
          <MathOMLWordmark size="nav" />
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
  const { scrollYProgress } = useScroll();
  const scrollScaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 28, restDelta: 0.001 });

  return (
    <header className="sticky top-0 z-30 h-12 w-full border-b border-black/[0.06] bg-white/70 backdrop-blur-2xl flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Desktop Collapse/Expand Toggle */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/90 border border-black/[0.06] bg-white/70 shadow-2xs transition-all text-xs font-medium"
            title="Open workspace sidebar (⌘\)"
          >
            <PanelLeft className="h-3.5 w-3.5" />
            <span className="hidden xl:inline text-[11px] font-normal text-zinc-400">Sidebar</span>
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
            className="hover:bg-black/[0.05] px-2 py-1 rounded-lg transition-colors inline-flex items-center"
          >
            <MathOMLWordmark size="nav" />
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
          className="glass-pill hidden sm:flex items-center gap-2 rounded-full px-3 py-1 text-xs text-zinc-500 hover:text-zinc-800"
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

      {view === "home" && (
        <motion.div
          style={{ scaleX: scrollScaleX, transformOrigin: "0% 50%" }}
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-[#0071e3] via-[#3b82f6] to-[#4f46e5]"
        />
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Preview Window (Frosted Glass macOS Chrome)            */
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
    <div className="apple-glass-card w-full rounded-[24px] overflow-hidden text-left">
      {/* Frosted macOS Toolbar Chrome */}
      <div className="flex flex-wrap items-center justify-between border-b border-black/[0.06] bg-white/60 backdrop-blur-md px-3.5 sm:px-4 py-2.5 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300/90 inline-block shadow-inner" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300/90 inline-block shadow-inner" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300/90 inline-block shadow-inner" />
        </div>

        {/* Claymorphic Segmented Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-200/55 border border-white/80 shadow-inner">
          {[
            { id: "3d", label: "3D Surface", icon: Mountain },
            { id: "2d", label: "2D Graph", icon: LineChart },
            { id: "solver", label: "Steps", icon: Equal },
            { id: "calc", label: "Calculate", icon: Calculator },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as "3d" | "2d" | "solver" | "calc")}
                className={cn(
                  "relative flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
                  active ? "text-zinc-900 font-semibold" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="hero-stage-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="apple-clay-surface absolute inset-0 rounded-full"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <t.icon className="h-3 w-3" />
                  <span>{t.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenTool(
            tab === "3d" ? "graph-3d" : tab === "2d" ? "graph-2d" : tab === "solver" ? "equation-solver" : "calculator"
          )}
          className="text-xs gap-1 font-medium text-[#0071e3] hover:text-[#0077ed] hover:bg-sky-50/70 rounded-full h-7 px-2.5"
        >
          Open <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Tab 1: 3D Surface */}
      {tab === "3d" && (
        <div className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {[
                { name: "Sombrero", expr: "(1 - (x^2 + y^2)/4) * exp(-(x^2 + y^2)/4)" },
                { name: "Ripple", expr: "sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + 0.1)" },
                { name: "Rosenbrock", expr: "log(1 + (1 - x)^2 + 10*(y - x^2)^2) / 3" },
                { name: "Saddle", expr: "x^3 - 3*x*y^2" },
              ].map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setExpr3d(p.expr)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all shrink-0",
                    expr3d === p.expr
                      ? "apple-clay-dark text-white"
                      : "glass-pill text-zinc-700"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-white/80 border border-black/[0.06] px-2.5 py-0.5 text-[11px] font-mono text-zinc-600 truncate max-w-full shadow-2xs">
              <span className="text-zinc-400">z =</span> {expr3d}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-black/[0.07] bg-white shadow-inner">
            <Plot3D expr={expr3d} height={310} />
          </div>
        </div>
      )}

      {/* Tab 2: 2D Graph */}
      {tab === "2d" && (
        <div className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
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
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all shrink-0",
                    expr2d === p.expr
                      ? "apple-clay-dark text-white"
                      : "glass-pill text-zinc-700"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-white/80 border border-black/[0.06] px-2.5 py-0.5 text-[11px] font-mono text-zinc-600 shadow-2xs">
              <span className="text-zinc-400">f(x) =</span> {expr2d}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-black/[0.07] bg-white shadow-inner">
            <Plot2D spec={spec2d} height={310} />
          </div>
        </div>
      )}

      {/* Tab 3: Derivation Steps */}
      {tab === "solver" && (
        <div className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
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
                  "rounded-full px-2.5 py-0.5 text-[11px] font-mono transition-all",
                  problemType === p.type
                    ? "apple-clay-dark text-white"
                    : "glass-pill text-zinc-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {liveSolution && (
            <div className="rounded-2xl border border-black/[0.06] bg-white/85 p-3.5 h-[310px] overflow-y-auto shadow-inner">
              <StepsView solution={liveSolution} />
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Quick Calculator */}
      {tab === "calc" && (
        <div className="p-3.5 sm:p-4 space-y-4 h-[370px] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Expression</label>
              <Input
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="e.g. sqrt(144) * 5 + sin(pi/6)"
                className="font-mono text-sm bg-white/90 rounded-xl border-zinc-200/80 h-10 shadow-inner"
              />
            </div>

            <div className="apple-clay-surface rounded-2xl p-4 space-y-1">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Result</div>
              <div className="text-2xl font-mono font-bold text-zinc-900 tabular-nums">
                {quickResult || "0"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-black/[0.06]">
            <span className="text-[11px] font-medium text-zinc-400 mr-1">Examples:</span>
            {["sin(pi/3)", "sqrt(256) / 4", "2^10 - 1000", "log(100, 10)"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setQuickInput(f)}
                className="glass-pill rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-700"
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
/* Quick Spotlight Search Bar (Frosted Glass)                         */
/* ------------------------------------------------------------------ */

function HeroSearch({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");
  const results = useMemo(() => searchTools(value).slice(0, 6), [value]);

  return (
    <div className="relative w-full">
      <form
        className="glass-panel flex items-center gap-2 rounded-2xl px-3.5 py-1.5 focus-within:ring-2 focus-within:ring-[#0071e3]/20 transition-all"
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
          placeholder="Search EDA, machine learning, calculus, matrices, or OCR..."
          className="border-0 shadow-none focus-visible:ring-0 h-8 text-xs sm:text-sm bg-transparent placeholder:text-zinc-400 text-zinc-900 px-1"
          aria-label="Search workspace"
        />
        <Button
          type="submit"
          size="sm"
          className="apple-clay-dark shrink-0 gap-1 rounded-xl font-medium text-white h-7.5 px-3 text-xs border-0"
        >
          Go <ArrowRight className="h-3 w-3" />
        </Button>
      </form>

      {value && (
        <div className="apple-glass-card absolute z-30 mt-2 w-full rounded-2xl overflow-hidden text-left shadow-xl">
          {results.length === 0 ? (
            <p className="p-3.5 text-xs text-zinc-500">
              Press Enter to evaluate in Equation Solver.
            </p>
          ) : (
            results.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category);
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-black/[0.04] transition-colors border-b border-black/[0.05] last:border-0"
                  onClick={() => onSearch(t.id)}
                >
                  <div className="apple-clay-surface flex h-7 w-7 items-center justify-center rounded-lg text-zinc-700 shrink-0">
                    <CatIcon name={t.icon} className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{t.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{t.description}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-medium text-zinc-400 shrink-0 border border-black/[0.08] bg-white/70 rounded-full px-2 py-0.5">
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
/* Directory Tool Card (Clay + Glass)                                 */
/* ------------------------------------------------------------------ */

function ToolCard({
  toolId,
  onOpen,
  showCategoryBadge = false,
}: {
  toolId: string;
  onOpen: (id: string) => void;
  showCategoryBadge?: boolean;
}) {
  const tool = TOOLS.find((t) => t.id === toolId)!;
  const cat = CATEGORIES.find((c) => c.id === tool.category);
  const exampleRaw = EXAMPLES[tool.id]?.[0];
  const exampleText = exampleRaw ? exampleRaw.replace(/\n/g, " ; ") : null;

  return (
    <button
      onClick={() => onOpen(tool.id)}
      className="group apple-glass-card flex flex-col justify-between rounded-2xl p-4 text-left"
    >
      <div className="space-y-2.5 w-full">
        <div className="flex items-center justify-between gap-2">
          <span className="apple-clay-surface flex h-9 w-9 items-center justify-center rounded-xl text-zinc-700 group-hover:text-[#0071e3] transition-colors shrink-0">
            <CatIcon name={tool.icon} className="h-4 w-4" />
          </span>
          {showCategoryBadge ? (
            <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-medium text-zinc-500 truncate">
              {cat?.name}
            </span>
          ) : (
            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-800 group-hover:translate-x-0.5 transition-all shrink-0" />
          )}
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-sm text-zinc-900 leading-snug">{tool.name}</p>
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{tool.description}</p>
        </div>
      </div>

      {exampleText && (
        <div className="mt-3 pt-2.5 border-t border-black/[0.05] w-full flex items-center justify-between gap-2">
          <code className="text-[11px] font-mono text-zinc-600 bg-white/80 border border-black/[0.06] rounded-lg px-2 py-0.5 truncate max-w-[200px]">
            {exampleText}
          </code>
          <span className="text-[11px] font-medium text-zinc-400 group-hover:text-[#0071e3] transition-colors shrink-0">
            Open
          </span>
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 3D Spatial Logo & Interactive Animation Stage                      */
/* ------------------------------------------------------------------ */

const SPATIAL_LOGOS = [
  {
    id: "eda-studio",
    label: "EDA Studio",
    tag: "Data & 3D Plotly",
    gradient: "linear-gradient(145deg, #38bdf8 0%, #0071e3 55%, #1d4ed8 100%)",
    glow: "rgba(0, 113, 227, 0.35)",
    floatDelay: 0,
    zDepth: 44,
    svg: (
      <svg viewBox="0 0 48 48" className="h-8 w-8 drop-shadow-md" fill="none">
        <path d="M24 6L40 15V33L24 42L8 33V15L24 6Z" fill="white" fillOpacity="0.18" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M24 24L40 15M24 24L8 15M24 24V42" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="14" y="21" width="5" height="11" rx="1.5" fill="white" fillOpacity="0.92" transform="skewY(26)" />
        <rect x="22" y="15" width="5" height="15" rx="1.5" fill="white" transform="skewY(-26)" />
      </svg>
    ),
  },
  {
    id: "graph-3d",
    label: "3D Surfaces",
    tag: "WebGL Manifolds",
    gradient: "linear-gradient(145deg, #22d3ee 0%, #0284c7 60%, #0369a1 100%)",
    glow: "rgba(14, 165, 233, 0.35)",
    floatDelay: 0.4,
    zDepth: 52,
    svg: (
      <svg viewBox="0 0 48 48" className="h-8 w-8 drop-shadow-md" fill="none">
        <circle cx="24" cy="24" r="15" fill="white" fillOpacity="0.14" stroke="white" strokeWidth="1.75" />
        <ellipse cx="24" cy="24" rx="15" ry="6" stroke="white" strokeWidth="1.5" strokeOpacity="0.85" />
        <ellipse cx="24" cy="24" rx="6" ry="15" stroke="white" strokeWidth="1.5" strokeOpacity="0.85" />
        <circle cx="24" cy="24" r="3" fill="white" />
      </svg>
    ),
  },
  {
    id: "ml-arena",
    label: "Machine Learning",
    tag: "Neural & Q-Learning",
    gradient: "linear-gradient(145deg, #818cf8 0%, #4f46e5 55%, #3730a3 100%)",
    glow: "rgba(99, 102, 241, 0.38)",
    floatDelay: 0.8,
    zDepth: 48,
    svg: (
      <svg viewBox="0 0 48 48" className="h-8 w-8 drop-shadow-md" fill="none">
        <path d="M13 15L24 9L35 15M13 33L24 39L35 33M13 15V33M35 15V33M13 15L35 33M35 15L13 33" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
        <circle cx="24" cy="9" r="3.2" fill="white" />
        <circle cx="13" cy="15" r="3.2" fill="white" />
        <circle cx="35" cy="15" r="3.2" fill="white" />
        <circle cx="24" cy="24" r="4" fill="white" />
        <circle cx="13" cy="33" r="3.2" fill="white" />
        <circle cx="35" cy="33" r="3.2" fill="white" />
        <circle cx="24" cy="39" r="3.2" fill="white" />
      </svg>
    ),
  },
  {
    id: "image-to-equation",
    label: "Equation OCR",
    tag: "Matrix & Formula",
    gradient: "linear-gradient(145deg, #34d399 0%, #059669 60%, #047857 100%)",
    glow: "rgba(16, 185, 129, 0.35)",
    floatDelay: 1.2,
    zDepth: 40,
    svg: (
      <svg viewBox="0 0 48 48" className="h-8 w-8 drop-shadow-md" fill="none">
        <path d="M15 9H11C9.9 9 9 9.9 9 11V15M33 9H37C38.1 9 39 9.9 39 11V15M15 39H11C9.9 39 9 38.1 9 37V33M33 39H37C38.1 39 39 38.1 39 37V33" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M17 19H31M17 24H26M17 29H29" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="31" cy="29" r="2.2" fill="white" />
      </svg>
    ),
  },
  {
    id: "derivative",
    label: "Calculus CAS",
    tag: "Symbolic Steps",
    gradient: "linear-gradient(145deg, #fbbf24 0%, #d97706 60%, #b45309 100%)",
    glow: "rgba(245, 158, 11, 0.35)",
    floatDelay: 1.6,
    zDepth: 50,
    svg: (
      <svg viewBox="0 0 48 48" className="h-8 w-8 drop-shadow-md" fill="none">
        <path d="M31 12C27.5 12 26 14.5 25 19L22 30C21 34.5 19.5 36 16 36" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M17 22H30" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="31" cy="12" r="2.5" fill="white" />
        <circle cx="16" cy="36" r="2.5" fill="white" />
      </svg>
    ),
  },
  {
    id: "eigen",
    label: "Linear Algebra",
    tag: "Tensors & Eigen",
    gradient: "linear-gradient(145deg, #fb7185 0%, #e11d48 60%, #be123c 100%)",
    glow: "rgba(244, 63, 94, 0.35)",
    floatDelay: 2.0,
    zDepth: 46,
    svg: (
      <svg viewBox="0 0 48 48" className="h-8 w-8 drop-shadow-md" fill="none">
        <path d="M14 11H11V37H14M34 11H37V37H34" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="16" y="16" width="6" height="6" rx="1.5" fill="white" />
        <rect x="26" y="16" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.65" />
        <rect x="16" y="26" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.65" />
        <rect x="26" y="26" width="6" height="6" rx="1.5" fill="white" />
      </svg>
    ),
  },
];

function SpatialLogoShowcase({ onOpenTool }: { onOpenTool: (id: string) => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), { stiffness: 140, damping: 20 });
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 140, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.75, ease: APPLE_EASE }}
      className="relative z-10"
      style={{ perspective: 1300 }}
    >
      <motion.div
        ref={stageRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="apple-glass-shell relative overflow-hidden rounded-[32px] px-5 py-8 sm:px-8 sm:py-10"
      >
        {/* Ambient Volumetric Backdrop Lights */}
        <div
          className="pointer-events-none absolute -top-20 left-1/4 h-64 w-64 rounded-full opacity-45 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0, 113, 227, 0.24) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none -bottom-20 right-1/4 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%)" }}
        />

        {/* Rotating 3D Orbital Ring Plane Behind Logos */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-50"
          style={{ transform: "translateZ(-20px) rotateX(68deg)" }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
            className="h-[440px] w-[440px] sm:h-[580px] sm:w-[580px] rounded-full border border-dashed border-[#0071e3]/25"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            className="absolute h-[290px] w-[290px] sm:h-[380px] sm:w-[380px] rounded-full border border-indigo-400/20"
          />
        </div>

        {/* Central 3D Core Crest + Surrounding 3D Floating App Logos */}
        <div
          className="relative z-10 flex flex-col items-center gap-7"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Levitating 3D Master MathOML Emblem */}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transform: "translateZ(48px)", transformStyle: "preserve-3d" }}
            className="flex flex-col items-center text-center gap-3"
          >
            <div className="relative group">
              <div
                className="absolute -inset-3 rounded-[28px] opacity-55 blur-xl transition-opacity duration-500 group-hover:opacity-85"
                style={{ background: "linear-gradient(135deg, #0071e3 0%, #4f46e5 100%)" }}
              />
              <div
                className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-[22px] shadow-2xl border border-white/25"
                style={{
                  background: "linear-gradient(145deg, #2c2c2e 0%, #18181b 55%, #09090b 100%)",
                  boxShadow:
                    "0 20px 38px -10px rgba(0, 0, 0, 0.35), inset 0 2px 3px rgba(255, 255, 255, 0.28), inset 0 -4px 8px rgba(0, 0, 0, 0.5)",
                }}
              >
                <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none">
                  <path
                    d="M45 16H19C18 16 17.5 17.1 18.2 17.9L32 32L18.2 46.1C17.5 46.9 18 48 19 48H45V41.5H29L38.8 32L29 22.5H45V16Z"
                    fill="white"
                  />
                  <path
                    d="M29 41.5H45V48H19C18 48 17.5 46.9 18.2 46.1L29 35.2V41.5Z"
                    fill="#38bdf8"
                  />
                  <circle cx="43.5" cy="32" r="3.2" fill="#0071e3" />
                </svg>
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0071e3]">
                Spatial Computing Suite
              </p>
              <h2 className="brand-wordmark text-lg sm:text-xl font-bold tracking-[-0.025em] text-zinc-900">
                Six Engines.{" "}
                <span className="font-editorial italic font-normal text-[1.15em] text-[#0071e3]">
                  One Studio.
                </span>
              </h2>
            </div>
          </motion.div>

          {/* 3D Floating Tactile Logo Dock */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5 w-full max-w-4xl"
            style={{ transformStyle: "preserve-3d" }}
          >
            {SPATIAL_LOGOS.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => onOpenTool(item.id)}
                animate={{ y: [-4, 4, -4] }}
                transition={{
                  duration: 4.2,
                  delay: item.floatDelay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                whileHover={{
                  scale: 1.07,
                  y: -8,
                  transition: { type: "spring", stiffness: 360, damping: 20 },
                }}
                whileTap={{ scale: 0.96 }}
                style={{ transform: `translateZ(${item.zDepth}px)`, transformStyle: "preserve-3d" }}
                className="group relative flex flex-col items-center gap-2.5 rounded-3xl bg-white/65 hover:bg-white/90 backdrop-blur-xl border border-white/85 p-3.5 shadow-[0_14px_30px_-12px_rgba(15,23,42,0.14)] hover:shadow-[0_22px_40px_-12px_rgba(0,113,227,0.22)] transition-colors cursor-pointer"
              >
                {/* 3D Squircle App Logo */}
                <div className="relative">
                  <div
                    className="absolute -inset-1.5 rounded-2xl opacity-0 group-hover:opacity-75 blur-lg transition-opacity duration-300"
                    style={{ background: item.glow }}
                  />
                  <div
                    className="relative flex h-14 w-14 items-center justify-center rounded-[18px] transition-transform duration-300 group-hover:rotate-3"
                    style={{
                      background: item.gradient,
                      boxShadow:
                        `0 14px 24px -8px ${item.glow}, inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -4px 8px rgba(0,0,0,0.22)`,
                    }}
                  >
                    {item.svg}
                  </div>
                </div>

                {/* Minimal Label */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-900 group-hover:text-[#0071e3] transition-colors leading-tight">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                    {item.tag}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Home View (Apple Claymorphism & Frosted Glass + Notion Restraint)  */
/* ------------------------------------------------------------------ */

function HomeView() {
  const { openTool } = useMathLab();
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [directoryFilter, setDirectoryFilter] = useState("");

  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const smoothHero = useSpring(heroScroll, { stiffness: 120, damping: 24, restDelta: 0.001 });
  const heroScale = useTransform(smoothHero, [0, 1], [1, 0.945]);
  const heroOpacity = useTransform(smoothHero, [0, 0.85, 1], [1, 0.72, 0.4]);
  const heroY = useTransform(smoothHero, [0, 1], [0, -24]);
  const heroLeftY = useTransform(smoothHero, [0, 1], [0, -28]);
  const heroRightY = useTransform(smoothHero, [0, 1], [0, 26]);
  const bentoRevealY = useTransform(smoothHero, [0, 0.85], [24, 0]);

  const filteredCategories = useMemo(() => {
    if (selectedCat === "all") return CATEGORIES;
    return CATEGORIES.filter((c) => c.id === selectedCat);
  }, [selectedCat]);

  const filterNormalized = directoryFilter.trim().toLowerCase();

  return (
    <div className="space-y-14 pb-16 max-w-6xl mx-auto">
      {/* ============================================================ */}
      {/* ARCHITECTURAL GLASS HERO WITH APPLE SCROLL CHOREOGRAPHY      */}
      {/* ============================================================ */}
      <div ref={heroRef} className="relative">
        {/* Soft Diffused Atmospheric Shapes Behind Frosted Glass Shell */}
        <div
          className="pointer-events-none -top-10 -left-10 absolute h-72 w-72 rounded-full opacity-75 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0, 113, 227, 0.22) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none top-1/3 right-12 absolute h-80 w-80 rounded-full opacity-65 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none -bottom-10 left-1/3 absolute h-64 w-64 rounded-full opacity-55 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, transparent 70%)" }}
        />

        <motion.section
          style={{ scale: heroScale, opacity: heroOpacity, y: heroY, willChange: "transform, opacity" }}
          className="apple-glass-shell relative overflow-hidden rounded-[32px] p-6 sm:p-8 lg:p-11 origin-top"
        >
          {/* Subtle Precision Dot Matrix */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage: "radial-gradient(rgba(24, 24, 27, 0.09) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              maskImage: "radial-gradient(ellipse at 65% 35%, black 35%, transparent 82%)",
              WebkitMaskImage: "radial-gradient(ellipse at 65% 35%, black 35%, transparent 82%)",
            }}
          />

          <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Hero Column: MathOML Brand, Luxury Headline & Actions */}
            <motion.div style={{ y: heroLeftY }} className="xl:col-span-5 space-y-6">
              {/* MathOML Display Brand Lockup */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: APPLE_EASE }}
                className="flex items-center gap-3.5"
              >
                <div className="apple-clay-dark flex h-12 w-12 items-center justify-center rounded-2xl text-white shrink-0">
                  <svg viewBox="0 0 64 64" className="h-7 w-7" fill="none">
                    <path
                      d="M45 16H19C18 16 17.5 17.1 18.2 17.9L32 32L18.2 46.1C17.5 46.9 18 48 19 48H45V41.5H29L38.8 32L29 22.5H45V16Z"
                      fill="white"
                    />
                    <path
                      d="M29 41.5H45V48H19C18 48 17.5 46.9 18.2 46.1L29 35.2V41.5Z"
                      fill="#38bdf8"
                    />
                    <circle cx="43.5" cy="32" r="3.2" fill="#0071e3" />
                  </svg>
                </div>
                <div>
                  <MathOMLWordmark size="hero" />
                  <p className="text-xs font-medium text-zinc-500 mt-1 tracking-tight">
                    Mathematics · Data Analysis · Machine Learning
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.68, delay: 0.08, ease: APPLE_EASE }}
                className="space-y-3"
              >
                <h1 className="brand-wordmark text-3xl sm:text-[34px] lg:text-[38px] font-bold tracking-[-0.035em] leading-[1.12] text-[#1d1d1f]">
                  Explore data,{" "}
                  <span className="font-editorial italic font-normal text-[1.14em] text-[#0071e3] pr-0.5">
                    visualize surfaces,
                  </span>{" "}
                  and solve math.
                </h1>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Inspect CSV files with 2D and 3D Plotly charts, run machine learning algorithms, plot functions, and compute calculus step by step.
                </p>
              </motion.div>

              {/* Claymorphic Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.68, delay: 0.16, ease: APPLE_EASE }}
                className="flex flex-wrap items-center gap-2.5"
              >
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => openTool("eda-studio")}
                  className="apple-clay-dark inline-flex items-center gap-1.5 rounded-xl px-4.5 h-10 text-xs font-semibold text-white cursor-pointer"
                >
                  Open EDA Studio <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => openTool("ml-arena")}
                  className="apple-clay-surface inline-flex items-center rounded-xl px-4 h-10 text-xs font-semibold text-zinc-900 cursor-pointer"
                >
                  Machine Learning
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => openTool("graph-3d")}
                  className="glass-pill inline-flex items-center rounded-xl px-3.5 h-10 text-xs font-medium text-[#0071e3] cursor-pointer"
                >
                  3D Surfaces →
                </motion.button>
              </motion.div>

              {/* Frosted Search + Quick Links */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.68, delay: 0.24, ease: APPLE_EASE }}
                className="space-y-2.5 pt-1"
              >
                <HeroSearch onSearch={(id) => openTool(id)} />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-400 font-medium mr-0.5">Popular:</span>
                  {[
                    { id: "derivative", label: "Derivatives" },
                    { id: "eigen", label: "Eigenvalues" },
                    { id: "image-to-equation", label: "Photo OCR" },
                    { id: "ode-solver", label: "ODE Solver" },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => openTool(q.id)}
                      className="glass-pill rounded-full px-2.5 py-0.5 text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Right Hero Column: Interactive Frosted Window with Keynote Glide */}
            <motion.div
              style={{ y: heroRightY }}
              initial={{ opacity: 0, y: 24, scale: 0.975 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.78, delay: 0.12, ease: APPLE_EASE }}
              className="xl:col-span-7"
            >
              <HeroPlayground onOpenTool={(id) => openTool(id)} />
            </motion.div>
          </div>
        </motion.section>
      </div>

      {/* ============================================================ */}
      {/* 3D SPATIAL LOGO & INTERACTIVE ANIMATION SHOWCASE             */}
      {/* ============================================================ */}
      <SpatialLogoShowcase onOpenTool={(id) => openTool(id)} />

      {/* ============================================================ */}
      {/* BENTO WORKSPACES SHOWCASE (SCROLL TRANSITION INTO MAIN PAGE) */}
      {/* ============================================================ */}
      <motion.section style={{ y: bentoRevealY }} className="relative space-y-5">
        <div
          className="pointer-events-none absolute top-12 left-1/4 h-72 w-72 rounded-full opacity-45 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0, 113, 227, 0.14) 0%, transparent 72%)" }}
        />
        <div
          className="pointer-events-none bottom-4 right-1/4 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 72%)" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.65, ease: APPLE_EASE }}
          className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-2"
        >
          <div>
            <h2 className="brand-wordmark text-xl font-bold tracking-[-0.025em] text-zinc-900">
              Featured{" "}
              <span className="font-editorial italic font-normal text-[1.12em] text-[#0071e3]">
                Workspaces
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tools for data analysis, machine learning, graphing, and equation recognition.
            </p>
          </div>
        </motion.div>

        {/* Row 1: Two Flagship Glass Cards with Clay App Icons */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* EDA Studio Bento */}
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.975 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.65, ease: APPLE_EASE }}
            className="h-full"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => openTool("eda-studio")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTool("eda-studio");
                }
              }}
              className="group apple-glass-card h-full cursor-pointer rounded-[24px] p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="apple-clay-blue flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                    <BarChart3 className="h-5 w-5" />
                  </span>
                  <span className="glass-pill rounded-full px-3 py-1 text-[11px] font-medium text-zinc-600">
                    CSV · Statistics · 3D Plotly · PDF
                  </span>
                </div>
                <div>
                  <h3 className="brand-wordmark text-base font-bold text-zinc-900">EDA Studio</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Upload CSV files for automatic schema profiling, outlier and correlation detection, 2D and 3D Plotly visualizations, data cleaning with undo/redo, and PDF reports.
                  </p>
                </div>
              </div>

              {/* Inner Clay Schematic: Distribution & Correlation */}
              <div className="apple-clay-surface rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-medium text-zinc-600">dataset_profile.csv</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="rounded-md bg-white border border-black/[0.07] px-2 py-0.5 text-zinc-700 shadow-2xs">
                      r = 0.84
                    </span>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-emerald-700">
                      0% Missing
                    </span>
                  </div>
                </div>
                <svg viewBox="0 0 320 58" className="w-full h-14 overflow-visible" aria-hidden="true">
                  {[18, 32, 46, 52, 40, 29, 20, 14, 10, 22, 35, 16].map((h, i) => (
                    <rect
                      key={i}
                      x={i * 26 + 4}
                      y={56 - h}
                      width="18"
                      height={h}
                      rx="4"
                      className={i >= 2 && i <= 4 ? "fill-[#0071e3]/85" : "fill-[#0071e3]/25"}
                    />
                  ))}
                  <path
                    d="M 10 44 C 45 28, 78 6, 106 8 C 145 12, 185 48, 220 42 C 255 36, 285 22, 310 46"
                    fill="none"
                    stroke="#1d1d1f"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                <span className="flex items-center gap-1">
                  Open EDA Studio <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="text-[11px] font-normal text-zinc-400">Clean Data · Export CSV &amp; PDF</span>
              </div>
            </div>
          </motion.div>

          {/* Machine Learning Bento */}
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.975 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.65, delay: 0.08, ease: APPLE_EASE }}
            className="h-full"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => openTool("ml-arena")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTool("ml-arena");
                }
              }}
              className="group apple-glass-card h-full cursor-pointer rounded-[24px] p-6 flex flex-col justify-between gap-5"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="apple-clay-indigo flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                    <Brain className="h-5 w-5" />
                  </span>
                  <span className="glass-pill rounded-full px-3 py-1 text-[11px] font-medium text-zinc-600">
                    Supervised · Unsupervised · RL
                  </span>
                </div>
                <div>
                  <h3 className="brand-wordmark text-base font-bold text-zinc-900">Machine Learning</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Experiment interactively with Linear &amp; Logistic Regression, SVM margins, KNN, Gradient Descent, Adam Optimizer comparisons, K-Means, PCA, and Q-Learning.
                  </p>
                </div>
              </div>

              {/* Inner Clay Schematic: Decision Boundary & Clusters */}
              <div className="apple-clay-surface rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-medium text-zinc-600">wᵀx + b = 0</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="rounded-md bg-white border border-black/[0.07] px-2 py-0.5 text-zinc-700 shadow-2xs">
                      R² = 0.96
                    </span>
                    <span className="rounded-md bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-indigo-700">
                      Adam · SGD
                    </span>
                  </div>
                </div>
                <svg viewBox="0 0 320 58" className="w-full h-14 overflow-visible" aria-hidden="true">
                  <line x1="16" y1="50" x2="304" y2="8" stroke="#1d1d1f" strokeWidth="1.75" strokeDasharray="4 3" />
                  {[
                    [34, 24], [58, 16], [84, 20], [108, 12], [138, 18], [164, 10],
                  ].map(([cx, cy], idx) => (
                    <circle key={`a-${idx}`} cx={cx} cy={cy} r="4.2" className="fill-[#0071e3]" />
                  ))}
                  {[
                    [174, 42], [202, 48], [228, 36], [254, 44], [280, 32], [296, 46],
                  ].map(([cx, cy], idx) => (
                    <circle key={`b-${idx}`} cx={cx} cy={cy} r="4.2" className="fill-indigo-500" />
                  ))}
                </svg>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold text-zinc-900">
                <span className="flex items-center gap-1">
                  Open Machine Learning <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="text-[11px] font-normal text-zinc-400">3D Loss · NumPy Code</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Row 2: Three Glass Feature Cards with Clay Icons */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Graphing 2D & 3D */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.6, ease: APPLE_EASE }}
            className="h-full"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => openTool("graph-3d")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTool("graph-3d");
                }
              }}
              className="group apple-glass-card h-full cursor-pointer rounded-[22px] p-5 text-left flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="apple-clay-emerald flex h-10 w-10 items-center justify-center rounded-xl text-white">
                    <Mountain className="h-4.5 w-4.5" />
                  </span>
                  <span className="glass-pill rounded-full px-2.5 py-0.5 text-[11px] font-mono text-zinc-500">
                    z = f(x, y)
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">2D &amp; 3D Graphing</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Plot 3D multivariable surfaces with orbital rotation, parameter animation sliders, roots, and tangent lines.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-900 flex items-center gap-1">
                  Open 3D <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTool("graph-2d");
                  }}
                  className="text-xs font-medium text-[#0071e3] hover:underline"
                >
                  Open 2D Grapher
                </button>
              </div>
            </div>
          </motion.div>

          {/* Image to Equation OCR */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.6, delay: 0.08, ease: APPLE_EASE }}
            className="h-full"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => openTool("image-to-equation")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTool("image-to-equation");
                }
              }}
              className="group apple-glass-card h-full cursor-pointer rounded-[22px] p-5 text-left flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="apple-clay-amber flex h-10 w-10 items-center justify-center rounded-xl text-white">
                    <ScanLine className="h-4.5 w-4.5" />
                  </span>
                  <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-mono text-zinc-600">
                    ∫ x² dx → x³/3
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Image to Equation</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Extract printed or handwritten equations and matrices from images and solve them step by step.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-xs font-semibold text-zinc-900">
                <span className="flex items-center gap-1">
                  Scan Image <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="text-[11px] font-normal text-zinc-400">Photo OCR · Matrices</span>
              </div>
            </div>
          </motion.div>

          {/* Symbolic Calculus & Linear Algebra */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.6, delay: 0.16, ease: APPLE_EASE }}
            className="h-full"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => openTool("derivative")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTool("derivative");
                }
              }}
              className="group apple-glass-card h-full cursor-pointer rounded-[22px] p-5 text-left flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="apple-clay-dark flex h-10 w-10 items-center justify-center rounded-xl text-white">
                    <Sigma className="h-4.5 w-4.5" />
                  </span>
                  <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-mono text-zinc-600">
                    Av = λv
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Calculus &amp; Linear Algebra</h3>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Step-by-step derivatives, integrals, Taylor series, ODEs, Gaussian elimination, and eigenvalues.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-900 flex items-center gap-1">
                  Calculus <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTool("eigen");
                  }}
                  className="text-xs font-medium text-[#0071e3] hover:underline"
                >
                  Open Matrices
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ============================================================ */}
      {/* CATEGORIZED TOOLS DIRECTORY WITH EXAMPLES                    */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: APPLE_EASE }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-black/[0.07] pb-3.5"
        >
          <div className="flex items-center gap-2.5">
            <h2 className="brand-wordmark text-xl font-bold tracking-[-0.025em] text-zinc-900">
              All{" "}
              <span className="font-editorial italic font-normal text-[1.12em] text-[#0071e3]">
                Tools
              </span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-200/50 border border-white/80 shadow-inner overflow-x-auto scrollbar-none">
              {[
                { id: "all", name: "All" },
                ...CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
              ].map((cat) => {
                const active = selectedCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCat(cat.id)}
                    className={cn(
                      "relative rounded-full px-3 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer",
                      active ? "text-zinc-900 font-semibold" : "text-zinc-600 hover:text-zinc-900"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="directory-cat-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="apple-clay-surface absolute inset-0 rounded-full"
                      />
                    )}
                    <span className="relative z-10">{cat.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative sm:w-48 shrink-0">
              <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={directoryFilter}
                onChange={(e) => setDirectoryFilter(e.target.value)}
                placeholder="Filter list..."
                className="h-8 pl-8 text-xs rounded-full border-white/90 bg-white/80 backdrop-blur-md shadow-2xs"
              />
            </div>
          </div>
        </motion.div>

        <div className="space-y-8">
          {filteredCategories.map((cat: Category) => {
            const tools = toolsByCategory(cat.id).filter((t) => {
              if (!filterNormalized) return true;
              return (
                t.name.toLowerCase().includes(filterNormalized) ||
                t.description.toLowerCase().includes(filterNormalized) ||
                t.keywords.some((k) => k.includes(filterNormalized))
              );
            });
            if (tools.length === 0) return null;

            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.08 }}
                transition={{ duration: 0.58, ease: APPLE_EASE }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CatIcon name={cat.icon} className="h-3.5 w-3.5 text-zinc-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{cat.name}</h3>
                  </div>
                  <span className="text-[11px] text-zinc-400">{cat.description}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {tools.map((t) => (
                    <ToolCard
                      key={t.id}
                      toolId={t.id}
                      onOpen={openTool}
                      showCategoryBadge={selectedCat === "all" && !!filterNormalized}
                    />
                  ))}
                </div>
              </motion.div>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="flex min-h-screen w-full bg-transparent">
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

        <footer className="mt-auto border-t border-black/[0.06] bg-white/65 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center gap-3 justify-between text-xs text-zinc-400">
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
