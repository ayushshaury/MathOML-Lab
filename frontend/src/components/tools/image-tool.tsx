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
import {
  determinantSteps, inverseSteps, eigenSteps, rankSteps, matrixOpSteps, matTex, type Matrix
} from "@/lib/math/matrices";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  index: number;
  raw: string;
  equation: string;
  type: "equation" | "derivative" | "integral" | "algebra" | "matrix";
  category?: "quadratic" | "linear" | "derivative" | "integral" | "rational" | "algebra" | "matrix" | "determinant" | "inverse" | "eigen";
  formattedTex?: string;
  status: "pending" | "solving" | "solved" | "error";
  solution?: Solution | null;
}

function parseMatrixFromText(raw: string): { matrix: number[][]; formattedTex: string } | null {
  if (!raw) return null;
  const str = raw.trim();

  // 1. Bracketed 2D array: [[1, 2], [3, 4]]
  const match = str.match(/\[\s*(\[\s*[-0-9\.\s\,]+\s*\](?:\s*,\s*\[\s*[-0-9\.\s\,]+\s*\])*)\s*\]/);
  if (match) {
    const rowMatches = match[1].match(/\[\s*([-0-9\.\s\,]+)\s*\]/g);
    if (rowMatches && rowMatches.length > 0) {
      const rows: number[][] = [];
      for (const rm of rowMatches) {
        const content = rm.replace(/^\[|\]$/g, "").trim();
        const cells = content.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length >= 1 && rows.every((r) => r.length === rows[0].length)) {
        return {
          matrix: rows,
          formattedTex: `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`,
        };
      }
    }
  }

  // 2. Semicolon notation: [1 2; 3 4]
  const semiMatch = str.match(/\[\s*([-0-9\.\s\,\;]+)\s*\]/);
  if (semiMatch && semiMatch[1].includes(";")) {
    const rowStrings = semiMatch[1].split(";").map((r) => r.trim()).filter(Boolean);
    const rows: number[][] = [];
    for (const r of rowStrings) {
      const cells = r.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 2 && rows.every((r) => r.length === rows[0].length)) {
      return {
        matrix: rows,
        formattedTex: `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`,
      };
    }
  }

  return null;
}

function toDisplayTex(expr: string): string {
  if (!expr) return "";
  let tex = expr;

  // Convert embedded matrix arrays [[...]] to LaTeX pmatrix
  const matMatches = tex.match(/\[\s*\[\s*[-0-9\.\s\,]+\s*\](?:\s*,\s*\[\s*[-0-9\.\s\,]+\s*\])*\s*\]/g);
  if (matMatches) {
    for (const m of matMatches) {
      const parsed = parseMatrixFromText(m);
      if (parsed) {
        tex = tex.replace(m, parsed.formattedTex);
      }
    }
    if (expr.startsWith("det(") && expr.endsWith(")")) {
      tex = tex.replace(/^det\((.*)\)$/, "\\det $1");
    } else if (expr.startsWith("inv(") && expr.endsWith(")")) {
      tex = tex.replace(/^inv\((.*)\)$/, "{$1}^{-1}");
    } else if (expr.startsWith("eigen(") && expr.endsWith(")")) {
      tex = tex.replace(/^eigen\((.*)\)$/, "\\operatorname{eigen}($1)");
    }
    return tex;
  }

  tex = tex
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

      // Matrix & Linear Algebra Solver Routing
      if (
        item.type === "matrix" ||
        item.category === "matrix" ||
        item.category === "determinant" ||
        item.category === "inverse" ||
        item.category === "eigen" ||
        item.equation.includes("[[") ||
        item.equation.startsWith("det(") ||
        item.equation.startsWith("inv(") ||
        item.equation.startsWith("eigen(")
      ) {
        // 1. Matrix operations between two matrices: A + B, A - B, A * B
        const opMatch = item.equation.match(/(\[\[[\s\S]*?\]\])\s*([\+\-\*])\s*(\[\[[\s\S]*?\]\])/);
        if (opMatch) {
          const m1 = parseMatrixFromText(opMatch[1]);
          const m2 = parseMatrixFromText(opMatch[3]);
          if (m1 && m2) {
            sol = matrixOpSteps(m1.matrix, m2.matrix, opMatch[2], 0);
            return { ...item, status: "solved", solution: sol };
          }
        }

        // 2. Determinant: det([[...]]) or category === 'determinant'
        if (item.category === "determinant" || /\b(?:det|determinant)\b/i.test(item.equation) || item.equation.startsWith("det(")) {
          const p = parseMatrixFromText(item.equation);
          if (p) {
            sol = determinantSteps(p.matrix);
            return { ...item, status: "solved", solution: sol };
          }
        }

        // 3. Inverse: inv([[...]]) or category === 'inverse'
        if (item.category === "inverse" || /\b(?:inv|inverse)\b/i.test(item.equation) || item.equation.startsWith("inv(")) {
          const p = parseMatrixFromText(item.equation);
          if (p) {
            sol = inverseSteps(p.matrix);
            return { ...item, status: "solved", solution: sol };
          }
        }

        // 4. Eigenvalues: eigen([[...]]) or category === 'eigen'
        if (item.category === "eigen" || /\b(?:eigen|eigenvalue)\b/i.test(item.equation) || item.equation.startsWith("eigen(")) {
          const p = parseMatrixFromText(item.equation);
          if (p) {
            const eigenRes = eigenSteps(p.matrix);
            sol = {
              ...eigenRes,
              resultTex:
                eigenRes.resultTex ||
                eigenRes.eigen.map((e, i) => `\\lambda_{${i + 1}} = ${e.tex}`).join(", "),
            };
            return { ...item, status: "solved", solution: sol };
          }
        }

        // 5. Default Matrix: Determinant for square matrices, rank for rectangular
        const p = parseMatrixFromText(item.equation);
        if (p) {
          if (p.matrix.length === p.matrix[0].length) {
            sol = determinantSteps(p.matrix);
          } else {
            const rankRes = rankSteps(p.matrix);
            sol = {
              title: "Matrix Rank",
              resultTex: `\\operatorname{rank}(A) = ${rankRes.rank}`,
              steps: rankRes.steps,
            };
          }
          return { ...item, status: "solved", solution: sol };
        }
      }

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
      const timeoutId = setTimeout(() => controller.abort(), 45000);

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
  const loadDemoWorksheet = (type: "algebra" | "calculus" | "matrix" | "mixed") => {
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
    } else if (type === "matrix") {
      ctx.fillText("1) det([[2, 5], [1, 3]])", 100, 105);
      ctx.fillText("2) inv([[4, 7], [2, 6]])", 100, 185);
      ctx.fillText("3) [[1, 2], [3, 4]] + [[5, 6], [7, 8]]", 100, 265);
      preset = [
        { id: "q1", index: 1, raw: "1) det([[2, 5], [1, 3]])", equation: "det([[2, 5], [1, 3]])", type: "matrix", category: "determinant", formattedTex: "\\det \\begin{pmatrix} 2 & 5 \\\\ 1 & 3 \\end{pmatrix}", status: "pending", solution: null },
        { id: "q2", index: 2, raw: "2) inv([[4, 7], [2, 6]])", equation: "inv([[4, 7], [2, 6]])", type: "matrix", category: "inverse", formattedTex: "\\begin{pmatrix} 4 & 7 \\\\ 2 & 6 \\end{pmatrix}^{-1}", status: "pending", solution: null },
        { id: "q3", index: 3, raw: "3) [[1, 2], [3, 4]] + [[5, 6], [7, 8]]", equation: "[[1, 2], [3, 4]] + [[5, 6], [7, 8]]", type: "matrix", category: "matrix", formattedTex: "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix} + \\begin{pmatrix} 5 & 6 \\\\ 7 & 8 \\end{pmatrix}", status: "pending", solution: null },
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
              "group relative w-full rounded-2xl border-2 border-dashed border-zinc-300 hover:border-zinc-500 p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition-all bg-zinc-50/50 hover:bg-zinc-100/50",
              loading && "pointer-events-none opacity-75"
            )}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 group-hover:scale-105 transition-transform border border-zinc-200">
              {loading ? <Scan className="h-6 w-6 animate-pulse text-[#0071e3]" /> : <Upload className="h-6 w-6" />}
            </div>
            <div>
              <p className="font-semibold text-sm text-zinc-900">
                {loading ? "Extracting mathematical expressions…" : "Upload a worksheet or equation photo"}
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Notebooks, printed worksheets, or whiteboard photos (JPG, PNG, WebP)
              </p>
            </div>
          </div>

          {/* Preset Test Sheets */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
              Example Worksheets:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => loadDemoWorksheet("algebra")}
                className="rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 p-3 text-left text-xs transition-all hover:border-zinc-300"
              >
                <p className="font-semibold text-zinc-900">Algebra</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">3 Questions</p>
              </button>
              <button
                type="button"
                onClick={() => loadDemoWorksheet("calculus")}
                className="rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 p-3 text-left text-xs transition-all hover:border-zinc-300"
              >
                <p className="font-semibold text-zinc-900">Calculus</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">3 Questions</p>
              </button>
              <button
                type="button"
                onClick={() => loadDemoWorksheet("matrix")}
                className="rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 p-3 text-left text-xs transition-all hover:border-zinc-300"
              >
                <p className="font-semibold text-zinc-900">Matrices</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">3 Questions</p>
              </button>
              <button
                type="button"
                onClick={() => loadDemoWorksheet("mixed")}
                className="rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 p-3 text-left text-xs transition-all hover:border-zinc-300"
              >
                <p className="font-semibold text-zinc-900">Mixed Exam</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">3 Questions</p>
              </button>
            </div>
          </div>

          {/* Image Preview */}
          {preview && (
            <div className="relative rounded-2xl border border-zinc-200/80 overflow-hidden bg-zinc-50 shadow-2xs">
              <img src={preview} alt="Uploaded math worksheet" className="max-h-64 w-full object-contain bg-white" />

              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex flex-col justify-end p-4">
                  <div className="mx-auto flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 shadow-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0071e3]" />
                    <span className="text-xs font-medium text-zinc-800">
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-zinc-600" />
                    <h3 className="font-semibold text-sm text-zinc-900">Detected Questions ({queue.length})</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {solvedCount} of {queue.length} solved
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addManualQuestion}
                    className="rounded-xl border-zinc-200 bg-white text-xs font-medium gap-1 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                  <Button
                    onClick={solveAllQueue}
                    disabled={isSolvingAll || solvedCount === queue.length}
                    className="gap-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white h-8 px-3.5"
                  >
                    {isSolvingAll ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Solving…
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Solve All
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
                      "rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all space-y-3.5",
                      currentlySolvingId === item.id && "border-[#0071e3] ring-2 ring-[#0071e3]/15",
                      item.status === "solved" && "border-zinc-300"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-700">
                          {item.index}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {(["equation", "derivative", "integral", "matrix", "algebra"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateType(item.id, t)}
                              className={cn(
                                "px-2.5 py-0.5 rounded-full text-[11px] capitalize font-medium transition-all",
                                item.type === t
                                  ? "bg-zinc-900 text-white shadow-2xs"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.status === "solved" && (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 mr-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Solved
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove question"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* LaTeX Display Card */}
                    <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/70 p-3.5 flex flex-col items-center justify-center min-h-[52px] overflow-x-auto space-y-1.5">
                      {item.raw && item.raw !== item.equation && (
                        <div className="text-[11px] font-mono text-zinc-500 self-start truncate max-w-full flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-zinc-700 bg-zinc-200/70 px-1.5 py-0.5 rounded">
                            Extracted
                          </span>
                          <span>&quot;{item.raw}&quot;</span>
                        </div>
                      )}
                      <MathText tex={item.formattedTex || toDisplayTex(item.equation)} display className="text-base sm:text-lg font-medium text-zinc-900" />
                    </div>

                    {/* Editable Formula Input */}
                    <div className="space-y-2">
                      <Input
                        value={item.equation}
                        onChange={(e) => updateEquation(item.id, e.target.value)}
                        className="font-mono text-xs sm:text-sm h-9 rounded-xl border-zinc-200 bg-zinc-50/70 focus:bg-white"
                        placeholder="Edit detected expression..."
                      />
                      <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                        <span className="text-[11px] font-medium text-zinc-400 mr-1">Insert:</span>
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
                            className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/70 text-zinc-700 transition-colors"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
                      <Button
                        size="sm"
                        onClick={() => solveSingle(item.id)}
                        disabled={currentlySolvingId === item.id}
                        className="gap-1.5 text-xs font-medium rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white h-8"
                      >
                        {currentlySolvingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {item.status === "solved" ? "Re-Solve" : "Solve"}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 rounded-xl border-zinc-200 h-8"
                        onClick={() => openTool("graph-2d", item.equation)}
                      >
                        <LineChart className="h-3.5 w-3.5" /> Plot 2D
                      </Button>

                      {item.solution?.resultText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 ml-auto rounded-xl h-8 text-zinc-600 hover:text-zinc-900"
                          onClick={() => {
                            navigator.clipboard.writeText(item.solution?.resultText ?? "");
                            toast.success("Answer copied to clipboard!");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </Button>
                      )}
                    </div>

                    {/* Step-by-Step Solution */}
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
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3 text-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-zinc-800 text-sm">No questions detected yet</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Upload a photo or select one of the example worksheets to extract and solve equations step by step.
                </p>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
