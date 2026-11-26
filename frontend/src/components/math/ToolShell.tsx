"use client";

import { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMathLab } from "@/lib/store";
import { getTool, CATEGORIES } from "@/lib/tools";
import { cn } from "@/lib/utils";

/** Standard Notion & Apple-styled layout for tool workspaces. */
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
    <div className="min-w-0 flex-1 space-y-6 max-w-7xl mx-auto">
      {/* Apple / Notion Breadcrumb & Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_24px_rgba(0,0,0,0.02)] space-y-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
          <button
            onClick={goHome}
            className="hover:text-zinc-900 transition-colors flex items-center gap-1 text-zinc-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Workspace
          </button>
          {category && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
              <span>{category.name}</span>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-900 font-semibold">{tool?.name ?? toolId}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                {tool?.name ?? toolId}
              </h1>
              {category && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-100/70 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  {category.name}
                </span>
              )}
            </div>
            {tool && (
              <p className="text-sm text-zinc-500 max-w-3xl leading-relaxed">
                {tool.description}
              </p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goHome}
            className="rounded-xl border-zinc-200 text-xs font-medium self-start sm:self-auto gap-1.5 hover:bg-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return Home
          </Button>
        </div>
      </div>

      {children}

      {/* Input + Result Grid */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section
          aria-label="Input Configuration"
          className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)] transition-all"
        >
          {inputPanel}
        </section>
        <section
          aria-label="Solution & Steps"
          className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.02)] lg:sticky lg:top-24 transition-all"
        >
          {resultPanel}
        </section>
      </div>
    </div>
  );
}

/** Row of clickable example inputs with Notion-style chips. */
export function ExampleChips({ examples, onPick }: { examples: string[]; onPick: (v: string) => void }) {
  if (!examples.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-zinc-100">
      <span className="text-xs font-medium text-zinc-500 flex items-center gap-1 mr-1">
        <Sparkles className="h-3 w-3 text-zinc-400" /> Presets:
      </span>
      {examples.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onPick(ex)}
          className="rounded-lg border border-zinc-200/70 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-700 px-2.5 py-1 font-mono text-xs transition-all active:scale-[0.98]"
        >
          {ex.length > 34 ? ex.slice(0, 32) + "…" : ex}
        </button>
      ))}
    </div>
  );
}

export function SolveButton({
  onClick,
  loading,
  label = "Solve",
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
        "rounded-xl font-medium bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs px-5 h-10 transition-all",
        className
      )}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Computing…
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
