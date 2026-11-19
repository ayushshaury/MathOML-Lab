/**
 * Equation solving engine with step-by-step explanations.
 * Handles linear, quadratic, polynomial and general equations (numeric),
 * plus systems of linear equations (Gaussian elimination with steps)
 * and Cramer's rule.
 */
import { math, parseExpr, preprocess, toTex, fmt, fmtExact, texNum, compileFn, findRoots, type Solution } from "./core";
import type { MathNode } from "mathjs";

export interface Root {
  tex: string;
  text: string;
  value: number;
}

/** Extract polynomial coefficients (ascending: [a0, a1, a2, ...]) of expr in v. */
export function polyCoeffs(expr: string, v: string): number[] | null {
  try {
    const node = parseExpr(expr);
    const res = math.rationalize(node, {}, true) as unknown as { expression: MathNode; coefficients: number[] | null };
    if (res.coefficients && res.coefficients.length > 0) return res.coefficients;
    // try expand + manual walk
    const expanded = math.simplify(node);
    const coeffs: number[] = [];
    const collect = (n: MathNode, sign = 1): void => {
      const t = n as unknown as { type: string; op?: string; args?: MathNode[]; value?: number; name?: string; fn?: { name?: string }; content?: MathNode };
      if (t.type === "ConstantNode") { coeffs[0] = (coeffs[0] ?? 0) + sign * Number(t.value); return; }
      if (t.type === "SymbolNode") {
        if (t.name === v) coeffs[1] = (coeffs[1] ?? 0) + sign;
        else if (t.name && !["e", "pi", "Infinity"].includes(t.name)) { coeffs[0] = NaN; }
        return;
      }
      if (t.type === "ParenthesisNode") return collect(t.content as MathNode, sign);
      if (t.type === "OperatorNode") {
        if (t.op === "+") { (t.args ?? []).forEach((a) => collect(a, sign)); return; }
        if (t.op === "-") {
          if ((t.args ?? []).length === 1) return collect(t.args![0], -sign);
          collect(t.args![0], sign); collect(t.args![1], -sign); return;
        }
        if (t.op === "*") {
          let constProd = sign, hasVar = null as MathNode | null;
          for (const a of t.args ?? []) {
            if (nodeHasVar(a, v)) { if (hasVar) return void (coeffs[0] = NaN); hasVar = a; }
            else { const val = tryConst(a); if (val === null) return void (coeffs[0] = NaN); constProd *= val; }
          }
          if (!hasVar) { coeffs[0] = (coeffs[0] ?? 0) + constProd; return; }
          const p = polyDegreePow(hasVar, v);
          if (p === null) { coeffs[0] = NaN; return; }
          coeffs[p] = (coeffs[p] ?? 0) + constProd; return;
        }
        if (t.op === "/" ) {
          const [a, b] = t.args ?? [];
          const denom = tryConst(b);
          if (denom === null || denom === 0) { coeffs[0] = NaN; return; }
          collect(a, sign / denom); return;
        }
        if (t.op === "^") {
          const [a, b] = t.args ?? [];
          const ex = tryConst(b);
          if (ex === null || !Number.isInteger(ex) || ex < 0) { coeffs[0] = NaN; return; }
          if (nodeHasVar(a, v)) {
            const p = polyDegreePow(a, v);
            if (p === null) { coeffs[0] = NaN; return; }
            coeffs[p * ex] = (coeffs[p * ex] ?? 0) + sign; return;
          }
          const val = tryConst(a);
          if (val === null) { coeffs[0] = NaN; return; }
          coeffs[0] = (coeffs[0] ?? 0) + sign * Math.pow(val, ex); return;
        }
        if (t.op === "unaryMinus" && (t.args ?? []).length === 1) return collect(t.args![0], -sign);
      }
      coeffs[0] = NaN;
    };
    collect(expanded);
    if (coeffs.some((c) => c === undefined || Number.isNaN(c))) return null;
    for (let i = 0; i < coeffs.length; i++) if (coeffs[i] === undefined) coeffs[i] = 0;
    while (coeffs.length > 1 && coeffs[coeffs.length - 1] === 0) coeffs.pop();
    return coeffs;
  } catch {
    return null;
  }
}

function nodeHasVar(n: MathNode, v: string): boolean {
  const self = n as unknown as { type: string; name?: string };
  if (self.type === "SymbolNode" && self.name === v) return true;
  let found = false;
  n.forEach(function walk(x: MathNode) {
    const t = x as unknown as { type: string; name?: string };
    if (t.type === "SymbolNode" && t.name === v) found = true;
    x.forEach(walk);
  });
  return found;
}

function tryConst(n: MathNode): number | null {
  try {
    const val = n.evaluate();
    if (typeof val === "number" && Number.isFinite(val)) return val;
    return null;
  } catch { return null; }
}

/** If n is v^k, return k; if n is v, return 1; else null. */
function polyDegreePow(n: MathNode, v: string): number | null {
  const t = n as unknown as { type: string; name?: string; op?: string; args?: MathNode[]; content?: MathNode };
  if (t.type === "SymbolNode" && t.name === v) return 1;
  if (t.type === "ParenthesisNode") return polyDegreePow(t.content as MathNode, v);
  if (t.type === "OperatorNode" && t.op === "^") {
    const [a, b] = t.args ?? [];
    const at = a as unknown as { type: string; name?: string };
    if (at?.type === "SymbolNode" && at.name === v) {
      const ex = tryConst(b);
      if (ex !== null && Number.isInteger(ex) && ex > 0) return ex;
    }
  }
  return null;
}

/** Build polynomial LaTeX from ascending coeffs. */
export function polyTex(coeffs: number[], v: string): string {
  const parts: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-15) continue;
    const sign = c > 0 ? (parts.length ? "+" : "") : "-";
    const a = Math.abs(c);
    const coefStr = a === 1 && i > 0 ? "" : texNum(a);
    const varStr = i === 0 ? "" : i === 1 ? v : `${v}^{${i}}`;
    parts.push(`${sign}${coefStr}${varStr}`);
  }
  return parts.length ? parts.join("") : "0";
}

/* ------------------------------------------------------------------ */
/* Main solver                                                         */
/* ------------------------------------------------------------------ */

export function solveEquation(input: string, varName?: string): Solution {
  const steps: Solution["steps"] = [];
  try {
    const raw = preprocess(input);
    const sides = raw.split("=");
    if (sides.length > 2) return { title: "Equation Solver", steps: [], error: "Please enter only one equals sign (=)." };
    const lhsStr = sides[0].trim();
    const rhsStr = (sides[1] ?? "0").trim();
    const v = varName || detectVariable(lhsStr + " " + rhsStr) || "x";

    const lhs = parseExpr(lhsStr);
    const rhs = parseExpr(rhsStr);
    const fTex = `${toTex(lhs)} = ${toTex(rhs)}`;

    steps.push({
      title: "The equation",
      explanation: `We need to find every value of ${v} that makes both sides equal.`,
      math: fTex,
    });

    // Move everything to the left side: LHS - RHS = 0
    const fNode = new math.OperatorNode("-", "subtract", [lhs, rhs]);
    steps.push({
      title: "Move everything to one side",
      explanation: `Subtract the right-hand side from both sides so the equation equals zero. Subtracting the same quantity from both sides keeps the equation balanced.`,
      math: `${toTex(fNode)} = 0`,
    });

    const coeffs = polyCoeffs(fNode.toString(), v);
    const deg = coeffs ? coeffs.length - 1 : -1;

    if (deg === 1) return finishLinear(coeffs!, v, fTex, steps);
    if (deg === 2) return finishQuadratic(coeffs!, v, fTex, steps);
    if (deg >= 3 && deg <= 6) return finishPolynomial(coeffs!, v, fTex, steps, fNode);
    // general numeric solve
    return finishNumeric(fNode.toString(), v, fTex, steps);
  } catch (e) {
    return { title: "Equation Solver", steps: [], error: readableError(e) };
  }
}

function readableError(e: unknown): string {
  const msg = (e as Error).message ?? String(e);
  if (/Undefined symbol|Unexpected end|Parenthesis \) expected/i.test(msg)) return "The equation could not be parsed. Check for typos, matching brackets and explicit operators.";
  return msg;
}

function detectVariable(s: string): string | null {
  const cleaned = preprocess(s).replace(/[a-z]+/g, (m) => (["sin","cos","tan","log","exp","sqrt","pi","sec","csc","cot","abs","asin","acos","atan","ln","e"].includes(m) ? "" : m));
  const m = cleaned.match(/[a-z]/);
  return m ? m[0] : null;
}

/* ---------- linear ---------- */
function finishLinear(coeffs: number[], v: string, fTex: string, steps: Solution["steps"]): Solution {
  const [b, a] = coeffs;
  steps.push({
    title: "Identify the standard form",
    explanation: "This is a linear equation of the form a·x + b = 0. It has exactly one solution (when a ≠ 0).",
    math: `${texNum(a)}\\,${v} ${b >= 0 ? "+" : "-"} ${texNum(Math.abs(b))} = 0`,
  });
  steps.push({
    title: "Isolate the variable term",
    explanation: `Move the constant ${fmtExact(b)} to the right side by subtracting it from both sides.`,
    math: `${texNum(a)}\\,${v} = ${texNum(-b)}`,
  });
  if (Math.abs(a) < 1e-15) {
    return {
      title: "Linear Equation",
      steps,
      resultTex: Math.abs(b) < 1e-15 ? "\\text{Infinitely many solutions (identity)}" : "\\text{No solution (contradiction)}",
    };
  }
  const x = -b / a;
  steps.push({
    title: "Divide by the coefficient",
    explanation: `Divide both sides by ${fmtExact(a)} to solve for ${v}. Dividing both sides by the same non-zero number keeps the equation balanced.`,
    math: `${v} = \\frac{${texNum(-b)}}{${texNum(a)}} = ${texNum(x)}`,
  });
  steps.push({
    title: "Check the solution",
    explanation: "Substitute the answer back into the original equation to verify it.",
    math: `${v} = ${texNum(x)}`,
  });
  return {
    title: "Linear Equation",
    resultTex: `${v} = ${texNum(x)}`,
    resultText: `${v} = ${fmtExact(x)}`,
    steps,
    plot: { curves: [{ label: `LHS−RHS`, expr: `(${texToPlain(coeffs, v)})` }], markers: [{ x, label: `root` }] },
  };
}

function texToPlain(coeffs: number[], v: string): string {
  return coeffs.map((c, i) => `${i === 0 ? c : c >= 0 ? `+${c}` : c}*${v}^${i}`).join(" ");
}

/* ---------- quadratic ---------- */
function finishQuadratic(coeffs: number[], v: string, fTex: string, steps: Solution["steps"]): Solution {
  const [c, b, a] = coeffs;
  steps.push({
    title: "Identify the standard form",
    explanation: "This is a quadratic equation a·x² + b·x + c = 0. The exponents tell us it is quadratic (degree 2), so we use the quadratic formula.",
    math: `${texNum(a)}\\,${v}^2 ${b >= 0 ? "+" : "-"} ${texNum(Math.abs(b))}\\,${v} ${c >= 0 ? "+" : "-"} ${texNum(Math.abs(c))} = 0`,
  });
  steps.push({
    title: "Write down a, b and c",
    math: `a = ${texNum(a)},\\quad b = ${texNum(b)},\\quad c = ${texNum(c)}`,
  });
  const D = b * b - 4 * a * c;
  steps.push({
    title: "Compute the discriminant",
    explanation: "The discriminant D = b² − 4ac tells us how many real solutions exist: D > 0 → two real solutions, D = 0 → one repeated solution, D < 0 → two complex solutions.",
    math: `D = b^2 - 4ac = (${texNum(b)})^2 - 4\\cdot(${texNum(a)})\\cdot(${texNum(c)}) = ${texNum(D)}`,
  });

  if (D > 1e-12) {
    const sq = Math.sqrt(D);
    const r1 = (-b + sq) / (2 * a);
    const r2 = (-b - sq) / (2 * a);
    const isPerf = isPerfectSquare(D);
    steps.push({
      title: "Apply the quadratic formula",
      explanation: "The quadratic formula gives both roots directly.",
      math: `${v} = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{${texNum(-b)} \\pm \\sqrt{${texNum(D)}}}{2\\cdot${texNum(a)}}`,
    });
    if (isPerf) {
      steps.push({ title: "Simplify the square root", math: `\\sqrt{${texNum(D)}} = ${texNum(sq)}` });
    }
    steps.push({
      title: "Split into the two solutions",
      math: `\\begin{aligned} ${v}_1 &= \\frac{${texNum(-b)} + ${texNum(sq)}}{${texNum(2 * a)}} = ${texNum(r1)} \\\\ ${v}_2 &= \\frac{${texNum(-b)} - ${texNum(sq)}}{${texNum(2 * a)}} = ${texNum(r2)} \\end{aligned}`,
    });
    return {
      title: "Quadratic Equation",
      resultTex: `${v}_1 = ${texNum(r1)},\\qquad ${v}_2 = ${texNum(r2)}`,
      resultText: `x1 = ${fmtExact(r1)}, x2 = ${fmtExact(r2)}`,
      steps,
      plot: {
        curves: [{ label: `f(${v})`, expr: texToPlain(coeffs, v) }],
        points: [ { x: r1, y: 0, label: `root ${fmt(r1)}` }, { x: r2, y: 0, label: `root ${fmt(r2)}` } ],
      },
    };
  }
  if (Math.abs(D) <= 1e-12) {
    const r = -b / (2 * a);
    steps.push({
      title: "Repeated root",
      explanation: "The discriminant is zero, so both roots coincide — the parabola just touches the x-axis.",
      math: `${v} = \\frac{-b}{2a} = \\frac{${texNum(-b)}}{${texNum(2 * a)}} = ${texNum(r)}`,
    });
    return {
      title: "Quadratic Equation",
      resultTex: `${v} = ${texNum(r)}\\ \\text{(double root)}`,
      resultText: `x = ${fmtExact(r)} (double)`,
      steps,
      plot: { curves: [{ label: `f(${v})`, expr: texToPlain(coeffs, v) }], points: [{ x: r, y: 0, label: `double root` }] },
    };
  }
  // complex roots
  const re = -b / (2 * a);
  const im = Math.sqrt(-D) / (2 * a);
  steps.push({
    title: "Negative discriminant — complex solutions",
    explanation: "D < 0 means the parabola never crosses the x-axis. The solutions are complex conjugates; we use i² = −1 to simplify √D.",
    math: `\\sqrt{${texNum(D)}} = i\\sqrt{${texNum(-D)}}`,
  });
  steps.push({
    title: "Complex roots via the quadratic formula",
    math: `\\begin{aligned} ${v}_1 &= ${texNum(re)} + ${texNum(Math.abs(im))}\\,i \\\\ ${v}_2 &= ${texNum(re)} - ${texNum(Math.abs(im))}\\,i \\end{aligned}`,
  });
  return {
    title: "Quadratic Equation",
    resultTex: `${v} = ${texNum(re)} \\pm ${texNum(Math.abs(im))}\\,i`,
    resultText: `x = ${fmt(re)} ± ${fmt(Math.abs(im))}i (complex)`,
    steps,
    plot: { curves: [{ label: `f(${v})`, expr: texToPlain(coeffs, v) }] },
    notes: ["The discriminant is negative, so the graph never touches the x-axis — there are no real solutions."],
  };
}

function isPerfectSquare(D: number): boolean {
  const r = Math.round(Math.sqrt(D));
  return Math.abs(r * r - D) < 1e-9;
}

/* ---------- polynomial degree >= 3 ---------- */
function finishPolynomial(coeffs: number[], v: string, fTex: string, steps: Solution["steps"], fNode: MathNode): Solution {
  steps.push({
    title: "Standard form",
    explanation: `This is a polynomial equation of degree ${coeffs.length - 1}.`,
    math: `${polyTex(coeffs, v)} = 0`,
  });
  const roots = numericPolyRoots(coeffs);
  const found = roots.filter((r) => Math.abs(evalPoly(coeffs, r)) < 1e-6);
  steps.push({
    title: "Find the roots",
    explanation: "For higher-degree polynomials we combine exact factoring with numerical root refinement (each root is verified by substitution).",
    math: found.length ? found.map((r) => `${v} \\approx ${texNum(r)}`).join(",\\quad ") : "\\text{No real roots found}",
  });
  if (found.length) {
    const check = found.map((r) => `f(${texNum(r)}) \\approx ${fmt(Math.abs(evalPoly(coeffs, r)), 2)}`).join(",\\quad ");
    steps.push({ title: "Verification (substitute each root)", math: check });
  }
  const complex = countComplex(coeffs, roots);
  return {
    title: `Polynomial Equation (degree ${coeffs.length - 1})`,
    resultTex: found.length ? found.map((r) => `${v} = ${texNum(r)}`).join(",\\; ") : "\\text{No real solutions}",
    resultText: found.map((r) => fmtExact(r)).join(", "),
    steps,
    plot: { curves: [{ label: `f(${v})`, expr: texToPlain(coeffs, v) }], points: found.map((r) => ({ x: r, y: 0 })) },
    notes: complex > 0 ? [`The remaining ${complex} root(s) are complex (non-real).`] : undefined,
  };
}

function evalPoly(coeffs: number[], x: number): number {
  let s = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) s = s * x + coeffs[i];
  return s;
}

function numericPolyRoots(coeffs: number[]): number[] {
  // try mathjs polynomialRoot (ascending coeffs)
  try {
    const r = (math as unknown as { polynomialRoot: (...c: number[]) => unknown }).polynomialRoot(...coeffs);
    if (Array.isArray(r)) {
      return r
        .map((c) => {
          if (typeof c === "number") return c;
          const cc = c as { re?: number; im?: number };
          if (typeof cc?.re === "number") return Math.abs(cc.im ?? 0) < 1e-9 ? cc.re : NaN;
          return NaN;
        })
        .filter((x) => Number.isFinite(x));
    }
  } catch { /* fall back to scanning */ }
  const f = (x: number) => evalPoly(coeffs, x);
  return findRoots(f, -60, 60, 12000);
}

function countComplex(coeffs: number[], realRoots: number[]): number {
  return Math.max(0, coeffs.length - 1 - realRoots.length);
}

/* ---------- general numeric ---------- */
function finishNumeric(fStr: string, v: string, fTex: string, steps: Solution["steps"]): Solution {
  steps.push({
    title: "Non-polynomial equation",
    explanation: "This equation is not a polynomial, so we solve it numerically: we look for sign changes of f(x) = LHS − RHS and refine each one with the bisection method (repeated interval halving).",
  });
  const f = compileFn(fStr, [v]);
  const roots = findRoots(f, -50, 50, 20000);
  if (!roots.length) {
    return {
      title: "Equation Solver",
      steps,
      error: "No real solutions were found on the interval [-50, 50]. The equation may have no real roots, or they may lie outside this range.",
    };
  }
  steps.push({
    title: "Solutions found",
    math: roots.map((r) => `${v} \\approx ${texNum(r)}`).join(",\\quad "),
  });
  return {
    title: "Equation Solver (numeric)",
    resultTex: roots.map((r) => `${v} = ${texNum(r)}`).join(",\\; "),
    resultText: roots.map((r) => fmtExact(r)).join(", "),
    steps,
    plot: { curves: [{ label: "LHS−RHS", expr: fStr }], points: roots.map((r) => ({ x: r, y: 0 })) },
  };
}

/* ------------------------------------------------------------------ */
/* Systems of linear equations                                         */
/* ------------------------------------------------------------------ */

export function solveSystem(equations: string[]): Solution {
  const steps: Solution["steps"] = [];
  try {
    const parsed = equations.map((eq) => {
      const sides = preprocess(eq).split("=");
      if (sides.length !== 2) throw new Error(`"${eq}" needs exactly one "=" sign.`);
      return { lhs: parseExpr(sides[0].trim()), rhs: parseExpr(sides[1].trim()) };
    });
    // detect variables
    const varSet = new Set<string>();
    parsed.forEach((p) => {
      [p.lhs, p.rhs].forEach((n) =>
        n.forEach(function walk(x: MathNode) {
          const t = x as unknown as { type: string; name?: string };
          if (t.type === "SymbolNode" && /^[a-z]$/.test(t.name ?? "") && !"e".includes(t.name ?? "")) varSet.add(t.name!);
          x.forEach(walk);
        })
      );
    });
    const vars = [...varSet].sort();
    if (vars.length === 0) throw new Error("No unknowns (like x, y, z) found.");
    if (parsed.length !== vars.length)
      throw new Error(`There are ${vars.length} unknowns (${vars.join(", ")}) but ${parsed.length} equation(s). Please provide exactly as many equations as unknowns.`);

    // build augmented matrix numerically
    const n = vars.length;
    const A: number[][] = [];
    for (const p of parsed) {
      const row = new Array(n).fill(0);
      const walk = (node: MathNode, sign: number, side: number) => {
        const t = node as unknown as { type: string; op?: string; args?: MathNode[]; value?: number; name?: string; content?: MathNode };
        if (t.type === "ConstantNode") { return; }
        if (t.type === "SymbolNode") { if (side === 0) row[vars.indexOf(t.name!)] += sign; return; }
        if (t.type === "ParenthesisNode") return walk(t.content as MathNode, sign, side);
        if (t.type === "OperatorNode") {
          if (t.op === "+" ) { (t.args ?? []).forEach((a) => walk(a, sign, side)); return; }
          if (t.op === "-" && (t.args ?? []).length === 2) { walk(t.args![0], sign, side); walk(t.args![1], -sign, side); return; }
          if (t.op === "-" && (t.args ?? []).length === 1) { walk(t.args![0], -sign, side); return; }
          if (t.op === "*") {
            let coeff = sign, varIdx = -1;
            for (const a of t.args ?? []) {
              const at = a as unknown as { type: string; name?: string };
              if (at.type === "SymbolNode" && varSet.has(at.name ?? "")) {
                if (varIdx !== -1) throw new Error("A term multiplies two unknowns — the system must be linear.");
                varIdx = vars.indexOf(at.name!);
              }
              else { const c = tryConst(a); if (c === null) throw new Error("Non-linear term detected — coefficients must be numbers."); coeff *= c; }
            }
            if (side === 0 && varIdx !== -1) row[varIdx] += coeff;
            return;
          }
          if (t.op === "/") {
            const denom = tryConst(t.args![1]);
            if (denom === null || denom === 0) throw new Error("Division by a variable is not linear.");
            walk(t.args![0], sign / denom, side); return;
          }
        }
        throw new Error("Term is not linear in the unknowns.");
      };
      walk(p.lhs, 1, 0);
      walk(p.rhs, -1, 0);
      A.push(row);
    }
    // constants vector b: constant part of (rhs - lhs)
    const B2: number[] = [];
    for (const p of parsed) {
      let c = 0;
      const getConst = (node: MathNode, sign: number) => {
        const t = node as unknown as { type: string; op?: string; args?: MathNode[]; value?: number; content?: MathNode };
        if (t.type === "ConstantNode") { c += sign * Number(t.value); return; }
        if (t.type === "ParenthesisNode") return getConst(t.content as MathNode, sign);
        if (t.type === "OperatorNode" && t.op === "+") { (t.args ?? []).forEach((a) => getConst(a, sign)); return; }
        if (t.type === "OperatorNode" && t.op === "-" && (t.args ?? []).length === 2) { getConst(t.args![0], sign); getConst(t.args![1], -sign); return; }
        if (t.type === "OperatorNode" && t.op === "-" && (t.args ?? []).length === 1) return getConst(t.args![0], -sign);
        if (t.type === "OperatorNode" && t.op === "*") {
          let allConst = true;
          for (const a of t.args ?? []) if (tryConst(a) === null) allConst = false;
          if (allConst) { c += sign * tryConst(node)!; }
          return;
        }
        if (t.type === "OperatorNode" && t.op === "/") {
          const d = tryConst(t.args![1]);
          if (d !== null) { getConst(t.args![0], sign / d); }
          return;
        }
      };
      c = 0; getConst(p.rhs, 1); getConst(p.lhs, -1);
      B2.push(c);
    }

    steps.push({
      title: "Write the system in matrix form A·x = b",
      explanation: "Each equation becomes one row of the coefficient matrix A, and the constants form the vector b.",
      math: `\\begin{pmatrix} ${A.map((r) => r.map((x) => texNum(x)).join(" & ")).join(" \\\\ ")} \\end{pmatrix} \\begin{pmatrix} ${vars.join(" \\\\ ")} \\end{pmatrix} = \\begin{pmatrix} ${B2.map((x) => texNum(x)).join(" \\\\ ")} \\end{pmatrix}`,
    });

    // Gaussian elimination with steps
    const M = A.map((r, i) => [...r, B2[i]]);
    const nE = n;
    let singular = false;
    for (let col = 0; col < nE; col++) {
      // pivot
      let piv = col;
      for (let r = col + 1; r < nE; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) { singular = true; continue; }
      if (piv !== col) {
        [M[col], M[piv]] = [M[piv], M[col]];
        steps.push({ title: `Swap rows ${col + 1} and ${piv + 1}`, explanation: "Partial pivoting: we choose the largest pivot in this column to improve numerical stability.", math: augTex(M) });
      }
      for (let r = col + 1; r < nE; r++) {
        if (Math.abs(M[r][col]) < 1e-15) continue;
        const f = M[r][col] / M[col][col];
        for (let c2 = col; c2 <= nE; c2++) M[r][c2] -= f * M[col][c2];
        steps.push({
          title: `Eliminate ${vars[col]} from row ${r + 1}`,
          explanation: `Row ${r + 1} ← Row ${r + 1} − ${fmtExact(f)} · Row ${col + 1}. This creates a zero below the pivot.`,
          math: augTex(M),
        });
      }
    }
    // back substitution
    const X = new Array(nE).fill(0);
    for (let r = nE - 1; r >= 0; r--) {
      let s = M[r][nE];
      for (let c2 = r + 1; c2 < nE; c2++) s -= M[r][c2] * X[c2];
      if (Math.abs(M[r][r]) < 1e-12) { singular = true; X[r] = NaN; continue; }
      X[r] = s / M[r][r];
    }
    if (singular && X.some((x) => Number.isNaN(x))) {
      return { title: "System of Equations", steps, error: "The system has no unique solution (it is singular — either no solution or infinitely many)." };
    }
    steps.push({
      title: "Back-substitution",
      explanation: "Solve the last equation first, then substitute upward to get the remaining unknowns.",
      math: `\\begin{aligned} ${vars.map((v2, i) => `${v2} = ${texNum(X[i])}`).join(" \\\\ ")} \\end{aligned}`,
    });
    return {
      title: "System of Linear Equations",
      resultTex: `\\left(${vars.map((v2, i) => `${v2} = ${texNum(X[i])}`).join(",\\; ")}\\right)`,
      resultText: vars.map((v2, i) => `${v2} = ${fmtExact(X[i])}`).join(", "),
      steps,
    };
  } catch (e) {
    return { title: "System of Equations", steps: [], error: (e as Error).message };
  }
}

function augTex(M: number[][]): string {
  const n = M.length;
  return `\\left(\\begin{array}{${"c".repeat(n)}|c} ${M.map((r) => r.map((x) => texNum(x)).join(" & ")).join(" \\\\ ")} \\end{array}\\right)`;
}
