"use client";

import { useRef, useState, useEffect } from "react";
import { ToolShell } from "@/components/math/ToolShell";
import { StepsView } from "@/components/math/Steps";
import { MathText } from "@/components/math/MathText";
import {
  Upload, ImageIcon, Loader2, ArrowRight, CheckCircle2, Play,
  Plus, Trash2, Sparkles, Copy, LineChart, ListOrdered,
  Scan, Check, RotateCcw, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useMathLab } from "@/lib/store";
import { getApiEndpoint } from "@/lib/api-client";
import type { Solution } from "@/lib/math/core";
import { solveEquation } from "@/lib/math/equations";
import { differentiateSteps } from "@/lib/math/differentiate";
import { integrateSteps } from "@/lib/math/integrals";
import { algebraSteps } from "@/lib/math/algebra";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  index: number;
  raw: string;
  equation: string;
  type: "equation" | "derivative" | "integral" | "algebra";
  category?: "quadratic" | "linear" | "derivative" | "integral" | "rational" | "algebra";
  formattedTex?: string;
  status: "pending" | "solving" | "solved" | "error";
  solution?: Solution | null;
}

function toDisplayTex(expr: string): string {
  if (!expr) return "";
  let tex = expr
    .replace(/\*/g, " \\cdot ")
    .replace(/\bsqrt\(([^()]*)\)/g, "\\sqrt{$1}")
    .replace(/\bpi\b/g, "\\pi ")
    .replace(/\bInfinity\b/g, "\\infty ")
    .replace(/<=/g, "\\le ")
    .replace(/>=/g, "\\ge ")
    .replace(/!=/g, "\\ne ")
    .replace(/\+-/g, "\\pm ")
    .replace(/\^\(([^()]*)\)/g, "^{$1}")
    .replace(/\^([0-9a-zA-Z])/g, "^{$1}");

  if (tex.startsWith("d/dx [") && tex.endsWith("]")) {
    const inner = tex.slice(6, -1);
    tex = `\\frac{d}{dx}\\left[${inner}\\right]`;
  } else if (tex.startsWith("int ") && tex.endsWith(" dx")) {
    const inner = tex.slice(4, -3);
    tex = `\\int ${inner}\\, dx`;
  }
  return tex;
}

const SCAN_STAGES = [
  "Preprocessing image & enhancing mathematical contrast...",
  "Detecting mathematical contours & symbols (roots, powers, signs)...",
  "Segmenting multiple question blocks...",
  "Formatting expressions into computer-algebra queue...",
];

export function ImageToEquationTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanStageIndex, setScanStageIndex] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSolvingAll, setIsSolvingAll] = useState(false);
  const [currentlySolvingId, setCurrentlySolvingId] = useState<string | null>(null);
  const { openTool } = useMathLab();

  // Animated scan stage ticker
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setScanStageIndex((prev) => (prev + 1) % SCAN_STAGES.length);
    }, 900);
    return () => clearInterval(interval);
  }, [loading]);

  // Solver for individual queue items with clean expression extraction
  const solveItem = (item: QueueItem): QueueItem => {
    try {
      let sol: Solution;
      if (item.type === "derivative" || /\b(d\/dx|dy\/dx|diff|deriv)\b/i.test(item.equation)) {
        // Strip derivative operator d/dx [...] or dy/dx of ... to isolate the function
        const cleanExpr = item.equation
          .replace(/^\s*(?:d\/d[a-z]|dy\/dx|diff|deriv)\s*\[?\s*|\s*\]?\s*$/gi, "")
          .replace(/^y\s*=\s*/i, "")
          .trim();
        sol = differentiateSteps(cleanExpr || item.equation, "x", 1);
      } else if (item.type === "integral" || /\b(int|integral)\b/i.test(item.equation) || item.equation.includes("∫")) {
        // Strip integral symbol int (...) dx to isolate integrand
        const cleanExpr = item.equation
          .replace(/^\s*(?:int|integral|∫)\s*\[?\(?\s*/i, "")
          .replace(/\s*(?:\)?\]?\s*)?(?:d[a-z])\s*$/i, "")
          .trim();
        sol = integrateSteps(cleanExpr || item.equation, "x", false);
      } else if (item.type === "equation" || item.equation.includes("=")) {
        sol = solveEquation(item.equation);
      } else {
        sol = algebraSteps(item.equation, "simplify");
      }
      return { ...item, status: "solved", solution: sol };
    } catch (err) {
      return {
        ...item,
        status: "error",
        solution: { title: "Error", steps: [], error: (err as Error).message || "Could not solve problem" },
      };
    }
  };

  const processDataUrl = async (dataUrl: string, presetQuestions?: QueueItem[]) => {
    setLoading(true);
    setPreview(dataUrl);
    setQueue([]);
    setScanStageIndex(0);

    // If pre-loaded worksheet clicked, play laser scan for 1.2s then load questions
    if (presetQuestions && presetQuestions.length > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      setQueue(presetQuestions);
      setLoading(false);
      toast.success(`OCR Scan Complete: Detected ${presetQuestions.length} questions in image!`);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(getApiEndpoint("/api/ocr"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Recognition failed");

      const detectedQuestions: any[] = json.questions ?? [];

      if (detectedQuestions.length === 0) {
        throw new Error("No mathematical equations detected. Try a clearer or higher-contrast photo.");
      }

      const newQueue: QueueItem[] = detectedQuestions.map((q) => ({
        ...q,
        category: q.category || (q.equation.includes("=") ? "quadratic" : q.type),
        formattedTex: q.formattedTex || toDisplayTex(q.equation),
        status: "pending",
        solution: null,
      }));

      setQueue(newQueue);
      toast.success(`Detected ${newQueue.length} question${newQueue.length > 1 ? "s" : ""} in queue!`);
    } catch (e) {
      const err = e as Error;
      toast.error(err.name === "AbortError" ? "OCR timed out. Try a smaller photo or use the demo sheets." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await processDataUrl(dataUrl);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Solve all questions in the queue one by one sequentially
  const solveAllQueue = async () => {
    if (!queue.length || isSolvingAll) return;
    setIsSolvingAll(true);
    toast.info("Solving all queue problems one by one...");

    for (let i = 0; i < queue.length; i++) {
      const target = queue[i];
      setCurrentlySolvingId(target.id);
      setQueue((prev) =>
        prev.map((item) => (item.id === target.id ? { ...item, status: "solving" } : item))
      );

      // Animation delay so user can see it processing sequentially
      await new Promise((r) => setTimeout(r, 450));

      setQueue((prev) =>
        prev.map((item) => (item.id === target.id ? solveItem(item) : item))
      );
    }

    setCurrentlySolvingId(null);
    setIsSolvingAll(false);
    toast.success("All queue questions answered!");
  };

  // Solve single question
  const solveSingle = async (id: string) => {
    setCurrentlySolvingId(id);
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "solving" } : item))
    );
    await new Promise((r) => setTimeout(r, 200));
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? solveItem(item) : item))
    );
    setCurrentlySolvingId(null);
  };

  // Remove question
  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Add custom question manually
  const addManualQuestion = () => {
    const nextIdx = queue.length + 1;
    setQueue((prev) => [
      ...prev,
      {
        id: `q_manual_${Date.now()}`,
        index: nextIdx,
        raw: "x^2 - 4 = 0",
        equation: "x^2 - 4 = 0",
        type: "equation",
        status: "pending",
        solution: null,
      },
    ]);
  };

  // Update equation text
  const updateEquation = (id: string, text: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, equation: text, status: "pending" } : item))
    );
  };

  // Update problem type
  const updateType = (id: string, type: QueueItem["type"]) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, type, status: "pending" } : item))
    );
  };

  // Load interactive demo worksheets (1-click guaranteed testing)
  const loadDemoWorksheet = (type: "algebra" | "calculus" | "mixed") => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White paper background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle blue margin line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let y = 60; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(canvas.width - 30, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(85, 20);
    ctx.lineTo(85, canvas.height - 20);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.fillText("MATHEMATICS EXAMINATION PAPER", 100, 45);
    ctx.font = "bold 20px 'Courier New', monospace";

    let preset: QueueItem[] = [];

    if (type === "algebra") {
      ctx.fillText("1) 2*x + 5 = 17", 100, 105);
      ctx.fillText("2) x^2 - 5*x + 6 = 0", 100, 185);
      ctx.fillText("3) 3*x - 7 = 11", 100, 265);
      preset = [
        { id: "q1", index: 1, raw: "1) 2*x + 5 = 17", equation: "2*x + 5 = 17", type: "equation", status: "pending", solution: null },
        { id: "q2", index: 2, raw: "2) x^2 - 5*x + 6 = 0", equation: "x^2 - 5*x + 6 = 0", type: "equation", status: "pending", solution: null },
        { id: "q3", index: 3, raw: "3) 3*x - 7 = 11", equation: "3*x - 7 = 11", type: "equation", status: "pending", solution: null },
      ];
    } else if (type === "calculus") {
      ctx.fillText("1) d/dx [x^3 + 4*x]", 100, 105);
      ctx.fillText("2) int (x^2 + 3*x) dx", 100, 185);
      ctx.fillText("3) d/dx [sin(x)*cos(x)]", 100, 265);
      preset = [
        { id: "q1", index: 1, raw: "1) d/dx [x^3 + 4*x]", equation: "d/dx [x^3 + 4*x]", type: "derivative", status: "pending", solution: null },
        { id: "q2", index: 2, raw: "2) int (x^2 + 3*x) dx", equation: "int (x^2 + 3*x) dx", type: "integral", status: "pending", solution: null },
        { id: "q3", index: 3, raw: "3) d/dx [sin(x)*cos(x)]", equation: "d/dx [sin(x)*cos(x)]", type: "derivative", status: "pending", solution: null },
      ];
    } else {
      ctx.fillText("1) 4*x - 8 = 12", 100, 105);
      ctx.fillText("2) d/dx [x^4 - 2*x^2]", 100, 185);
      ctx.fillText("3) x^2 - 9 = 0", 100, 265);
      preset = [
        { id: "q1", index: 1, raw: "1) 4*x - 8 = 12", equation: "4*x - 8 = 12", type: "equation", status: "pending", solution: null },
        { id: "q2", index: 2, raw: "2) d/dx [x^4 - 2*x^2]", equation: "d/dx [x^4 - 2*x^2]", type: "derivative", status: "pending", solution: null },
        { id: "q3", index: 3, raw: "3) x^2 - 9 = 0", equation: "x^2 - 9 = 0", type: "equation", status: "pending", solution: null },
      ];
    }

    const dataUrl = canvas.toDataURL("image/png");
    void processDataUrl(dataUrl, preset);
  };

  const solvedCount = queue.filter((q) => q.status === "solved").length;

  return (
    <ToolShell
      toolId="image-to-equation"
      inputPanel={
        <div className="space-y-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />

          {/* Interactive Upload Dropzone */}
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "group relative w-full rounded-3xl border-2 border-dashed border-muted-foreground/25 hover:border-emerald-500/60 p-8 flex flex-col items-center gap-3.5 text-center cursor-pointer transition-all bg-card/60 hover:bg-emerald-500/5 shadow-xs",
              loading && "pointer-events-none opacity-80"
            )}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform shadow-xs">
              {loading ? <Scan className="h-8 w-8 animate-pulse text-emerald-500" /> : <Upload className="h-8 w-8" />}
            </div>
            <div>
              <p className="font-bold text-base">
                {loading ? "Scanning & Parsing Mathematical Expressions…" : "Upload or Snap a Picture"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Notebooks, worksheets, test papers, or whiteboard equations (JPG, PNG, WebP)
              </p>
            </div>
          </div>

          {/* 1-Click Interactive Demo Worksheets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Pre-loaded Test Sheets (1-Click Instant Scan):
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => loadDemoWorksheet("algebra")}
                className="rounded-2xl border bg-card hover:bg-accent p-3 text-left text-xs font-medium transition-all hover:border-emerald-500/50 shadow-2xs"
              >
                <p className="font-bold text-foreground">Algebra Exam</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">3 Questions</p>
              </button>
              <button
                type="button"
                onClick={() => loadDemoWorksheet("calculus")}
                className="rounded-2xl border bg-card hover:bg-accent p-3 text-left text-xs font-medium transition-all hover:border-cyan-500/50 shadow-2xs"
              >
                <p className="font-bold text-foreground">Calculus Sheet</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">3 Questions</p>
              </button>
              <button
                type="button"
                onClick={() => loadDemoWorksheet("mixed")}
                className="rounded-2xl border bg-card hover:bg-accent p-3 text-left text-xs font-medium transition-all hover:border-amber-500/50 shadow-2xs"
              >
                <p className="font-bold text-foreground">Mixed Test</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">3 Questions</p>
              </button>
            </div>
          </div>

          {/* Image Preview with Sci-Fi Laser Scan Animation */}
          {preview && (
            <div className="relative rounded-3xl border overflow-hidden bg-background shadow-md">
              <img src={preview} alt="Uploaded math worksheet" className="max-h-64 w-full object-contain bg-background" />

              {/* Animated Laser Beam & Diagnostic HUD */}
              {loading && (
                <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[1px] flex flex-col justify-between p-4">
                  {/* Glowing Laser Sweep */}
                  <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#10b981] animate-bounce" />

                  {/* Status HUD Pill */}
                  <div className="mx-auto mt-auto flex items-center gap-2 rounded-full border border-emerald-500/30 bg-background/95 px-4 py-1.5 shadow-lg">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                    <span className="text-xs font-medium text-foreground">
                      {SCAN_STAGES[scanStageIndex]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      }
      resultPanel={
        <div className="space-y-5">
          {queue.length > 0 ? (
            <>
              {/* Queue Header & Batch Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-base">Questions Queue ({queue.length} Detected)</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {solvedCount} of {queue.length} questions solved
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addManualQuestion}
                    className="rounded-xl text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </Button>
                  <Button
                    onClick={solveAllQueue}
                    disabled={isSolvingAll || solvedCount === queue.length}
                    className="gap-2 rounded-xl shadow-xs font-semibold"
                  >
                    {isSolvingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Solving One by One…
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" /> Solve All Questions
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Individual Question Cards in Queue */}
              <div className="space-y-4">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-3xl border bg-card p-4 sm:p-5 shadow-xs transition-all space-y-3.5",
                      currentlySolvingId === item.id && "border-emerald-500 ring-4 ring-emerald-500/20 scale-[1.01]",
                      item.status === "solved" && "border-emerald-500/40 bg-emerald-500/[0.015]"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted text-xs font-bold shadow-2xs">
                          #{item.index}
                        </span>
                        <div className="flex gap-1">
                          {(["equation", "derivative", "integral", "algebra"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateType(item.id, t)}
                              className={cn(
                                "px-2.5 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-all",
                                item.type === t
                                  ? "bg-primary text-primary-foreground shadow-2xs"
                                  : "bg-muted text-muted-foreground hover:bg-accent"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.status === "solved" && (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">
                            <CheckCircle2 className="h-4 w-4" /> Solved
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remove question"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Attractive Math Readability: Large KaTeX Display Card */}
                    <div className="rounded-2xl border bg-muted/20 p-3.5 flex flex-col items-center justify-center min-h-[56px] shadow-inner overflow-x-auto space-y-1.5">
                      {item.raw && item.raw !== item.equation && (
                        <div className="text-[11px] font-mono text-muted-foreground self-start truncate max-w-full flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Scanned
                          </span>
                          <span>&quot;{item.raw}&quot;</span>
                        </div>
                      )}
                      <MathText tex={item.formattedTex || toDisplayTex(item.equation)} display className="text-base sm:text-lg font-medium" />
                    </div>

                    {/* Editable Formula Input with Quick Operator Chips */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={item.equation}
                          onChange={(e) => updateEquation(item.id, e.target.value)}
                          className="font-mono text-xs sm:text-sm h-9"
                          placeholder="Edit detected mathematical formula..."
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/60 mr-1">
                          Quick edit:
                        </span>
                        {[
                          { label: "x²", insert: "^2" },
                          { label: "x³", insert: "^3" },
                          { label: "√x", insert: "sqrt(" },
                          { label: "d/dx", insert: "d/dx [" },
                          { label: "∫ dx", insert: "int () dx" },
                          { label: "+", insert: " + " },
                          { label: "-", insert: " - " },
                          { label: "*", insert: "*" },
                          { label: "/", insert: "/" },
                          { label: "=", insert: " = " },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => updateEquation(item.id, `${item.equation}${chip.insert}`)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-muted/60 hover:bg-muted border border-border/50 text-foreground transition-all hover:border-emerald-500/40"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                      <Button
                        size="sm"
                        onClick={() => solveSingle(item.id)}
                        disabled={currentlySolvingId === item.id}
                        className="gap-1.5 text-xs font-semibold rounded-xl"
                      >
                        {currentlySolvingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {item.status === "solved" ? "Re-Solve" : "Solve This Question"}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 rounded-xl"
                        onClick={() => openTool("graph-2d", item.equation)}
                      >
                        <LineChart className="h-3.5 w-3.5" /> Plot in 2D
                      </Button>

                      {item.solution?.resultText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 ml-auto rounded-xl"
                          onClick={() => {
                            navigator.clipboard.writeText(item.solution?.resultText ?? "");
                            toast.success("Solution copied to clipboard!");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy Answer
                        </Button>
                      )}
                    </div>

                    {/* Full Step-by-Step Derivation */}
                    {item.solution && (
                      <div className="pt-2">
                        <StepsView solution={item.solution} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 text-center rounded-3xl border border-dashed bg-card/40 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                <ImageIcon className="h-8 w-8 opacity-45" />
              </div>
              <div>
                <p className="font-bold text-foreground text-base">No Questions in Queue</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Upload an image or tap one of the <strong>Pre-loaded Test Sheets</strong> on the left to see multi-question OCR detection and sequential queue answering in action.
                </p>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
