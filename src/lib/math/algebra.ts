/**
 * Algebra engine: simplify, expand, factor — with steps.
 */
import { math, parseExpr, preprocess, toTex, type Solution } from "./core";
import { nrd, nrdTex, nrdTry } from "./nerdamer-client";

export type AlgebraOp = "simplify" | "expand" | "factor";

const OP_INFO: Record<AlgebraOp, { title: string; explain: string }> = {
  simplify: {
    title: "Simplify the expression",
    explain: "Simplifying collects like terms, cancels common factors and rewrites the expression in its shortest equivalent form.",
  },
  expand: {
    title: "Expand the expression",
    explain: "Expanding multiplies every term in one bracket by every term in the next (the distributive law a(b + c) = ab + ac).",
  },
  factor: {
    title: "Factor the expression",
    explain: "Factoring rewrites the expression as a product of simpler factors — the reverse of expanding.",
  },
};

export function algebraSteps(input: string, op: AlgebraOp): Solution {
  const steps: Solution["steps"] = [];
  try {
    const node = parseExpr(input);
    const inputTex = toTex(node);
    const p = preprocess(input);
    steps.push({
      title: "Given expression",
      explanation: OP_INFO[op].explain,
      math: inputTex,
    });

    // mathjs simplification (safe baseline)
    let mjs: string | null = null;
    try {
      mjs = math.simplify(node).toString();
    } catch { /* ignore */ }

    // nerdamer symbolic result
    let resultStr: string | null = null;
    let resultTex: string | null = null;
    const nrdExpr =
      op === "simplify" ? nrdTry(p) :
      op === "expand" ? nrdTry(`expand(${p})`) :
      nrdTry(`factor(${p})`);
    if (nrdExpr) {
      resultStr = nrdExpr.toString();
      resultTex = nrdTex(nrdExpr);
    }

    const finalStr = resultStr ?? mjs;
    if (!finalStr) throw new Error("The expression could not be processed.");

    if (op === "expand") {
      steps.push({
        title: "Apply the distributive law to every product",
        explanation: "Each term in the first bracket is multiplied by each term in the second, then like terms are collected.",
        math: inputTex,
      });
    } else if (op === "factor") {
      steps.push({
        title: "Look for common factors and patterns",
        explanation: "We search for the greatest common factor, then try standard patterns: difference of squares a²−b² = (a−b)(a+b), perfect squares, and factoring of quadratics.",
      });
    } else {
      steps.push({
        title: "Collect like terms",
        explanation: "Terms with exactly the same variables and powers are added together; common factors in fractions are cancelled.",
      });
    }

    if (mjs && normalizeStr(mjs) !== normalizeStr(finalStr)) {
      steps.push({ title: "Intermediate simplification", math: toTexSafe(mjs) });
    }
    steps.push({
      title: op === "factor" ? "Factored form" : op === "expand" ? "Expanded form" : "Simplified form",
      math: resultTex ?? toTexSafe(finalStr),
    });

    // verification by re-expanding
    if (op === "factor") {
      try {
        const reexpanded = nrd(`expand(${finalStr})`).toString();
        const origExpanded = nrd(`expand(${p})`).toString();
        if (normalizeStr(reexpanded) === normalizeStr(origExpanded)) {
          steps.push({
            title: "Verification",
            explanation: "Expanding the factored form reproduces the original expression, so the factorization is correct.",
            math: `${toTexSafe(finalStr)} = ${toTexSafe(origExpanded)}`,
          });
        }
      } catch { /* skip verification */ }
    }

    return {
      title: OP_INFO[op].title,
      resultTex: resultTex ?? toTexSafe(finalStr),
      resultText: finalStr,
      steps,
    };
  } catch (e) {
    return { title: OP_INFO[op].title, steps: [], error: (e as Error).message };
  }
}

function toTexSafe(s: string): string {
  try {
    return toTex(s);
  } catch {
    return s;
  }
}

function normalizeStr(s: string): string {
  return s.replace(/\s+/g, "").replace(/\*/g, "");
}

/** Evaluate an expression numerically (calculator mode). */
export function evaluateSteps(input: string): Solution {
  const steps: Solution["steps"] = [];
  try {
    const node = parseExpr(input);
    const tex = toTex(node);
    let value: unknown;
    try {
      value = node.evaluate();
    } catch {
      throw new Error("The expression contains unknown variables, so it cannot be evaluated to a number.");
    }
    steps.push({ title: "Expression", math: tex });
    let resultTex: string;
    if (typeof value === "number") {
      resultTex = Number.isInteger(value) ? String(value) : `\\approx ${Number(value.toPrecision(12))}`;
      steps.push({
        title: "Evaluate using standard order of operations (PEMDAS)",
        explanation: "Brackets first, then powers, then multiplication/division, finally addition/subtraction.",
        math: `${tex} = ${resultTex}`,
      });
    } else if (value && typeof value === "object" && "re" in (value as object)) {
      const c = value as { re: number; im: number };
      resultTex = `${c.re} ${c.im >= 0 ? "+" : "-"} ${Math.abs(c.im)}\\,i`;
      steps.push({ title: "Complex result", math: `${tex} = ${resultTex}` });
    } else {
      resultTex = String(value);
      steps.push({ title: "Result", math: `${tex} = ${resultTex}` });
    }
    return { title: "Evaluation", resultTex, resultText: String(value), steps };
  } catch (e) {
    return { title: "Evaluation", steps: [], error: (e as Error).message };
  }
}
