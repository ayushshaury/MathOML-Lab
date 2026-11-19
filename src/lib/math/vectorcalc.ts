/**
 * Vector calculus engine: gradient, divergence, curl — with steps.
 */
import { parseExpr, preprocess, toTex, fmt, type Solution } from "./core";
import { allPartials } from "./differentiate";
import { nrdTex } from "./nerdamer-client";

function texSafe(s: string): string {
  const t = nrdTex(s);
  if (t) return t;
  try { return toTex(s); } catch { return s; }
}

export function gradientSteps(input: string, vars: string[]): Solution {
  const steps: Solution["steps"] = [];
  try {
    const p = preprocess(input);
    parseExpr(p);
    steps.push({
      title: "The scalar field",
      explanation: "The gradient of a scalar field f is the vector of its partial derivatives — it points in the direction of steepest increase, and its length is the rate of increase in that direction.",
      math: `f(${vars.join(",")}) = ${texSafe(p)}`,
    });
    const partials = allPartials(p, vars);
    partials.forEach((pt) => {
      steps.push({
        title: `Partial derivative with respect to ${pt.v}`,
        explanation: `Differentiate with respect to ${pt.v} while treating the other variables as constants.`,
        math: `\\frac{\\partial f}{\\partial ${pt.v}} = ${pt.tex}`,
      });
    });
    const gradTex = `\\nabla f = \\begin{pmatrix} ${partials.map((x) => x.tex).join(" \\\\ ")} \\end{pmatrix}`;
    steps.push({ title: "Assemble the gradient vector", math: gradTex });
    return {
      title: "Gradient",
      resultTex: gradTex,
      resultText: `grad f = (${partials.map((x) => x.node.toString()).join(", ")})`,
      steps,
      notes: ["The gradient is always perpendicular to the level curves/surfaces of f."],
    };
  } catch (e) {
    return { title: "Gradient", steps: [], error: (e as Error).message };
  }
}

export function divergenceSteps(components: string[], vars: string[]): Solution {
  const steps: Solution["steps"] = [];
  try {
    const clean = components.map(preprocess);
    clean.forEach((c) => parseExpr(c));
    steps.push({
      title: "The vector field",
      explanation: "The divergence measures how much the vector field spreads out from (or converges into) each point — think of a fluid source (positive) or sink (negative).",
      math: `\\vec{F} = \\begin{pmatrix} ${clean.map((c) => texSafe(c)).join(" \\\\ ")} \\end{pmatrix}`,
    });
    const parts = vars.map((v, i) => allPartials(clean[i], [v])[0]);
    parts.forEach((pt, i) => {
      steps.push({
        title: `Partial derivative of component ${i + 1} with respect to ${vars[i]}`,
        math: `\\frac{\\partial F_{${i + 1}}}{\\partial ${vars[i]}} = \\frac{\\partial}{\\partial ${vars[i]}}\\left(${texSafe(clean[i])}\\right) = ${pt.tex}`,
      });
    });
    const sumTex = parts.map((x) => x.tex).join(" + ");
    const sumStr = parts.map((x) => x.node.toString()).join(" + ");
    const divTex = `\\nabla\\cdot\\vec{F} = ${sumTex}`;
    steps.push({ title: "Add the three partial derivatives", math: divTex });
    return {
      title: "Divergence",
      resultTex: divTex,
      resultText: `div F = ${sumStr}`,
      steps,
      notes: ["Positive divergence indicates a source; negative indicates a sink; zero means the field is incompressible."],
    };
  } catch (e) {
    return { title: "Divergence", steps: [], error: (e as Error).message };
  }
}

export function curlSteps(components: string[], vars: string[]): Solution {
  const steps: Solution["steps"] = [];
  try {
    if (vars.length < 3 || components.length < 3) throw new Error("Curl requires a 3-dimensional vector field (three components in x, y, z).");
    const [Fx, Fy, Fz] = components.map(preprocess);
    [Fx, Fy, Fz].forEach((c) => parseExpr(c));
    steps.push({
      title: "The vector field",
      explanation: "The curl measures the rotation (twist) of the vector field at each point — the axis of the curl vector is the rotation axis, its length the rotation strength.",
      math: `\\vec{F} = \\begin{pmatrix} ${texSafe(Fx)} \\\\ ${texSafe(Fy)} \\\\ ${texSafe(Fz)} \\end{pmatrix}`,
    });
    steps.push({
      title: "The curl formula (determinant of a symbolic matrix)",
      explanation: "Expand the determinant along the first row; each 2×2 minor gives one component.",
      math: `\\nabla\\times\\vec{F} = \\begin{vmatrix} \\hat{i} & \\hat{j} & \\hat{k} \\\\ \\frac{\\partial}{\\partial x} & \\frac{\\partial}{\\partial y} & \\frac{\\partial}{\\partial z} \\\\ ${texSafe(Fx)} & ${texSafe(Fy)} & ${texSafe(Fz)} \\end{vmatrix}`,
    });
    const dFy_dz = allPartials(Fy, [vars[2]])[0];
    const dFz_dy = allPartials(Fz, [vars[1]])[0];
    const dFx_dz = allPartials(Fx, [vars[2]])[0];
    const dFy_dx = allPartials(Fy, [vars[0]])[0];
    const dFz_dx = allPartials(Fz, [vars[0]])[0];
    const dFx_dy = allPartials(Fx, [vars[1]])[0];
    const comps = [
      { tex: `${dFy_dz.tex} - ${dFz_dy.tex}`, name: "i" },
      { tex: `${dFz_dx.tex} - ${dFx_dz.tex}`, name: "j" },
      { tex: `${dFx_dy.tex} - ${dFy_dx.tex}`, name: "k" },
    ];
    steps.push({
      title: "Compute each component",
      explanation: "Each component is a difference of two mixed partial derivatives, following the determinant expansion pattern.",
      math: `\\begin{aligned} (\\nabla\\times\\vec{F})_x &= \\frac{\\partial F_y}{\\partial z} - \\frac{\\partial F_z}{\\partial y} = ${dFy_dz.tex} - ${dFz_dy.tex} \\\\ (\\nabla\\times\\vec{F})_y &= \\frac{\\partial F_z}{\\partial x} - \\frac{\\partial F_x}{\\partial z} = ${dFz_dx.tex} - ${dFx_dz.tex} \\\\ (\\nabla\\times\\vec{F})_z &= \\frac{\\partial F_x}{\\partial y} - \\frac{\\partial F_y}{\\partial x} = ${dFx_dy.tex} - ${dFy_dx.tex} \\end{aligned}`,
    });
    const curlTex = `\\nabla\\times\\vec{F} = \\begin{pmatrix} ${comps[0].tex} \\\\ ${comps[1].tex} \\\\ ${comps[2].tex} \\end{pmatrix}`;
    steps.push({ title: "The curl vector", math: curlTex });
    const isZero = comps.every((c) => /^[0()-\s]+$/.test(c.tex.replace(/frac|partial|times|nabla/g, "")));
    return {
      title: "Curl",
      resultTex: curlTex,
      resultText: `curl F = (${comps.map((c) => c.tex).join(", ")})`,
      steps,
      notes: [isZero ? "The curl is (close to) zero — this field is irrotational (conservative, in simply-connected regions)." : "A non-zero curl means the field circulates around points."],
    };
  } catch (e) {
    return { title: "Curl", steps: [], error: (e as Error).message };
  }
}
