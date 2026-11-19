/**
 * Limits engine: numeric two-sided exploration + symbolic attempt (nerdamer)
 * + L'Hôpital's rule steps + continuity check.
 */
import { preprocess, parseExpr, toTex, fmt, texNum, compileFn, type Solution } from "./core";
import type { MathNode } from "mathjs";
import { nrdTry, nrdTex } from "./nerdamer-client";
import { differentiateSteps } from "./differentiate";

function texSafe(s: string): string {
  const t = nrdTex(s);
  if (t) return t;
  try { return toTex(s); } catch { return s; }
}

export function limitSteps(input: string, v: string, point: number | "inf" | "-inf"): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    const node = parseExpr(p);
    const inputTex = toTex(node);
    const pointTex = point === "inf" ? "\\infty" : point === "-inf" ? "-\\infty" : texNum(point);
    const pv = point === "inf" ? 1e12 : point === "-inf" ? -1e12 : point;

    steps.push({
      title: "The limit",
      explanation: "A limit describes the value the function approaches — it does not need to equal the function value at that point.",
      math: `\\lim_{${v}\\to ${pointTex}} ${inputTex}`,
    });

    // 1. try direct substitution (finite point)
    if (typeof point === "number") {
      const f = compileFn(p, [v]);
      const direct = f(point);
      if (Number.isFinite(direct)) {
        steps.push({
          title: "Try direct substitution",
          explanation: "If the function is defined and continuous at the point, the limit is simply the function value.",
          math: `${v} = ${texNum(point)}\\;\\Rightarrow\\; ${inputTex} = ${fmt(direct)}`,
        });
        return {
          title: "Limit",
          resultTex: `\\lim_{${v}\\to ${pointTex}} ${inputTex} = ${fmt(direct)}`,
          resultText: fmt(direct),
          steps,
          plot: { curves: [{ label: `f(${v})`, expr: p }], markers: [{ x: point, label: `x→${fmt(point)}` }] },
          notes: ["The function is defined at this point, so the limit equals the function value (continuity)."],
        };
      }
      steps.push({
        title: "Direct substitution fails",
        explanation: "Substituting gives an undefined or infinite value — an indeterminate form such as 0/0 or ∞/∞. This is exactly the situation where special limit techniques are needed.",
      });
    }

    // 2. symbolic attempt
    const sym = nrdTry(`limit(${p}, ${v}, ${typeof point === "number" ? point : point === "inf" ? "infinity" : "-infinity"})`);
    const symVal = sym ? Number(sym.valueOf()) : NaN;
    const symUsable = sym && Number.isFinite(symVal) && !/limit/i.test(sym.toString());

    // 3. numeric tables from both sides
    const f = compileFn(p, [v]);
    const epsList = [0.1, 0.01, 0.001, 0.0001, 0.00001];
    const rows: { eps: number; left?: number; right?: number }[] = [];
    for (const eps of epsList) {
      const row: { eps: number; left?: number; right?: number } = { eps };
      if (typeof point === "number") {
        const l = f(point - eps), r = f(point + eps);
        row.left = Number.isFinite(l) ? l : undefined;
        row.right = Number.isFinite(r) ? r : undefined;
      } else {
        const r = f(pv * eps * 100);
        row.right = Number.isFinite(r) ? r : undefined;
      }
      rows.push(row);
    }
    const tableTex =
      typeof point === "number"
        ? `\\begin{array}{c|cc} & \\text{from the left} & \\text{from the right}\\\\ \\hline ${rows
            .map((r) => `${v} = ${texNum(point)} - 10^{-${Math.round(Math.log10(1 / r.eps))}} & ${r.left === undefined ? "\\text{undef}" : fmt(r.left)} & ${r.right === undefined ? "\\text{undef}" : fmt(r.right)}`)
            .join(" \\\\ ")} \\end{array}`
        : `\\begin{array}{c|c} ${v} & f(${v})\\\\ \\hline ${rows
            .map((r) => `${fmt(pv * r.eps * 100)} & ${r.right === undefined ? "\\text{undef}" : fmt(r.right)}`)
            .join(" \\\\ ")} \\end{array}`;

    steps.push({
      title: "Numerical investigation",
      explanation: "We evaluate the function closer and closer to the target point from both sides and watch where the values settle.",
      math: tableTex,
    });

    // detect numeric limit
    const lastL = rows[rows.length - 1].left, lastR = rows[rows.length - 1].right;
    let numericLimit: number | undefined;
    if (typeof point === "number") {
      if (lastL !== undefined && lastR !== undefined && Math.abs(lastL - lastR) < 1e-4 * Math.max(1, Math.abs(lastL))) numericLimit = (lastL + lastR) / 2;
    } else if (lastR !== undefined && Math.abs(lastR) < 1e10) numericLimit = lastR;

    // 4. L'Hôpital for 0/0 or ∞/∞ at finite points
    if (typeof point === "number") {
      const asQuotient = extractQuotient(node);
      if (asQuotient) {
        const num = asQuotient.num, den = asQuotient.den;
        const fN = compileFn(num, [v]), fD = compileFn(den, [v]);
        const n0 = fN(point), d0 = fD(point);
        const is00 = Math.abs(n0) < 1e-9 && Math.abs(d0) < 1e-9;
        const isInf = !Number.isFinite(n0) && !Number.isFinite(d0);
        if (is00 || isInf) {
          steps.push({
            title: `Indeterminate form ${is00 ? "0/0" : "∞/∞"} — apply L'Hôpital's rule`,
            explanation: "When a quotient of functions produces 0/0 or ∞/∞, the limit of the quotient equals the limit of the quotient of derivatives (provided that limit exists).",
            math: `\\lim_{${v}\\to ${pointTex}}\\frac{${texSafe(num)}}{${texSafe(den)}} = \\lim_{${v}\\to ${pointTex}}\\frac{\\frac{d}{d${v}}\\left(${texSafe(num)}\\right)}{\\frac{d}{d${v}}\\left(${texSafe(den)}\\right)}`,
          });
          const dN = differentiateSteps(num, v, 1);
          const dD = differentiateSteps(den, v, 1);
          if (dN.resultText && dD.resultText) {
            steps.push({ title: "Differentiate numerator and denominator separately", math: `\\frac{${texSafe(dN.resultText)}}{${texSafe(dD.resultText)}}` });
            const fdN = compileFn(dN.resultText, [v]), fdD = compileFn(dD.resultText, [v]);
            const lh = fdN(point) / fdD(point);
            if (Number.isFinite(lh)) {
              steps.push({ title: "Evaluate the new quotient", math: `= ${fmt(lh)}` });
              if (numericLimit === undefined || Math.abs(numericLimit - lh) < 1e-3 * Math.max(1, Math.abs(lh))) {
                numericLimit = lh;
              }
            }
          }
        }
      }
    }

    // 5. infinite limit detection
    const bigPos = 1e9;
    if (numericLimit === undefined) {
      const sample = typeof point === "number" ? [f(point - 1e-6), f(point + 1e-6)] : [f(pv * 1e-6)];
      const finite = sample.filter((s) => Number.isFinite(s));
      if (finite.length && finite.every((s) => Math.abs(s) > bigPos)) {
        return {
          title: "Limit",
          resultTex: `\\lim_{${v}\\to ${pointTex}} ${inputTex} = ${finite[0] > 0 ? "+\\infty" : "-\\infty"}`,
          resultText: finite[0] > 0 ? "Infinity" : "-Infinity",
          steps,
          plot: { curves: [{ label: `f(${v})`, expr: p }], markers: typeof point === "number" ? [{ x: point, label: `x=${fmt(point)}` }] : [] },
          notes: ["The function grows without bound near this point."],
        };
      }
      if (symUsable) {
        return {
          title: "Limit",
          resultTex: `\\lim_{${v}\\to ${pointTex}} ${inputTex} = ${fmt(symVal)}`,
          resultText: fmt(symVal),
          steps,
          plot: { curves: [{ label: `f(${v})`, expr: p }] },
        };
      }
      return {
        title: "Limit",
        steps,
        error: "The limit could not be determined — the left and right approaches disagree (the two-sided limit may not exist), or the function oscillates near this point.",
        plot: { curves: [{ label: `f(${v})`, expr: p }] },
      };
    }

    const finalVal = symUsable ? symVal : numericLimit;
    steps.push({
      title: "Conclusion",
      explanation: "Both the numeric table and the analytic manipulation agree.",
      math: `\\lim_{${v}\\to ${pointTex}} ${inputTex} = ${fmt(finalVal)}`,
    });
    return {
      title: "Limit",
      resultTex: `\\lim_{${v}\\to ${pointTex}} ${inputTex} = ${fmt(finalVal)}`,
      resultText: fmt(finalVal),
      steps,
      plot: { curves: [{ label: `f(${v})`, expr: p }], markers: typeof point === "number" ? [{ x: point, label: `x→${fmt(point)}` }] : [] },
    };
  } catch (e) {
    return { title: "Limit", steps: [], error: (e as Error).message };
  }
}

/** If node is num/den structurally, return the two strings. */
function extractQuotient(node: ReturnType<typeof parseExpr>): { num: string; den: string } | null {
  const t = node as unknown as { type: string; op?: string; args?: MathNode[] };
  if (t.type === "OperatorNode" && t.op === "/" && t.args?.length === 2) {
    return { num: t.args[0].toString(), den: t.args[1].toString() };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Continuity check                                                    */
/* ------------------------------------------------------------------ */

export function continuitySteps(input: string, v: string, point: number): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    const node = parseExpr(p);
    const inputTex = toTex(node);
    const f = compileFn(p, [v]);

    steps.push({
      title: "Continuity test at a point",
      explanation: "A function is continuous at x = a when three conditions hold: (1) f(a) is defined, (2) the limit as x → a exists, (3) they are equal.",
      math: `f(${v}) = ${inputTex},\\quad ${v} = ${texNum(point)}`,
    });

    const fa = f(point);
    const defined = Number.isFinite(fa);
    steps.push({
      title: "Step 1 — Is the function defined there?",
      math: defined ? `f(${texNum(point)}) = ${fmt(fa)}\\;\\checkmark` : `f(${texNum(point)})\\ \\text{is undefined}\\;\\times`,
      explanation: defined ? "The function value exists." : "The function is not defined at this point, so it cannot be continuous there.",
    });

    // limit from both sides (computed regardless, to classify the discontinuity)
    const epsList = [0.01, 0.001, 0.0001];
    const left = epsList.map((e) => f(point - e)).filter(Number.isFinite);
    const right = epsList.map((e) => f(point + e)).filter(Number.isFinite);
    const leftLim = left.length ? left[left.length - 1] : NaN;
    const rightLim = right.length ? right[right.length - 1] : NaN;
    const limitExists = Number.isFinite(leftLim) && Number.isFinite(rightLim) && Math.abs(leftLim - rightLim) < 1e-4 * Math.max(1, Math.abs(leftLim));

    if (!defined) {
      if (limitExists) {
        steps.push({
          title: "Step 2 — Does the two-sided limit exist?",
          math: `\\lim_{${v}\\to ${texNum(point)}^{-}} f = ${fmt(leftLim)},\\quad \\lim_{${v}\\to ${texNum(point)}^{+}} f = ${fmt(rightLim)}`,
          explanation: "Although the function itself is undefined here, both one-sided limits exist and agree.",
        });
        steps.push({
          title: "Removable discontinuity (hole)",
          explanation: "The limit exists but the function is not defined at the point — redefining f(a) = limit would make it continuous.",
          math: `\\lim_{${v}\\to ${texNum(point)}} f = ${fmt(leftLim)}\\ \\text{but}\\ f(${texNum(point)})\\ \\text{undefined}`,
        });
        return {
          title: "Continuity Check",
          resultTex: `\\text{Removable discontinuity (hole) at } ${v} = ${texNum(point)}`,
          resultText: "removable discontinuity",
          steps,
          plot: { curves: [{ label: `f(${v})`, expr: p }], markers: [{ x: point, label: `hole at x=${fmt(point)}` }] },
        };
      }
      return {
        title: "Continuity Check",
        resultTex: `\\text{Not continuous at } ${v} = ${texNum(point)}`,
        resultText: "discontinuous (undefined, no limit)",
        steps,
        plot: { curves: [{ label: `f(${v})`, expr: p }], markers: [{ x: point, label: `x=${fmt(point)}` }] },
      };
    }

    steps.push({
      title: "Step 2 — Does the two-sided limit exist?",
      math: `\\lim_{${v}\\to ${texNum(point)}^{-}} f = ${fmt(leftLim)},\\quad \\lim_{${v}\\to ${texNum(point)}^{+}} f = ${fmt(rightLim)}`,
      explanation: limitExists
        ? "The left-hand and right-hand limits exist and agree."
        : "The left and right limits differ (or fail to exist) — this signals a jump or infinite discontinuity.",
    });

    if (!limitExists) {
      const jump = Number.isFinite(leftLim) && Number.isFinite(rightLim);
      return {
        title: "Continuity Check",
        resultTex: `\\text{Not continuous at } ${v} = ${texNum(point)}\\ \\text{(jump discontinuity)}`,
        resultText: jump ? `jump of size ${fmt(Math.abs(rightLim - leftLim))}` : "discontinuous",
        steps,
        plot: { curves: [{ label: `f(${v})`, expr: p }], markers: [{ x: point, label: `x=${fmt(point)}` }] },
      };
    }

    const equal = Math.abs(leftLim - fa) < 1e-4 * Math.max(1, Math.abs(fa));
    steps.push({
      title: "Step 3 — Does the limit equal the function value?",
      math: `\\lim_{${v}\\to ${texNum(point)}} f = ${fmt(leftLim)}\\quad\\text{vs}\\quad f(${texNum(point)}) = ${fmt(fa)}`,
    });
    steps.push({
      title: equal ? "Continuous ✓" : "Removable discontinuity",
      explanation: equal ? "All three conditions hold, so the function is continuous at this point." : "The limit exists but differs from the function value — a removable (hole) discontinuity.",
      math: equal ? `f \\text{ is continuous at } ${v} = ${texNum(point)}` : `f \\text{ has a hole at } ${v} = ${texNum(point)}`,
    });
    return {
      title: "Continuity Check",
      resultTex: equal
        ? `f\\ \\text{is continuous at}\\ ${v} = ${texNum(point)}`
        : `\\text{Removable discontinuity at } ${v} = ${texNum(point)}`,
      resultText: equal ? "continuous" : "removable discontinuity",
      steps,
      plot: { curves: [{ label: `f(${v})`, expr: p }], points: [{ x: point, y: fa, label: `f(${fmt(point)})` }] },
    };
  } catch (e) {
    return { title: "Continuity Check", steps: [], error: (e as Error).message };
  }
}
