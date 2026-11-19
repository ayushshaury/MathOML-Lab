/**
 * Smoke test for all math engines (run with bun).
 */
import { solveEquation, solveSystem } from "../src/lib/math/equations";
import { algebraSteps, evaluateSteps } from "../src/lib/math/algebra";
import { differentiateSteps } from "../src/lib/math/differentiate";
import { integrateSteps } from "../src/lib/math/integrals";
import { limitSteps, continuitySteps } from "../src/lib/math/limits";
import { solveODE } from "../src/lib/math/odes";
import { compileFn } from "../src/lib/math/core";
import { gradientSteps, divergenceSteps, curlSteps } from "../src/lib/math/vectorcalc";
import { solveTrigEquation, verifyIdentity } from "../src/lib/math/trig";
import { analyzeSequence, sumSeries, taylorSeries } from "../src/lib/math/sequences";
import { descriptiveStats, distributionSteps, combinatoricsSteps, regressionSteps, hypothesisTestSteps } from "../src/lib/math/stats";
import { shapeSolution, coordinateGeometry } from "../src/lib/math/geometry";
import { matrixOpSteps, determinantSteps, inverseSteps, eigenSteps, type Matrix } from "../src/lib/math/matrices";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  OK ${name}`); }
  else { fail++; console.log(`FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}

// equations
console.log("== Equations ==");
let s = solveEquation("2*x + 5 = 17");
check("linear x=6", s.resultText === "x = 6", s.resultText);
s = solveEquation("x^2 - 5*x + 6 = 0");
check("quadratic roots 2,3", /2/.test(s.resultText ?? "") && /3/.test(s.resultText ?? ""), s.resultText);
s = solveEquation("x^2 + 4 = 0");
check("quadratic complex", /i/.test(s.resultText ?? ""), s.resultText);
s = solveEquation("x^3 - 6*x^2 + 11*x - 6 = 0");
check("cubic 3 roots", (s.resultText?.split(",").length ?? 0) === 3, s.resultText);
s = solveSystem(["2*x + 3*y = 8", "x - y = 1"]);
check("system 2x2", /11\/5|2\.2/.test(s.resultText ?? ""), s.resultText);

// algebra
console.log("== Algebra ==");
let a = algebraSteps("(x + 3)*(x - 2)", "expand");
check("expand", (a.resultText ?? "").includes("x ^ 2") || (a.resultText ?? "").includes("+x"), a.resultText);
a = algebraSteps("x^2 - 9", "factor");
check("factor diff squares", (a.resultText ?? "").includes("*") || (a.resultText ?? "").includes("("), a.resultText);
let ev = evaluateSteps("2^10 + sqrt(144)");
check("evaluate", /1036/.test(ev.resultText ?? ""), ev.resultText);

// derivatives
console.log("== Derivatives ==");
let d = differentiateSteps("x^3", "x", 1);
check("d/dx x^3 = 3x^2", /3 \* x \^ 2/.test(d.resultText ?? ""), d.resultText);
d = differentiateSteps("sin(x)*cos(x)", "x", 1);
check("product rule", d.steps.some((st) => st.title.includes("Product Rule")), d.resultText);
d = differentiateSteps("sin(x^2)", "x", 1);
check("chain rule", d.steps.some((st) => st.title.includes("Chain Rule")), d.resultText);
d = differentiateSteps("x^4", "x", 2);
check("second derivative 12x^2", /12 \* x \^ 2/.test(d.resultText ?? ""), d.resultText);
d = differentiateSteps("x^2*y + y^3", "y", 1);
check("partial w.r.t. y", /x \^ 2 \+ 3 \* y \^ 2/.test(d.resultText ?? ""), d.resultText);

// integrals
console.log("== Integrals ==");
let i = integrateSteps("x^2 + 3*x", "x", false);
check("∫x²+3x", /1\/3|0\.3333/.test(i.resultText ?? ""), i.resultText);
i = integrateSteps("sin(x)", "x", true, 0, Math.PI);
check("∫₀^π sin = 2", /^2$|2\.0/.test(i.resultText ?? ""), i.resultText);
i = integrateSteps("x*sin(x)", "x", false);
check("∫x·sinx by parts", Boolean(i.resultText?.includes("cos")), i.resultText);

// limits
console.log("== Limits ==");
let l = limitSteps("sin(x)/x", "x", 0);
check("lim sin(x)/x = 1", /^1$|1\.0/.test(l.resultText ?? ""), l.resultText);
l = limitSteps("(x^2-4)/(x-2)", "x", 2);
check("lim (x²-4)/(x-2) = 4", /4/.test(l.resultText ?? ""), l.resultText);
l = continuitySteps("(x^2 - 4)/(x - 2)", "x", 2);
check("continuity hole", /hole|Removable/i.test(l.resultTex ?? "") || /removable/i.test(l.resultText ?? ""), l.resultText);

// ODEs
console.log("== ODEs ==");
let o = solveODE("y' = x^2", {});
check("y'=x² (+sign)", /(1\/3|x \^ 3)/.test(o.resultText ?? "") && !/^-\(?1\/3|-1 \/ 3/.test((o.resultText ?? "").trim()), o.resultText);
o = solveODE("y' + 2*y = 0", {});
check("y'+2y=0", /e\^/.test(o.resultText ?? ""), o.resultText);
const oIC = solveODE("y' + 2*y = e^(-x)", { x0: 0, y0: 1 });
const ivpErr = (() => {
  try {
    const f = compileFn(oIC.resultText ?? "", ["x"]);
    return Math.abs(f(0.5) - Math.exp(-0.5));
  } catch {
    return NaN;
  }
})();
check("IVP y'+2y=e^-x y(0)=1 → y=e^-x", ivpErr < 1e-6, { text: oIC.resultText, err: ivpErr });
const oIC2 = solveODE("y'' - 3*y' + 2*y = 0", { x0: 0, y0: 0, y1: 1 });
const ivp2Err = (() => {
  try {
    const f = compileFn(oIC2.resultText ?? "", ["x"]);
    // y = (e^x - e^2x... ) for y(0)=0, y'(0)=1: y = e^x - e^2x? check: y'=e^x-2e^2x, y'(0)=-1 ✗. y = -e^x + e^2x: y'(0)=1 ✓
    return Math.abs(f(0.3) - (-Math.exp(0.3) + Math.exp(0.6)));
  } catch {
    return NaN;
  }
})();
check("IVP 2nd order", ivp2Err < 1e-6, { text: oIC2.resultText, err: ivp2Err });
o = solveODE("y'' - 3*y' + 2*y = 0", {});
check("y''-3y'+2y=0", /e\^/.test(o.resultText ?? ""), o.resultText);
o = solveODE("y' = x*y", {});
check("separable", o.steps.some((st) => st.title.toLowerCase().includes("separabl")), o.error);

// vector calc
console.log("== Vector Calculus ==");
let g = gradientSteps("x^2*y + y^2*z", ["x", "y", "z"]);
check("gradient", Boolean(g.resultTex?.includes("nabla") || g.resultTex?.includes("pmatrix")), g.resultTex);
let dv = divergenceSteps(["x*y", "y*z", "x*z"], ["x", "y", "z"]);
check("divergence", /y \+ z \+ x|z \+ y \+ x|x \+ y \+ z/.test(dv.resultText ?? ""), dv.resultText);
let cu = curlSteps(["x*y", "y*z", "x*z"], ["x", "y", "z"]);
check("curl", Boolean(cu.resultTex?.includes("times")), cu.resultTex);

// trig
console.log("== Trigonometry ==");
let t = solveTrigEquation("sin(x) = 0.5", false);
check("sin(x)=0.5", /0\.523/.test(t.resultText ?? ""), t.resultText);
t = solveTrigEquation("cos(x) = -1", false);
check("cos(x)=-1", /3\.141/.test(t.resultText ?? ""), t.resultText);
t = verifyIdentity("sin(x)^2 + cos(x)^2 = 1");
check("pythagorean identity", /identity holds/i.test(t.resultText ?? ""), t.resultText);

// sequences
console.log("== Sequences ==");
let q = analyzeSequence([2, 5, 8, 11, 14]);
check("arithmetic d=3", q.kind === "arithmetic" && (q.nthTerm ?? "").includes("3"), q.nthTerm);
q = analyzeSequence([3, 6, 12, 24]);
check("geometric r=2", q.kind === "geometric", q.nthTerm);
let sm = sumSeries("k^2", 1, 10);
check("Σk²=385", /385/.test(sm.resultText ?? ""), sm.resultText);
let ty = taylorSeries("sin(x)", 0, 5);
check("taylor sin", (ty.resultTex ?? "").includes("P_{5}"), ty.resultTex);

// stats
console.log("== Statistics ==");
let st = descriptiveStats("12 15 11 20 17 14 12 19 16 13");
check("stats mean 14.9", /mean=14\.9/.test(st.resultText ?? ""), st.resultText);
let di = distributionSteps("binomial", { n: 10, p: 0.5 }, { type: "exactly", value: 5 });
check("binom P(X=5)≈0.246", /0\.246/.test(di.resultText ?? ""), di.resultText);
let dn = distributionSteps("normal", { mu: 0, sigma: 1 }, { type: "less", value: 1.96 });
check("Φ(1.96)≈0.975", /0\.97[45]/.test(dn.resultText ?? ""), dn.resultText);
let cb = combinatoricsSteps(10, 3, "comb");
check("C(10,3)=120", /120/.test(cb.resultText ?? ""), cb.resultText);
let rg = regressionSteps("1 2\n2 4.1\n3 5.8\n4 8.2\n5 10.1", 1);
check("regression r high", /r=0\.99/.test(rg.resultText ?? ""), rg.resultText);
let ht = hypothesisTestSteps("102 98 101 99 103 97 100 104 98 100", 100, null, 0.05, 2);
check("t-test runs", ht.steps.length > 3, ht.error);

// geometry
console.log("== Geometry ==");
let sh = shapeSolution("circle", { r: 2 });
check("circle area 12.57", /12\.566/.test(sh.resultText ?? ""), sh.resultText);
let cg = coordinateGeometry(0, 0, 3, 4);
check("distance 5", /d=5/.test(cg.resultText ?? ""), cg.resultText);

// matrices
console.log("== Matrices ==");
const A: Matrix = [[1, 2], [3, 4]];
const B: Matrix = [[5, 6], [7, 8]];
let m = matrixOpSteps(A, B, "*", 1);
check("A*B = [[19,22],[43,50]]", /19/.test(m.resultText ?? ""), m.resultText);
let dt = determinantSteps(A);
check("det = -2", /-2/.test(dt.resultText ?? ""), dt.resultText);
let iv = inverseSteps([[4, 7], [2, 6]]);
check("inverse", /0\.6|-0\.7|0\.3|-0\.2/.test(iv.resultText ?? ""), iv.resultText);
let eg = eigenSteps([[2, 0], [0, 3]]);
check("eigen 2,3", /2/.test(eg.resultText ?? "") && /3/.test(eg.resultText ?? ""), eg.resultText);
let m3 = matrixOpSteps([[1, 2, 3], [4, 5, 6]], null, "transpose", 1);
check("transpose", (m3.resultTex ?? "").includes("1 & 4"), m3.resultTex);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
