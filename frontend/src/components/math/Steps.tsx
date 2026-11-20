"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListChecks, AlertTriangle, Info, Copy, CheckCircle2 } from "lucide-react";
import { MathText } from "./MathText";
import type { Solution } from "@/lib/math/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Step-by-step solution renderer with collapsible steps. */
export function StepsView({ solution }: { solution: Solution }) {
  const [collapsed, setCollapsed] = useState(false);
  if (solution.error && solution.steps.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">Calculation error</p>
          <p className="text-sm text-destructive/90 mt-1">{solution.error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* final result */}
      {solution.resultTex && (
        <div className="rounded-xl border-2 border-emerald-600/30 bg-emerald-600/5 dark:bg-emerald-400/10 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Result</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => {
                navigator.clipboard?.writeText(solution.resultText ?? solution.resultTex ?? "").then(
                  () => toast.success("Result copied to clipboard"),
                  () => toast.error("Could not copy")
                );
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <MathText tex={solution.resultTex} display className="text-lg sm:text-xl" />
        </div>
      )}

      {/* error note with partial steps */}
      {solution.error && solution.steps.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2 items-start text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{solution.error}</span>
        </div>
      )}

      {/* steps */}
      <div>
        <button
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <ListChecks className="h-4 w-4" />
          Step-by-step explanation ({solution.steps.length} {solution.steps.length === 1 ? "step" : "steps"})
        </button>
        {!collapsed && (
          <ol className="mt-3 space-y-0">
            {solution.steps.map((step, i) => (
              <li key={i} className="relative pl-9 pb-4 last:pb-0">
                {/* timeline line */}
                {i < solution.steps.length - 1 && (
                  <span className="absolute left-[13px] top-8 bottom-0 w-px bg-border" aria-hidden />
                )}
                {/* number bubble */}
                <span
                  className={cn(
                    "absolute left-0 top-0.5 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
                    i === solution.steps.length - 1
                      ? "bg-emerald-600 text-white"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{step.title}</p>
                  {step.explanation && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.explanation}</p>
                  )}
                  {step.math && (
                    <div className="mt-2 rounded-lg bg-muted/60 dark:bg-muted/30 px-3 py-2 overflow-x-auto">
                      <MathText tex={step.isTex ? step.math : step.math} display className="text-base" />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* notes */}
      {solution.notes && solution.notes.length > 0 && (
        <div className="space-y-2">
          {solution.notes.map((note, i) => (
            <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2 items-start text-sm">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact header shown above the input of each tool. */
export function SolutionPending() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <CheckCircle2 className="h-8 w-8 opacity-40" />
      <p className="text-sm">Enter your problem and press Solve to see the full working.</p>
    </div>
  );
}
