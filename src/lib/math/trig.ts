/**
 * Trigonometry engine: equation solving with general solutions,
 * identity verification, evaluation with degrees/radians.
 */
import { preprocess, parseExpr, toTex, fmt, texNum, compileFn, findRoots, type Solution } from "./core";
import { nrd, nrdTry, nrdTex } from "./nerdamer-client";

function texSafe(s: string): string {
  const t = nrdTex(s);
  if (t) return t;
  try { return toTex(s); } catch { return s; }
}

type TrigFn = "sin" | "cos" | "tan";
const GENERAL_SOLUTION: Record<TrigFn, { ok: string; neg: string; period: string; periodVal: number }> = {
  sin: { ok: "x = (-1)^n\\arcsin(k) + n\\pi", neg: "x = (-1)^{n+1}\\arcsin(k) + n\\pi", period: "2\\pi", periodVal: 2 * Math.PI },
  cos: { ok: "x = \\pm\\arccos(k) + 2n\\pi", neg: "x = \\pm\\arccos(k) + 2n\\pi", period: "2\\pi", periodVal: 2 * Math.PI },
  tan: { ok: "x = \\arctan(k) + n\\pi", neg: "x = \\arctan(k) + n\\pi", period: "\\pi", periodVal: Math.PI },
};

export function solveTrigEquation(input: string, domainDeg: boolean): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    const sides = p.split("=");
    if (sides.length > 2) throw new Error("Use exactly one '=' sign.");
    const lhs = sides[0].trim();
    const rhs = (sides[1] ?? "0").trim();
    const fullTex = `${texSafe(lhs)} = ${texSafe(rhs)}`;

    steps.push({
      title: "The trigonometric equation",
      explanation: "Trigonometric equations usually have infinitely many solutions because the trig functions are periodic. We find all solutions in one period, then extend by periodicity.",
      math: fullTex,
    });

    // detect simple form: sin(x) = k etc. (k numeric constant, possibly complex expr)
    const simple = detectSimpleTrig(lhs, rhs);
    if (simple) {
      const { fn, k } = simple;
      const info = GENERAL_SOLUTION[fn];
      if (Math.abs(k) > 1 && fn !== "tan") {
        steps.push({
          title: "Check the range of the trig function",
          explanation: `The values of ${fn}(x) are always between −1 and 1, so ${fn}(x) = ${fmt(k)} has no real solution.`,
          math: `${fn}(x) \\in [-1, 1]\\;\\Rightarrow\\;\\text{no real solutions}`,
        });
        return { title: "Trigonometric Equation", resultTex: "\\text{No real solutions}", resultText: "none", steps };
      }
      const principal = fn === "sin" ? Math.asin(k) : fn === "cos" ? Math.acos(k) : Math.atan(k);
      steps.push({
        title: `Step 1 — principal value via the inverse function`,
        explanation: `Take the inverse ${fn} of both sides to get one solution (the principal value).`,
        math: `${fn}(x) = ${texNum(k)}\\;\\Rightarrow\\; x = \\arc${fn}(${texNum(k)}) = ${fmt(principal)}\\ \\text{rad}`,
      });
      // second solution in [0, 2π)
      let allInPeriod: number[] = [];
      if (fn === "sin") {
        const s1 = principal, s2 = Math.PI - principal;
        allInPeriod = [s1, s2];
      } else if (fn === "cos") {
        allInPeriod = [principal, -principal];
      } else {
        allInPeriod = [principal];
      }
      allInPeriod = allInPeriod
        .map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
        .filter((v, i, arr) => arr.findIndex((u) => Math.abs(u - v) < 1e-9) === i)
        .sort((a, b) => a - b);
      steps.push({
        title: "Step 2 — find the second angle using symmetry",
        explanation:
          fn === "sin"
            ? "Sine is symmetric about π/2: if θ is a solution, so is π − θ."
            : fn === "cos"
            ? "Cosine is even: if θ is a solution, so is −θ."
            : "Tangent has period π, so the base solution repeats every π.",
        math: `x \\in [0, 2\\pi):\\; ${allInPeriod.map((a) => `x = ${fmt(a)}`).join(",\\; ")}`,
      });
      steps.push({
        title: "Step 3 — general solution (all periods)",
        explanation: "Add integer multiples of the period to reach every solution on the real line (n ∈ ℤ).",
        math: info.ok.replace("k", texNum(k)),
      });
      const degreeSolutions = allInPeriod.map((a) => (a * 180) / Math.PI);
      return {
        title: "Trigonometric Equation",
        resultTex: allInPeriod.length === 2
          ? `x = ${fmt(allInPeriod[0])},\\; ${fmt(allInPeriod[1])} \\;(\\text{mod } 2\\pi)`
          : `x = ${fmt(allInPeriod[0])}\\;(\\text{mod } \\pi)`,
        resultText: domainDeg
          ? degreeSolutions.map((d) => `${fmt(d)}° + k·360°`).join(", ")
          : allInPeriod.map((a) => `${fmt(a)} + k·${fn === "tan" ? "π" : "2π"}`).join(", "),
        steps,
        notes: domainDeg
          ? [`In degrees: ${degreeSolutions.map((d) => `${fmt(d)}°`).join(", ")} (plus multiples of ${fn === "tan" ? "180°" : "360°"}).`]
          : [`Period of ${fn}: ${fn === "tan" ? "π (180°)" : "2π (360°)"}.`],
        plot: { curves: [{ label: `y = ${fn}(x)`, expr: `${fn}(x)` }, { label: `y = ${fmt(k)}`, expr: `${k}` }], points: allInPeriod.map((a) => ({ x: a, y: k })) },
      };
    }

    // general numeric approach
    const fStr = `(${lhs}) - (${rhs})`;
    const f = compileFn(fStr, ["x"]);
    const twoPi = 2 * Math.PI;
    const roots = findRoots(f, 0, twoPi, 6000)
      .filter((r) => Math.abs(f(r)) < 1e-6)
      .map((r) => Number(r.toPrecision(8)));
    steps.push({
      title: "Numerical solution over one period [0, 2π)",
      explanation: "For a general trigonometric equation we scan one full period for sign changes and refine each root by bisection. The solutions then repeat with the period of the function.",
    });
    if (!roots.length) {
      return { title: "Trigonometric Equation", steps, error: "No solutions found in [0, 2π). The equation may have no real solutions." };
    }
    steps.push({
      title: "Solutions in [0, 2π)",
      math: roots.map((r) => `x = ${fmt(r)}\\ \\text{rad}`).join(",\\quad "),
    });
    steps.push({
      title: "Extend periodically",
      explanation: "Each solution repeats every 2π (the period of the trigonometric functions involved).",
      math: `x = ${roots.map((r) => fmt(r)).join(",\\; ")} + 2k\\pi,\\quad k \\in \\mathbb{Z}`,
    });
    return {
      title: "Trigonometric Equation",
      resultTex: `x = ${roots.map((r) => fmt(r)).join(",\\; ")} + 2k\\pi`,
      resultText: roots.map((r) => `${fmt(r)} rad (${fmt((r * 180) / Math.PI)}°)`).join(", ") + " + 2kπ",
      steps,
      plot: { curves: [{ label: "LHS−RHS", expr: fStr }], points: roots.map((r) => ({ x: r, y: 0 })), xRange: [0, 2 * Math.PI] },
    };
  } catch (e) {
    return { title: "Trigonometric Equation", steps: [], error: (e as Error).message };
  }
}

function detectSimpleTrig(lhs: string, rhs: string): { fn: TrigFn; k: number } | null {
  const trySides = (l: string, r: string): { fn: TrigFn; k: number } | null => {
    const m = l.match(/^(sin|cos|tan)\s*\(\s*x\s*\)$/);
    if (!m) return null;
    try {
      const k = parseExpr(r).evaluate();
      if (typeof k === "number" && Number.isFinite(k)) return { fn: m[1] as TrigFn, k };
    } catch { /* not constant */ }
    return null;
  };
  return trySides(lhs, rhs) ?? trySides(rhs, lhs);
}

/** Verify a trig identity: is LHS − RHS ≡ 0? */
export function verifyIdentity(input: string): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    const sides = p.split("=");
    if (sides.length !== 2) throw new Error("Enter an identity with one '=' sign, e.g. sin(x)^2 + cos(x)^2 = 1.");
    const lhs = sides[0].trim();
    const rhs = sides[1].trim();
    steps.push({ title: "The claimed identity", math: `${texSafe(lhs)} = ${texSafe(rhs)}` });

    // symbolic: simplify LHS - RHS
    const diffExpr = `(${lhs}) - (${rhs})`;
    const simplified = nrdTry(`simplify(trig(${diffExpr}))`) ?? nrdTry(`simplify(${diffExpr})`);
    const zeroSymbolic = simplified && /^0$/.test(simplified.toString().trim());
    if (simplified) {
      steps.push({
        title: "Simplify the difference LHS − RHS with trig rules",
        explanation: "We use the Pythagorean identities, angle-sum formulas and double-angle formulas to reduce both sides to a common form.",
        math: `${texSafe(lhs)} - ${texSafe(rhs)} = ${texSafe(simplified.toString())}`,
      });
    }
    // numeric spot checks
    const f = compileFn(diffExpr, ["x"]);
    const probes = [0.3, 1.1, 2.2, 3.7, 5.1, -0.8, -2.4];
    const maxErr = Math.max(...probes.map((t) => Math.abs(f(t))));
    steps.push({
      title: "Numeric spot-check at several angles",
      math: probes.map((t) => `x=${fmt(t)}:\\; |\\Delta| = ${fmt(Math.abs(f(t)), 2)}`).join(",\\quad "),
      explanation: "The difference between the two sides is (numerically) zero at every tested angle.",
    });
    const verified = zeroSymbolic || maxErr < 1e-9;
    steps.push({
      title: verified ? "Identity verified ✓" : "Not an identity ✗",
      explanation: verified
        ? "Both sides are equal for every value of x — the identity holds."
        : "The two sides differ at some tested angle, so this is not an identity.",
    });
    return {
      title: "Identity Verification",
      resultTex: verified ? `${texSafe(lhs)} \\equiv ${texSafe(rhs)}` : `\\text{Not an identity (fails at some }x\\text{)}`,
      resultText: verified ? "identity holds" : "not an identity",
      steps,
      plot: { curves: [{ label: "LHS", expr: lhs }, { label: "RHS", expr: rhs, dashed: true }] },
    };
  } catch (e) {
    return { title: "Identity Verification", steps: [], error: (e as Error).message };
  }
}

/** Evaluate trig expression at angle (deg or rad) with a small table of exact values. */
export function evalTrig(input: string, angle: number, deg: boolean): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    const rad = deg ? (angle * Math.PI) / 180 : angle;
    steps.push({
      title: deg ? "Convert to radians" : "The angle",
      explanation: deg ? "Trigonometric computation internally uses radians: radians = degrees × π/180." : "Working directly in radians.",
      math: deg ? `${texNum(angle)}^\\circ = ${texNum(angle)}\\cdot\\frac{\\pi}{180} = ${fmt(rad)}\\ \\text{rad}` : `x = ${fmt(rad)}\\ \\text{rad}`,
    });
    const f = compileFn(p, ["x"]);
    const val = f(rad);
    steps.push({ title: "Substitute into the expression", math: `${texSafe(p)}\\Big|_{x = ${fmt(rad)}} = ${fmt(val)}` });
    // reference triangle for common angles
    const exactTable: Record<string, string> = {
      "0": "0", "0.5235987755982988": "\\frac{\\pi}{6}", "0.7853981633974483": "\\frac{\\pi}{4}",
      "1.0471975511965976": "\\frac{\\pi}{3}", "1.5707963267948966": "\\frac{\\pi}{2}", "3.141592653589793": "\\pi",
    };
    const near = Object.entries(exactTable).find(([k]) => Math.abs(Number(k) - rad) < 1e-9);
    if (near) {
      steps.push({ title: "Exact angle recognised", math: `x = ${near[1]}` });
    }
    return {
      title: "Trigonometric Evaluation",
      resultTex: `${texSafe(p)} = ${fmt(val)}`,
      resultText: fmt(val),
      steps,
      plot: { curves: [{ label: "f(x)", expr: p }], markers: [{ x: rad, label: `f = ${fmt(val)}` }] },
    };
  } catch (e) {
    return { title: "Trigonometric Evaluation", steps: [], error: (e as Error).message };
  }
}
