/**
 * Statistics & probability engine: descriptive statistics, quartiles,
 * outlier detection, distributions (binomial, normal, Poisson),
 * combinatorics, correlation and regression.
 */
import { fmt, texNum, type Solution } from "./core";

export interface StatsResult extends Solution {
  histogram?: { bins: { from: number; to: number; count: number }[]; data: number[] };
  boxplot?: { min: number; q1: number; median: number; q3: number; max: number; outliers: number[] };
  scatter?: { points: { x: number; y: number }[]; fit?: { m: number; b: number; r2?: number }[]; fitPoly?: string };
}

export function parseNumbers(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && Number.isFinite(Number(s)))
    .map(Number);
}

export function descriptiveStats(raw: string): StatsResult {
  const steps: Solution["steps"] = [];
  try {
    const data = parseNumbers(raw);
    if (data.length < 2) throw new Error("Please enter at least two numbers separated by spaces or commas.");
    const n = data.length;
    const sorted = [...data].sort((a, b) => a - b);
    steps.push({ title: "The data set", explanation: `n = ${n} values. Always start by sorting the data — this unlocks the median, quartiles and range.`, math: `x = \\{${sorted.map((v) => fmt(v)).join(",\\; ")}\\}` });

    // mean
    const sum = data.reduce((s, x) => s + x, 0);
    const mean = sum / n;
    steps.push({
      title: "Mean (arithmetic average)",
      explanation: "Add all the values and divide by how many there are.",
      math: `\\bar{x} = \\frac{1}{n}\\sum x_i = \\frac{${sorted.map((v) => fmt(v)).join(" + ")}}{${n}} = \\frac{${fmt(sum)}}{${n}} = ${fmt(mean)}`,
    });

    // median
    const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    steps.push({
      title: "Median (middle value)",
      explanation: n % 2 === 1 ? "With an odd number of values, the median is the single middle value of the sorted data." : "With an even number of values, the median is the average of the two middle values.",
      math: n % 2 === 1
        ? `\\tilde{x} = x_{(${n}+1)/2} = ${fmt(median)}`
        : `\\tilde{x} = \\frac{x_{(${n}/2)} + x_{(${n}/2 + 1)}}{2} = \\frac{${fmt(sorted[n / 2 - 1])} + ${fmt(sorted[n / 2])}}{2} = ${fmt(median)}`,
    });

    // mode
    const freq = new Map<number, number>();
    data.forEach((x) => freq.set(x, (freq.get(x) ?? 0) + 1));
    const maxFreq = Math.max(...freq.values());
    const modes = maxFreq > 1 ? [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v) : [];
    steps.push({
      title: "Mode (most frequent value)",
      math: modes.length ? `\\text{mode} = ${modes.map((m) => fmt(m)).join(",\\; ")}\\ \\text{(appears } ${maxFreq}\\times)` : "\\text{no mode (all values unique)}",
    });

    // range
    const min = sorted[0], max = sorted[n - 1];
    steps.push({ title: "Range and extremes", math: `\\text{min} = ${fmt(min)},\\quad \\text{max} = ${fmt(max)},\\quad R = \\text{max} - \\text{min} = ${fmt(max - min)}` });

    // quartiles (Tukey method)
    const q = (p: number): number => {
      const pos = p * (n - 1);
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    };
    const q1 = q(0.25), q3 = q(0.75);
    const iqr = q3 - q1;
    steps.push({
      title: "Quartiles and the interquartile range",
      explanation: "Q1 and Q3 bracket the middle 50% of the data. The IQR measures spread that is robust to outliers.",
      math: `Q_1 = ${fmt(q1)},\\quad Q_3 = ${fmt(q3)},\\quad IQR = Q_3 - Q_1 = ${fmt(iqr)}`,
    });

    // outliers
    const lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
    const outliers = sorted.filter((x) => x < lower || x > upper);
    if (outliers.length) {
      steps.push({
        title: "Outlier check (1.5 × IQR rule)",
        explanation: "Values below Q1 − 1.5·IQR or above Q3 + 1.5·IQR are flagged as outliers.",
        math: `\\text{fences}: [${fmt(lower)},\\; ${fmt(upper)}]\\;\\Rightarrow\\; \\text{outliers}: ${outliers.map((v) => fmt(v)).join(", ")}`,
      });
    }

    // variance & std
    const ss = data.reduce((s, x) => s + (x - mean) ** 2, 0);
    const varP = ss / n;
    const varS = ss / (n - 1);
    const sdP = Math.sqrt(varP);
    const sdS = Math.sqrt(varS);
    steps.push({
      title: "Variance and standard deviation",
      explanation: "The variance averages the squared distances from the mean; the standard deviation takes the square root to return to the original units. Use the sample formula (divide by n − 1) when the data is a sample; the population formula (divide by n) when it is the whole population.",
      math: `s^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n-1} = \\frac{${fmt(ss)}}{${n - 1}} = ${fmt(varS)},\\quad s = ${fmt(sdS)}`,
    });

    // skewness & kurtosis
    const skew = (ss / n) ** 1.5 ? (data.reduce((s, x) => s + ((x - mean) / sdP) ** 3, 0) / n) : 0;
    const kurt = data.reduce((s, x) => s + ((x - mean) / sdP) ** 4, 0) / n - 3;
    steps.push({
      title: "Shape: skewness and excess kurtosis",
      explanation: "Skewness measures asymmetry (positive = longer right tail); excess kurtosis measures tail heaviness compared to a normal distribution (0 = normal).",
      math: `\\text{skew} \\approx ${fmt(skew)},\\quad \\text{excess kurtosis} \\approx ${fmt(kurt)}`,
    });

    // histogram bins (Sturges)
    const kBins = Math.max(4, Math.min(16, Math.ceil(Math.log2(n) + 1)));
    const binW = (max - min) / kBins || 1;
    const bins = Array.from({ length: kBins }, (_, i) => ({
      from: min + i * binW,
      to: min + (i + 1) * binW,
      count: 0,
    }));
    data.forEach((x) => {
      let idx = Math.floor((x - min) / binW);
      if (idx >= kBins) idx = kBins - 1;
      if (idx < 0) idx = 0;
      bins[idx].count++;
    });

    return {
      title: "Descriptive Statistics",
      resultTex: `\\bar{x} = ${fmt(mean)},\\; \\tilde{x} = ${fmt(median)},\\; s = ${fmt(sdS)},\\; Q_1 = ${fmt(q1)},\\; Q_3 = ${fmt(q3)}`,
      resultText: `mean=${fmt(mean)}, median=${fmt(median)}, mode=${modes.map((m) => fmt(m)).join("/") || "none"}, sd=${fmt(sdS)}, var=${fmt(varS)}, min=${fmt(min)}, max=${fmt(max)}, Q1=${fmt(q1)}, Q3=${fmt(q3)}, IQR=${fmt(iqr)}, skew=${fmt(skew)}`,
      steps,
      histogram: { bins, data: sorted },
      boxplot: { min, q1, median, q3, max, outliers },
      notes: [n >= 30 ? "n ≥ 30 — the sample is large enough for the Central Limit Theorem to matter." : "Small sample (n < 30): interpret the standard deviation with care."],
    };
  } catch (e) {
    return { title: "Descriptive Statistics", steps: [], error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Distributions                                                       */
/* ------------------------------------------------------------------ */

function logGamma(z: number): number {
  // Lanczos approximation
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function gammaFn(z: number): number {
  if (Number.isInteger(z) && z > 0) {
    let r = 1;
    for (let i = 2; i < z; i++) r *= i;
    return r;
  }
  return Math.exp(logGamma(z));
}

function incompleteGamma(s: number, x: number): number {
  // series expansion for P(s, x)
  if (x < 0) return 0;
  if (x === 0) return 0;
  let sum = 1 / s;
  let term = sum;
  for (let n = 1; n < 500; n++) {
    term *= x / (s + n);
    sum += term;
    if (Math.abs(term) < 1e-14 * Math.abs(sum)) break;
  }
  return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
}

export function binomialPmf(k: number, n: number, p: number): number {
  const c = combinations(n, k);
  return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r * 1e6) / 1e6;
}

export function permutations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
}

export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

export function normalCdf(z: number): number {
  // Abramowitz–Stegun / erf approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - normalPdf(z) * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

export function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / gammaFn(k + 1);
}

export type DistKind = "binomial" | "normal" | "poisson";

export function distributionSteps(
  kind: DistKind,
  params: Record<string, number>,
  query: { type: "exactly" | "atMost" | "atLeast" | "between" | "less" | "greater"; value?: number; value2?: number }
): StatsResult {
  const steps: Solution["steps"] = [];
  try {
    if (kind === "binomial") {
      const n = Math.round(params.n ?? 10);
      const p = params.p ?? 0.5;
      const k = Math.round(query.value ?? 0);
      if (n < 1 || n > 10000) throw new Error("n must be between 1 and 10000.");
      if (p < 0 || p > 1) throw new Error("p must be between 0 and 1.");
      steps.push({
        title: "The binomial distribution",
        explanation: `Models the number of successes in ${n} independent trials, each with success probability ${fmt(p)}.`,
        math: `X \\sim B(${n},\\; ${texNum(p)}),\\qquad P(X = k) = \\binom{${n}}{k}\\,${texNum(p)}^k\\,(1-${texNum(p)})^{${n}-k}`,
      });
      steps.push({ title: `Binomial coefficient for k = ${k}`, math: `\\binom{${n}}{${k}} = \\frac{${n}!}{${k}!\\,(${n}-${k})!} = ${fmt(combinations(n, k))}` });
      const pmf = binomialPmf(k, n, p);
      steps.push({
        title: "Insert into the formula",
        math: `P(X = ${k}) = ${fmt(combinations(n, k))}\\cdot ${texNum(p)}^{${k}}\\cdot ${texNum(1 - p)}^{${n - k}} = ${fmt(pmf)}`,
      });
      let result = pmf;
      let resultTex = `P(X = ${k}) = ${fmt(pmf)}`;
      if (query.type === "atMost") {
        let s = 0;
        for (let i = 0; i <= k; i++) s += binomialPmf(i, n, p);
        steps.push({ title: `Sum all probabilities up to k = ${k}`, explanation: "P(X ≤ k) is the cumulative probability.", math: `P(X \\le ${k}) = \\sum_{i=0}^{${k}} P(X=i) = ${fmt(s)}` });
        result = s; resultTex = `P(X \\le ${k}) = ${fmt(s)}`;
      } else if (query.type === "atLeast") {
        let s = 0;
        for (let i = k; i <= n; i++) s += binomialPmf(i, n, p);
        steps.push({ title: `Sum from k = ${k} to ${n}`, explanation: "Equivalently 1 − P(X ≤ k − 1).", math: `P(X \\ge ${k}) = ${fmt(s)}` });
        result = s; resultTex = `P(X \\ge ${k}) = ${fmt(s)}`;
      } else if (query.type === "between") {
        const k2 = Math.round(query.value2 ?? k);
        let s = 0;
        for (let i = Math.min(k, k2); i <= Math.max(k, k2); i++) s += binomialPmf(i, n, p);
        result = s; resultTex = `P(${Math.min(k, k2)} \\le X \\le ${Math.max(k, k2)}) = ${fmt(s)}`;
        steps.push({ title: "Sum over the interval", math: resultTex });
      }
      const mean = n * p, varr = n * p * (1 - p);
      steps.push({ title: "Mean and variance", math: `E[X] = np = ${fmt(mean)},\\quad Var[X] = np(1-p) = ${fmt(varr)}` });
      // pmf chart data
      const bars = Array.from({ length: Math.min(n + 1, 40) }, (_, i) => ({ x: i, y: binomialPmf(i, n, p) }));
      return {
        title: "Binomial Distribution",
        resultTex,
        resultText: fmt(result),
        steps,
        scatter: { points: bars },
        notes: [`The most likely value (mode) is around k = ${fmt(Math.round((n + 1) * p))}.`],
      };
    }
    if (kind === "normal") {
      const mu = params.mu ?? 0, sigma = params.sigma ?? 1;
      if (sigma <= 0) throw new Error("The standard deviation σ must be positive.");
      const x = query.value ?? 0;
      const z = (x - mu) / sigma;
      steps.push({
        title: "The normal distribution",
        explanation: "The bell curve — symmetric, with 68% of the data within 1σ, 95% within 2σ and 99.7% within 3σ of the mean.",
        math: `X \\sim N(${texNum(mu)},\\; ${texNum(sigma)}^2)`,
      });
      steps.push({
        title: "Standardise to a z-score",
        explanation: "Convert x into a standard normal variable z = (x − μ)/σ so that standard normal tables apply.",
        math: `z = \\frac{x - \\mu}{\\sigma} = \\frac{${fmt(x)} - ${fmt(mu)}}{${fmt(sigma)}} = ${fmt(z)}`,
      });
      const cdf = normalCdf(z);
      let result = cdf;
      let resultTex = `P(X < ${fmt(x)}) = \\Phi(${fmt(z)}) = ${fmt(cdf)}`;
      if (query.type === "greater") {
        result = 1 - cdf;
        steps.push({ title: "Upper tail (complement rule)", math: `P(X > ${fmt(x)}) = 1 - \\Phi(${fmt(z)}) = ${fmt(result)}` });
        resultTex = `P(X > ${fmt(x)}) = ${fmt(result)}`;
      } else if (query.type === "between") {
        const x2 = query.value2 ?? x;
        const z2 = (x2 - mu) / sigma;
        result = Math.abs(normalCdf(z2) - cdf);
        steps.push({ title: "Area between two z-scores", math: `P(${fmt(Math.min(x, x2))} < X < ${fmt(Math.max(x, x2))}) = \\Phi(${fmt(Math.max(z, z2))}) - \\Phi(${fmt(Math.min(z, z2))}) = ${fmt(result)}` });
        resultTex = `P(${fmt(Math.min(x, x2))} < X < ${fmt(Math.max(x, x2))}) = ${fmt(result)}`;
      } else {
        steps.push({ title: "Look up / compute Φ(z)", math: `\\Phi(${fmt(z)}) = ${fmt(cdf)}` });
      }
      const curve: { x: number; y: number }[] = [];
      for (let t = -3.6; t <= 3.6001; t += 0.05) curve.push({ x: mu + t * sigma, y: normalPdf(t) / sigma });
      return {
        title: "Normal Distribution",
        resultTex,
        resultText: fmt(result),
        steps,
        scatter: { points: curve },
      };
    }
    // poisson
    const lambda = params.lambda ?? 1;
    const k = Math.round(query.value ?? 0);
    if (lambda <= 0) throw new Error("λ must be positive.");
    steps.push({
      title: "The Poisson distribution",
      explanation: `Models the number of events in a fixed interval when they occur independently at average rate λ = ${fmt(lambda)}.`,
      math: `X \\sim \\text{Poisson}(${texNum(lambda)}),\\qquad P(X = k) = \\frac{\\lambda^k e^{-\\lambda}}{k!}`,
    });
    const pmf = poissonPmf(k, lambda);
    steps.push({
      title: `Insert k = ${k}`,
      math: `P(X = ${k}) = \\frac{${texNum(lambda)}^{${k}}\\,e^{-${texNum(lambda)}}}{${k}!} = ${fmt(pmf)}`,
    });
    let result = pmf;
    let resultTex = `P(X = ${k}) = ${fmt(pmf)}`;
    if (query.type === "atMost") {
      let s = 0;
      for (let i = 0; i <= k; i++) s += poissonPmf(i, lambda);
      result = s; resultTex = `P(X \\le ${k}) = ${fmt(s)}`;
      steps.push({ title: "Cumulative sum", math: resultTex });
    } else if (query.type === "atLeast") {
      let s = 1;
      for (let i = 0; i < k; i++) s -= poissonPmf(i, lambda);
      result = Math.max(0, s); resultTex = `P(X \\ge ${k}) = ${fmt(result)}`;
      steps.push({ title: "Complement rule", math: `P(X \\ge ${k}) = 1 - P(X \\le ${k - 1}) = ${fmt(result)}` });
    }
    steps.push({ title: "Mean and variance", math: `E[X] = Var[X] = \\lambda = ${fmt(lambda)}` });
    const bars: { x: number; y: number }[] = [];
    for (let i = 0; i <= Math.max(10, Math.ceil(lambda + 4 * Math.sqrt(lambda))); i++) bars.push({ x: i, y: poissonPmf(i, lambda) });
    return {
      title: "Poisson Distribution",
      resultTex,
      resultText: fmt(result),
      steps,
      scatter: { points: bars },
    };
  } catch (e) {
    return { title: "Distribution", steps: [], error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Combinatorics                                                       */
/* ------------------------------------------------------------------ */

export function combinatoricsSteps(n: number, k: number, kind: "perm" | "comb" | "permRep" | "combRep"): Solution {
  const steps: Solution["steps"] = [];
  try {
    if (kind === "perm") {
      steps.push({
        title: "Permutations (order matters, no repetition)",
        explanation: "How many ways to arrange k items chosen from n distinct items, where different orders count separately.",
        math: `P(n, k) = \\frac{n!}{(n-k)!}`,
      });
      steps.push({
        title: "Compute",
        math: `P(${n}, ${k}) = \\frac{${n}!}{(${n}-${k})!} = ${n > 20 ? `${fmt(permutations(n, k))}` : `${Array.from({ length: k }, (_, i) => n - i).join(" \\cdot ")} = ${fmt(permutations(n, k))}`}`,
      });
      return { title: "Permutations", resultTex: `P(${n},${k}) = ${fmt(permutations(n, k))}`, resultText: fmt(permutations(n, k)), steps };
    }
    if (kind === "comb") {
      steps.push({
        title: "Combinations (order does not matter)",
        explanation: "How many ways to choose k items from n when the order of selection is irrelevant.",
        math: `\\binom{n}{k} = \\frac{n!}{k!\\,(n-k)!}`,
      });
      steps.push({
        title: "Compute",
        math: `\\binom{${n}}{${k}} = \\frac{${n}!}{${k}!\\,(${n}-${k})!} = ${fmt(combinations(n, k))}`,
      });
      return { title: "Combinations", resultTex: `\\binom{${n}}{${k}} = ${fmt(combinations(n, k))}`, resultText: fmt(combinations(n, k)), steps };
    }
    if (kind === "permRep") {
      const r = Math.pow(n, k);
      steps.push({
        title: "Permutations with repetition",
        explanation: "Each of the k slots can independently take any of the n values.",
        math: `n^k = ${n}^{${k}} = ${fmt(r)}`,
      });
      return { title: "Permutations with repetition", resultTex: `${n}^{${k}} = ${fmt(r)}`, resultText: fmt(r), steps };
    }
    const r = combinations(n + k - 1, k);
    steps.push({
      title: "Combinations with repetition",
      explanation: "Choosing k items from n types with unlimited repetition (stars and bars).",
      math: `\\binom{n + k - 1}{k} = \\binom{${n + k - 1}}{${k}} = ${fmt(r)}`,
    });
    return { title: "Combinations with repetition", resultTex: `\\binom{${n + k - 1}}{${k}} = ${fmt(r)}`, resultText: fmt(r), steps };
  } catch (e) {
    return { title: "Combinatorics", steps: [], error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Correlation & regression                                            */
/* ------------------------------------------------------------------ */

export function regressionSteps(pairsText: string, degree: number): StatsResult {
  const steps: Solution["steps"] = [];
  try {
    const pairs = pairsText
      .split(/[\n;]+/)
      .map((line) => line.split(/[\s,]+/).map(Number))
      .filter((arr) => arr.length >= 2 && arr.every((v) => Number.isFinite(v)))
      .map((arr) => ({ x: arr[0], y: arr[1] }));
    if (pairs.length < 3) throw new Error("Enter at least three (x, y) pairs, one per line.");
    const n = pairs.length;
    steps.push({ title: "The data", explanation: `${n} points. Regression finds the polynomial that minimises the sum of squared vertical distances to the points (least squares).` });

    const xs = pairs.map((p) => p.x), ys = pairs.map((p) => p.y);
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const sxx = xs.reduce((s, v) => s + (v - mx) ** 2, 0);
    const syy = ys.reduce((s, v) => s + (v - my) ** 2, 0);
    const sxy = pairs.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const r = sxy / Math.sqrt(sxx * syy);

    if (degree <= 1) {
      const m = sxy / sxx;
      const b = my - m * mx;
      steps.push({ title: "Means", math: `\\bar{x} = ${fmt(mx)},\\quad \\bar{y} = ${fmt(my)}` });
      steps.push({
        title: "Slope of the least-squares line",
        explanation: "The slope is the covariance of x and y divided by the variance of x.",
        math: `m = \\frac{\\sum (x_i-\\bar{x})(y_i-\\bar{y})}{\\sum (x_i-\\bar{x})^2} = \\frac{${fmt(sxy)}}{${fmt(sxx)}} = ${fmt(m)}`,
      });
      steps.push({
        title: "Intercept",
        explanation: "The line always passes through the point of means (x̄, ȳ).",
        math: `b = \\bar{y} - m\\,\\bar{x} = ${fmt(my)} - ${fmt(m)}\\cdot${fmt(mx)} = ${fmt(b)}`,
      });
      steps.push({
        title: "Correlation coefficient",
        explanation: "r measures the strength and direction of the linear relationship: |r| = 1 is a perfect line, r = 0 no linear relation.",
        math: `r = \\frac{\\sum (x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum (x_i-\\bar{x})^2 \\sum (y_i-\\bar{y})^2}} = ${fmt(r)}`,
      });
      const r2 = r * r;
      steps.push({ title: "Coefficient of determination", math: `R^2 = r^2 = ${fmt(r2)}\\;\\text{(${fmt(r2 * 100)}\\% of the variation explained)}` });
      const ssRes = pairs.reduce((s, p) => s + (p.y - (m * p.x + b)) ** 2, 0);
      steps.push({ title: "Residual analysis", math: `SS_{\\text{res}} = \\sum (y_i - \\hat{y}_i)^2 = ${fmt(ssRes)}` });
      return {
        title: "Linear Regression",
        resultTex: `\\hat{y} = ${fmt(m)}\\,x ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))},\\qquad r = ${fmt(r)}`,
        resultText: `y = ${m}*x + (${b}); r=${fmt(r)}; R2=${fmt(r2)}`,
        steps,
        scatter: { points: pairs, fit: [{ m, b }] },
      };
    }
    // polynomial regression degree d: solve normal equations via least squares
    const d = Math.min(degree, 6);
    const A: number[][] = [];
    const bb: number[] = [];
    for (let i = 0; i <= d; i++) {
      const row: number[] = [];
      for (let j = 0; j <= d; j++) row.push(xs.reduce((s, x) => s + Math.pow(x, i + j), 0));
      A.push(row);
      bb.push(pairs.reduce((s, p) => s + p.y * Math.pow(p.x, i), 0));
    }
    // gaussian solve
    const M = A.map((row, i) => [...row, bb[i]]);
    for (let col = 0; col <= d; col++) {
      let piv = col;
      for (let row2 = col + 1; row2 <= d; row2++) if (Math.abs(M[row2][col]) > Math.abs(M[piv][col])) piv = row2;
      if (Math.abs(M[piv][col]) < 1e-12) throw new Error("The system is ill-conditioned — try a lower degree.");
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let row2 = col + 1; row2 <= d; row2++) {
        const f = M[row2][col] / M[col][col];
        for (let c = col; c <= d + 1; c++) M[row2][c] -= f * M[col][c];
      }
    }
    const coeffs = new Array(d + 1).fill(0);
    for (let row2 = d; row2 >= 0; row2--) {
      let s = M[row2][d + 1];
      for (let c = row2 + 1; c <= d; c++) s -= M[row2][c] * coeffs[c];
      coeffs[row2] = s / M[row2][row2];
    }
    steps.push({
      title: `Polynomial regression of degree ${d}`,
      explanation: "We solve the normal equations — the system that minimises the squared residuals for a degree-d polynomial.",
      math: `\\hat{y} = ${coeffs.map((c, i) => `${fmt(c)}\\,x^{${i}}`).reverse().join(" + ")}`,
    });
    const yh = (x: number) => coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0);
    const sst = syy;
    const sse = pairs.reduce((s, p) => s + (p.y - yh(p.x)) ** 2, 0);
    const r2 = 1 - sse / sst;
    steps.push({ title: "Goodness of fit", math: `R^2 = 1 - \\frac{SS_{res}}{SS_{tot}} = ${fmt(r2)}` });
    return {
      title: `Polynomial Regression (degree ${d})`,
        resultTex: `\\hat{y} = ${coeffs.map((c, i) => `${fmt(c)}\\,x^{${i}}`).reverse().join(" + ")},\\quad R^2 = ${fmt(r2)}`,
        resultText: coeffs.map((c, i) => `${c}*x^${i}`).join(" + "),
        steps,
        scatter: { points: pairs, fit: [], fitPoly: coeffs.map((c, i) => `(${c})*x^${i}`).join(" + ") },
        notes: [`R² = ${fmt(r2)} — the model explains ${fmt(r2 * 100)}% of the variation in y.`],
      };
  } catch (e) {
    return { title: "Regression", steps: [], error: (e as Error).message };
  }
}

/** z-test / t-test for a sample mean. */
export function hypothesisTestSteps(
  dataOrMean: string, mu0: number, sigma: number | null, alpha: number, tails: 1 | 2
): StatsResult {
  const steps: Solution["steps"] = [];
  try {
    const data = parseNumbers(dataOrMean);
    let mean: number, n: number, s: number | null = null;
    if (data.length >= 2) {
      n = data.length;
      mean = data.reduce((a, b) => a + b, 0) / n;
      const ss = data.reduce((s2, x) => s2 + (x - mean) ** 2, 0);
      s = Math.sqrt(ss / (n - 1));
    } else {
      const v = Number(dataOrMean.trim());
      if (!Number.isFinite(v)) throw new Error("Enter the sample data (numbers separated by spaces) or the sample mean.");
      mean = v; n = 1; // placeholder, caller should give sigma path
      throw new Error("Please paste the raw sample data for a complete test.");
    }
    steps.push({ title: "The hypotheses", explanation: "H₀ claims the population mean equals μ₀; H₁ is the alternative we are testing for.", math: `H_0: \\mu = ${texNum(mu0)} \\quad\\text{vs}\\quad H_${tails === 2 ? "1: \\mu \\ne" : tails === 1 ? "1: \\mu >" : "1: \\mu <"} ${texNum(mu0)}` });
    steps.push({ title: "Sample statistics", math: `n = ${n},\\quad \\bar{x} = ${fmt(mean)},\\quad s = ${fmt(s!)}` });

    const useZ = sigma !== null && sigma > 0;
    const se = useZ ? sigma! / Math.sqrt(n) : s! / Math.sqrt(n);
    const stat = (mean - mu0) / se;
    steps.push({
      title: useZ ? "z-statistic (σ known)" : "t-statistic (σ estimated by s)",
      explanation: "The statistic measures how many standard errors the sample mean is away from the hypothesised value.",
      math: `${useZ ? "z" : "t"} = \\frac{\\bar{x} - \\mu_0}{${useZ ? "\\sigma" : "s"}/\\sqrt{n}} = \\frac{${fmt(mean)} - ${fmt(mu0)}}{${fmt(se)}} = ${fmt(stat)}`,
    });
    // p-value via normal or t approximation
    let p: number;
    if (useZ) {
      p = tails === 2 ? 2 * (1 - normalCdf(Math.abs(stat))) : 1 - normalCdf(Math.abs(stat));
    } else {
      // Student t CDF via incomplete beta approximation
      const df = n - 1;
      const t2 = stat * stat;
      const x = df / (df + t2);
      const pTwo = incompleteBeta(df / 2, 0.5, x);
      p = tails === 2 ? pTwo : (stat > 0 ? pTwo / 2 : 1 - pTwo / 2);
    }
    steps.push({
      title: "p-value",
      explanation: `The p-value is the probability of seeing data at least this extreme if H₀ were true. Compare it with the significance level α = ${alpha}.`,
      math: `p \\approx ${fmt(p)}`,
    });
    const reject = p < alpha;
    steps.push({
      title: reject ? `Reject H₀ (p < α = ${alpha})` : `Fail to reject H₀ (p ≥ α = ${alpha})`,
      explanation: reject
        ? "The data provides statistically significant evidence against the null hypothesis."
        : "The data is consistent with the null hypothesis — no significant effect detected.",
    });
    return {
      title: useZ ? "z-Test for the Mean" : "t-Test for the Mean",
      resultTex: `${useZ ? "z" : "t"} = ${fmt(stat)},\\quad p \\approx ${fmt(p)}\\;${reject ? "(\\text{reject } H_0)" : "(\\text{fail to reject } H_0)"}`,
      resultText: `stat=${fmt(stat)}, p=${fmt(p)}, ${reject ? "reject H0" : "keep H0"}`,
      steps,
    };
  } catch (e) {
    return { title: "Hypothesis Test", steps: [], error: (e as Error).message };
  }
}

/** Regularised incomplete beta I_x(a, b) — used for Student-t p-values. */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const bt = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Continued fraction for the incomplete beta (Lentz's method). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 500, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
