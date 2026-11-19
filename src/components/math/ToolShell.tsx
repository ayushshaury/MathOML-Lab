"use client";

import { ReactNode } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
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
    <div className="min-w-0 flex-1">
      {/* tool header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={goHome}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All tools
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{tool?.name ?? toolId}</h1>
          {category && <Badge variant="secondary" className="capitalize">{category.name}</Badge>}
        </div>
        {tool && <p className="mt-1.5 text-muted-foreground max-w-2xl">{tool.description}</p>}
      </div>

      {children}

      {/* input + result grid */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <section aria-label="Input" className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
          {inputPanel}
        </section>
        <section aria-label="Solution" className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm lg:sticky lg:top-20">
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
    <div className="flex flex-wrap items-center gap-1.5 mt-3">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3" /> Try:
      </span>
      {examples.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onPick(ex)}
          className="rounded-full border bg-background px-2.5 py-1 font-mono text-xs hover:border-primary/50 hover:bg-accent transition-colors"
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
      className={cn("h-11 px-6 text-base font-semibold", className)}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Computing…
        </>
      ) : (
        label
      )}
    </Button>
  );
}
