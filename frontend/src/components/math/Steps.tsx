"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListChecks, AlertTriangle, Info, Copy, CheckCircle2 } from "lucide-react";
import { MathText } from "./MathText";
import type { Solution } from "@/lib/math/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Step-by-step solution renderer with collapsible steps in Apple/Notion style. */
export function StepsView({ solution }: { solution: Solution }) {
  const [collapsed, setCollapsed] = useState(false);

  if (solution.error && solution.steps.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 flex gap-3 items-start text-red-900">
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">Calculation Error</p>
          <p className="text-xs text-red-700 mt-1">{solution.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Final Result Card */}
      {solution.resultTex && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Evaluated Result
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 rounded-lg border-zinc-200 hover:bg-white text-zinc-700"
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
          <div className="pt-1">
            <MathText tex={solution.resultTex} display className="text-lg sm:text-xl text-zinc-900 font-semibold" />
          </div>
        </div>
      )}

      {/* Partial error notice */}
      {solution.error && solution.steps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex gap-2 items-start text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{solution.error}</span>
        </div>
      )}

      {/* Step-by-Step Derivation */}
      <div className="pt-1">
        <button
          className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors w-full text-left py-1"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
          <ListChecks className="h-4 w-4 text-zinc-500" />
          <span>Step-by-step derivation ({solution.steps.length} {solution.steps.length === 1 ? "step" : "steps"})</span>
        </button>

        {!collapsed && (
          <ol className="mt-4 space-y-0">
            {solution.steps.map((step, i) => (
              <li key={i} className="relative pl-9 pb-5 last:pb-1">
                {/* Timeline connector line */}
                {i < solution.steps.length - 1 && (
                  <span className="absolute left-[13px] top-8 bottom-0 w-px bg-zinc-200" aria-hidden />
                )}
                {/* Number badge */}
                <span
                  className={cn(
                    "absolute left-0 top-0.5 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shadow-2xs",
                    i === solution.steps.length - 1
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-200 text-zinc-700"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 leading-snug">{step.title}</p>
                  {step.explanation && (
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{step.explanation}</p>
                  )}
                  {step.math && (
                    <div className="mt-2.5 rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2.5 overflow-x-auto shadow-2xs">
                      <MathText tex={step.isTex ? step.math : step.math} display className="text-sm sm:text-base text-zinc-900" />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Methodological Notes */}
      {solution.notes && solution.notes.length > 0 && (
        <div className="space-y-2 pt-2">
          {solution.notes.map((note, i) => (
            <div key={i} className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-3 flex gap-2 items-start text-xs text-zinc-600">
              <Info className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Clean empty state shown before calculation. */
export function SolutionPending() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-zinc-400 gap-2 text-center">
      <CheckCircle2 className="h-7 w-7 text-zinc-300" />
      <p className="text-xs font-medium text-zinc-600">Enter your problem on the left and select Solve.</p>
      <p className="text-[11px] text-zinc-400 max-w-xs">Detailed mathematical steps and analytical explanations will render here.</p>
    </div>
  );
}
