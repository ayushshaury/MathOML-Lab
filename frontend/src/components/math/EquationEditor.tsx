"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Camera, X, Sigma } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MathText } from "./MathText";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getApiEndpoint } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/* Symbol palette                                                      */
/* ------------------------------------------------------------------ */

interface PaletteItem {
  label: string;         // shown as text or rendered
  insert: string;        // text inserted at cursor
  cursorOffset?: number; // how many chars to move cursor back after insert
  title?: string;
}

const PALETTE: { group: string; items: PaletteItem[] }[] = [
  {
    group: "Basic",
    items: [
      { label: "a⁄b", insert: "/", title: "Fraction" },
      { label: "x²", insert: "^2", title: "Square" },
      { label: "xⁿ", insert: "^", title: "Power" },
      { label: "xₙ", insert: "_n", title: "Subscript" },
      { label: "√", insert: "sqrt()", cursorOffset: 1, title: "Square root" },
      { label: "∛", insert: "cbrt()", cursorOffset: 1, title: "Cube root" },
      { label: "|x|", insert: "abs()", cursorOffset: 1, title: "Absolute value" },
      { label: "π", insert: "pi", title: "Pi" },
      { label: "e", insert: "e", title: "Euler's number" },
      { label: "∞", insert: "Infinity", title: "Infinity" },
    ],
  },
  {
    group: "Operators",
    items: [
      { label: "±", insert: "+-" , title: "Plus minus" },
      { label: "×", insert: "*", title: "Multiply" },
      { label: "÷", insert: "/", title: "Divide" },
      { label: "≤", insert: "<=", title: "Less or equal" },
      { label: "≥", insert: ">=", title: "Greater or equal" },
      { label: "≠", insert: "!=", title: "Not equal" },
      { label: "→", insert: "=", title: "Equals" },
    ],
  },
  {
    group: "Functions",
    items: [
      { label: "sin", insert: "sin()", cursorOffset: 1 },
      { label: "cos", insert: "cos()", cursorOffset: 1 },
      { label: "tan", insert: "tan()", cursorOffset: 1 },
      { label: "asin", insert: "asin()", cursorOffset: 1 },
      { label: "acos", insert: "acos()", cursorOffset: 1 },
      { label: "atan", insert: "atan()", cursorOffset: 1 },
      { label: "sinh", insert: "sinh()", cursorOffset: 1 },
      { label: "cosh", insert: "cosh()", cursorOffset: 1 },
      { label: "tanh", insert: "tanh()", cursorOffset: 1 },
      { label: "ln", insert: "log()", cursorOffset: 1, title: "Natural log" },
      { label: "log₁₀", insert: "log10()", cursorOffset: 1 },
      { label: "eˣ", insert: "e^()", cursorOffset: 1 },
      { label: "aˣ", insert: "^()", cursorOffset: 1 },
    ],
  },
  {
    group: "Calculus",
    items: [
      { label: "∫dx", insert: "∫ f(x) dx", title: "Integral template" },
      { label: "∫ₐᵇ", insert: "∫[a,b] f(x) dx", title: "Definite integral template" },
      { label: "d/dx", insert: "d/dx( )", cursorOffset: 2, title: "Derivative template" },
      { label: "∂", insert: "∂f/∂x", title: "Partial derivative" },
      { label: "Σ", insert: "sum(k^2, k, 1, n)", title: "Summation" },
      { label: "lim", insert: "lim(x→0)", title: "Limit" },
      { label: "y′", insert: "y'", title: "y prime (ODE)" },
      { label: "y″", insert: "y''", title: "y double prime (ODE)" },
      { label: "dy/dx", insert: "dy/dx", title: "Derivative notation" },
    ],
  },
  {
    group: "Greek",
    items: [
      { label: "α", insert: "alpha" }, { label: "β", insert: "beta" }, { label: "γ", insert: "gamma" },
      { label: "δ", insert: "delta" }, { label: "θ", insert: "theta" }, { label: "λ", insert: "lambda" },
      { label: "μ", insert: "mu" }, { label: "ρ", insert: "rho" }, { label: "σ", insert: "sigma" },
      { label: "φ", insert: "phi" }, { label: "ω", insert: "omega" }, { label: "Δ", insert: "Delta" },
    ],
  },
  {
    group: "Matrices",
    items: [
      { label: "[[a,b],[c,d]]", insert: "[[1,2],[3,4]]", title: "2×2 matrix" },
      { label: "3×3", insert: "[[1,2,3],[4,5,6],[7,8,9]]", title: "3×3 matrix" },
      { label: "( )", insert: "()", cursorOffset: 1, title: "Parentheses" },
      { label: "[ ]", insert: "[]", cursorOffset: 1, title: "Brackets" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Equation editor                                                     */
/* ------------------------------------------------------------------ */

interface EquationEditorProps {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  label?: string;
  multiline?: boolean;
  className?: string;
  /** show OCR camera button */
  ocr?: boolean;
}

export function EquationEditor({
  value,
  onChange,
  onEnter,
  placeholder = "Type a problem, e.g. x^2 - 5*x + 6 = 0",
  label,
  multiline = false,
  className,
  ocr = true,
}: EquationEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  // live preview (convert plain math to tex-ish display)
  const previewTex = useMemo(() => {
    if (!value.trim()) {
      return null;
    }
    // lightweight plain -> tex (superscripts etc. are handled by mathjs later; here we prettify common cases)
    let tex = value
      .replace(/\*/g, " \\cdot ")
      .replace(/\bsqrt\(([^()]*)\)/g, "\\sqrt{$1}")
      .replace(/\bpi\b/g, "\\pi ")
      .replace(/\binfinity\b/gi, "\\infty ")
      .replace(/<=/g, "\\le ").replace(/>=/g, "\\ge ")
      .replace(/!=/g, "\\ne ")
      .replace(/\+-/g, "\\pm ");
    // handle ^2 ^n after parens
    tex = tex.replace(/\^\(([^()]*)\)/g, "^{$1}").replace(/\^(\w)/g, "^{$1}");
    return tex;
  }, [value]);

  const insertAtCursor = useCallback(
    (text: string, cursorOffset = 0) => {
      const el = inputRef.current;
      if (!el) {
        onChange(value + text);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + text.length - cursorOffset;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange, value]
  );

  const handleOcr = async (file: File) => {
    setOcrLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(getApiEndpoint("/api/ocr"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Recognition failed");
      const eq: string = json.equation ?? "";
      if (!eq.trim()) throw new Error("No equation found in the image");
      onChange(eq);
      toast.success("Equation recognised — review and edit it below", {
        description: eq.slice(0, 80),
      });
    } catch (e) {
      toast.error((e as Error).message || "Could not read the image");
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      <div className="flex gap-2">
        <div className="relative flex-1">
          {multiline ? (
            <textarea
              ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="flex min-h-[84px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && onEnter) onEnter();
              }}
              placeholder={placeholder}
              className="h-11 text-base font-mono"
              aria-label={label ?? "Mathematical expression"}
            />
          )}
        </div>
        {ocr && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleOcr(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              title="Upload a picture of a problem"
              disabled={ocrLoading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className={cn("h-5 w-5", ocrLoading && "animate-pulse")} />
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          title="Math symbols"
          onClick={() => setShowPalette(!showPalette)}
        >
          <Sigma className="h-5 w-5" />
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            title="Clear"
            onClick={() => onChange("")}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* symbol palette */}
      {showPalette && (
        <div className="rounded-lg border bg-popover p-3 space-y-3 shadow-md">
          {PALETTE.map((group) => (
            <div key={group.group}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{group.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.label + item.insert}
                    type="button"
                    title={item.title ?? item.label}
                    onClick={() => insertAtCursor(item.insert, item.cursorOffset ?? 0)}
                    className="min-w-9 h-9 px-2 rounded-md border bg-background hover:bg-accent hover:border-primary/40 transition-colors font-mono text-sm flex items-center justify-center"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Tip: use <code className="font-mono">*</code> for multiplication, <code className="font-mono">^</code> for powers,
            and <code className="font-mono">sqrt()</code> for roots. Implicit multiplication like <code className="font-mono">3x</code> also works.
          </p>
        </div>
      )}

      {/* live preview */}
      {previewTex && (
        <div className="rounded-xl bg-zinc-50 border border-zinc-200/70 px-3 py-2 overflow-x-auto">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
          <MathText tex={previewTex} className="text-base" />
        </div>
      )}
    </div>
  );
}
