/**
 * Matrix engine: arithmetic, determinant (cofactor expansion with steps),
 * inverse (Gauss–Jordan with steps), rank, eigenvalues/eigenvectors.
 */
import { math, fmt, fmtExact, texNum, type Solution } from "./core";

export type Matrix = number[][];

export function matTex(M: Matrix, vars?: string[]): string {
  const body = M.map((r) => r.map((x) => (Number.isFinite(x) ? texNum(x) : "\\square")).join(" & ")).join(" \\\\ ");
  void vars;
  return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
}

export function isSquare(M: Matrix): boolean {
  return M.length > 0 && M.every((r) => r.length === M.length);
}

export function checkMatrices(A: Matrix, B: Matrix, op: string): string | null {
  if (op === "+" || op === "-") {
    if (A.length !== B.length || A[0].length !== B[0].length)
      return `For ${op === "+" ? "addition" : "subtraction"} both matrices must have the same dimensions (got ${A.length}×${A[0].length} and ${B.length}×${B[0].length}).`;
  }
  if (op === "*") {
    if (A[0].length !== B.length)
      return `For multiplication the number of columns of the first matrix (${A[0].length}) must equal the number of rows of the second (${B.length}).`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Basic operations with steps                                         */
/* ------------------------------------------------------------------ */

export function matrixOpSteps(
  A: Matrix, B: Matrix | null, op: string, scalar: number
): Solution {
  const steps: Solution["steps"] = [];
  try {
    const nameOf: Record<string, string> = {
      "+": "Matrix Addition", "-": "Matrix Subtraction", "*": "Matrix Multiplication",
      "scalar": "Scalar Multiplication", "transpose": "Transpose", "^": "Matrix Power",
      "det": "Determinant", "inv": "Inverse", "rank": "Rank", "trace": "Trace",
    };
    const aTex = matTex(A);
    if (op === "scalar") {
      steps.push({ title: "Scalar multiplication", explanation: `Every element of the matrix is multiplied by the scalar ${fmtExact(scalar)}.`, math: `${texNum(scalar)}\\,${aTex}` });
      const R = A.map((r) => r.map((x) => x * scalar));
      steps.push({ title: "Multiply each entry", math: matTex(R) });
      return { title: nameOf[op], resultTex: matTex(R), resultText: JSON.stringify(R), steps };
    }
    if (op === "transpose") {
      steps.push({ title: "Transpose", explanation: "Rows and columns are swapped: the element at position (i, j) moves to (j, i).", math: `A = ${aTex}` });
      const R = A[0].map((_, j) => A.map((r) => r[j]));
      steps.push({ title: "Swapped rows and columns", math: `A^T = ${matTex(R)}` });
      return { title: nameOf[op], resultTex: matTex(R), resultText: JSON.stringify(R), steps };
    }
    if (op === "^") {
      if (!isSquare(A)) throw new Error("Only square matrices can be raised to a power.");
      let R = A.map((r) => [...r]);
      const power = Math.round(scalar);
      if (power <= 0) throw new Error("The power must be a positive integer.");
      for (let k = 2; k <= power; k++) {
        R = matMul(R, A);
        steps.push({ title: `Multiply — power ${k}`, explanation: `A^${k} = A^${k - 1} · A. Each entry is the dot product of a row of the first matrix with a column of the second.`, math: `A^{${k}} = ${matTex(R)}` });
      }
      steps.unshift({ title: "Matrix power", explanation: `We compute A^${power} by repeated multiplication A · A · … · A.`, math: `A^{${power}}` });
      return { title: nameOf[op], resultTex: matTex(R), resultText: JSON.stringify(R), steps };
    }
    if (op === "trace") {
      if (!isSquare(A)) throw new Error("The trace is only defined for square matrices.");
      const tr = A.reduce((s, r, i) => s + r[i], 0);
      steps.push({ title: "Trace", explanation: "The trace is the sum of the diagonal elements.", math: `\\operatorname{tr}(A) = ${A.map((r, i) => texNum(r[i])).join(" + ")} = ${texNum(tr)}` });
      return { title: nameOf[op], resultTex: `\\operatorname{tr}(A) = ${texNum(tr)}`, resultText: String(tr), steps };
    }
    if (op === "rank") {
      const { rank, steps: rsteps } = rankSteps(A);
      return { title: "Rank", resultTex: `\\operatorname{rank}(A) = ${rank}`, resultText: String(rank), steps: rsteps };
    }
    if (op === "det") return determinantSteps(A);
    if (op === "inv") return inverseSteps(A);
    if (B === null) throw new Error("A second matrix is required for this operation.");

    const err = checkMatrices(A, B, op);
    if (err) throw new Error(err);

    if (op === "+" || op === "-") {
      const sign = op === "+" ? "+" : "-";
      steps.push({
        title: nameOf[op],
        explanation: `Matrices are ${op === "+" ? "added" : "subtracted"} element by element — only matrices with identical dimensions can be ${op === "+" ? "added" : "subtracted"}.`,
        math: `${matTex(A)} ${sign} ${matTex(B)}`,
      });
      const R = A.map((r, i) => r.map((x, j) => (op === "+" ? x + B[i][j] : x - B[i][j])));
      steps.push({ title: `${op === "+" ? "Add" : "Subtract"} corresponding entries`, math: matTex(R) });
      return { title: nameOf[op], resultTex: matTex(R), resultText: JSON.stringify(R), steps };
    }
    if (op === "*") {
      steps.push({
        title: "Matrix multiplication",
        explanation: `The entry (i, j) of the product is the dot product of row i of A with column j of B: (A·B)_ij = Σₖ A_ik · B_kj. The result has as many rows as A and as many columns as B (here ${A.length}×${B[0].length}).`,
        math: `${matTex(A)}\\cdot${matTex(B)}`,
      });
      const R = matMul(A, B);
      // show one worked entry in detail
      const i0 = 0, j0 = 0;
      const dotDetail = A[i0].map((x, k) => `${texNum(x)}\\cdot${texNum(B[k][j0])}`).join(" + ");
      steps.push({
        title: "Example entry — row 1 × column 1",
        explanation: "Every entry is computed the same way: multiply pairs and add the products.",
        math: `(A\\cdot B)_{1,1} = ${dotDetail} = ${texNum(R[i0][j0])}`,
      });
      steps.push({ title: "Complete product", math: matTex(R) });
      return { title: nameOf[op], resultTex: matTex(R), resultText: JSON.stringify(R), steps };
    }
    throw new Error(`Unknown operation "${op}".`);
  } catch (e) {
    return { title: "Matrix calculation", steps: [], error: (e as Error).message };
  }
}

export function matMul(A: Matrix, B: Matrix): Matrix {
  return A.map((row) => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
}

/* ------------------------------------------------------------------ */
/* Determinant — cofactor expansion with recursive steps               */
/* ------------------------------------------------------------------ */

export function determinantSteps(A: Matrix): Solution {
  const steps: Solution["steps"] = [];
  try {
    if (!isSquare(A)) throw new Error("The determinant only exists for square matrices (n × n).");
    const n = A.length;
    steps.push({ title: "Given matrix", math: `A = ${matTex(A)}` });
    if (n === 1) {
      return { title: "Determinant", resultTex: `\\det(A) = ${texNum(A[0][0])}`, resultText: String(A[0][0]), steps };
    }
    if (n === 2) {
      const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
      steps.push({
        title: "2×2 formula (Sarrus rule for n = 2)",
        explanation: "For a 2×2 matrix, multiply the main diagonal and subtract the product of the anti-diagonal.",
        math: `\\det(A) = (${texNum(A[0][0])})(${texNum(A[1][1])}) - (${texNum(A[0][1])})(${texNum(A[1][0])}) = ${texNum(A[0][0] * A[1][1])} - ${texNum(A[0][1] * A[1][0])} = ${texNum(det)}`,
      });
      return { title: "Determinant", resultTex: `\\det(A) = ${texNum(det)}`, resultText: String(det), steps };
    }
    steps.push({
      title: "Laplace (cofactor) expansion along the first row",
      explanation: "Each element a₁ⱼ of the first row is multiplied by its cofactor: (−1)^(1+j) · M₁ⱼ, where M₁ⱼ is the minor — the determinant of the matrix left after deleting row 1 and column j.",
      math: `\\det(A) = ${A[0].map((_, j) => `(${texNum(A[0][j])})\\,C_{1,${j + 1}}`).join(" + ")}`,
    });
    const subSteps: Solution["steps"] = [];
    let det = 0;
    for (let j = 0; j < n; j++) {
      if (Math.abs(A[0][j]) < 1e-15) continue;
      const minor = A.slice(1).map((r) => r.filter((_, c) => c !== j));
      const minorDet = rawDet(minor);
      const cofactor = Math.pow(-1, 1 + (j + 1)) * minorDet;
      det += A[0][j] * cofactor;
      subSteps.push({
        title: `Cofactor for entry a₁,${j + 1} = ${fmtExact(A[0][j])}`,
        explanation: `Delete row 1 and column ${j + 1} to get the minor, then apply the sign (−1)^{1+${j + 1}} = ${cofactor >= 0 ? "+" : "−"}1.`,
        math: `M_{1,${j + 1}} = \\det${matTex(minor)} = ${texNum(minorDet)}\\;\\Rightarrow\\; C_{1,${j + 1}} = (${A[0][j] >= 0 ? "" : "-"}${texNum(Math.abs(minorDet))})`,
      });
    }
    steps.push(...subSteps);
    steps.push({
      title: "Combine the cofactor products",
      math: `\\det(A) = ${A[0].map((x, j) => `(${fmtExact(x)})\\cdot(${fmtExact(Math.pow(-1, 2 + j) * rawDet(A.slice(1).map((r) => r.filter((_, c) => c !== j))))})`).join(" + ")} = ${texNum(det)}`,
    });
    return { title: "Determinant", resultTex: `\\det(A) = ${texNum(det)}`, resultText: String(det), steps };
  } catch (e) {
    return { title: "Determinant", steps: [], error: (e as Error).message };
  }
}

/** plain numeric determinant (no steps) */
export function rawDet(M: Matrix): number {
  if (M.length === 1) return M[0][0];
  if (M.length === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  // fraction-free Gaussian elimination for stability
  const n = M.length;
  const a = M.map((r) => [...r]);
  let det = 1;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[piv][i])) piv = r;
    if (Math.abs(a[piv][i]) < 1e-14) return 0;
    if (piv !== i) { [a[i], a[piv]] = [a[piv], a[i]]; det = -det; }
    det *= a[i][i];
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / a[i][i];
      for (let c = i; c < n; c++) a[r][c] -= f * a[i][c];
    }
  }
  return det;
}

/* ------------------------------------------------------------------ */
/* Inverse — Gauss–Jordan with steps                                   */
/* ------------------------------------------------------------------ */

export function inverseSteps(A: Matrix): Solution {
  const steps: Solution["steps"] = [];
  try {
    if (!isSquare(A)) throw new Error("Only square matrices can be inverted.");
    const n = A.length;
    const det = rawDet(A);
    steps.push({ title: "Given matrix", math: `A = ${matTex(A)}` });
    if (Math.abs(det) < 1e-12) {
      steps.push({
        title: "Check the determinant",
        explanation: "A matrix is invertible only when det(A) ≠ 0. Here the determinant is zero.",
        math: `\\det(A) = ${texNum(det)} = 0`,
      });
      return { title: "Matrix Inverse", steps, error: "The matrix is singular (det = 0), so it has no inverse." };
    }
    steps.push({
      title: "Check invertibility",
      explanation: "A matrix is invertible only when its determinant is non-zero.",
      math: `\\det(A) = ${texNum(det)} \\neq 0 \\;\\checkmark`,
    });
    if (n === 2) {
      const inv: Matrix = [
        [A[1][1] / det, -A[0][1] / det],
        [-A[1][0] / det, A[0][0] / det],
      ];
      steps.push({
        title: "2×2 inverse formula",
        explanation: "Swap the main diagonal elements, negate the anti-diagonal elements, and divide everything by the determinant.",
        math: `A^{-1} = \\frac{1}{${texNum(det)}}${matTex([[A[1][1], -A[0][1]], [-A[1][0], A[0][0]]])}`,
      });
      steps.push({ title: "Divide by the determinant", math: `A^{-1} = ${matTex(inv)}` });
      return { title: "Matrix Inverse", resultTex: `A^{-1} = ${matTex(inv)}`, resultText: JSON.stringify(inv), steps };
    }
    // Gauss-Jordan
    const aug: Matrix = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    steps.push({
      title: "Gauss–Jordan elimination",
      explanation: "Write the identity matrix next to A, then use row operations to turn the left half into the identity. The right half then becomes A⁻¹.",
      math: augTexWide(aug, n),
    });
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[piv][col])) piv = r;
      if (piv !== col) {
        [aug[col], aug[piv]] = [aug[piv], aug[col]];
        steps.push({ title: `Swap rows ${col + 1} ↔ ${piv + 1}`, math: augTexWide(aug, n) });
      }
      const p = aug[col][col];
      if (Math.abs(p) > 1e-14 && Math.abs(p - 1) > 1e-14) {
        for (let c = 0; c < 2 * n; c++) aug[col][c] /= p;
        steps.push({ title: `Scale row ${col + 1} by 1/${fmtExact(p)}`, explanation: "Make the pivot element equal to 1.", math: augTexWide(aug, n) });
      }
      for (let r = 0; r < n; r++) {
        if (r === col || Math.abs(aug[r][col]) < 1e-15) continue;
        const f = aug[r][col];
        for (let c = 0; c < 2 * n; c++) aug[r][c] -= f * aug[col][c];
        steps.push({
          title: `Eliminate column ${col + 1} from row ${r + 1}`,
          explanation: `Row ${r + 1} ← Row ${r + 1} − ${fmtExact(f)} · Row ${col + 1}`,
          math: augTexWide(aug, n),
        });
      }
    }
    const inv = aug.map((r) => r.slice(n));
    steps.push({ title: "The left half is the identity — the right half is A⁻¹", math: `A^{-1} = ${matTex(inv)}` });
    return { title: "Matrix Inverse", resultTex: `A^{-1} = ${matTex(inv)}`, resultText: JSON.stringify(inv), steps };
  } catch (e) {
    return { title: "Matrix Inverse", steps: [], error: (e as Error).message };
  }
}

function augTexWide(M: Matrix, n: number): string {
  return `\\left(\\begin{array}{${"c".repeat(n)}|${"c".repeat(n)}} ${M.map((r) => r.map((x) => texNum(Number(x.toPrecision(6)))).join(" & ")).join(" \\\\ ")} \\end{array}\\right)`;
}

/* ------------------------------------------------------------------ */
/* Rank — row echelon form                                             */
/* ------------------------------------------------------------------ */

export function rankSteps(A: Matrix): { rank: number; steps: Solution["steps"] } {
  const steps: Solution["steps"] = [];
  const m = A.length, n = A[0].length;
  const R = A.map((r) => [...r]);
  steps.push({
    title: "Rank via row echelon form",
    explanation: "The rank is the number of non-zero rows that remain after Gaussian elimination — it equals the number of linearly independent rows (and columns).",
    math: `A = ${matTex(A)}`,
  });
  let rank = 0;
  let row = 0;
  for (let col = 0; col < n && row < m; col++) {
    let piv = row;
    for (let r = row + 1; r < m; r++) if (Math.abs(R[r][col]) > Math.abs(R[piv][col])) piv = r;
    if (Math.abs(R[piv][col]) < 1e-10) continue;
    [R[row], R[piv]] = [R[piv], R[row]];
    for (let r = row + 1; r < m; r++) {
      if (Math.abs(R[r][col]) < 1e-15) continue;
      const f = R[r][col] / R[row][col];
      for (let c = col; c < n; c++) R[r][c] -= f * R[row][c];
    }
    row++;
    rank++;
  }
  steps.push({ title: `Row echelon form — ${rank} non-zero row${rank === 1 ? "" : "s"}`, math: matTex(R.map((r) => r.map((x) => (Math.abs(x) < 1e-10 ? 0 : Number(x.toPrecision(6)))))) });
  return { rank, steps };
}

/* ------------------------------------------------------------------ */
/* Eigenvalues & eigenvectors                                          */
/* ------------------------------------------------------------------ */

export interface EigenResult extends Solution {
  eigen: { value: number; tex: string; vector: number[]; vectorTex: string; mult: number }[];
  complex: { re: number; im: number }[];
}

export function eigenSteps(A: Matrix): EigenResult {
  const steps: Solution["steps"] = [];
  try {
    if (!isSquare(A)) throw new Error("Eigenvalues are only defined for square matrices.");
    const n = A.length;
    steps.push({ title: "Given matrix", math: `A = ${matTex(A)}` });
    steps.push({
      title: "The eigenvalue equation",
      explanation: "A number λ is an eigenvalue of A if there is a non-zero vector v (the eigenvector) with A·v = λ·v. Equivalently, det(A − λI) = 0 — the characteristic polynomial.",
      math: `\\det(A - \\lambda I) = 0`,
    });

    let charTex: string | null = null;
    let eigenPairs: { value: number; mult: number }[] = [];

    if (n === 2) {
      const [a, b] = A[0], [c, d] = A[1];
      const tr = a + d, det = a * d - b * c;
      charTex = `\\lambda^2 ${tr >= 0 ? "-" : "+"} ${texNum(Math.abs(tr))}\\lambda ${det >= 0 ? "+" : "-"} ${texNum(Math.abs(det))}`;
      steps.push({
        title: "Characteristic polynomial for 2×2",
        explanation: "For a 2×2 matrix it equals λ² − (trace)·λ + determinant.",
        math: `\\lambda^2 - \\operatorname{tr}(A)\\,\\lambda + \\det(A) = ${charTex} = 0`,
      });
      const disc = tr * tr - 4 * det;
      if (disc >= -1e-12) {
        const sq = Math.sqrt(Math.max(0, disc));
        const l1 = (tr + sq) / 2, l2 = (tr - sq) / 2;
        steps.push({
          title: "Solve the quadratic for λ",
          math: `\\lambda = \\frac{${texNum(tr)} \\pm \\sqrt{${texNum(disc)}}}{2} \\;\\Rightarrow\\; \\lambda_1 = ${texNum(l1)},\\; \\lambda_2 = ${texNum(l2)}`,
        });
        eigenPairs = Math.abs(l1 - l2) < 1e-9 ? [{ value: l1, mult: 2 }] : [{ value: l1, mult: 1 }, { value: l2, mult: 1 }];
      } else {
        const re = tr / 2, im = Math.sqrt(-disc) / 2;
        steps.push({
          title: "Negative discriminant — complex eigenvalues",
          math: `\\lambda_{1,2} = ${texNum(re)} \\pm ${texNum(Math.abs(im))}\\,i`,
        });
        return {
          title: "Eigenvalues & Eigenvectors",
          steps,
          eigen: [],
          complex: [{ re, im }, { re, im: -im }],
          resultTex: `\\lambda_{1,2} = ${texNum(re)} \\pm ${texNum(Math.abs(im))}\\,i`,
          resultText: `${fmt(re)} ± ${fmt(Math.abs(im))}i`,
          notes: ["The eigenvalues are complex, so there are no real eigenvectors."],
        };
      }
    } else {
      // numeric eigenvalues via mathjs
      const eigs = math.eigs(A) as unknown as { values: unknown; vectors?: unknown };
      const values = (eigs.values as unknown[]).map((v) => {
        if (typeof v === "number") return v;
        const c = v as { re: number; im: number };
        return c.im === 0 || Math.abs(c.im) < 1e-10 ? c.re : NaN;
      });
      const allComplex = (eigs.values as unknown[]).map((v) => {
        if (typeof v === "number") return { re: v, im: 0 };
        const c = v as { re: number; im: number };
        return { re: c.re, im: c.im };
      });
      const reals = values.filter((v) => Number.isFinite(v));
      // group by multiplicity
      const seen: { value: number; mult: number }[] = [];
      reals.forEach((v) => {
        const g = seen.find((s) => Math.abs(s.value - v) < 1e-8 * Math.max(1, Math.abs(v)));
        if (g) g.mult++;
        else seen.push({ value: v, mult: 1 });
      });
      eigenPairs = seen;
      steps.push({
        title: "Solve the characteristic equation",
        explanation: "For larger matrices the characteristic polynomial is solved numerically (QR algorithm).",
        math: eigenPairs.map((p, i) => `\\lambda_{${i + 1}} = ${texNum(p.value)}${p.mult > 1 ? `\\;(${p.mult}\\times)` : ""}`).join(",\\quad "),
      });
      const complexes = allComplex.filter((c) => Math.abs(c.im) > 1e-10);
      if (complexes.length) {
        steps.push({
          title: "Complex eigenvalue pairs",
          math: complexes.map((c) => `${texNum(c.re)} \\pm ${texNum(Math.abs(c.im))}i`).join(",\\quad "),
        });
      }
    }

    // eigenvectors: solve (A - λI) v = 0 via nullspace
    const eigen: EigenResult["eigen"] = [];
    for (const p of eigenPairs) {
      const M = A.map((r, i) => r.map((x, j) => x - (i === j ? p.value : 0)));
      const v = nullspaceVector(M);
      if (v) {
        const vTex = `\\begin{pmatrix} ${v.map((x) => texNum(Number(x.toPrecision(5)))).join(" \\\\ ")} \\end{pmatrix}`;
        eigen.push({ value: p.value, tex: texNum(p.value), vector: v, vectorTex: vTex, mult: p.mult });
        steps.push({
          title: `Eigenvector for λ = ${fmt(p.value)}`,
          explanation: "Solve (A − λI)·v = 0 by Gaussian elimination; any non-zero multiple of this vector is also an eigenvector.",
          math: `\\left(A - ${texNum(p.value)}\\,I\\right)v = 0 \\;\\Rightarrow\\; v = ${vTex}`,
        });
      }
    }
    const resultTexPart = eigen.map((e) => `\\lambda = ${e.tex}: v = ${e.vectorTex}`).join(",\\;\\; ");
    return {
      title: "Eigenvalues & Eigenvectors",
      steps,
      eigen,
      complex: [],
      resultTex: resultTexPart || "\\text{No real eigenpairs}",
      resultText: eigen.map((e) => `λ=${fmt(e.value)} v=[${e.vector.map((x) => fmt(x, 4)).join(", ")}]`).join("; "),
    };
  } catch (e) {
    return { title: "Eigenvalues & Eigenvectors", steps: [], eigen: [], complex: [], error: (e as Error).message };
  }
}

/** Find a nullspace vector of M (M must be near-singular). */
function nullspaceVector(Min: Matrix): number[] | null {
  const m = Min.length, n = Min[0].length;
  const M = Min.map((r) => [...r]);
  const pivCols: number[] = [];
  let row = 0;
  for (let col = 0; col < n && row < m; col++) {
    let piv = row;
    for (let r = row + 1; r < m; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) continue;
    [M[row], M[piv]] = [M[piv], M[row]];
    for (let r = 0; r < m; r++) {
      if (r === row) continue;
      const f = M[r][col] / M[row][col];
      for (let c = col; c < n; c++) M[r][c] -= f * M[row][c];
    }
    pivCols.push(col);
    row++;
  }
  const free = [...Array(n).keys()].filter((c) => !pivCols.includes(c));
  if (free.length === 0) return null;
  const v = new Array(n).fill(0);
  v[free[0]] = 1;
  for (let i = 0; i < pivCols.length; i++) {
    const pc = pivCols[i];
    v[pc] = -M[i][free[0]] / M[i][pc];
  }
  // normalise
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 1e-12 ? v.map((x) => x / norm) : v;
}
