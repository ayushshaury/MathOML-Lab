/**
 * Step-tracking symbolic differentiation engine built on the mathjs AST.
 * Every rule application (power, product, quotient, chain, ...) is recorded
 * as a human-readable step.
 */
import { type MathNode } from "mathjs";
import { math, parseExpr, toTex, fmt, type Solution, type Step } from "./core";

/* ---------- node builder helpers ---------- */
const nnum = (v: number) => new math.ConstantNode(v);
const nsym = (n: string) => new math.SymbolNode(n);
function nop(op: string, fn: string, args: MathNode[]) {
  return new math.OperatorNode(op as never, fn as never, args);
}
const add = (a: MathNode, b: MathNode) => nop("+", "add", [a, b]);
const sub = (a: MathNode, b: MathNode) => nop("-", "subtract", [a, b]);
const mul = (a: MathNode, b: MathNode) => nop("*", "multiply", [a, b]);
const div = (a: MathNode, b: MathNode) => nop("/", "divide", [a, b]);
const pow = (a: MathNode, b: MathNode) => nop("^", "pow", [a, b]);
const neg = (a: MathNode) => nop("-", "unaryMinus", [a]);
const nfn = (name: string, args: MathNode[]) => new math.FunctionNode(nsym(name), args);
const ZERO = () => nnum(0);
const ONE = () => nnum(1);

const nt = (node: MathNode) => toTex(node);

/** does this subtree contain the variable? */
function contains(node: MathNode, v: string): boolean {
  const self = node as unknown as { type: string; name?: string };
  if (self.type === "SymbolNode" && self.name === v) return true;
  let found = false;
  node.forEach(function walk(n: MathNode) {
    const t = n as unknown as { type: string; name?: string };
    if (t.type === "SymbolNode" && t.name === v) found = true;
    n.forEach(walk);
  });
  return found;
}

type DiffStep = Step;

/* ---------- the differentiator ---------- */
function d(node: MathNode, v: string, steps: DiffStep[]): MathNode {
  const t = node as unknown as {
    type: string;
    name?: string;
    value?: unknown;
    op?: string;
    fn?: unknown;
    args?: MathNode[];
    content?: MathNode;
  };

  if (!contains(node, v)) {
    return ZERO();
  }

  switch (t.type) {
    case "SymbolNode":
      if (t.name === v) return ONE();
      return ZERO();

    case "ParenthesisNode":
      return d(t.content as MathNode, v, steps);

    case "ConstantNode":
      return ZERO();

    case "OperatorNode": {
      const args = (t.args ?? []) as MathNode[];
      switch (t.op) {
        case "+":
          return add(d(args[0], v, steps), d(args[1], v, steps));
        case "-": {
          if (args.length === 1) return neg(d(args[0], v, steps));
          return sub(d(args[0], v, steps), d(args[1], v, steps));
        }
        case "*": {
          const [a, b] = args;
          // constant multiple shortcut (one side has no v)
          if (!contains(a, v)) {
            steps.push({
              title: "Constant Multiple Rule",
              explanation: `The factor ${nt(a)} does not contain ${v}, so it is treated as a constant and can be pulled out of the derivative.`,
              math: `\\frac{d}{d${v}}\\left[${nt(a)}\\,f\\right] = ${nt(a)}\\,f'`,
            });
            return mul(a, d(b, v, steps));
          }
          if (!contains(b, v)) {
            steps.push({
              title: "Constant Multiple Rule",
              explanation: `The factor ${nt(b)} does not contain ${v}, so it is treated as a constant and can be pulled out of the derivative.`,
              math: `\\frac{d}{d${v}}\\left[f\\,${nt(b)}\\right] = f'\\,${nt(b)}`,
            });
            return mul(d(a, v, steps), b);
          }
          steps.push({
            title: "Product Rule",
            explanation: "When two functions are multiplied, differentiate each factor while keeping the other fixed, then add the two results.",
            math: `\\frac{d}{d${v}}\\left[${nt(a)}\\cdot ${nt(b)}\\right] = ${nt(a)}'\\cdot ${nt(b)} + ${nt(a)}\\cdot ${nt(b)}'`,
          });
          const da = d(a, v, steps);
          const db = d(b, v, steps);
          const res = add(mul(da, b), mul(a, db));
          steps.push({
            title: "Combine the product rule pieces",
            math: `\\frac{d}{d${v}}\\left[${nt(a)}\\cdot ${nt(b)}\\right] = ${nt(mul(da, b))} + ${nt(mul(a, db))} = ${nt(res)}`,
          });
          return res;
        }
        case "/": {
          const [a, b] = args;
          if (!contains(b, v)) {
            steps.push({
              title: "Constant Multiple Rule",
              explanation: `The denominator ${nt(b)} is constant with respect to ${v}, so only the numerator is differentiated.`,
              math: `\\frac{d}{d${v}}\\left[\\frac{f}{${nt(b)}}\\right] = \\frac{f'}{${nt(b)}}`,
            });
            return div(d(a, v, steps), b);
          }
          steps.push({
            title: "Quotient Rule",
            explanation: "For a quotient, the derivative is (low·dHigh − high·dLow) / low².",
            math: `\\frac{d}{d${v}}\\left[\\frac{${nt(a)}}{${nt(b)}}\\right] = \\frac{${nt(b)}\\cdot ${nt(a)}' - ${nt(a)}\\cdot ${nt(b)}'}{\\left(${nt(b)}\\right)^2}`,
          });
          const da = d(a, v, steps);
          const db = d(b, v, steps);
          const res = div(sub(mul(b, da), mul(a, db)), pow(b, nnum(2)));
          return res;
        }
        case "^": {
          const [base, expo] = args;
          if (!contains(expo, v)) {
            // power rule (with chain rule when base is a function)
            if (base.type === "SymbolNode") {
              steps.push({
                title: "Power Rule",
                explanation: "Bring the exponent down as a factor and reduce the exponent by one.",
                math: `\\frac{d}{d${v}}\\left[${nt(base)}^{${nt(expo)}}\\right] = ${nt(expo)}\\cdot ${nt(base)}^{${nt(expo)}-1}`,
              });
            } else {
              steps.push({
                title: "Power Rule + Chain Rule",
                explanation: "Differentiate the outer power first, then multiply by the derivative of the inner expression.",
                math: `\\frac{d}{d${v}}\\left[u^{${nt(expo)}}\\right] = ${nt(expo)}\\,u^{${nt(expo)}-1}\\cdot u',\\quad u = ${nt(base)}`,
              });
            }
            const newExpo = expo.type === "ConstantNode" ? nnum((expo as unknown as { value: number }).value - 1) : sub(expo, ONE());
            return mul(expo, mul(pow(base, newExpo), d(base, v, steps)));
          }
          if (!contains(base, v)) {
            steps.push({
              title: "Exponential Rule",
              explanation: "For a constant base raised to a function of " + v + ", the derivative keeps the expression and multiplies by ln(base).",
              math: `\\frac{d}{d${v}}\\left[${nt(base)}^{u}\\right] = ${nt(base)}^{u}\\ln\\left(${nt(base)}\\right)\\cdot u',\\quad u = ${nt(expo)}`,
            });
            return mul(pow(base, expo), mul(nfn("log", [base]), d(expo, v, steps)));
          }
          steps.push({
            title: "Logarithmic Differentiation",
            explanation: "When both the base and the exponent contain " + v + ", rewrite as an exponential: f = e^(ln f) and differentiate.",
            math: `y = ${nt(base)}^{${nt(expo)}} \\;\\Rightarrow\\; \\ln y = ${nt(expo)}\\ln\\left(${nt(base)}\\right) \\;\\Rightarrow\\; \\frac{y'}{y} = \\left(${nt(expo)}\\right)'\\ln\\left(${nt(base)}\\right) + ${nt(expo)}\\cdot\\frac{\\left(${nt(base)}\\right)'}{${nt(base)}}`,
          });
          const inner = add(mul(d(expo, v, steps), nfn("log", [base])), mul(expo, div(d(base, v, steps), base)));
          return mul(pow(base, expo), inner);
        }
        default:
          throw new Error(`Unsupported operator: ${t.op}`);
      }
    }

    case "FunctionNode": {
      const fnSym = t.fn as unknown as { name?: string };
      const name = fnSym?.name ?? "";
      const u = (t.args as MathNode[])[0];
      const table: Record<string, { d: MathNode; name: string }> = {
        sin: { d: nfn("cos", [u]), name: "\\sin' u = \\cos u" },
        cos: { d: neg(nfn("sin", [u])), name: "\\cos' u = -\\sin u" },
        tan: { d: div(ONE(), pow(nfn("cos", [u]), nnum(2))), name: "\\tan' u = \\sec^2 u = \\frac{1}{\\cos^2 u}" },
        sec: { d: div(nfn("sin", [u]), pow(nfn("cos", [u]), nnum(2))), name: "\\sec' u = \\sec u\\tan u" },
        csc: { d: neg(div(nfn("cos", [u]), pow(nfn("sin", [u]), nnum(2)))), name: "\\csc' u = -\\csc u\\cot u" },
        cot: { d: neg(div(ONE(), pow(nfn("sin", [u]), nnum(2)))), name: "\\cot' u = -\\csc^2 u" },
        asin: { d: div(ONE(), nfn("sqrt", [sub(nnum(1), pow(u, nnum(2)))])), name: "\\arcsin' u = \\frac{1}{\\sqrt{1-u^2}}" },
        acos: { d: neg(div(ONE(), nfn("sqrt", [sub(nnum(1), pow(u, nnum(2)))]))), name: "\\arccos' u = -\\frac{1}{\\sqrt{1-u^2}}" },
        atan: { d: div(ONE(), add(nnum(1), pow(u, nnum(2)))), name: "\\arctan' u = \\frac{1}{1+u^2}" },
        sinh: { d: nfn("cosh", [u]), name: "\\sinh' u = \\cosh u" },
        cosh: { d: nfn("sinh", [u]), name: "\\cosh' u = \\sinh u" },
        tanh: { d: div(ONE(), pow(nfn("cosh", [u]), nnum(2))), name: "\\tanh' u = \\operatorname{sech}^2 u = \\frac{1}{\\cosh^2 u}" },
        exp: { d: nfn("exp", [u]), name: "\\left(e^u\\right)' = e^u" },
        log: { d: div(ONE(), u), name: "\\left(\\ln u\\right)' = \\frac{1}{u}" },
        log10: { d: div(ONE(), mul(u, nfn("log", [nnum(10)]))), name: "\\left(\\log_{10} u\\right)' = \\frac{1}{u\\ln 10}" },
        log2: { d: div(ONE(), mul(u, nfn("log", [nnum(2)]))), name: "\\left(\\log_2 u\\right)' = \\frac{1}{u\\ln 2}" },
        sqrt: { d: div(ONE(), mul(nnum(2), nfn("sqrt", [u]))), name: "\\left(\\sqrt{u}\\right)' = \\frac{1}{2\\sqrt{u}}" },
        cbrt: { d: div(ONE(), mul(nnum(3), pow(u, div(nnum(2), nnum(3))))), name: "\\left(\\sqrt[3]{u}\\right)' = \\frac{1}{3\\,u^{2/3}}" },
        abs: { d: nfn("sign", [u]), name: "\\left(|u|\\right)' = \\operatorname{sign}(u)" },
        sign: { d: ZERO(), name: "\\operatorname{sign}' u = 0" },
      };
      const entry = table[name];
      if (!entry) throw new Error(`Cannot differentiate function "${name}" yet.`);
      const isPlainVar = u.type === "SymbolNode" && (u as unknown as { name: string }).name === v;
      if (isPlainVar) {
        steps.push({
          title: `Derivative of ${name}`,
          math: entry.name.replace(/u/g, nt(u)),
        });
      } else {
        steps.push({
          title: `Chain Rule — outer function ${name}`,
          explanation: "Differentiate the outer function (keeping the inner expression untouched), then multiply by the derivative of the inner expression.",
          math: `\\frac{d}{d${v}}\\left[${name}\\left(${nt(u)}\\right)\\right] = \\left(${entry.name}\\right)\\Big|_{u\\,=\\,${nt(u)}} \\cdot \\frac{d}{d${v}}\\left[${nt(u)}\\right]`,
        });
        steps.push({
          title: `Inner derivative of ${nt(u)}`,
        });
      }
      const du = d(u, v, steps);
      return mul(entry.d, du);
    }
    default:
      throw new Error(`Cannot differentiate node type "${t.type}".`);
  }
}

/* ---------- public API ---------- */

export function differentiateSteps(input: string, variable: string, order: number): Solution {
  const steps: Step[] = [];
  try {
    let node = parseExpr(input);
    let current = node;
    for (let k = 1; k <= order; k++) {
      const label = k === 1 ? `\\frac{d}{d${variable}}` : `\\frac{d^{${k}}}{d${variable}^{${k}}}`;
      const dsteps: DiffStep[] = [];
      const result = d(current, variable, dsteps);
      steps.push({
        title: k === 1 ? `Differentiate with respect to ${variable}` : `${k}. derivative — differentiate the previous result again`,
        math: `${label === undefined ? "" : label}\\left[${nt(current)}\\right] = ${nt(result)}`,
      });
      steps.push(...dsteps);
      current = result;
    }
    // simplify
    let simplified: MathNode;
    try {
      simplified = math.simplify(current);
    } catch {
      simplified = current;
    }
    steps.push({
      title: "Simplify the result",
      explanation: "Collect like terms and remove factors that cancel.",
      math: nt(simplified),
    });
    const labelTex =
      order === 1
        ? `\\frac{d}{d${variable}}\\left(${nt(node)}\\right)`
        : `\\frac{d^{${order}}}{d${variable}^{${order}}}\\left(${nt(node)}\\right)`;
    return {
      title: `Derivative of order ${order}`,
      resultTex: `${labelTex} = ${nt(simplified)}`,
      resultText: simplified.toString(),
      steps,
    };
  } catch (e) {
    return { title: "Derivative", steps: [], error: (e as Error).message };
  }
}

/** Partial derivative: differentiate w.r.t. one variable, others stay symbolic. */
export function partialDifferentiate(
  input: string,
  variable: string,
  order: number,
  others?: string[]
): Solution {
  const base = differentiateSteps(input, variable, order);
  if (base.error) return base;
  base.title = `Partial derivative with respect to ${variable}`;
  return base;
}

/** All first-order partials of f(x,y,z) — used by gradient tool. */
export function allPartials(input: string, vars: string[]): { v: string; node: MathNode; tex: string }[] {
  return vars.map((v) => {
    const res = d(parseExpr(input), v, []);
    let s = res;
    try {
      s = math.simplify(res);
    } catch { /* keep raw */ }
    return { v, node: s, tex: nt(s) };
  });
}

/** Gradient vector as LaTeX column vector. */
export function gradientTex(input: string, vars: string[]): { tex: string; components: { v: string; tex: string }[] } {
  const components = allPartials(input, vars);
  const body = components.map((c) => `\\frac{\\partial f}{\\partial ${c.v}} = ${c.tex}`);
  const vec = `\\nabla f = \\begin{pmatrix} ${components.map((c) => c.tex).join(" \\\\ ")} \\end{pmatrix}`;
  return { tex: vec, components: components.map((c, i) => ({ v: vars[i], tex: body[i] })) };
}
