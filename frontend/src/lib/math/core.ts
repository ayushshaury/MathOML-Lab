/**
 * Core math utilities: preprocessing, formatting, shared types, TeX helpers.
 */
import { create, all, type MathNode } from "mathjs";

export const math = create(all, { number: "number" });

/* ------------------------------------------------------------------ */
/* Shared solution types                                               */
/* ------------------------------------------------------------------ */

export interface Step {
  /** Short heading, e.g. "Apply the Power Rule" */
  title: string;
  /** Beginner-friendly explanation of what is happening */
  explanation?: string;
  /** LaTeX (or plain) math shown in a KaTeX block */
  math?: string;
  /** true when `math` is already LaTeX; false = plain expression */
  isTex?: boolean;
}

export interface PlotSpec {
  /** functions to plot */
  curves?: { label: string; expr: string; color?: string; dashed?: boolean }[];
  /** shaded area under a curve */
  area?: { expr: string; from: number; to: number };
  /** tangent line */
  tangent?: { expr: string; at: number };
  /** vertical marker lines */
  markers?: { x: number; label: string }[];
  /** 3D surface */
  surface?: string;
  /** points to mark */
  points?: { x: number; y: number; label?: string }[];
  /** default x range */
  xRange?: [number, number];
  /** default y range */
  yRange?: [number, number];
  /** direction field for ODEs: y' = f(x, y) */
  field?: string;
  /** pre-sampled curve (e.g. RK4 solution), plotted as a connected line */
  sampled?: { x: number; y: number }[];
}

export interface Solution {
  title: string;
  /** final answer in LaTeX */
  resultTex?: string;
  /** final answer in plain text (fallback / copy) */
  resultText?: string;
  steps: Step[];
  plot?: PlotSpec;
  notes?: string[];
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Input preprocessing                                                 */
/* ------------------------------------------------------------------ */

const SUPERSCRIPTS: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
};

/** Normalise a raw user expression into mathjs/nerdamer friendly syntax. */
export function preprocess(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[\u2212\u2013\u2014]/g, "-");
  s = s.replace(/[×·∗]/g, "*");
  s = s.replace(/[÷]/g, "/");
  s = s.replace(/√/g, "sqrt");
  s = s.replace(/π/g, "pi");
  s = s.replace(/∞/g, "Infinity");
  s = s.replace(/≤/g, "<=").replace(/≥/g, ">=");
  // superscripts → ^n
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPTS[c]).join(""));
  // ln → log (mathjs natural log)
  s = s.replace(/\bln\s*\(/g, "log(");
  s = s.replace(/\bln\b(?!\s*\()/g, "log");
  // arcsin etc → asin
  s = s.replace(/\barc(sin|cos|tan|sec|csc|cot)\b/g, "a$1");
  s = s.replace(/\*\*/g, "^");
  s = s.replace(/\bsqrt\s+([0-9.]+)/g, "sqrt($1)");
  return s;
}

/** Turn a mathjs node / string into LaTeX with pretty fixes. */
export function toTex(expr: string | MathNode): string {
  try {
    const node = typeof expr === "string" ? math.parse(expr) : expr;
    let tex = node.toTex({ parenthesis: "auto" });
    tex = tex.replace(/\\log\(/g, "\\ln(");
    tex = tex.replace(/\\log\\left\(/g, "\\ln\\left(");
    tex = tex.replace(/\\mathrm\{log\}/g, "\\ln");
    return tex;
  } catch {
    return expr as string;
  }
}

/* ------------------------------------------------------------------ */
/* Number formatting                                                   */
/* ------------------------------------------------------------------ */

export function fmt(x: number | undefined | null, digits = 6): string {
  if (x === undefined || x === null || Number.isNaN(x)) return "—";
  if (!Number.isFinite(x)) return x > 0 ? "\\infty" : Number.isNaN(x) ? "NaN" : "-\\infty";
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  const abs = Math.abs(x);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) return x.toExponential(4);
  const r = Number(x.toPrecision(digits));
  return String(r);
}

/** Exact fraction when clean, otherwise decimal. */
export function fmtExact(x: number, digits = 6): string {
  if (Number.isInteger(x)) return String(x);
  try {
    const f = math.fraction(x) as unknown as { s: number; n: bigint | number; d: bigint | number };
    const s = Number(f.s), n = Number(f.n), d = Number(f.d);
    if (d !== 0 && d <= 10000 && Math.abs(n) <= 1e9) {
      const frac = s < 0 ? `-${Math.abs(n)}/${d}` : `${n}/${d}`;
      const val = (s * Math.abs(n)) / d;
      if (Math.abs(val - x) < 1e-10) return frac;
    }
  } catch {
    /* fall through */
  }
  return fmt(x, digits);
}

/** LaTeX-friendly exact value (fraction rendered with \frac). */
export function texNum(x: number): string {
  const s = fmtExact(x);
  const m = s.match(/^(-?)(\d+)\/(\d+)$/);
  if (m) return `${m[1] === "-" ? "-" : ""}\\frac{${m[2]}}{${m[3]}}`;
  return fmt(x);
}

/* ------------------------------------------------------------------ */
/* Symbol / variable detection                                         */
/* ------------------------------------------------------------------ */

const FUNC_NAMES = new Set([
  "sin","cos","tan","sec","csc","cot","asin","acos","atan","sinh","cosh","tanh",
  "exp","log","log10","log2","sqrt","cbrt","abs","sign","floor","ceil","round",
  "min","max","erf","gamma","det","inv","transpose","sum","prod","mean","median",
  "variance","std","dot","cross","norm","trace","eigs","rationalize","simplify",
  "derivative","polynomialRoot","lsolve","usolve","mod","pow","nthRoot","arg",
  "re","im","conj","complex","distance","intersect","combinations","factorial",
  "random","pickRandom","atan2","logbase","log",
]);

const CONSTANTS = new Set(["e", "pi", "tau", "i", "Infinity", "phi", "x", "y", "z", "t", "n", "u", "v", "w", "a", "b", "c", "d", "k", "m", "s", "r", "p", "q", "f", "g", "h", "l", "j"]);

export function isReservedName(name: string): boolean {
  return FUNC_NAMES.has(name) || CONSTANTS.has(name);
}

/** Collect unbound (free) variable names in a parsed node. */
export function findSymbols(node: MathNode): string[] {
  const syms = new Set<string>();
  const self = node as unknown as { type: string; name?: string };
  if (self.type === "SymbolNode" && self.name && !isReservedName(self.name)) syms.add(self.name);
  node.forEach(function walk(n: MathNode) {
    const t = n as unknown as { type: string; name?: string; fn?: { name?: string } };
    if (t.type === "SymbolNode" && t.name && !isReservedName(t.name)) syms.add(t.name);
    n.forEach(walk);
  });
  return [...syms];
}

/** Parse an expression safely. Throws with a readable message. */
export function parseExpr(input: string): MathNode {
  const s = preprocess(input);
  return math.parse(s);
}

/** Evaluate a compiled node numerically, tolerating complex results. */
export function evalNode(node: MathNode, scope: Record<string, number>): number {
  const v = node.evaluate({ ...scope });
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "re" in v && typeof (v as { re: unknown }).re === "number") {
    const c = v as { re: number; im: number };
    return Math.abs(c.im) < 1e-12 ? c.re : NaN;
  }
  return Number(v);
}

/* ------------------------------------------------------------------ */
/* Numeric helpers                                                     */
/* ------------------------------------------------------------------ */

/** Compile an expression string into a numeric function. */
export function compileFn(expr: string, vars: string[] = ["x"]): (...args: number[]) => number {
  const node = parseExpr(expr);
  const code = node.compile();
  return (...args: number[]) => {
    const scope: Record<string, number> = {};
    vars.forEach((v, i) => (scope[v] = args[i]));
    try {
      const v = code.evaluate(scope);
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "re" in v) {
        const c = v as { re: number; im: number };
        return c.im === 0 ? c.re : NaN;
      }
      return Number(v);
    } catch {
      return NaN;
    }
  };
}

/** Bisection root refinement. */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-12): number {
  let fa = f(a), m = a;
  for (let i = 0; i < 200; i++) {
    m = (a + b) / 2;
    const fm = f(m);
    if (Math.abs(fm) < tol || (b - a) / 2 < tol) return m;
    if (fa * fm < 0) b = m;
    else { a = m; fa = fm; }
  }
  return m;
}

function safeF(f: (x: number) => number, x: number): number {
  try {
    const y = f(x);
    return Number.isFinite(y) ? y : NaN;
  } catch {
    return NaN;
  }
}

function pushRoot(roots: number[], r: number) {
  const rounded = Math.abs(r) < 1e-10 ? 0 : Number(r.toPrecision(10));
  if (!roots.some((x) => Math.abs(x - rounded) < 1e-8)) roots.push(rounded);
}

/** Find real roots of f on [lo, hi] by sign-change scanning + bisection. */
export function findRoots(f: (x: number) => number, lo = -50, hi = 50, samples = 8000): number[] {
  const roots: number[] = [];
  const step = (hi - lo) / samples;
  let prevX = lo, prevY = safeF(f, lo);
  for (let i = 1; i <= samples; i++) {
    const x = lo + i * step;
    const y = safeF(f, x);
    if (Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY === 0) pushRoot(roots, prevX);
      else if (prevY * y < 0) pushRoot(roots, bisect(f, prevX, x));
    }
    prevX = x; prevY = y;
  }
  return roots;
}

/** Adaptive Simpson's rule for numeric integration. */
export function simpson(f: (x: number) => number, a: number, b: number, n = 1000): number {
  if (n % 2 === 1) n++;
  const h = (b - a) / n;
  let s = safeF(f, a) + safeF(f, b);
  for (let i = 1; i < n; i++) {
    const y = safeF(f, a + i * h);
    s += Number.isFinite(y) ? y * (i % 2 === 0 ? 2 : 4) : 0;
  }
  return (h / 3) * s;
}
