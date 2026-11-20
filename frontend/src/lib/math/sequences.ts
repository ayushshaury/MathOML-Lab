/**
 * Sequences & series engine: pattern detection (arithmetic, geometric),
 * nth term, partial sums, finite/infinite series, Taylor polynomials.
 */
import { preprocess, toTex, fmt, texNum, compileFn, type Solution } from "./core";
import { nrdTry, nrdTex } from "./nerdamer-client";
import { differentiateSteps } from "./differentiate";

function texSafe(s: string): string {
  const t = nrdTex(s);
  if (t) return t;
  try { return toTex(s); } catch { return s; }
}

export interface SequenceResult extends Solution {
  kind?: "arithmetic" | "geometric" | "other";
  nthTerm?: string;
  nthTermTex?: string;
  sumFormula?: string;
}

export function analyzeSequence(numbers: number[]): SequenceResult {
  const steps: Solution["steps"] = [];
  try {
    if (numbers.length < 3) throw new Error("Please enter at least 3 terms of the sequence.");
    const n = numbers.length;
    steps.push({ title: "The sequence", math: numbers.map((x) => fmt(x)).join(",\\; ") });

    // arithmetic?
    const d = numbers[1] - numbers[0];
    const isArithmetic = numbers.every((x, i) => i === 0 || Math.abs(x - numbers[i - 1] - d) < 1e-9);
    if (isArithmetic) {
      steps.push({
        title: "Test for an arithmetic sequence (constant difference)",
        explanation: "An arithmetic sequence adds the same amount d each step. Subtract consecutive terms to check.",
        math: `d = ${fmt(numbers[1])} - ${fmt(numbers[0])} = ${fmt(d)}` +
          (n > 2 ? `\\quad\\checkmark\\ \\text{(all differences equal } ${fmt(d)}\\text{)}` : ""),
      });
      steps.push({
        title: "nth term formula",
        explanation: "Starting from the first term a₁, adding d exactly (n − 1) times gives the nth term.",
        math: `a_n = a_1 + (n-1)\\,d = ${fmt(numbers[0])} + (n-1)\\cdot${fmt(d)}`,
      });
      const nth = `${numbers[0]} + (n-1)*(${d})`;
      steps.push({
        title: "Sum of the first n terms",
        explanation: "Pair the first and last terms: each pair sums to a₁ + aₙ, and there are n/2 such pairs.",
        math: `S_n = \\frac{n}{2}\\left(2a_1 + (n-1)d\\right) = \\frac{n}{2}\\left(a_1 + a_n\\right)`,
      });
      return {
        title: "Arithmetic Sequence",
        kind: "arithmetic",
        nthTerm: nth,
        nthTermTex: `a_n = ${fmt(numbers[0])} + (n-1)\\cdot${fmt(d)}`,
        sumFormula: `S_n = n/2*(2*${numbers[0]} + (n-1)*(${d}))`,
        resultTex: `a_n = ${fmt(numbers[0])} + (n-1)\\cdot${fmt(d)}`,
        resultText: `an = ${numbers[0]} + (n-1)*(${d})`,
        steps,
      };
    }

    // geometric?
    if (Math.abs(numbers[0]) > 1e-12) {
      const r = numbers[1] / numbers[0];
      const isGeometric = numbers.every((x, i) => i === 0 || Math.abs(x - numbers[i - 1] * r) < 1e-9 * Math.max(1, Math.abs(x)));
      if (isGeometric) {
        steps.push({
          title: "Test for a geometric sequence (constant ratio)",
          explanation: "A geometric sequence multiplies by the same factor r each step. Divide consecutive terms to check.",
          math: `r = \\frac{${fmt(numbers[1])}}{${fmt(numbers[0])}} = ${fmt(r)}`,
        });
        steps.push({
          title: "nth term formula",
          math: `a_n = a_1\\,r^{\\,n-1} = ${fmt(numbers[0])}\\cdot${fmt(r)}^{\\,n-1}`,
        });
        steps.push({
          title: "Sum of the first n terms",
          math: `S_n = a_1\\,\\frac{1 - r^n}{1 - r}`,
        });
        if (Math.abs(r) < 1) {
          steps.push({
            title: "Infinite series (|r| < 1)",
            explanation: "Because |r| < 1 the terms shrink to zero, so the infinite sum converges.",
            math: `S_\\infty = \\frac{a_1}{1 - r} = \\frac{${fmt(numbers[0])}}{1 - (${fmt(r)})} = ${fmt(numbers[0] / (1 - r))}`,
          });
        } else {
          steps.push({
            title: "Infinite series diverges (|r| ≥ 1)",
            explanation: "When the ratio is at least 1 in absolute value the terms do not approach zero, so the infinite sum diverges.",
          });
        }
        return {
          title: "Geometric Sequence",
          kind: "geometric",
          nthTerm: `${numbers[0]}*(${r})^(n-1)`,
          nthTermTex: `a_n = ${fmt(numbers[0])}\\cdot${fmt(r)}^{\\,n-1}`,
          sumFormula: `${numbers[0]}*(1-(${r})^n)/(1-(${r}))`,
          resultTex: `a_n = ${fmt(numbers[0])}\\cdot${fmt(r)}^{\\,n-1}`,
          resultText: `an = ${numbers[0]}*(${r})^(n-1)`,
          steps,
        };
      }
    }

    // quadratic fit (second differences)
    const diffs1 = numbers.slice(1).map((x, i) => x - numbers[i]);
    const diffs2 = diffs1.slice(1).map((x, i) => x - diffs1[i]);
    if (diffs2.length && diffs2.every((x) => Math.abs(x - diffs2[0]) < 1e-9)) {
      const a = diffs2[0] / 2;
      // solve a*n^2 + b*n + c through first three terms
      const m = [
        [1, 1, 1],
        [4, 2, 1],
        [9, 3, 1],
      ];
      const rhs = numbers.slice(0, 3);
      const sol = gauss3(m, rhs);
      if (sol) {
        const [b, c] = [sol[1], sol[2]];
        steps.push({
          title: "Second differences are constant — quadratic pattern",
          explanation: "Constant second differences mean the nth term formula is a quadratic polynomial in n.",
          math: `\\Delta^2 = ${fmt(diffs2[0])} \\;\\Rightarrow\\; a_n = a n^2 + b n + c`,
        });
        steps.push({
          title: "Fit the quadratic through the first three terms",
          math: `a_n = ${fmt(a)}n^2 ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}n ${c >= 0 ? "+" : "-"} ${fmt(Math.abs(c))}`,
        });
        const nth = `${a}*n^2 + (${b})*n + (${c})`;
        return {
          title: "Quadratic Sequence",
          kind: "other",
          nthTerm: nth,
          nthTermTex: `a_n = ${fmt(a)}\\,n^2 ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}\\,n ${c >= 0 ? "+" : "-"} ${fmt(Math.abs(c))}`,
          resultTex: `a_n = ${fmt(a)}\\,n^2 ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}\\,n ${c >= 0 ? "+" : "-"} ${fmt(Math.abs(c))}`,
          resultText: nth,
          steps,
          notes: ["The next terms and partial sums can be computed from this formula directly."],
        };
      }
    }

    return {
      title: "Sequence Analysis",
      kind: "other",
      steps,
      error: "No standard pattern (arithmetic, geometric, quadratic) was recognised. Try entering a formula for the nth term instead, e.g. n^2 + 1.",
    };
  } catch (e) {
    return { title: "Sequence Analysis", steps: [], error: (e as Error).message };
  }
}

function gauss3(A: number[][], b: number[]): number[] | null {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < 3; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(3).fill(0);
  for (let r = 2; r >= 0; r--) {
    let s = M[r][3];
    for (let c = r + 1; c < 3; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Evaluate nth term / sum for a given formula. */
export function evaluateTerm(nthExpr: string, n: number): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(nthExpr);
    const f = compileFn(p, ["n"]);
    steps.push({ title: "The term formula", math: `a_n = ${texSafe(p)}` });
    steps.push({ title: `Substitute n = ${n}`, math: `a_{${n}} = ${texSafe(p)}\\Big|_{n=${n}} = ${fmt(f(n))}` });
    // partial sum
    let s = 0;
    for (let k = 1; k <= Math.min(n, 5000); k++) s += f(k);
    if (n <= 5000) {
      steps.push({ title: "Partial sum", explanation: "Adding the terms from 1 up to n.", math: `S_{${n}} = \\sum_{k=1}^{${n}} a_k = ${fmt(s)}` });
    }
    return {
      title: "Sequence Term",
      resultTex: `a_{${n}} = ${fmt(f(n))}${n <= 5000 ? `,\\quad S_{${n}} = ${fmt(s)}` : ""}`,
      resultText: `a${n} = ${fmt(f(n))}`,
      steps,
    };
  } catch (e) {
    return { title: "Sequence Term", steps: [], error: (e as Error).message };
  }
}

/** Sum of a series Σ expr from k=a to b with steps. */
export function sumSeries(expr: string, from: number, to: number): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(expr);
    steps.push({
      title: "The series",
      math: `\\sum_{k=${from}}^{${to}} ${texSafe(p)}`,
    });
    // symbolic via nerdamer
    const sym = nrdTry(`sum(${p}, k, ${from}, ${to})`);
    const f = compileFn(p, ["k"]);
    if (sym) {
      const val = Number(sym.valueOf());
      steps.push({
        title: "Closed-form summation",
        explanation: "Standard summation identities (power sums, geometric series, telescoping) give a closed form.",
        math: `\\sum_{k=${from}}^{${to}} ${texSafe(p)} = ${texSafe(sym.toString())}${Number.isFinite(val) ? ` = ${fmt(val)}` : ""}`,
      });
      return {
        title: "Series Sum",
        resultTex: `\\sum_{k=${from}}^{${to}} ${texSafe(p)} = ${Number.isFinite(val) ? fmt(val) : texSafe(sym.toString())}`,
        resultText: Number.isFinite(val) ? fmt(val) : sym.toString(),
        steps,
      };
    }
    // numeric fallback
    let s = 0;
    for (let k = from; k <= Math.min(to, from + 100000); k++) s += f(k);
    steps.push({ title: "Term-by-term addition", math: `= ${fmt(s)}` });
    return { title: "Series Sum", resultTex: `\\sum = ${fmt(s)}`, resultText: fmt(s), steps };
  } catch (e) {
    return { title: "Series Sum", steps: [], error: (e as Error).message };
  }
}

/** Taylor / Maclaurin polynomial with steps. */
export function taylorSeries(expr: string, at: number, order: number): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(expr);
    const f = compileFn(p, ["x"]);
    steps.push({
      title: at === 0 ? "Maclaurin series (Taylor at 0)" : `Taylor series around x = ${fmt(at)}`,
      explanation: "A polynomial that matches the function's value and all its derivatives at one point. Near that point it is an excellent approximation.",
      math: `f(x) \\approx \\sum_{k=0}^{${order}} \\frac{f^{(k)}(${fmt(at)})}{k!}\\,(x ${at >= 0 ? "-" : "+"} ${fmt(Math.abs(at))})^k`,
    });
    let current = p;
    let value = f(at);
    const terms: { k: number; derivTex: string; coeff: number }[] = [];
    for (let k = 0; k <= order; k++) {
      if (k > 0) {
        const d = differentiateSteps(current, "x", 1);
        if (d.error || !d.resultText) throw new Error(`Could not differentiate to order ${k}.`);
        current = d.resultText;
        const df = compileFn(current, ["x"]);
        value = df(at);
      }
      const coeff = value / factorial(k);
      if (Number.isFinite(coeff)) terms.push({ k, derivTex: current, coeff });
      steps.push({
        title: `Order ${k} derivative at x = ${fmt(at)}`,
        math: `f^{(${k})}(x) = ${texSafe(k === 0 ? p : current)},\\quad f^{(${k})}(${fmt(at)}) = ${fmt(value)},\\quad \\frac{f^{(${k})}(${fmt(at)})}{${k}!} = ${fmt(coeff)}`,
      });
    }
    const poly = terms
      .filter((t) => Math.abs(t.coeff) > 1e-12)
      .map((t) => t.k === 0
        ? fmt(t.coeff)
        : t.k === 1
          ? `${fmt(t.coeff)}\\,(x ${at >= 0 ? "-" : "+"} ${fmt(Math.abs(at))})`
          : `\\frac{${fmt(t.coeff * 1)}}{1}\\,(x ${at >= 0 ? "-" : "+"} ${fmt(Math.abs(at))})^{${t.k}}`)
      .join(" + ")
      .replace(/ \+ -/g, " - ");
    steps.push({ title: `Taylor polynomial of degree ${order}`, math: `P_{${order}}(x) = ${poly}` });
    const exprPlain = terms
      .filter((t) => Math.abs(t.coeff) > 1e-12)
      .map((t) => t.k === 0 ? `${t.coeff}` : t.k === 1 ? `(${t.coeff})*(x-(${at}))` : `(${t.coeff})*(x-(${at}))^${t.k}`)
      .join(" + ");
    return {
      title: "Taylor Series",
      resultTex: `P_{${order}}(x) = ${poly}`,
      resultText: exprPlain,
      steps,
      plot: { curves: [{ label: "f(x)", expr: p }, { label: `P${order}(x)`, expr: exprPlain, dashed: true }] },
      notes: [`The polynomial matches f and its first ${order} derivatives at x = ${fmt(at)}.`],
    };
  } catch (e) {
    return { title: "Taylor Series", steps: [], error: (e as Error).message };
  }
}

function factorial(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

/** Convergence check for Σ 1/n^p style series. */
export function seriesConvergence(expr: string): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(expr);
    steps.push({ title: "The series", math: `\\sum_{n=1}^{\\infty} ${texSafe(p)}` });
    // p-series test
    const m = p.match(/^1\s*\/\s*n\s*\^\s*\(?\s*([0-9.]+)\s*\)?$/);
    if (m) {
      const pp = Number(m[1]);
      steps.push({
        title: "p-series test",
        explanation: "The p-series Σ 1/n^p converges if and only if p > 1.",
        math: `p = ${texNum(pp)} ${pp > 1 ? "> 1\\;\\Rightarrow\\;\\text{converges}" : "\\le 1\\;\\Rightarrow\\;\\text{diverges}"}`,
      });
      const zeta = (s: number): number => {
        // numeric partial sum with tail estimate
        let sum = 0;
        for (let n = 1; n <= 200000; n++) sum += 1 / Math.pow(n, s);
        return sum;
      };
      if (pp > 1) {
        steps.push({ title: "Numerical estimate of the sum", math: `\\sum \\frac{1}{n^{${fmt(pp)}}} \\approx ${fmt(zeta(pp))}` });
      }
      return {
        title: "Series Convergence",
        resultTex: pp > 1 ? `\\sum ${texSafe(p)}\\ \\text{converges}` : `\\sum ${texSafe(p)}\\ \\text{diverges}`,
        resultText: pp > 1 ? "converges (p-series)" : "diverges (p-series)",
        steps,
      };
    }
    // ratio test
    const f = compileFn(p, ["n"]);
    const ratio = (n: number) => Math.abs(f(n + 1) / f(n));
    const r = ratio(10000);
    if (Number.isFinite(r)) {
      steps.push({
        title: "Ratio test",
        explanation: "Compute L = lim |aₙ₊₁/aₙ|. The series converges if L < 1 and diverges if L > 1; L = 1 is inconclusive.",
        math: `L = \\lim_{n\\to\\infty}\\left|\\frac{a_{n+1}}{a_n}\\right| \\approx ${fmt(r)}`,
      });
      const verdict = r < 0.999 ? "converges" : r > 1.001 ? "diverges" : "inconclusive";
      steps.push({
        title: `Conclusion: ${verdict}`,
        explanation: verdict === "inconclusive" ? "The ratio test gives L ≈ 1 — try a comparison or integral test." : "",
      });
      return {
        title: "Series Convergence",
        resultTex: `\\sum ${texSafe(p)}\\ \\text{${verdict}}`,
        resultText: verdict,
        steps,
      };
    }
    throw new Error("Could not analyse this series automatically.");
  } catch (e) {
    return { title: "Series Convergence", steps: [], error: (e as Error).message };
  }
}
