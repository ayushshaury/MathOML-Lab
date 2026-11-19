"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface MathTextProps {
  tex: string | undefined;
  display?: boolean;
  className?: string;
  fallback?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render LaTeX with KaTeX; falls back to plain text on failure. */
export function MathText({ tex, display = false, className, fallback }: MathTextProps) {
  const html = useMemo(() => {
    const src = tex ?? "";
    if (!src.trim()) return "";
    try {
      return katex.renderToString(src, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        errorColor: "#dc2626",
        macros: { "\\R": "\\mathbb{R}", "\\checkmark": "\\text{✓}" },
      });
    } catch {
      return `<span class="font-mono text-sm">${escapeHtml(src)}</span>`;
    }
  }, [tex, display]);

  if (!html) return null;
  return (
    <span
      className={cn(display ? "block text-center py-1 overflow-x-auto" : "inline-block", className)}
      dangerouslySetInnerHTML={{ __html: html }}
      aria-label={fallback ?? (tex ?? "").replace(/\\/g, " ")}
    />
  );
}
