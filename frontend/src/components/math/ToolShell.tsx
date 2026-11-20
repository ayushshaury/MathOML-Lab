"use client";

import { ReactNode } from "react";
import { ArrowLeft, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMathLab } from "@/lib/store";
import { getTool, CATEGORIES } from "@/lib/tools";
import { cn } from "@/lib/utils";

/** Standard layout for every tool page. */
export function ToolShell({
  toolId,
  children,
  inputPanel,
  resultPanel,
}: {
  toolId: string;
  children?: ReactNode;
  inputPanel: ReactNode;
  resultPanel: ReactNode;
}) {
  const { goHome } = useMathLab();
  const tool = getTool(toolId);
  const category = tool ? CATEGORIES.find((c) => c.id === tool.category) : undefined;

  return (
    <div className="min-w-0 flex-1 space-y-6">
      {/* tool header */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-8 shadow-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-2xl" aria-hidden />

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground glass-pill gap-1.5 rounded-full px-3"
            onClick={goHome}
          >
            <ArrowLeft className="h-4 w-4" /> Return to Laboratory
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {tool?.name ?? toolId}
            </h1>
            {category && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Terminal className="h-3 w-3" /> {category.name}
              </span>
            )}
          </div>
          {tool && (
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
              {tool.description}
            </p>
          )}
        </div>
      </div>

      {children}

      {/* input + result grid */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section
          aria-label="Input"
          className="rounded-3xl glass-panel p-5 sm:p-7 shadow-lg relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 opacity-60" />
          {inputPanel}
        </section>
        <section
          aria-label="Solution"
          className="rounded-3xl glass-panel p-5 sm:p-7 shadow-lg lg:sticky lg:top-24 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 opacity-60" />
          {resultPanel}
        </section>
      </div>
    </div>
  );
}

/** Row of clickable example inputs. */
export function ExampleChips({ examples, onPick }: { examples: string[]; onPick: (v: string) => void }) {
  if (!examples.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/40">
      <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> 1-Click:
      </span>
      {examples.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onPick(ex)}
          className="rounded-full border border-border/60 bg-background/60 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-500 px-3 py-1 font-mono text-xs transition-all active:scale-95"
        >
          {ex.length > 34 ? ex.slice(0, 32) + "…" : ex}
        </button>
      ))}
    </div>
  );
}

/** Solve button with loading state. */
export function SolveButton({
  onClick,
  loading,
  label = "Compute Result",
  className,
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "h-12 px-7 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-950/20 active:scale-95 transition-all",
        className
      )}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Computing Engine…
        </>
      ) : (
        label
      )}
    </Button>
  );
}
