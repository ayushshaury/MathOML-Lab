/**
 * Integration engine: symbolic antiderivatives (nerdamer) with
 * rule explanations, definite integrals via the Fundamental Theorem
 * of Calculus, verification by differentiation, and numeric Simpson fallback.
 */
import { preprocess, parseExpr, toTex, fmt, texNum, simpson, compileFn, type Solution } from "./core";
import { nrd, nrdTry, nrdTex } from "./nerdamer-client";
import { differentiateSteps } from "./differentiate";

function texSafe(s: string): string {
  const t = nrdTex(s);
  if (t) return t;
  try { return toTex(s); } catch { return s; }
}

export function integrateSteps(input: string, v: string, definite: boolean, a?: number, b?: number): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    const node = parseExpr(p);
    const inputTex = toTex(node);
    steps.push({
      title: "The integral",
      explanation: definite
        ? "A definite integral computes the signed area between the curve and the x-axis over the given interval."
        : "An indefinite integral reverses differentiation: we look for a function F whose derivative is the integrand.",
      math: definite
        ? `\\int_{${texNum(a ?? 0)}}^{${texNum(b ?? 0)}} ${inputTex}\\,d${v}`
        : `\\int ${inputTex}\\,d${v}`,
    });

    // symbolic antiderivative
    const anti = nrdTry(`integrate(${p}, ${v})`);
    if (!anti) throw new Error("The symbolic engine could not process this integrand.");
    const antiStr = anti.toString();
    const antiTex = nrdTex(anti) ?? texSafe(antiStr);

    // classify the main rule used
    steps.push({
      title: "Find the antiderivative",
      explanation: describeRule(p, v, antiStr),
      math: `\\int ${inputTex}\\,d${v} = ${antiTex} + C`,
    });

    // verification by differentiating back
    try {
      const back = nrdTry(`diff(${antiStr}, ${v})`);
      if (back) {
        steps.push({
          title: "Verification — differentiate the antiderivative",
          explanation: "Differentiating F must return the original integrand. This proves the antiderivative is correct.",
          math: `\\frac{d}{d${v}}\\left(${antiTex}\\right) = ${nrdTex(back) ?? back.toString()}`,
        });
      }
    } catch { /* skip */ }

    if (!definite) {
      return {
        title: "Indefinite Integral",
        resultTex: `\\int ${inputTex}\\,d${v} = ${antiTex} + C`,
        resultText: `${antiStr} + C`,
        steps,
        notes: ["C is the constant of integration: infinitely many antiderivatives differ by a constant."],
        plot: { curves: [
          { label: `f(${v})`, expr: p },
          { label: `F(${v}) (antiderivative)`, expr: antiStr, dashed: true },
        ] },
      };
    }

    // definite: FTC
    const lo = a!, hi = b!;
    steps.push({
      title: "Fundamental Theorem of Calculus",
      explanation: "The definite integral equals the antiderivative evaluated at the upper limit minus its value at the lower limit.",
      math: `\\int_{${texNum(lo)}}^{${texNum(hi)}} ${inputTex}\\,d${v} = \\Big[${antiTex}\\Big]_{${texNum(lo)}}^{${texNum(hi)}} = F(${texNum(hi)}) - F(${texNum(lo)})`,
    });

    const F = compileFn(antiStr, [v]);
    const Fhi = F(hi), Flo = F(lo);
    if (!Number.isFinite(Fhi) || !Number.isFinite(Flo)) {
      throw new Error("The antiderivative could not be evaluated at the bounds (possible singularity).");
    }
    const value = Fhi - Flo;
    steps.push({
      title: "Evaluate at the limits",
      math: `F(${texNum(hi)}) - F(${texNum(lo)}) = ${fmt(Fhi)} - ${fmt(Flo)} = ${fmt(value)}`,
    });

    // numeric cross-check
    const f = compileFn(p, [v]);
    const numeric = simpson(f, lo, hi, 2000);
    if (Number.isFinite(numeric) && Math.abs(numeric - value) < Math.max(1e-4, Math.abs(value) * 1e-6)) {
      steps.push({
        title: "Numeric cross-check (Simpson's rule)",
        explanation: "An independent numerical approximation confirms the exact result.",
        math: `\\int_{${texNum(lo)}}^{${texNum(hi)}} ${inputTex}\\,d${v} \\approx ${fmt(numeric)} \\;\\checkmark`,
      });
    } else if (Number.isFinite(numeric)) {
      steps.push({
        title: "Numeric approximation (Simpson's rule)",
        math: `\\approx ${fmt(numeric)}`,
      });
    }

    return {
      title: "Definite Integral",
      resultTex: `\\int_{${texNum(lo)}}^{${texNum(hi)}} ${inputTex}\\,d${v} = ${fmt(value)}`,
      resultText: fmt(value),
      steps,
      plot: { curves: [{ label: `f(${v})`, expr: p }], area: { expr: p, from: lo, to: hi } },
      notes: [value >= 0
        ? "Positive value: the area above the x-axis dominates."
        : "Negative value: the curve lies mostly below the x-axis on this interval (signed area)."],
    };
  } catch (e) {
    // numeric fallback for definite integrals
    if (definite && a !== undefined && b !== undefined) {
      try {
        const p = preprocess(input);
        const f = compileFn(p, [v]);
        const value = simpson(f, a, b, 4000);
        if (!Number.isFinite(value)) throw new Error("The integral could not be computed numerically either (singularity in the interval?).");
        return {
          title: "Definite Integral (numeric)",
          resultTex: `\\int_{${texNum(a)}}^{${texNum(b)}} ${texSafe(p)}\\,d${v} \\approx ${fmt(value)}`,
          resultText: fmt(value),
          steps: [
            { title: "The integral", math: `\\int_{${texNum(a)}}^{${texNum(b)}} ${texSafe(p)}\\,d${v}` },
            {
              title: "Simpson's rule approximation",
              explanation: "No closed-form antiderivative was found, so we approximate the area numerically. Simpson's rule fits parabolas through successive triples of sample points — much more accurate than rectangles or trapezoids.",
              math: `\\int_a^b f(x)\\,dx \\approx \\frac{b-a}{3n}\\left[f(x_0) + 4f(x_1) + 2f(x_2) + \\cdots + 4f(x_{n-1}) + f(x_n)\\right] \\approx ${fmt(value)}`,
            },
          ],
          plot: { curves: [{ label: `f(${v})`, expr: p }], area: { expr: p, from: a, to: b } },
          error: (e as Error).message !== "The symbolic engine could not process this integrand." ? undefined : undefined,
        };
      } catch (e2) {
        return { title: "Integral", steps: [], error: (e2 as Error).message };
      }
    }
    return { title: "Integral", steps: [], error: (e as Error).message };
  }
}

function describeRule(p: string, v: string, anti: string): string {
  const s = p.toLowerCase();
  if (/\b(exp|e\^)/.test(s)) return "The exponential function is its own antiderivative: ∫eᵘdu = eᵘ + C.";
  if (/1\s*\/\s*\(?[^)]*\^\s*2/.test(s) && /sin/.test(s)) return "Integrals of powers of sine use the identity sin²x = (1 − cos 2x)/2 or reduction formulas.";
  if (/sin\(/.test(s) && /cos\(/.test(s) && /\*\s*cos|cos\)\s*\*|sin\([^)]*\)\s*\*\s*cos/.test(s)) return "Products of sine and cosine often yield to the substitution u = sin(x) (since du = cos(x)dx) or the product-to-sum identities.";
  if (/sin\(/.test(s)) return "The antiderivative of sine is negative cosine: ∫sin(u)du = −cos(u) + C (checked by differentiating).";
  if (/cos\(/.test(s)) return "The antiderivative of cosine is sine: ∫cos(u)du = sin(u) + C (checked by differentiating).";
  if (/1\s*\/\s*\(?[a-z]*\^?2|sqrt\(1-/.test(s)) return "This integrand matches the derivative pattern of arctan or arcsin.";
  if (/1\s*\/\s*[a-z]/.test(s)) return "The antiderivative of 1/u is the natural logarithm: ∫du/u = ln|u| + C.";
  if (/\*\s*[a-z]\s*\*|x\s*\*\s*(sin|cos|exp|log|e\b)/.test(s)) return "A product of different function families suggests integration by parts: ∫u dv = uv − ∫v du.";
  if (new RegExp(`\\(\\s*[-+]?\\d*\\*?\\s*${v}\\s*[-+][^)]*\\)`).test(s)) return "A linear inner expression suggests the substitution u = ax + b (du = a·dx).";
  return `The power rule is the workhorse of integration: for n ≠ −1, ∫${v}ⁿd${v} = ${v}^(n+1)/(n+1) + C. The engine matches your integrand against a table of standard forms and combines them linearly.`;
}

/** Tangent line at a point — used by the graphing calculator. */
export function tangentLine(input: string, at: number, v = "x"): { expr: string; tex: string; point: { x: number; y: number } } | null {
  try {
    const d = differentiateSteps(input, v, 1);
    if (d.error || !d.resultText) return null;
    const f = compileFn(input, [v]);
    const df = compileFn(d.resultText, [v]);
    const y = f(at), m = df(at);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
    const b = y - m * at;
    const expr = `${m}*${v} + (${b})`;
    const tex = `y = ${fmt(m)}\\,${v} ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`;
    return { expr, tex, point: { x: at, y } };
  } catch {
    return null;
  }
}

/** Area between curve and x-axis (handling sign changes properly). */
export function signedArea(input: string, a: number, b: number, v = "x"): number {
  const f = compileFn(input, [v]);
  return simpson(f, a, b, 4000);
}
