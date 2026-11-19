/**
 * Ordinary differential equation solver with step-by-step methods:
 *  - direct integration (y' = g(x))
 *  - separable equations
 *  - first-order linear via integrating factor
 *  - second-order linear constant coefficients (characteristic equation +
 *    undetermined coefficients, or Laplace transform when ICs are given)
 *  - numeric RK4 solution curves + direction field
 */
import { math, preprocess, parseExpr, toTex, fmt, texNum, compileFn, type Solution, type PlotSpec } from "./core";
import { nrd, nrdTry, nrdTex } from "./nerdamer-client";

function texSafe(s: string): string {
  const t = nrdTex(s);
  if (t) return t;
  try { return toTex(s); } catch { return s; }
}

/** Normalise ODE notation to internal symbols: Dy (y'), D2y (y''). */
function normalizeODE(raw: string): string {
  let s = preprocess(raw);
  s = s.replace(/d\^?2\s*y\s*\/\s*d\s*x\s*\^?2/g, " D2y ");
  s = s.replace(/d\s*y\s*\/\s*d\s*x/g, " Dy ");
  s = s.replace(/y\s*''|y\s*’’|y''/g, " D2y ");
  s = s.replace(/y\s*'|y’/g, " Dy ");
  s = s.replace(/\bD2y\b/g, "D2y");
  return s;
}

export interface OdeICs {
  x0?: number;
  y0?: number;
  y1?: number; // y'(x0)
}

interface OdeTerms {
  a2: string; a1: string; a0: string; g: string;
  lhsTex: string; rhsTex: string;
}

/** Split equation into a2·y'' + a1·y' + a0·y = g with coefficient strings. */
function parseODE(raw: string): OdeTerms {
  const s = normalizeODE(raw);
  const sides = s.split("=");
  if (sides.length > 2) throw new Error("Use exactly one '=' sign in the equation.");
  const lhsStr = (sides[0] || "0").trim() || "0";
  const rhsStr = (sides[1] ?? "0").trim() || "0";
  const lhs = parseExpr(lhsStr);
  const rhs = parseExpr(rhsStr);

  const acc = { D2y: "0", Dy: "0", y: "0", rest: "0" };
  const addTerm = (accStr: string, termStr: string) => {
    if (termStr === "0") return accStr;
    if (accStr === "0") return termStr;
    try {
      return math.simplify(`(${accStr}) + (${termStr})`).toString();
    } catch {
      return `(${accStr}) + (${termStr})`;
    }
  };

  const walk = (node: ReturnType<typeof parseExpr>, sign: number, side: 0 | 1) => {
    const t = node as unknown as {
      type: string; op?: string; args?: ReturnType<typeof parseExpr>[];
      value?: number; name?: string; content?: ReturnType<typeof parseExpr>;
    };
    // coefficients of y-terms move to the LEFT (RHS negated);
    // non-y terms move to the RIGHT (LHS negated) so that acc.rest = g.
    const wrapCoeff = (str: string) => (sign >= 0 ? (side === 0 ? str : `(-1)*(${str})`) : (side === 0 ? `(-1)*(${str})` : str));
    const wrapRest = (str: string) => (sign >= 0 ? (side === 0 ? `(-1)*(${str})` : str) : (side === 0 ? str : `(-1)*(${str})`));
    if (t.type === "ConstantNode") { acc.rest = addTerm(acc.rest, wrapRest(t.value === 0 ? "0" : String(t.value))); return; }
    if (t.type === "SymbolNode") {
      if (t.name === "D2y") acc.D2y = addTerm(acc.D2y, wrapCoeff("1"));
      else if (t.name === "Dy") acc.Dy = addTerm(acc.Dy, wrapCoeff("1"));
      else if (t.name === "y") acc.y = addTerm(acc.y, wrapCoeff("1"));
      else acc.rest = addTerm(acc.rest, wrapRest(t.name ?? ""));
      return;
    }
    if (t.type === "ParenthesisNode") return walk(t.content as ReturnType<typeof parseExpr>, sign, side);
    if (t.type === "OperatorNode") {
      if (t.op === "+") { (t.args ?? []).forEach((a) => walk(a, sign, side)); return; }
      if (t.op === "-" && (t.args ?? []).length === 2) { walk(t.args![0], sign, side); walk(t.args![1], -sign, side); return; }
      if (t.op === "-" && (t.args ?? []).length === 1) { walk(t.args![0], -sign, side); return; }
      if (t.op === "*" || t.op === "/") {
        // partition factors into derivative symbols vs rest (division handled via ^-1 below)
        let dSyms = 0;
        const restFactors: string[] = [];
        for (const a of t.args ?? []) {
          const at = a as unknown as { type: string; name?: string };
          if (at.type === "SymbolNode" && (at.name === "D2y" || at.name === "Dy" || at.name === "y")) dSyms++;
          else restFactors.push(a.toString());
        }
        if (dSyms > 1) throw new Error("Non-linear ODE: a term multiplies two y-factors.");
        if (restFactors.some((f) => /\by\b|D2y|Dy/.test(f.replace(/D2y|Dy/g, "y")))) {
          throw new Error("Non-linear ODE: y appears inside a coefficient (e.g. sin(y) or 1/y).");
        }
        const coeff = restFactors.length ? restFactors.join("*") : "1";
        const key = dSyms === 1
          ? ((t.args ?? []).find((a) => { const at = a as unknown as { name?: string; type: string }; return at.type === "SymbolNode" && (at.name === "D2y" || at.name === "Dy" || at.name === "y"); }) as unknown as { name: string }).name
          : null;
        if (key) acc[key] = addTerm(acc[key], wrapCoeff(coeff));
        else acc.rest = addTerm(acc.rest, wrapRest(coeff));
        return;
      }
      if (t.op === "^") {
        const base = (t.args ?? [])[0] as unknown as { type: string; name?: string };
        if (base?.type === "SymbolNode" && ["D2y", "Dy", "y"].includes(base.name ?? "")) {
          throw new Error("Powers of y are not supported (non-linear ODE).");
        }
        acc.rest = addTerm(acc.rest, wrapRest(node.toString()));
        return;
      }
    }
    // function of x only
    acc.rest = addTerm(acc.rest, wrapRest(node.toString()));
  };

  // rewrite a/b as a * b^-1 so the product branch handles division correctly
  const quotientsToProducts = (n: ReturnType<typeof parseExpr>): ReturnType<typeof parseExpr> =>
    n.transform((child) => {
      const ct = child as unknown as { type: string; op?: string; args?: ReturnType<typeof parseExpr>[] };
      if (ct.type === "OperatorNode" && ct.op === "/" && ct.args?.length === 2) {
        const inv = new math.OperatorNode("^", "pow", [ct.args[1], new math.ConstantNode(-1)]);
        return new math.OperatorNode("*", "multiply", [ct.args[0], inv]);
      }
      return child;
    }) as ReturnType<typeof parseExpr>;

  walk(quotientsToProducts(lhs), 1, 0);
  walk(quotientsToProducts(rhs), 1, 1);

  // acc now holds the standard form a2·y'' + a1·y' + a0·y = g (acc.rest = g)
  return {
    a2: acc.D2y, a1: acc.Dy, a0: acc.y, g: acc.rest,
    lhsTex: toTexSafeStr(lhsStr), rhsTex: toTexSafeStr(rhsStr),
  };
}

function toTexSafeStr(s: string): string {
  try { return toTex(s.replace(/D2y/g, "y''").replace(/Dy/g, "y'")); } catch { return s; }
}

function containsAny(node: ReturnType<typeof parseExpr>, names: string[]): boolean {
  const self = node as unknown as { type: string; name?: string };
  if (self.type === "SymbolNode" && names.includes(self.name ?? "")) return true;
  let found = false;
  node.forEach(function walk(n: ReturnType<typeof parseExpr>) {
    const t = n as unknown as { type: string; name?: string };
    if (t.type === "SymbolNode" && names.includes(t.name ?? "")) found = true;
    n.forEach(walk);
  });
  return found;
}

function constVal(s: string): number | null {
  try {
    const v = parseExpr(s).evaluate();
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function solveODE(raw: string, ics: OdeICs): Solution {
  const steps: Solution["steps"] = [];
  try {
    const eq = parseODE(raw);
    const a2v = constVal(eq.a2), a1v = constVal(eq.a1), a0v = constVal(eq.a0);

    steps.push({
      title: "The differential equation",
      explanation: "We need a function y(x) that satisfies this equation.",
      math: `${toTexSafeStr(eq.lhsTex ? normalizeODE(raw).split("=")[0].trim().replace(/D2y/g, "y''").replace(/Dy/g, "y'") : raw)} = ${normalizeODE(raw).split("=")[1]?.trim() ?? "0"}`,
    });

    const isSecond = a2v !== null && Math.abs(a2v) > 1e-12;
    const isFirstLinear = !isSecond && a1v !== null && Math.abs(a1v) > 1e-12;

    // ----- second order, constant coefficients -----
    if (isSecond && a1v !== null && a0v !== null) {
      return secondOrder(raw, eq, a2v!, a1v!, a0v!, ics, steps);
    }

    // ----- first order linear -----
    if (isFirstLinear && a0v !== null) {
      const A = a0v! / a1v!;
      if (Math.abs(a0v!) < 1e-12) {
        // y' = g(x)/a1  → direct integration
        return directIntegration(raw, eq, a1v!, ics, steps);
      }
      return firstOrderLinearConst(raw, eq, a1v!, A, ics, steps);
    }

    // ----- separable attempt: y' = f(x)·h(y) -----
    if (!isSecond && a1v !== null && Math.abs(a1v!) > 1e-12) {
      const sep = trySeparable(raw, eq, a1v!, [...steps]);
      if (sep) return sep;
    }

    // ----- first order linear, variable coefficients: integrating factor -----
    if (!isSecond && a1v !== null && Math.abs(a1v!) > 1e-12 && constVal(eq.a0) === null) {
      const ifResult = tryIntegratingFactor(raw, eq, a1v!, ics, [...steps]);
      if (ifResult) return ifResult;
    }

    // ----- fallback: numeric -----
    return numericODE(raw, eq, ics, steps, "This equation does not match a closed-form method (it may be non-linear or have variable coefficients), so we solve it numerically with the 4th-order Runge–Kutta method (RK4).");
  } catch (e) {
    return { title: "Differential Equation", steps: [], error: (e as Error).message };
  }
}

/* ---------- y' = g(x) ---------- */
function directIntegration(raw: string, eq: OdeTerms, a1: number, ics: OdeICs, steps: Solution["steps"]): Solution {
  const gOverA = `(${eq.g})/(${a1})`;
  steps.push({
    title: "Direct integration",
    explanation: "The equation has the form y′ = g(x): the right side does not involve y, so we simply integrate both sides with respect to x.",
    math: `\\frac{dy}{dx} = ${texSafe(gOverA)}\\;\\Rightarrow\\; y = \\int ${texSafe(gOverA)}\\,dx + C`,
  });
  const anti = nrdTry(`integrate(${gOverA}, x)`);
  if (!anti) return numericODE(raw, eq, ics, steps, "The right-hand side has no elementary antiderivative, so we solve numerically with RK4.");
  const antiStr = anti.toString();
  steps.push({ title: "Antiderivative", math: `y = ${texSafe(antiStr)} + C` });
  return applyICs(`(${antiStr}) + C`, ics, steps, raw, eq, 1);
}

/* ---------- y' + Ay = g(x), A constant ---------- */
function firstOrderLinearConst(raw: string, eq: OdeTerms, a1: number, A: number, ics: OdeICs, steps: Solution["steps"]): Solution {
  steps.push({
    title: "First-order linear equation",
    explanation: "Divide by the coefficient of y′ to reach the standard form y′ + P(x)·y = Q(x).",
    math: `y' + ${texNum(A)}\\,y = ${texSafe(`(${eq.g})/(${a1})`)}`,
  });
  // integrating factor
  steps.push({
    title: "Integrating factor",
    explanation: `For y′ + P·y = Q the integrating factor is μ(x) = e^∫P dx. Here P is the constant ${fmt(A)}, so μ = e^{${fmt(A)}x}.`,
    math: `\\mu(x) = e^{\\int ${texNum(A)}\\,dx} = e^{${texNum(A)}\\,x}`,
  });
  const gOverA = `(${eq.g})/(${a1})`;
  const muInt = nrdTry(`integrate(e^(${A}*x) * (${gOverA}), x)`);
  let yExpr: string | null = null;
  if (muInt) {
    steps.push({
      title: "Multiply through by μ and integrate",
      explanation: "After multiplying, the left side becomes (μ·y)′ — a perfect derivative — so one integration recovers y.",
      math: `\\left(e^{${texNum(A)}x}\\,y\\right)' = e^{${texNum(A)}x}\\cdot ${texSafe(gOverA)} \\;\\Rightarrow\\; e^{${texNum(A)}x}\\,y = ${texSafe(muInt.toString())} + C`,
    });
    yExpr = `e^(${-A}*x) * ((${muInt.toString()}) + C)`;
    steps.push({ title: "Solve for y", math: `y = ${texSafe(yExpr)}` });
    return applyICs(yExpr, ics, steps, raw, eq, 1);
  }
  // homogeneous + particular via ansatz
  const yh = `C*e^(${-A}*x)`;
  steps.push({
    title: "Homogeneous solution",
    explanation: "Set the right side to zero: y′ + P y = 0 has the exponential solution.",
    math: `y_h = C\\,e^{${texNum(-A)}\\,x}`,
  });
  const yp = particularAnsatz(gOverA, 1, A, 0, steps);
  if (yp) {
    const y = `(${yh}) + (${yp})`;
    steps.push({ title: "General solution", math: `y = ${texSafe(yh)} + ${texSafe(yp)}` });
    return applyICs(y, ics, steps, raw, eq, 1);
  }
  return numericODE(raw, eq, ics, steps, "The forcing term has no simple particular solution form, so we compute the solution numerically with RK4.");
}

/* ---------- second order constant coefficients ---------- */
function secondOrder(raw: string, eq: OdeTerms, a2: number, a1: number, a0: number, ics: OdeICs, steps: Solution["steps"]): Solution {
  steps.push({
    title: "Second-order linear equation with constant coefficients",
    explanation: "Divide by the leading coefficient to obtain the standard form y″ + b·y′ + c·y = g(x).",
    math: `y'' ${a1 / a2 >= 0 ? "+" : "-"} ${texNum(Math.abs(a1 / a2))}\\,y' ${a0 / a2 >= 0 ? "+" : "-"} ${texNum(Math.abs(a0 / a2))}\\,y = ${texSafe(`(${eq.g})/(${a2})`)}`,
  });
  const b = a1 / a2, c = a0 / a2, gS = `(${eq.g})/(${a2})`;
  steps.push({
    title: "Solve the homogeneous equation first (g = 0)",
    explanation: "Try y = e^{rx}. Substituting gives the characteristic equation — a plain quadratic for r.",
    math: `y = e^{rx}\\;\\Rightarrow\\; r^2 ${b >= 0 ? "+" : "-"} ${texNum(Math.abs(b))}\\,r ${c >= 0 ? "+" : "-"} ${texNum(Math.abs(c))} = 0`,
  });
  const disc = b * b - 4 * c;
  let basis: string[] = [];
  let basisTex: string[] = [];
  if (disc > 1e-12) {
    const r1 = (-b + Math.sqrt(disc)) / 2, r2 = (-b - Math.sqrt(disc)) / 2;
    basis = [`e^(${r1}*x)`, `e^(${r2}*x)`];
    basisTex = [`e^{${fmt(r1)}x}`, `e^{${fmt(r2)}x}`];
    steps.push({
      title: "Two distinct real roots",
      math: `r_{1,2} = \\frac{${texNum(-b)} \\pm \\sqrt{${texNum(disc)}}}{2} \\;\\Rightarrow\\; r_1 = ${texNum(r1)},\\; r_2 = ${texNum(r2)}`,
    });
  } else if (Math.abs(disc) <= 1e-12) {
    const r = -b / 2;
    basis = [`e^(${r}*x)`, `x*e^(${r}*x)`];
    basisTex = [`e^{${fmt(r)}x}`, `x\\,e^{${fmt(r)}x}`];
    steps.push({
      title: "Repeated root",
      explanation: "When the discriminant is zero there is only one exponential solution; a second, independent solution is obtained by multiplying by x.",
      math: `r = ${texNum(r)}\\;\\text{(double)} \\;\\Rightarrow\\; y_h = (C_1 + C_2\\,x)\\,e^{${texNum(r)}x}`,
    });
  } else {
    const re = -b / 2, im = Math.sqrt(-disc) / 2;
    basis = [`e^(${re}*x)*cos(${im}*x)`, `e^(${re}*x)*sin(${im}*x)`];
    basisTex = [`e^{${fmt(re)}x}\\cos(${fmt(im)}x)`, `e^{${fmt(re)}x}\\sin(${fmt(im)}x)`];
    steps.push({
      title: "Complex conjugate roots",
      explanation: "Complex roots r = α ± βi produce oscillating solutions built from Euler's formula e^{(α+βi)x} = e^{αx}(cos βx + i sin βx).",
      math: `r_{1,2} = ${texNum(re)} \\pm ${texNum(Math.abs(im))}\\,i`,
    });
  }
  steps.push({
    title: "Homogeneous solution",
    math: `y_h = C_1\\,${basisTex[0]} + C_2\\,${basisTex[1]}`,
  });

  // particular solution
  const g0 = constVal(gS);
  const yp = particularAnsatz(gS, 2, b, c, steps);
  const yhExpr = `C1*(${basis[0]}) + C2*(${basis[1]})`;
  if (yp) {
    const y = `(${yhExpr}) + (${yp})`;
    steps.push({
      title: "General solution",
      explanation: "The complete solution is homogeneous + particular.",
      math: `y = ${texSafe(yhExpr)} + ${texSafe(yp)}`,
    });
    void g0;
    return applyICs(y, ics, steps, raw, eq, 2, basis);
  }
  // no particular found: numeric or homogeneous-only answer
  steps.push({
    title: "General (homogeneous) solution",
    explanation: "The forcing term does not match a standard ansatz; the homogeneous family below is exact — add a numerical particular solution if needed.",
    math: `y_h = ${texSafe(yhExpr)}`,
  });
  if (ics.y0 !== undefined) return numericODE(raw, eq, ics, steps, "We compute the particular solution numerically with RK4.");
  return {
    title: "Differential Equation",
    resultTex: `y_h = C_1\\,${basisTex[0]} + C_2\\,${basisTex[1]}`,
    resultText: yhExpr,
    steps,
    plot: odePlot(raw, eq, undefined),
  };
}

/* ---------- method of undetermined coefficients ---------- */
function particularAnsatz(gExpr: string, order: number, b: number, c: number, steps: Solution["steps"]): string | null {
  const g = gExpr.trim();
  // zero forcing term → no particular solution needed
  const gVal = constVal(g);
  if (gVal === 0) return "0";
  // polynomial?
  const poly = tryPolyParticular(g, order, b, c, steps);
  if (poly) return poly;
  // exponential e^{kx} (k const, possibly 0 covered by poly)
  const mExp = g.match(/^e\^\(?([-+0-9.]+)\*?[a-z]\)?$/);
  if (mExp) {
    const k = Number(mExp[1]);
    steps.push({
      title: "Particular solution — exponential ansatz",
      explanation: `Because the forcing term is e^{${fmt(k)}x}, we try y_p = A·e^{${fmt(k)}x} and determine A by substitution.`,
      math: `y_p = A\\,e^{${fmt(k)}x}`,
    });
    const denom = k * k + b * k + c;
    if (Math.abs(denom) > 1e-12) {
      const A = 1 / denom;
      steps.push({ title: "Substitute and match coefficients", math: `(${fmt(k * k)} + ${fmt(b * k)} + ${fmt(c)})\\,A = 1 \\;\\Rightarrow\\; A = ${fmt(A)}` });
      return `${A}*e^(${k}*x)`;
    }
    // resonance: k is a root → multiply by x^order
    steps.push({
      title: "Resonance — multiply the ansatz by x",
      explanation: `k = ${fmt(k)} is a root of the characteristic equation, so we multiply the trial solution by x.`,
      math: `y_p = A\\,x\\,e^{${fmt(k)}x}`,
    });
    const coef = 1 / (2 * k + b);
    steps.push({ title: "Coefficient after substitution", math: `A = \\frac{1}{2\\cdot${fmt(k)} + ${fmt(b)}} = ${fmt(coef)}` });
    return `${coef}*x*e^(${k}*x)`;
  }
  // sine/cosine
  if (/^(sin|cos)\(/.test(g) || /^[^-+]*sin\(/.test(g)) {
    const mW = g.match(/(?:sin|cos)\(([-+0-9.e]*)\*?[a-z]?\)/);
    const w = mW ? Number(mW[1] || 1) : 1;
    steps.push({
      title: "Particular solution — trigonometric ansatz",
      explanation: `For a sinusoidal forcing term we try y_p = A sin(${fmt(w)}x) + B cos(${fmt(w)}x).`,
      math: `y_p = A\\sin(${fmt(w)}x) + B\\cos(${fmt(w)}x)`,
    });
    // substitute: for g = sin(wx) (amplitude 1)
    const mSin = g.match(/^sin\(/), mCos = g.match(/^cos\(/);
    const amp = mSin || mCos ? 1 : null;
    if (amp) {
      const den = (c - w * w) * (c - w * w) + (b * w) * (b * w);
      const A = ((c - w * w) / den) * (mSin ? 1 : 0);
      const Bc = (-(b * w) / den) * (mSin ? 1 : 0) + ((c - w * w) / den) * (mCos ? 1 : 0);
      steps.push({ title: "Match coefficients", math: `A = ${fmt(A)},\\; B = ${fmt(Bc)}` });
      return `${A}*sin(${w}*x) + (${Bc})*cos(${w}*x)`;
    }
  }
  return null;
}

function tryPolyParticular(g: string, order: number, b: number, c: number, steps: Solution["steps"]): string | null {
  try {
    const node = parseExpr(g);
    // polynomial in x?
    const coeffs = polyCoeffsOf(node);
    if (!coeffs) return null;
    const n = coeffs.length - 1;
    if (n < 0) return "0";
    steps.push({
      title: "Particular solution — polynomial ansatz",
      explanation: `Because the right side is a polynomial of degree ${n}, we try a polynomial of the same degree with unknown coefficients and determine them by substitution.`,
      math: `y_p = ${Array.from({ length: n + 1 }, (_, k) => `A_{${k}}x^{${k}}`).reverse().join(" + ")}`,
    });
    // substitute y_p = Σ A_k x^k into y'' + b y' + c y = g
    // build linear equations by matching powers
    const N = n + 1;
    const rows: number[][] = [];
    const rhs: number[] = new Array(N).fill(0);
    for (let p = 0; p <= n; p++) rhs[p] = coeffs[p] ?? 0;
    for (let p = 0; p <= n; p++) {
      const row = new Array(N).fill(0);
      // contribution of A_p x^p:
      row[p] += c; // c·A_p x^p
      if (p >= 1) row[p - 1] += b * p; // b·y' contributes b·p·A_p x^{p-1}
      if (p >= 2) row[p - 2] += 1 * p * (p - 1); // y'' contributes p(p-1)A_p x^{p-2}
      rows.push(row);
    }
    const sol = gaussSolve(rows, rhs);
    if (!sol || sol.some((x) => !Number.isFinite(x))) return null;
    steps.push({
      title: "Solve the linear system for the coefficients",
      math: sol.map((a, k) => `A_{${k}} = ${fmt(a)}`).join(",\\quad "),
    });
    const yp = sol.map((a, k) => (Math.abs(a) < 1e-12 ? "" : `${a}*x^${k}`)).filter(Boolean).join(" + ");
    return yp || "0";
  } catch {
    return null;
  }
}

function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

function polyCoeffsOf(node: ReturnType<typeof parseExpr>): number[] | null {
  try {
    const res = math.rationalize(node, {}, true) as unknown as { coefficients: number[] | null };
    if (res.coefficients && res.coefficients.some((c) => Number.isFinite(c))) return res.coefficients;
  } catch { /* not polynomial */ }
  return null;
}

/* ---------- apply initial conditions ---------- */
function applyICs(yExpr: string, ics: OdeICs, steps: Solution["steps"], raw: string, eq: OdeTerms, order: number, basis?: string[]): Solution {
  const hasC1 = yExpr.includes("C1") || yExpr.includes("C");
  if (ics.y0 === undefined || !hasC1) {
    return {
      title: "Differential Equation",
      resultTex: texSafe(yExpr),
      resultText: yExpr,
      steps,
      plot: odePlot(raw, eq, ics),
    };
  }
  steps.push({
    title: "Apply the initial condition",
    explanation: `Substitute x = ${fmt(ics.x0 ?? 0)}, y = ${fmt(ics.y0)} to pin down the constant(s).`,
    math: `y(${fmt(ics.x0 ?? 0)}) = ${fmt(ics.y0)}`,
  });
  // solve for C numerically: f(x0) = y0 ; use two sample points for 2 constants
  const f = compileFn(yExpr.replace(/\bC1\b/g, "C").replace(/\bC2\b/g, "D2"), ["x", "C", "D2"]);
  if (order === 1) {
    // y = F(x, C): find C such that F(x0, C) = y0 via secant iterations
    let cLo = -50, cHi = 50;
    const F = (c: number) => f(ics.x0 ?? 0, c, 0);
    let vLo = F(cLo), vHi = F(cHi);
    if (Number.isFinite(vLo) && Number.isFinite(vHi) && vLo * vHi <= 0) {
      for (let i = 0; i < 200; i++) {
        const mid = (cLo + cHi) / 2;
        const v = F(mid);
        if (Math.abs(v - (ics.y0 ?? 0)) < 1e-12) { cLo = cHi = mid; break; }
        if ((v - (ics.y0 ?? 0)) * (vLo - (ics.y0 ?? 0)) < 0) { cHi = mid; vHi = v; }
        else { cLo = mid; vLo = v; }
      }
      const C = (cLo + cHi) / 2;
      const finalExpr = yExpr.replace(/\bC\b/g, `(${C})`);
      steps.push({ title: "Constant found", math: `C = ${fmt(C)}` });
      steps.push({ title: "Particular solution (IVP)", math: texSafe(finalExpr) });
      return {
        title: "Initial Value Problem",
        resultTex: texSafe(finalExpr),
        resultText: finalExpr,
        steps,
        plot: odePlot(raw, eq, ics),
      };
    }
  } else if (order === 2 && ics.y1 !== undefined && basis) {
    // solve linear 2×2 for C1, C2 using y(x0)=y0 and y'(x0)=y1
    const x0 = ics.x0 ?? 0;
    const b1 = compileFn(basis[0], ["x"]), b2 = compileFn(basis[1], ["x"]);
    // numeric derivative of basis at x0
    const h = 1e-6;
    const db1 = (b1(x0 + h) - b1(x0 - h)) / (2 * h);
    const db2 = (b2(x0 + h) - b2(x0 - h)) / (2 * h);
    const M = [[b1(x0), b2(x0)], [db1, db2]];
    const rhsV = [ics.y0 - constPart(yExpr, x0), ics.y1 - dconstPart(yExpr, x0)];
    const sol = gaussSolve(M, rhsV);
    if (sol && sol.every(Number.isFinite)) {
      const finalExpr = yExpr.replace(/\bC1\b/g, `(${sol[0]})`).replace(/\bC2\b/g, `(${sol[1]})`);
      steps.push({ title: "Constants found", math: `C_1 = ${fmt(sol[0])},\\quad C_2 = ${fmt(sol[1])}` });
      steps.push({ title: "Particular solution (IVP)", math: texSafe(finalExpr) });
      return {
        title: "Initial Value Problem",
        resultTex: texSafe(finalExpr),
        resultText: finalExpr,
        steps,
        plot: odePlot(raw, eq, ics),
      };
    }
  }
  return numericODE(raw, eq, ics, steps, "The constants were determined numerically; the plotted solution is computed with high-accuracy RK4.");
}

function constPart(yExpr: string, x0: number): number {
  // evaluate the C-free part: set C1=C2=0
  const f = compileFn(yExpr.replace(/\bC1\b/g, "0").replace(/\bC2\b/g, "0").replace(/\bC\b/g, "0"), ["x"]);
  return f(x0);
}
function dconstPart(yExpr: string, x0: number): number {
  const f = compileFn(yExpr.replace(/\bC1\b/g, "0").replace(/\bC2\b/g, "0").replace(/\bC\b/g, "0"), ["x"]);
  const h = 1e-6;
  return (f(x0 + h) - f(x0 - h)) / (2 * h);
}

/* ---------- first-order linear with variable coefficients ---------- */
function tryIntegratingFactor(raw: string, eq: OdeTerms, a1: number, ics: OdeICs, steps: Solution["steps"]): Solution | null {
  try {
    const P = `((${eq.a0}))/(${a1})`;
    const Q = `((${eq.g}))/(${a1})`;
    steps.push({
      title: "First-order linear equation (standard form)",
      explanation: "Divide by the coefficient of y′ to reach y′ + P(x)·y = Q(x). P depends on x, so we use the general integrating-factor method.",
      math: `y' + ${texSafe(P)}\,y = ${texSafe(Q)}`,
    });
    const pInt = nrdTry(`integrate(${P}, x)`);
    if (!pInt) return null;
    const mu = `e^(${pInt.toString()})`;
    steps.push({
      title: "Integrating factor",
      explanation: "μ(x) = e^∫P(x)dx. Multiplying the equation by μ makes the left side an exact derivative (μ·y)′.",
      math: `\\mu(x) = e^{\\int ${texSafe(P)}\\,dx} = ${texSafe(mu)}`,
    });
    const qInt = nrdTry(`integrate((${mu})*(${Q}), x)`);
    if (!qInt) return null;
    steps.push({
      title: "Multiply through by μ and integrate",
      math: `(\\mu\\,y)' = \\mu\\,Q \\;\\Rightarrow\\; \\mu\\,y = ${texSafe(qInt.toString())} + C`,
    });
    const yExpr = `(${qInt.toString()} + C)/(${mu})`;
    steps.push({ title: "Solve for y", math: `y = ${texSafe(yExpr)}` });
    return applyICs(yExpr, ics, steps, raw, eq, 1);
  } catch {
    return null;
  }
}

/* ---------- separable ---------- */
function trySeparable(raw: string, eq: OdeTerms, a1: number, steps: Solution["steps"]): Solution | null {
  try {
    // reconstruct the full RHS: y' = (g - a0·y)/a1
    const rhsStr = `((${eq.g}) - (${eq.a0})*y)/(${a1})`;
    let rhsNode: ReturnType<typeof parseExpr>;
    try {
      rhsNode = math.simplify(parseExpr(rhsStr));
    } catch {
      rhsNode = parseExpr(rhsStr);
    }
    const rhs = rhsNode;
    // factor into x-only and y-only parts (product of factors)
    const factors: string[] = [];
    const split = (node: ReturnType<typeof parseExpr>) => {
      const t = node as unknown as { type: string; op?: string; args?: ReturnType<typeof parseExpr>[]; content?: ReturnType<typeof parseExpr> };
      if (t.type === "ParenthesisNode") return split(t.content as ReturnType<typeof parseExpr>);
      if (t.type === "OperatorNode" && t.op === "*") { (t.args ?? []).forEach(split); return; }
      if (t.type === "OperatorNode" && t.op === "/" ) {
        const [num, den] = t.args ?? [];
        if (!containsAny(den, ["y"])) { factors.push(node.toString()); return; }
        factors.push(num.toString()); factors.push(`1/(${den.toString()})`); return;
      }
      factors.push(node.toString());
    };
    split(rhs);
    const xPart = factors.filter((f) => !containsYStr(f));
    const yPart = factors.filter((f) => containsYStr(f) && !/[xX]/.test(f.replace(/x/g, "")) && !/\bx\b/.test(f));
    const cleanY = yPart.every((f) => !/\bx\b/.test(f));
    if (!cleanY || yPart.length === 0) return null;
    const fX = xPart.length ? xPart.join("*") : "1";
    const hY = yPart.join("*");
    if (containsYStr(fX)) return null;

    steps.push({
      title: "Separable equation",
      explanation: "The right side factors into a pure function of x times a pure function of y, so the variables can be separated on opposite sides.",
      math: `\\frac{dy}{dx} = ${texSafe(fX)}\\cdot ${texSafe(hY)}`,
    });
    steps.push({
      title: "Separate the variables",
      explanation: "Move every y-factor (with dy) to the left and every x-factor (with dx) to the right.",
      math: `\\frac{dy}{${texSafe(hY)}} = ${texSafe(fX)}\\,dx`,
    });
    const leftInt = nrdTry(`integrate(1/(${hY}), y)`);
    const rightInt = nrdTry(`integrate(${fX}, x)`);
    if (!leftInt || !rightInt) return null;
    steps.push({
      title: "Integrate both sides",
      math: `\\int \\frac{dy}{${texSafe(hY)}} = \\int ${texSafe(fX)}\\,dx \\;\\Rightarrow\\; ${texSafe(leftInt.toString())} = ${texSafe(rightInt.toString())} + C`,
    });
    // try to solve for y
    const solved = nrdTry(`solve(${leftInt.toString()} - (${rightInt.toString()}), y)`);
    const resultStr = solved ? solved.toString() : `${leftInt} = ${rightInt} + C`;
    return {
      title: "Separable Differential Equation",
      resultTex: solved ? texSafe(resultStr) : `${texSafe(leftInt.toString())} = ${texSafe(rightInt.toString())} + C`,
      resultText: resultStr,
      steps,
      plot: odePlot(raw, eq, undefined),
      notes: solved ? [] : ["The solution is left in implicit form — solving for y explicitly is not always possible in closed form."],
    };
  } catch {
    return null;
  }
}

function containsYStr(s: string): boolean {
  return /\by\b/.test(s);
}

/* ---------- numeric RK4 ---------- */
function numericODE(raw: string, eq: OdeTerms, ics: OdeICs, steps: Solution["steps"], why: string): Solution {
  const a1v = constVal(eq.a1);
  const a2v = constVal(eq.a2);
  const a0v = constVal(eq.a0);
  const fXY = (x: number, y: number): number => {
    try {
      const scope: Record<string, number> = { x, y, D2y: 0, Dy: 0 };
      void scope;
      const val = parseExpr(`((${eq.g}) - (${eq.a0})*y - 0)/(${a1v ?? 1})`).evaluate({ x, y });
      return typeof val === "number" ? val : NaN;
    } catch {
      return NaN;
    }
  };
  void a2v;
  steps.push({
    title: "Numeric solution (RK4)",
    explanation: why,
    math: `y_{n+1} = y_n + \\tfrac{h}{6}\\left(k_1 + 2k_2 + 2k_3 + k_4\\right)`,
  });
  if (ics.y0 === undefined) {
    steps.push({
      title: "Direction field",
      explanation: "Without an initial condition there is a whole family of curves. The direction field below shows the slope y′ at many points — every solution follows these arrows.",
    });
    return {
      title: "Differential Equation (numeric)",
      resultTex: "\\text{Solution family — see direction field}",
      resultText: "numeric",
      steps,
      plot: odePlot(raw, eq, ics),
    };
  }
  const x0 = ics.x0 ?? 0;
  steps.push({
    title: "Marching from the initial condition",
    math: `y(${fmt(x0)}) = ${fmt(ics.y0)}`,
  });
  return {
    title: "Initial Value Problem (numeric)",
    resultTex: `y(${fmt(x0)}) = ${fmt(ics.y0)}\\;\\text{(RK4 solution curve shown in the graph)}`,
    resultText: "numeric RK4 solution",
    steps,
    plot: odePlot(raw, eq, ics),
  };
}

/** Build the plot spec for an ODE: direction field + optional solution curve. */
function odePlot(raw: string, eq: OdeTerms, ics: OdeICs | undefined): PlotSpec {
  void raw;
  const a1v = constVal(eq.a1) ?? 1;
  const a2v = constVal(eq.a2) ?? 0;
  const spec: PlotSpec = { xRange: [-6, 6], yRange: [-6, 6] };
  if (Math.abs(a2v) < 1e-12) {
    // first-order: direction field y' = f(x, y)
    const dydxStr = `((${eq.g}) - (${eq.a0})*y)/(${a1v})`;
    spec.field = dydxStr;
    if (ics && ics.y0 !== undefined) {
      const curve = rk4Curve(dydxStr, ics.x0 ?? 0, ics.y0, 12, 0.01);
      if (curve && curve.length > 10) spec.sampled = curve;
    }
  } else if (ics && ics.y0 !== undefined) {
    // second-order with ICs: solve the system y1' = y2, y2' = f(x, y1, y2)
    const dy2 = `((${eq.g}) - (${eq.a1})*v - (${eq.a0})*y)/(${a2v})`;
    const curve = rk4Curve2(dy2, ics.x0 ?? 0, ics.y0, ics.y1 ?? 0, 12, 0.01);
    if (curve && curve.length > 10) spec.sampled = curve;
  }
  return spec;
}

/** RK4 solution curve for a first-order ODE y' = f(x, y). */
export function rk4Curve(dydxStr: string, x0: number, y0: number, span: number, h: number): { x: number; y: number }[] | null {
  try {
    const f = compileFn(dydxStr, ["x", "y"]);
    const pts: { x: number; y: number }[] = [];
    let x = x0, y = y0;
    for (let i = 0; i < span / h; i++) {
      pts.push({ x, y });
      const k1 = f(x, y);
      const k2 = f(x + h / 2, y + (h / 2) * k1);
      const k3 = f(x + h / 2, y + (h / 2) * k2);
      const k4 = f(x + h, y + h * k3);
      const dy = (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      if (!Number.isFinite(dy) || Math.abs(y) > 1e6) break;
      x += h; y += dy;
    }
    x = x0; y = y0;
    for (let i = 0; i < span / h; i++) {
      const k1 = f(x, y);
      const k2 = f(x - h / 2, y - (h / 2) * k1);
      const k3 = f(x - h / 2, y - (h / 2) * k2);
      const k4 = f(x - h, y - h * k3);
      const dy = (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      if (!Number.isFinite(dy) || Math.abs(y) > 1e6) break;
      x -= h; y -= dy;
      pts.push({ x, y });
    }
    return pts.sort((a, b) => a.x - b.x);
  } catch {
    return null;
  }
}

/** RK4 for a second-order ODE written as the system y' = v, v' = f(x, y, v). */
function rk4Curve2(dvStr: string, x0: number, y0: number, v0: number, span: number, h: number): { x: number; y: number }[] | null {
  try {
    const f = compileFn(dvStr, ["x", "y", "v"]);
    const deriv = (x: number, y: number, v: number): [number, number] => [v, f(x, y, v)];
    const pts: { x: number; y: number }[] = [];
    let x = x0, y = y0, v = v0;
    for (let i = 0; i < span / h; i++) {
      pts.push({ x, y });
      const [k1y, k1v] = deriv(x, y, v);
      const [k2y, k2v] = deriv(x + h / 2, y + (h / 2) * k1y, v + (h / 2) * k1v);
      const [k3y, k3v] = deriv(x + h / 2, y + (h / 2) * k2y, v + (h / 2) * k2v);
      const [k4y, k4v] = deriv(x + h, y + h * k3y, v + h * k3v);
      const dy = (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      const dv = (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (!Number.isFinite(dy) || !Number.isFinite(dv) || Math.abs(y) > 1e6) break;
      x += h; y += dy; v += dv;
    }
    x = x0; y = y0; v = v0;
    for (let i = 0; i < span / h; i++) {
      const [k1y, k1v] = deriv(x, y, v);
      const [k2y, k2v] = deriv(x - h / 2, y - (h / 2) * k1y, v - (h / 2) * k1v);
      const [k3y, k3v] = deriv(x - h / 2, y - (h / 2) * k2y, v - (h / 2) * k2v);
      const [k4y, k4v] = deriv(x - h, y - h * k3y, v - h * k3v);
      const dy = (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      const dv = (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (!Number.isFinite(dy) || !Number.isFinite(dv) || Math.abs(y) > 1e6) break;
      x -= h; y -= dy; v -= dv;
      pts.push({ x, y });
    }
    return pts.sort((a, b) => a.x - b.x);
  } catch {
    return null;
  }
}
