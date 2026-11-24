"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MathText } from "@/components/math/MathText";
import { Plot3D } from "@/components/math/Plot3D";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Brain, TrendingUp, Target, Zap, Network, Gamepad2,
  Play, Pause, RotateCcw, Copy, Check, Sparkles, Sliders,
  Layers, Code2, BookOpen, Activity, ArrowRight, Compass,
  Trophy, RefreshCw, Crosshair, FastForward, PlayCircle, Gauge,
  ChevronLeft, ChevronRight, HelpCircle, Eye, CheckCircle2,
  Cpu, ArrowUpRight, BarChart3, Atom, Trash2, Plus, MousePointer2
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Mathematical Solvers for Dynamic Real-Time Canvas Data             */
/* ------------------------------------------------------------------ */

interface Point2D {
  id: string;
  x: number;
  y: number;
  label: number; // 0 or 1
}

// Gaussian elimination for polynomial regression and ridge normal equations
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;
    if (Math.abs(M[i][i]) < 1e-12) continue;
    for (let k = i + 1; k < n; k++) {
      const c = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= c * M[i][j];
      }
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
  }
  return x;
}

// Fit polynomial of degree d onto arbitrary 2D points
function fitPolynomial(points: Point2D[], degree: number, l2Penalty: number = 0): number[] {
  if (points.length === 0) return [0];
  const d = Math.min(degree, Math.max(1, points.length - 1));
  const A: number[][] = Array.from({ length: d + 1 }, () => new Array(d + 1).fill(0));
  const b: number[] = new Array(d + 1).fill(0);

  for (let i = 0; i <= d; i++) {
    for (let j = 0; j <= d; j++) {
      let sum = 0;
      for (const p of points) {
        sum += Math.pow(p.x, i + j);
      }
      A[i][j] = sum;
    }
    // Add Ridge L2 regularizer to diagonal (excluding bias i=0)
    if (i > 0) A[i][i] += l2Penalty;

    let sumB = 0;
    for (const p of points) {
      sumB += p.y * Math.pow(p.x, i);
    }
    b[i] = sumB;
  }
  return solveLinearSystem(A, b);
}

// Evaluate polynomial at scalar x
function evalPolynomial(coeffs: number[], x: number): number {
  let val = 0;
  for (let i = 0; i < coeffs.length; i++) {
    val += coeffs[i] * Math.pow(x, i);
  }
  return val;
}

// Train Logistic Regression dynamically on user points
function fitLogisticRegression(points: Point2D[], epochs: number = 60, lr: number = 0.15): { w1: number; w2: number; b: number } {
  let w1 = 0.2, w2 = 0.2, b = 0.0;
  if (points.length === 0) return { w1, w2, b };
  const m = points.length;

  for (let ep = 0; ep < epochs; ep++) {
    let dw1 = 0, dw2 = 0, db = 0;
    for (const p of points) {
      const z = w1 * p.x + w2 * p.y + b;
      const pred = 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, z))));
      const err = pred - p.label;
      dw1 += err * p.x;
      dw2 += err * p.y;
      db += err;
    }
    w1 -= (lr / m) * dw1;
    w2 -= (lr / m) * dw2;
    b -= (lr / m) * db;
  }
  return { w1, w2, b };
}

// Linear SVM via subgradient descent on user points
function fitLinearSVM(points: Point2D[], C: number = 1.0, epochs: number = 80, lr: number = 0.02): { w1: number; w2: number; b: number } {
  let w1 = 0.1, w2 = 0.1, b = 0.0;
  if (points.length === 0) return { w1, w2, b };
  const m = points.length;

  for (let ep = 0; ep < epochs; ep++) {
    for (const p of points) {
      const ySigned = p.label === 1 ? 1 : -1;
      const margin = ySigned * (w1 * p.x + w2 * p.y + b);
      if (margin < 1.0) {
        w1 -= lr * (w1 / m - C * ySigned * p.x);
        w2 -= lr * (w2 / m - C * ySigned * p.y);
        b -= lr * (-C * ySigned);
      } else {
        w1 -= lr * (w1 / m);
        w2 -= lr * (w2 / m);
      }
    }
  }
  return { w1, w2, b };
}

// Find optimal 1D axis split minimizing Gini impurity
function findBestSplit(points: Point2D[]): { axis: "x" | "y"; threshold: number; giniGain: number } {
  if (points.length < 2) return { axis: "x", threshold: 0, giniGain: 0 };
  let bestGain = -1;
  let bestAxis: "x" | "y" = "x";
  let bestThresh = 0;

  const totalPoints = points.length;
  const p1Total = points.filter((p) => p.label === 1).length / totalPoints;
  const parentGini = 1 - (p1Total ** 2 + (1 - p1Total) ** 2);

  for (const axis of ["x", "y"] as const) {
    const sorted = [...points].sort((a, b) => a[axis] - b[axis]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const t = (sorted[i][axis] + sorted[i + 1][axis]) / 2;
      const left = sorted.filter((p) => p[axis] <= t);
      const right = sorted.filter((p) => p[axis] > t);
      if (left.length === 0 || right.length === 0) continue;

      const p1L = left.filter((p) => p.label === 1).length / left.length;
      const giniL = 1 - (p1L ** 2 + (1 - p1L) ** 2);
      const p1R = right.filter((p) => p.label === 1).length / right.length;
      const giniR = 1 - (p1R ** 2 + (1 - p1R) ** 2);

      const splitGini = (left.length / totalPoints) * giniL + (right.length / totalPoints) * giniR;
      const gain = parentGini - splitGini;
      if (gain > bestGain) {
        bestGain = gain;
        bestAxis = axis;
        bestThresh = t;
      }
    }
  }
  return { axis: bestAxis, threshold: bestThresh, giniGain: Math.max(0, bestGain) };
}

// 2D Eigendecomposition for PCA on user points
function compute2DPCA(points: Point2D[]): { meanX: number; meanY: number; v1: [number, number]; v2: [number, number]; varRatio: number } {
  if (points.length < 2) {
    return { meanX: 0, meanY: 0, v1: [1, 0], v2: [0, 1], varRatio: 1.0 };
  }
  let sumX = 0, sumY = 0;
  for (const p of points) { sumX += p.x; sumY += p.y; }
  const meanX = sumX / points.length;
  const meanY = sumY / points.length;

  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const m = points.length - 1 || 1;
  const a = sxx / m;
  const c = syy / m;
  const b = sxy / m;

  // Analytical 2x2 eigenvalues
  const T = a + c;
  const D = a * c - b * b;
  const discr = Math.sqrt(Math.max(0, (T * T) / 4 - D));
  const lambda1 = T / 2 + discr;
  const lambda2 = Math.max(0, T / 2 - discr);

  // Eigenvector v1
  let vx = lambda1 - c;
  let vy = b;
  if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
    vx = 1; vy = 0;
  }
  const mag = Math.hypot(vx, vy) || 1;
  const v1: [number, number] = [vx / mag, vy / mag];
  const v2: [number, number] = [-v1[1], v1[0]];
  const varRatio = (lambda1 + lambda2) > 0 ? lambda1 / (lambda1 + lambda2) : 1.0;

  return { meanX, meanY, v1, v2, varRatio };
}

/* ------------------------------------------------------------------ */
/* Model Definitions & Structured Metadata                            */
/* ------------------------------------------------------------------ */

export type MLParadigm = "regression" | "classification" | "optimization" | "unsupervised" | "reinforcement";

export interface PipelineStage {
  step: number;
  phase: string;
  badge: string;
  mathExpression: string;
  insight: string;
}

export interface MLTopic {
  id: string;
  name: string;
  paradigm: MLParadigm;
  badge: string;
  summary: string;
  lossSurface3d?: string;
  lossSurfaceName?: string;
  pipelineStages: PipelineStage[];
  math: {
    objective: string;
    objectiveExpl: string;
    gradient?: string;
    gradientExpl?: string;
    closedForm?: string;
    closedFormExpl?: string;
    keyPoints: string[];
  };
  pythonCode: string;
}

export const ML_TOPICS: MLTopic[] = [
  /* ================= REGRESSION ================= */
  {
    id: "linear-regression",
    name: "Linear Regression (OLS)",
    paradigm: "regression",
    badge: "Closed-Form & Iterative",
    summary: "Minimizes vertical residual variance via projection onto feature subspace.",
    lossSurface3d: "(x - 1)^2 + 2*(y - 1)^2",
    lossSurfaceName: "Quadratic MSE Convex Basin",
    pipelineStages: [
      { step: 1, phase: "Data Projection", badge: "Forward Pass", mathExpression: "\\hat{y} = w x + b", insight: "Evaluates current linear predictor on all coordinates." },
      { step: 2, phase: "Residual Energy", badge: "Loss Measure", mathExpression: "e_i = y_i - \\hat{y}_i, \\quad J = \\frac{1}{2m} \\sum e_i^2", insight: "Calculates individual residuals and cumulative MSE penalty." },
      { step: 3, phase: "Gradient Vector", badge: "Subspace Calculus", mathExpression: "\\nabla J = \\frac{1}{m} X^T (Xw - y)", insight: "Determines steepest error ascent vector in parameter space." },
      { step: 4, phase: "Weight Update", badge: "Descent Step", mathExpression: "w \\leftarrow w - \\alpha \\nabla_w J", insight: "Pivots slope and translates bias closer to optimal least-squares." },
      { step: 5, phase: "Normal Equilibrium", badge: "Closed Form", mathExpression: "w^* = (X^T X)^{-1} X^T y", insight: "Analytical Moore-Penrose pseudoinverse global minimum." },
    ],
    math: {
      objective: "J(w, b) = \\frac{1}{2m} \\sum_{i=1}^{m} \\left( w x^{(i)} + b - y^{(i)} \\right)^2 = \\frac{1}{2m} \\|Xw - y\\|^2",
      objectiveExpl: "Mean Squared Error (MSE) measures the average squared Euclidean distance of residuals.",
      gradient: "\\nabla_w J = \\frac{1}{m} X^T (Xw - y), \\quad \\frac{\\partial J}{\\partial b} = \\frac{1}{m} \\sum_{i=1}^m (\\hat{y}^{(i)} - y^{(i)})",
      gradientExpl: "Gradient points in the direction of steepest loss ascent; gradient descent steps in the negative direction.",
      closedForm: "w^* = (X^T X)^{-1} X^T y",
      closedFormExpl: "The Normal Equation derives the exact global minimum in one analytical matrix operation via Moore-Penrose pseudoinverse.",
      keyPoints: [
        "Convex quadratic loss bowl guarantees a single unique global minimum.",
        "Closed-form OLS complexity is O(d^3); gradient descent is preferred when feature dimension d > 10,000.",
        "Assumes homoscedasticity, normality of residuals, and no severe multicollinearity."
      ]
    },
    pythonCode: `import numpy as np

class LinearRegressionOLS:
    def __init__(self, fit_intercept: bool = True):
        self.fit_intercept = fit_intercept
        self.weights = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        if self.fit_intercept:
            X = np.hstack([np.ones((X.shape[0], 1)), X])
        # Closed-form Normal Equation: w* = (X^T X)^(-1) X^T y
        self.weights = np.linalg.pinv(X.T @ X) @ X.T @ y
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.fit_intercept:
            X = np.hstack([np.ones((X.shape[0], 1)), X])
        return X @ self.weights`
  },
  {
    id: "polynomial-regression",
    name: "Polynomial & Overfitting",
    paradigm: "regression",
    badge: "Nonlinear Hilbert Basis",
    summary: "Maps features into higher-order Vandermonde spaces, revealing the bias-variance trade-off.",
    lossSurface3d: "(x^2 + y - 11)^2 / 30 + (x + y^2 - 7)^2 / 30",
    lossSurfaceName: "Himmelblau Multimodal Landscape",
    pipelineStages: [
      { step: 1, phase: "Linear Basis", badge: "Degree 1", mathExpression: "\\hat{y} = w_0 + w_1 x", insight: "High bias (underfitting): cannot capture non-linear curvature." },
      { step: 2, phase: "Quadratic / Cubic", badge: "Degree 2-3", mathExpression: "\\phi(x) = [1, x, x^2, x^3]", insight: "Low bias, low variance: captures natural physical contours." },
      { step: 3, phase: "High Order Powers", badge: "Degree 4-5", mathExpression: "\\hat{y} = \\sum_{j=0}^d w_j x^j", insight: "Flexible boundary begins matching individual sample noise." },
      { step: 4, phase: "Runge Oscillations", badge: "Degree ≥ 6", mathExpression: "\\text{Var}(\\hat{f}) \\to \\infty \\quad (|x| \\to x_{\\max})", insight: "Catastrophic boundary oscillations; overfitting noise." },
    ],
    math: {
      objective: "\\hat{y} = w_0 + w_1 x + w_2 x^2 + w_3 x^3 + \\dots + w_d x^d = \\sum_{j=0}^{d} w_j \\phi_j(x)",
      objectiveExpl: "Feature mapping function phi maps scalar x into a Vandermonde polynomial design matrix.",
      gradient: "\\nabla_w J = \\frac{1}{m} \\Phi(X)^T (\\Phi(X)w - y)",
      gradientExpl: "Optimized identically to linear regression in the transformed polynomial Hilbert space.",
      closedForm: "w^* = (\\Phi^T \\Phi)^{-1} \\Phi^T y",
      closedFormExpl: "Direct matrix solution over the Vandermonde design matrix Phi.",
      keyPoints: [
        "Low degree d=1 causes high bias (underfitting).",
        "High degree d>6 causes high variance (severe overfitting and Runge's phenomenon oscillations at boundary points).",
        "Regularization (L1/L2) is mandatory to penalize surging polynomial coefficients."
      ]
    },
    pythonCode: `import numpy as np

class PolynomialRegression:
    def __init__(self, degree: int = 3):
        self.degree = degree
        self.weights = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        Phi = np.hstack([X ** i for i in range(self.degree + 1)])
        self.weights = np.linalg.pinv(Phi.T @ Phi) @ Phi.T @ y
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        Phi = np.hstack([X ** i for i in range(self.degree + 1)])
        return Phi @ self.weights`
  },
  {
    id: "ridge-lasso",
    name: "Ridge (L2) & Lasso (L1)",
    paradigm: "regression",
    badge: "Constrained Optimization",
    summary: "Shrinks parameter magnitudes to stabilize multicollinearity and induce exact sparsity.",
    lossSurface3d: "x^2 + y^2 + 0.8*abs(x) + 0.8*abs(y)",
    lossSurfaceName: "Penalized L1/L2 Diamond Basin",
    pipelineStages: [
      { step: 1, phase: "Unconstrained OLS", badge: "λ = 0", mathExpression: "\\|w\\| \\gg 0", insight: "Weights fluctuate wildly to fit collinear noise points." },
      { step: 2, phase: "L2 Spherical Shrink", badge: "Ridge L2", mathExpression: "J_{\\text{Ridge}} = \\text{MSE} + \\frac{\\lambda}{2} \\|w\\|_2^2", insight: "Isotropic circle shrinks weights proportionally toward 0." },
      { step: 3, phase: "L1 Diamond Corners", badge: "Lasso L1", mathExpression: "J_{\\text{Lasso}} = \\text{MSE} + \\lambda \\|w\\|_1", insight: "Diamond vertices on axes force parameters to exactly 0.00." },
      { step: 4, phase: "Automated Sparsity", badge: "Feature Selection", mathExpression: "w_j = \\text{sign}(\\rho_j) \\max(0, |\\rho_j| - \\lambda)", insight: "Uninformative dimensions completely pruned from the model." },
    ],
    math: {
      objective: "J_{\\text{Ridge}}(w) = \\frac{1}{2m} \\|Xw - y\\|^2 + \\frac{\\lambda}{2} \\|w\\|_2^2, \\quad J_{\\text{Lasso}}(w) = \\frac{1}{2m} \\|Xw - y\\|^2 + \\lambda \\|w\\|_1",
      objectiveExpl: "Ridge adds quadratic L2 penalty; Lasso adds L1 absolute diamond penalty.",
      closedForm: "w_{\\text{Ridge}} = (X^T X + \\lambda I)^{-1} X^T y",
      closedFormExpl: "Ridge guarantees invertibility of (X^T X + lambda I) even when features are collinear (singular).",
      keyPoints: [
        "L1 diamond constraint creates sharp corners on axes, producing sparse solutions (feature selection).",
        "L2 circle constraint shrinks weights proportionally without zeroing them out.",
        "Hyperparameter lambda governs the bias-variance tradeoff."
      ]
    },
    pythonCode: `import numpy as np

def ridge_regression(X: np.ndarray, y: np.ndarray, alpha: float = 1.0) -> np.ndarray:
    d = X.shape[1]
    return np.linalg.inv(X.T @ X + alpha * np.eye(d)) @ X.T @ y

def lasso_coordinate_descent(X: np.ndarray, y: np.ndarray, alpha: float = 0.1, iters: int = 500) -> np.ndarray:
    n, d = X.shape
    w = np.zeros(d)
    for _ in range(iters):
        for j in range(d):
            X_j = X[:, j]
            resid = y - (X @ w) + w[j] * X_j
            rho = X_j.T @ resid
            if rho < -alpha: w[j] = (rho + alpha) / (X_j.T @ X_j)
            elif rho > alpha: w[j] = (rho - alpha) / (X_j.T @ X_j)
            else: w[j] = 0.0
    return w`
  },

  /* ================= CLASSIFICATION ================= */
  {
    id: "logistic-regression",
    name: "Logistic Regression",
    paradigm: "classification",
    badge: "Maximum Likelihood",
    summary: "Maps linear combinations into continuous posterior probabilities via the logistic sigmoid.",
    lossSurface3d: "-log(1 / (1 + exp(-x))) - log(1 - 1 / (1 + exp(-y)))",
    lossSurfaceName: "Cross-Entropy Convex Canyon",
    pipelineStages: [
      { step: 1, phase: "Linear Logit", badge: "Dot Product", mathExpression: "z = \\mathbf{w}^T \\mathbf{x} + b", insight: "Evaluates raw scalar classification score from -∞ to +∞." },
      { step: 2, phase: "Sigmoid Squash", badge: "Activation", mathExpression: "\\sigma(z) = \\frac{1}{1 + e^{-z}} \\in (0, 1)", insight: "Binds scores strictly into probability range P(Y=1|X)." },
      { step: 3, phase: "Cross-Entropy", badge: "Penalty", mathExpression: "J = -\\frac{1}{m}\\sum [y\\log(\\hat{y}) + (1-y)\\log(1-\\hat{y})]", insight: "Asymptotically infinite penalty for confident mispredictions." },
      { step: 4, phase: "Decision Boundary", badge: "Separation", mathExpression: "\\mathbf{w}^T \\mathbf{x} + b = 0 \\iff P = 0.50", insight: "Linear hyperplane isolating Amber vs Cyan probability regions." },
    ],
    math: {
      objective: "J(w, b) = -\\frac{1}{m} \\sum_{i=1}^m \\left[ y^{(i)} \\log(\\sigma(z^{(i)})) + (1 - y^{(i)}) \\log(1 - \\sigma(z^{(i)})) \\right]",
      objectiveExpl: "Binary Cross-Entropy (Log Loss) penalizes confident incorrect predictions with infinite loss.",
      gradient: "\\nabla_w J = \\frac{1}{m} X^T (\\sigma(Xw + b) - y)",
      gradientExpl: "Shares the exact algebraic gradient structure with linear regression, with sigma(z) replacing linear predictions.",
      closedForm: "\\sigma(z) = \\frac{1}{1 + e^{-z}} = \\frac{e^z}{1 + e^z}",
      closedFormExpl: "The sigmoid maps any real number from (-infinity, +infinity) to a valid probability in (0, 1).",
      keyPoints: [
        "Decision boundary is linear: w^T x + b = 0 where P(y=1|x) = 0.5.",
        "No closed-form solution exists; solved via Gradient Descent, Newton-Raphson, or L-BFGS.",
        "Generalizes to multiclass via Softmax (Categorical Cross-Entropy)."
      ]
    },
    pythonCode: `import numpy as np

class LogisticRegressionFromScratch:
    def __init__(self, lr: float = 0.1, epochs: int = 1000):
        self.lr, self.epochs = lr, epochs
        self.w, self.b = None, 0.0

    def fit(self, X: np.ndarray, y: np.ndarray):
        m, d = X.shape
        self.w = np.zeros(d)
        for _ in range(self.epochs):
            z = X @ self.w + self.b
            y_hat = 1.0 / (1.0 + np.exp(-np.clip(z, -200, 200)))
            self.w -= (self.lr / m) * (X.T @ (y_hat - y))
            self.b -= (self.lr / m) * np.sum(y_hat - y)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        prob = 1.0 / (1.0 + np.exp(-np.clip(X @ self.w + self.b, -200, 200)))
        return (prob >= 0.5).astype(int)`
  },
  {
    id: "svm",
    name: "Support Vector Machines",
    paradigm: "classification",
    badge: "Maximum Margin",
    summary: "Constructs the optimal geometric hyperplane supported solely by boundary data points.",
    lossSurface3d: "0.5*(x^2 + y^2) + max(0, 1 - x*y)",
    lossSurfaceName: "Hinge Loss Margin Valley",
    pipelineStages: [
      { step: 1, phase: "Margin Definition", badge: "Geometry", mathExpression: "\\text{Margin Width} = \\frac{2}{\\|\\mathbf{w}\\|}", insight: "Maximizing separation distance between supporting gutters." },
      { step: 2, phase: "Support Vectors", badge: "Critical Points", mathExpression: "y_i(\\mathbf{w}^T \\mathbf{x}_i + b) = 1", insight: "Pulsing neon rings lock onto the only points governing the boundary." },
      { step: 3, phase: "Hinge Loss Slack", badge: "Soft Margin (C)", mathExpression: "\\xi_i = \\max(0, 1 - y_i(\\mathbf{w}^T \\mathbf{x}_i + b))", insight: "Tolerates controlled misclassifications in non-separable data." },
      { step: 4, phase: "Hyperplane Lock", badge: "Convergence", mathExpression: "\\min \\frac{1}{2}\\|w\\|^2 + C\\sum\\xi_i", insight: "Optimal compromise between margin width and classification fidelity." },
    ],
    math: {
      objective: "\\min_{w, b, \\xi} \\frac{1}{2} \\|w\\|^2 + C \\sum_{i=1}^m \\xi_i \\quad \\text{s.t.} \\quad y^{(i)}(w^T x^{(i)} + b) \\ge 1 - \\xi_i, \\quad \\xi_i \\ge 0",
      objectiveExpl: "Balances margin maximization (1/||w||) with soft-margin hinge loss violations (xi_i).",
      gradient: "\\mathcal{L}_{\\text{dual}}(\\alpha) = \\sum_{i=1}^m \\alpha_i - \\frac{1}{2} \\sum_{i=1}^m \\sum_{j=1}^m \\alpha_i \\alpha_j y^{(i)} y^{(j)} K(x^{(i)}, x^{(j)})",
      gradientExpl: "Dual formulation expresses the hyperplane entirely via dot products, unlocking the Kernel Trick.",
      closedForm: "K_{\\text{RBF}}(x_i, x_j) = \\exp\\left(-\\gamma \\|x_i - x_j\\|^2\\right)",
      closedFormExpl: "The Radial Basis Function (RBF) kernel implicitly projects features into an infinite-dimensional Hilbert space.",
      keyPoints: [
        "Hyperplane depends ONLY on the support vectors that lie on or violate the margin.",
        "Hyperparameter C governs tolerance for margin violations (high C = hard margin, low C = soft margin).",
        "Convex quadratic programming guarantees global optimality."
      ]
    },
    pythonCode: `import numpy as np

class LinearSVM:
    def __init__(self, C: float = 1.0, lr: float = 0.001, epochs: int = 1000):
        self.C, self.lr, self.epochs = C, lr, epochs
        self.w, self.b = None, 0.0

    def fit(self, X: np.ndarray, y: np.ndarray):
        y_signed = np.where(y <= 0, -1, 1)
        m, d = X.shape
        self.w = np.zeros(d)
        for _ in range(self.epochs):
            for i in range(m):
                if y_signed[i] * (np.dot(X[i], self.w) + self.b) < 1:
                    self.w -= self.lr * (self.w / m - self.C * y_signed[i] * X[i])
                    self.b -= self.lr * (-self.C * y_signed[i])
                else:
                    self.w -= self.lr * (self.w / m)
        return self`
  },
  {
    id: "decision-tree",
    name: "Decision Trees (Gini)",
    paradigm: "classification",
    badge: "Orthogonal Partitioning",
    summary: "Greedily searches threshold splits to maximize information gain and purity.",
    lossSurface3d: "1 - (x^2 + y^2)",
    lossSurfaceName: "Gini Impurity Paraboloid",
    pipelineStages: [
      { step: 1, phase: "Impurity Metric", badge: "Gini Score", mathExpression: "I_G(S) = 1 - \\sum p_k^2", insight: "Measures statistical disorder; 0.00 represents complete purity." },
      { step: 2, phase: "Scanline Search", badge: "Split Finder", mathExpression: "\\Delta I_G = I_G(P) - [\\frac{N_L}{N}I_G(L) + \\frac{N_R}{N}I_G(R)]", insight: "Sweeps coordinate axes to locate the single cut that minimizes impurity." },
      { step: 3, phase: "Axis-Aligned Cut", badge: "Threshold", mathExpression: "x_j \\le \\theta^*", insight: "Slices feature space into distinct rectangular sub-domains." },
      { step: 4, phase: "Recursive Leaves", badge: "Subdivision", mathExpression: "\\hat{y} = \\text{Mode}(y_{\\text{leaf}})", insight: "Builds hierarchy until maximum depth or leaf purity is satisfied." },
    ],
    math: {
      objective: "I_G(p) = 1 - \\sum_{k=1}^K p_k^2, \\quad H(p) = -\\sum_{k=1}^K p_k \\log_2(p_k)",
      objectiveExpl: "Gini Impurity measures misclassification probability; Entropy measures informational disorder.",
      closedForm: "\\Delta I = I(D_{\\text{parent}}) - \\left( \\frac{|D_L|}{|D|} I(D_L) + \\frac{|D_R|}{|D|} I(D_R) \\right)",
      closedFormExpl: "Information Gain evaluates the reduction in impurity achieved by splitting on feature j at threshold t.",
      keyPoints: [
        "Non-parametric method that requires no feature normalization or scaling.",
        "Prone to high variance and overfitting; mitigated via pruning or Random Forest bagging ensembles.",
        "Creates orthogonal axis-aligned rectangular decision regions."
      ]
    },
    pythonCode: `import numpy as np

def gini(y):
    if len(y) == 0: return 0.0
    _, counts = np.unique(y, return_counts=True)
    return 1.0 - np.sum((counts / len(y)) ** 2)

def best_split(X, y):
    best_gain, best_f, best_t = -1, 0, 0
    p_gini = gini(y)
    m, d = X.shape
    for f in range(d):
        for t in np.unique(X[:, f]):
            mask = X[:, f] <= t
            yL, yR = y[mask], y[~mask]
            if len(yL) == 0 or len(yR) == 0: continue
            gain = p_gini - (len(yL)/m * gini(yL) + len(yR)/m * gini(yR))
            if gain > best_gain:
                best_gain, best_f, best_t = gain, f, t
    return best_f, best_t`
  },
  {
    id: "knn",
    name: "K-Nearest Neighbors",
    paradigm: "classification",
    badge: "Instance-Based Voting",
    summary: "Classifies query points dynamically by local Euclidean neighborhood vote.",
    lossSurface3d: "sqrt(x^2 + y^2)",
    lossSurfaceName: "Euclidean Metric Cone",
    pipelineStages: [
      { step: 1, phase: "Query Probe", badge: "Coordinates", mathExpression: "\\mathbf{x}_q = (x_p, y_p)", insight: "User-positioned target reticle anywhere on the continuous plane." },
      { step: 2, phase: "Metric Distance", badge: "L2 Norm", mathExpression: "d_2(\\mathbf{x}_q, \\mathbf{x}_i) = \\|\\mathbf{x}_q - \\mathbf{x}_i\\|_2", insight: "Computes exact Euclidean distance from probe to every data point." },
      { step: 3, phase: "Neighborhood Radar", badge: "K Selection", mathExpression: "N_K(\\mathbf{x}_q) = \\text{top } K \\text{ nearest}", insight: "Dynamic laser beams connect to the K closest instances." },
      { step: 4, phase: "Majority Vote", badge: "Output", mathExpression: "\\hat{y} = \\arg\\max_c \\sum_{i \\in N_K} \\mathbb{I}(y_i = c)", insight: "Tally decides predicted class label and confidence fraction." },
    ],
    math: {
      objective: "\\hat{y} = \\arg\\max_c \\sum_{i \\in N_K(x)} \\mathbb{I}(y^{(i)} = c)",
      objectiveExpl: "Assigns the class label with the highest vote among the K training points in neighborhood N_K(x).",
      closedForm: "d_2(x, z) = \\sqrt{\\sum_{j=1}^d (x_j - z_j)^2}, \\quad d_1(x, z) = \\sum_{j=1}^d |x_j - z_j|",
      closedFormExpl: "Calculates distance using Euclidean L2 norm or Manhattan L1 norm.",
      keyPoints: [
        "Zero training time (O(1)); prediction time scales with dataset size O(m * d).",
        "Sensitive to feature scales; feature standardization (z-score) is essential.",
        "Small K leads to noisy complex boundaries (overfitting); large K oversmoothes (underfitting)."
      ]
    },
    pythonCode: `import numpy as np

class KNN:
    def __init__(self, k: int = 3):
        self.k = k
        self.X, self.y = None, None

    def fit(self, X, y):
        self.X, self.y = X, y
        return self

    def predict_one(self, x_query):
        dists = np.linalg.norm(self.X - x_query, axis=1)
        k_nearest = self.y[np.argsort(dists)[:self.k]]
        vals, counts = np.unique(k_nearest, return_counts=True)
        return vals[np.argmax(counts)]`
  },

  /* ================= OPTIMIZATION ================= */
  {
    id: "batch-gradient-descent",
    name: "Batch Gradient Descent (BGD)",
    paradigm: "optimization",
    badge: "First-Order Deterministic",
    summary: "Computes the exact gradient of empirical risk over the entire dataset, taking monotonic descent steps down the error surface.",
    lossSurface3d: "0.5*x^2 + 2*y^2",
    lossSurfaceName: "Convex Elliptic Paraboloid (Condition Number κ = 4)",
    pipelineStages: [
      { step: 1, phase: "Total Dataset Loss", badge: "Global Sum", mathExpression: "J(w) = \\frac{1}{2m} \\sum_{i=1}^m (h_w(x^{(i)}) - y^{(i)})^2", insight: "Averages empirical risk across every sample in the dataset, producing zero variance." },
      { step: 2, phase: "Exact Gradient Vector", badge: "Subspace Calculus", mathExpression: "\\nabla J(w) = \\frac{1}{m} X^T (Xw - y)", insight: "Orthogonal to contour equipotential lines; points in the direction of steepest loss ascent." },
      { step: 3, phase: "Deterministic Step", badge: "Lipschitz α", mathExpression: "w^{(t+1)} = w^{(t)} - \\alpha \\nabla J(w^{(t)})", insight: "Guaranteed monotonic decrease in loss J(w^{(t+1)}) \\le J(w^{(t)}) when learning rate alpha < 2/L." },
      { step: 4, phase: "Stationary Convergence", badge: "Critical Point", mathExpression: "\\|\\nabla J(w^*)\\|_2 < \\epsilon \\implies \\nabla J(w^*) = 0", insight: "Stops exactly at the global minimum with zero asymptotic oscillations." },
    ],
    math: {
      objective: "J(w) = \\frac{1}{2m} \\|Xw - y\\|_2^2 = \\frac{1}{2m} \\sum_{i=1}^m \\left(w^T x^{(i)} - y^{(i)}\\right)^2",
      objectiveExpl: "Batch Mean Squared Error measures global discrepancy across all m training examples simultaneously.",
      gradient: "\\nabla_w J(w) = \\frac{1}{m} X^T (Xw - y) = \\frac{1}{m} \\sum_{i=1}^m \\left(w^T x^{(i)} - y^{(i)}\\right) x^{(i)}",
      gradientExpl: "The gradient vector aggregates sensitivity over every row in feature matrix X. Computing this requires O(m · d) FLOPs per step.",
      closedForm: "w^{(t+1)} = w^{(t)} - \\alpha \\nabla J(w^{(t)}), \\quad \\text{Monotonic convergence for } 0 < \\alpha < \\frac{2}{L}",
      closedFormExpl: "For L-Lipschitz smooth objectives, the parameter update contracts distances to the optimum w* when alpha < 2/L, where L = lambda_max(X^T X / m).",
      keyPoints: [
        "Deterministic: Every epoch follows an identical path; zero stochastic variance or wandering.",
        "Global Monotonicity: Guaranteed to decrease loss at every step given appropriately tuned learning rate alpha.",
        "Computational Bottleneck: Full O(m * d) dataset pass required per parameter update; prohibitive for massive datasets (m > 10^7).",
        "Vulnerable to Local Saddles: Can halt or slow down near saddle points or flat plateaus where ||grad J|| ≈ 0."
      ]
    },
    pythonCode: `import numpy as np

class BatchGradientDescent:
    """
    Exact Batch Gradient Descent (BGD) for Linear Regression.
    Computes the true gradient over the entire dataset X in O(m * d) time.
    """
    def __init__(self, lr=0.05, max_iter=1000, tol=1e-6):
        self.lr = lr
        self.max_iter = max_iter
        self.tol = tol
        self.weights = None
        self.bias = 0.0
        self.loss_history = []

    def fit(self, X: np.ndarray, y: np.ndarray):
        m, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0
        self.loss_history = []

        for step in range(self.max_iter):
            # 1. Forward Pass: Predictions & Residuals
            y_pred = np.dot(X, self.weights) + self.bias
            residuals = y_pred - y
            loss = (1.0 / (2.0 * m)) * np.sum(residuals ** 2)
            self.loss_history.append(loss)

            # 2. Exact Vectorized Gradient over entire batch
            grad_w = (1.0 / m) * np.dot(X.T, residuals)
            grad_b = (1.0 / m) * np.sum(residuals)

            # 3. Check First-Order Optimality (Stationary Point)
            grad_norm = np.sqrt(np.sum(grad_w ** 2) + grad_b ** 2)
            if grad_norm < self.tol:
                break

            # 4. Parameter Update Step
            self.weights -= self.lr * grad_w
            self.bias -= self.lr * grad_b

        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.dot(X, self.weights) + self.bias`
  },
  {
    id: "stochastic-gradient-descent",
    name: "Stochastic Gradient Descent (SGD)",
    paradigm: "optimization",
    badge: "Mini-Batch & Noise Exploration",
    summary: "Samples random subsets (or single instances) to compute noisy, unbiased gradient approximations, escaping saddle points and scaling to big data.",
    lossSurface3d: "x^2 - y^2 + 0.1*(x^4 + y^4)",
    lossSurfaceName: "Non-Convex Saddle Landscape (Twin Basins)",
    pipelineStages: [
      { step: 1, phase: "Mini-Batch Sampling", badge: "Sub-sample B << m", mathExpression: "\\mathcal{B}_t \\subset \\{1, \\dots, m\\}, \\quad |\\mathcal{B}_t| = B", insight: "Draws small random subsets of training data, reducing per-step compute from O(m) to O(B)." },
      { step: 2, phase: "Unbiased Gradient Estimate", badge: "E[g] = ∇J", mathExpression: "g_t(w) = \\frac{1}{B} \\sum_{i \\in \\mathcal{B}_t} \\nabla f_i(w), \\quad \\mathbb{E}[g_t] = \\nabla J(w)", insight: "Expectation matches true gradient, while stochastic noise Var(g) acts as implicit regularization." },
      { step: 3, phase: "Stochastic Step & Saddle Escape", badge: "Noisy Jitter", mathExpression: "w^{(t+1)} = w^{(t)} - \\alpha_t g_t(w^{(t)})", insight: "Fluctuations knock parameters out of shallow local minima and strict saddle points." },
      { step: 4, phase: "Robbins-Monro Annealing", badge: "Decay Schedule", mathExpression: "\\alpha_t = \\frac{\\alpha_0}{1 + \\lambda t}, \\quad \\sum \\alpha_t = \\infty, \\; \\sum \\alpha_t^2 < \\infty", insight: "Gradually diminishes step variance, causing parameters to settle into the true global optimum." },
    ],
    math: {
      objective: "J(w) = \\mathbb{E}_{(x, y) \\sim \\mathcal{D}}[\\ell(w; x, y)] \\approx \\frac{1}{m} \\sum_{i=1}^m \\ell_i(w)",
      objectiveExpl: "Approximates the full population risk by optimizing mini-batches of size B sampled independently from distribution D.",
      gradient: "g_t(w) = \\frac{1}{B} \\sum_{i \\in \\mathcal{B}_t} \\nabla \\ell_i(w), \\quad \\mathbb{E}[g_t(w) \\mid w] = \\nabla J(w), \\quad \\operatorname{Var}(g_t) = \\frac{\\sigma^2}{B}",
      gradientExpl: "The stochastic gradient is an unbiased estimator of true gradient. Variance is inversely proportional to batch size B.",
      closedForm: "w_{t+1} = w_t - \\alpha_t g_t, \\quad \\sum_{t=1}^\\infty \\alpha_t = \\infty, \\quad \\sum_{t=1}^\\infty \\alpha_t^2 < \\infty",
      closedFormExpl: "The Robbins-Monro convergence conditions guarantee almost sure convergence (w_t -> w*) even with continuous gradient noise.",
      keyPoints: [
        "O(1) Step Cost: Independent of total dataset size m; updates parameters immediately after inspecting small batches.",
        "Implicit Regularization: Gradient variance prevents overfitting to individual training examples.",
        "Saddle Point Escape: Stochastic noise perturbs trajectories along directions of negative curvature (escape saddles).",
        "Learning Rate Annealing: Requires learning rate decay (alpha_t -> 0) to avoid random walk wandering around the optimum."
      ]
    },
    pythonCode: `import numpy as np

class StochasticGradientDescent:
    """
    Mini-Batch / Stochastic Gradient Descent (SGD) with Learning Rate Decay.
    Samples random mini-batches of size B to provide fast, unbiased gradient updates.
    """
    def __init__(self, lr=0.1, batch_size=32, epochs=50, decay=0.001):
        self.lr0 = lr
        self.batch_size = batch_size
        self.epochs = epochs
        self.decay = decay
        self.weights = None
        self.bias = 0.0
        self.loss_history = []

    def fit(self, X: np.ndarray, y: np.ndarray):
        m, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0
        self.loss_history = []
        global_step = 0

        for epoch in range(self.epochs):
            # 1. Shuffle data at the beginning of each epoch
            indices = np.random.permutation(m)
            X_shuffled = X[indices]
            y_shuffled = y[indices]

            for i in range(0, m, self.batch_size):
                # 2. Extract mini-batch (B samples)
                X_batch = X_shuffled[i : i + self.batch_size]
                y_batch = y_shuffled[i : i + self.batch_size]
                B = X_batch.shape[0]

                # 3. Learning Rate Decay: Robbins-Monro schedule
                lr_t = self.lr0 / (1.0 + self.decay * global_step)

                # 4. Unbiased Stochastic Gradient Estimate
                y_pred = np.dot(X_batch, self.weights) + self.bias
                residuals = y_pred - y_batch
                grad_w = (1.0 / B) * np.dot(X_batch.T, residuals)
                grad_b = (1.0 / B) * np.sum(residuals)

                # 5. Stochastic Parameter Step
                self.weights -= lr_t * grad_w
                self.bias -= lr_t * grad_b
                global_step += 1

            # Track full-dataset loss after each epoch
            full_pred = np.dot(X, self.weights) + self.bias
            full_loss = (1.0 / (2.0 * m)) * np.sum((full_pred - y) ** 2)
            self.loss_history.append(full_loss)

        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.dot(X, self.weights) + self.bias`
  },
  {
    id: "adam-optimizer",
    name: "Adam, RMSProp & Momentum",
    paradigm: "optimization",
    badge: "Adaptive Deep Learning",
    summary: "Simulates simultaneous convergence on non-convex mathematical loss landscapes.",
    lossSurface3d: "log(1 + (1 - x)^2 + 10*(y - x^2)^2)/3",
    lossSurfaceName: "Rosenbrock Banana Ravine",
    pipelineStages: [
      { step: 1, phase: "Vanilla SGD", badge: "High Jitter", mathExpression: "\\Delta w = -\\alpha \\nabla J", insight: "Bounces uncontrollably back and forth across steep ravine walls." },
      { step: 2, phase: "Momentum", badge: "Velocity Memory", mathExpression: "v_t = \\beta_1 v_{t-1} + \\alpha g_t", insight: "Cancels perpendicular oscillations, building forward speed down the valley." },
      { step: 3, phase: "RMSProp", badge: "Scale Adaptation", mathExpression: "s_t = \\beta_2 s_{t-1} + (1-\\beta_2)g_t^2", insight: "Rescales step sizes inversely to coordinate gradient variance." },
      { step: 4, phase: "Adam Synthesis", badge: "Bias-Corrected", mathExpression: "w \\leftarrow w - \\frac{\\alpha}{\\sqrt{\\hat{v}_t} + \\epsilon}\\hat{m}_t", insight: "Reaches the global optimum (1, 1) in the fewest iterations." },
    ],
    math: {
      objective: "m_t = \\beta_1 m_{t-1} + (1 - \\beta_1) g_t, \\quad v_t = \\beta_2 v_{t-1} + (1 - \\beta_2) g_t^2",
      objectiveExpl: "Maintains exponential moving averages of gradients (m_t) and squared gradients (v_t).",
      gradient: "\\hat{m}_t = \\frac{m_t}{1 - \\beta_1^t}, \\quad \\hat{v}_t = \\frac{v_t}{1 - \\beta_2^t}",
      gradientExpl: "Bias corrections prevent vanishing steps in early iterations when m_0 and v_0 are initialized to zero.",
      closedForm: "\\theta_{t+1} = \\theta_t - \\frac{\\alpha}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t",
      closedFormExpl: "The parameter update scales individual learning rates inversely to the curvature of each coordinate axis.",
      keyPoints: [
        "Standard hyperparameters: beta_1 = 0.9, beta_2 = 0.999, epsilon = 1e-8, alpha = 0.001.",
        "Invariant to diagonal rescaling of gradients.",
        "Overcomes saddle points and navigates ravines far faster than vanilla SGD."
      ]
    },
    pythonCode: `import numpy as np

class Adam:
    def __init__(self, lr=0.001, b1=0.9, b2=0.999, eps=1e-8):
        self.lr, self.b1, self.b2, self.eps = lr, b1, b2, eps
        self.m, self.v, self.t = 0, 0, 0

    def step(self, w, grad):
        self.t += 1
        self.m = self.b1 * self.m + (1 - self.b1) * grad
        self.v = self.b2 * self.v + (1 - self.b2) * (grad ** 2)
        m_hat = self.m / (1 - self.b1 ** self.t)
        v_hat = self.v / (1 - self.b2 ** self.t)
        return w - self.lr * m_hat / (np.sqrt(v_hat) + self.eps)`
  },

  /* ================= UNSUPERVISED ================= */
  {
    id: "kmeans",
    name: "K-Means Clustering",
    paradigm: "unsupervised",
    badge: "Lloyd's EM Algorithm",
    summary: "Partitions feature space into Voronoi cells by iteratively updating cluster centroids.",
    lossSurface3d: "sin(x)*cos(y)",
    lossSurfaceName: "Multimodal Periodic Potential",
    pipelineStages: [
      { step: 1, phase: "Initial Seeds", badge: "Centroids", mathExpression: "\\mu_1, \\dots, \\mu_K \\in \\mathbb{R}^2", insight: "Spawns K cluster anchor points across data space." },
      { step: 2, phase: "Assignment", badge: "Voronoi Partition", mathExpression: "c_i = \\arg\\min_k \\|\\mathbf{x}_i - \\mu_k\\|^2", insight: "Every point recolors to its nearest Euclidean centroid." },
      { step: 3, phase: "Center of Mass", badge: "Mean Update", mathExpression: "\\mu_k = \\frac{1}{|C_k|} \\sum_{i \\in C_k} \\mathbf{x}_i", insight: "Centroids glide smoothly to the mathematical center of their points." },
      { step: 4, phase: "Inertia Minima", badge: "Convergence", mathExpression: "J = \\sum \\|\\mathbf{x}_i - \\mu_{c_i}\\|^2 \\to \\min", insight: "Stable partition achieved when centroid movement ceases." },
    ],
    math: {
      objective: "J(\\mu) = \\sum_{i=1}^m \\sum_{k=1}^K r_{ik} \\|x^{(i)} - \\mu_k\\|^2, \\quad r_{ik} = \\begin{cases} 1 & \\text{if } k = \\arg\\min_j \\|x^{(i)} - \\mu_j\\|^2 \\\\ 0 & \\text{otherwise} \\end{cases}",
      objectiveExpl: "Inertia (Within-Cluster Sum of Squares) measures cluster compactness.",
      closedForm: "\\mu_k = \\frac{\\sum_{i=1}^m r_{ik} x^{(i)}}{\\sum_{i=1}^m r_{ik}}",
      closedFormExpl: "The centroid update sets mu_k to the mathematical mean of all data points assigned to cluster k.",
      keyPoints: [
        "Guaranteed to converge to a local minimum; sensitive to initial centroid placement.",
        "K-Means++ initialization spreads initial centroids to dramatically improve convergence.",
        "Assumes spherical isotropic clusters of comparable variance."
      ]
    },
    pythonCode: `import numpy as np

class KMeans:
    def __init__(self, k=3, max_iter=100):
        self.k, self.max_iter = k, max_iter
        self.centroids = None

    def fit(self, X):
        self.centroids = X[np.random.choice(len(X), self.k, replace=False)]
        for _ in range(self.max_iter):
            dists = np.linalg.norm(X[:, None] - self.centroids, axis=2)
            labels = np.argmin(dists, axis=1)
            new_c = np.array([X[labels == k].mean(axis=0) for k in range(self.k)])
            if np.allclose(self.centroids, new_c): break
            self.centroids = new_c
        return self`
  },
  {
    id: "pca",
    name: "Principal Component Analysis",
    paradigm: "unsupervised",
    badge: "Spectral Decomposition",
    summary: "Identifies orthogonal axes of maximal variance, enabling lossless compression.",
    lossSurface3d: "2*x^2 + 0.5*y^2",
    lossSurfaceName: "Ellipsoidal Variance Basin",
    pipelineStages: [
      { step: 1, phase: "Zero-Mean Centering", badge: "Shift", mathExpression: "\\tilde{\\mathbf{x}} = \\mathbf{x} - \\bar{\\mathbf{x}}", insight: "Aligns center of mass of user data cloud to origin (0, 0)." },
      { step: 2, phase: "Covariance Matrix", badge: "Cov(X, Y)", mathExpression: "\\Sigma = \\frac{1}{m} \\tilde{X}^T \\tilde{X}", insight: "Measures feature variances and mutual cross-correlations." },
      { step: 3, phase: "Eigenvectors", badge: "Eigendecomposition", mathExpression: "\\Sigma \\mathbf{v}_1 = \\lambda_1 \\mathbf{v}_1, \\quad \\mathbf{v}_1 \\perp \\mathbf{v}_2", insight: "Green axis (PC1) rotates to line up with maximum data spread." },
      { step: 4, phase: "Orthogonal Drop", badge: "2D → 1D", mathExpression: "z_i = \\tilde{\\mathbf{x}}_i^T \\mathbf{v}_1", insight: "Perpendicular lines project points onto PC1, preserving variance." },
    ],
    math: {
      objective: "\\max_{u_1} u_1^T \\Sigma u_1 \\quad \\text{s.t.} \\quad u_1^T u_1 = 1",
      objectiveExpl: "Finds the unit vector u_1 that maximizes projected data variance.",
      closedForm: "\\Sigma v_k = \\lambda_k v_k, \\quad \\Sigma = \\frac{1}{m} X_{\\text{centered}}^T X_{\\text{centered}}",
      closedFormExpl: "The principal directions v_k are the eigenvectors of the sample covariance matrix Sigma; eigenvalues lambda_k measure variance.",
      keyPoints: [
        "Uncorrelated orthogonal axes eliminate multicollinearity.",
        "Explained variance ratio = lambda_k / sum(lambda).",
        "Dual formulation solved via Singular Value Decomposition (SVD): X = U S V^T."
      ]
    },
    pythonCode: `import numpy as np

class PCA:
    def __init__(self, n_components=1):
        self.k = n_components
        self.components = None

    def fit(self, X):
        X_c = X - np.mean(X, axis=0)
        cov = np.cov(X_c, rowvar=False)
        vals, vecs = np.linalg.eigh(cov)
        self.components = vecs[:, np.argsort(vals)[::-1][:self.k]]
        return self`
  },

  /* ================= REINFORCEMENT LEARNING ================= */
  {
    id: "q-learning",
    name: "Tabular Q-Learning (RL)",
    paradigm: "reinforcement",
    badge: "Bellman Optimality",
    summary: "Autonomous agent explores a 5×5 gridworld, updating action-values via temporal difference error.",
    lossSurface3d: "(x^2 - 4)^2 / 8 + y^2 / 2",
    lossSurfaceName: "Double-Well Value Landscape",
    pipelineStages: [
      { step: 1, phase: "State Observation", badge: "Grid Coordinate", mathExpression: "s_t = (r, c) \\in \\{0, \\dots, 24\\}", insight: "Agent reads current location in maze with traps and goal." },
      { step: 2, phase: "Action Selection", badge: "ε-Greedy", mathExpression: "a = \\text{Random} \\text{ (prob } \\epsilon) \\text{ or } \\arg\\max Q", insight: "Balances exploratory discoveries with greedy exploitation." },
      { step: 3, phase: "Reward Feedback", badge: "Environment", mathExpression: "R \\in \\{+10, -10, -0.1\\}", insight: "+10 for Target 🎯, -10 for Lava 🔥, -0.1 step penalty." },
      { step: 4, phase: "Bellman TD Update", badge: "Value Convergence", mathExpression: "Q(s, a) \\leftarrow Q + \\alpha [R + \\gamma \\max Q' - Q]", insight: "Action values propagate backward, lighting up safe paths." },
    ],
    math: {
      objective: "Q(s, a) \\leftarrow Q(s, a) + \\alpha \\left[ R + \\gamma \\max_{a'} Q(s', a') - Q(s, a) \\right]",
      objectiveExpl: "The Temporal Difference (TD) error updates existing estimates toward the Bellman target (R + gamma * max Q).",
      closedForm: "Q^*(s, a) = \\mathbb{E} \\left[ R_{t+1} + \\gamma \\max_{a'} Q^*(S_{t+1}, a') \\mid S_t = s, A_t = a \\right]",
      closedFormExpl: "The Bellman Optimality Equation states that the value of taking action a in state s equals expected immediate reward plus discounted optimal future returns.",
      keyPoints: [
        "Off-policy: Learns the optimal policy while behaving according to an epsilon-greedy exploratory policy.",
        "Guaranteed convergence to Q* under infinite exploration and Robbins-Monro learning rate schedules.",
        "Deep Q-Networks (DQN) replace the lookup table with deep neural networks and experience replay."
      ]
    },
    pythonCode: `import numpy as np

class QLearningAgent:
    def __init__(self, states=25, actions=4, lr=0.2, gamma=0.95, eps=0.2):
        self.Q = np.zeros((states, actions))
        self.lr, self.gamma, self.eps = lr, gamma, eps

    def act(self, s):
        if np.random.rand() < self.eps: return np.random.choice(4)
        return np.argmax(self.Q[s])

    def update(self, s, a, r, s_next):
        td_target = r + self.gamma * np.max(self.Q[s_next])
        self.Q[s, a] += self.lr * (td_target - self.Q[s, a])`
  }
];

/* ------------------------------------------------------------------ */
/* Dynamic Interactive Visualizer with Real Mathematical Solving     */
/* ------------------------------------------------------------------ */

export function DynamicModelCanvas({
  topic,
  activePipelineStep,
  onStepChange,
}: {
  topic: MLTopic;
  activePipelineStep: number;
  onStepChange: (step: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dynamic User Points
  const [points, setPoints] = useState<Point2D[]>([
    { id: "1", x: -3.5, y: -2.1, label: 0 },
    { id: "2", x: -2.7, y: -1.3, label: 0 },
    { id: "3", x: -1.8, y: -0.5, label: 0 },
    { id: "4", x: -1.0, y: -0.1, label: 0 },
    { id: "5", x: -0.4, y: 0.7, label: 1 },
    { id: "6", x: 0.5, y: 1.1, label: 1 },
    { id: "7", x: 1.3, y: 1.9, label: 1 },
    { id: "8", x: 2.2, y: 2.3, label: 1 },
    { id: "9", x: 3.1, y: 3.2, label: 1 },
    { id: "10", x: 2.0, y: -1.4, label: 0 },
    { id: "11", x: -1.8, y: 1.7, label: 1 },
    { id: "12", x: 1.1, y: -0.8, label: 0 },
  ]);

  // Point placement tool: 0 (Soft Ivory #FAF6F3) or 1 (Neon Lime Green #CDF22B)
  const [activeLabel, setActiveLabel] = useState<0 | 1>(1);

  // Probe Reticle for KNN
  const [probe, setProbe] = useState({ x: 0.5, y: 0.8 });
  const isDraggingProbe = useRef(false);

  // Animation Cycle & Hyperparameters
  const [isParallelRunning, setIsParallelRunning] = useState(true);
  const [animTime, setAnimTime] = useState(0);
  const [degree, setDegree] = useState(3);
  const [l2Reg, setL2Reg] = useState(1.5);
  const [svmC, setSvmC] = useState(2.0);
  const [knnK, setKnnK] = useState(3);
  const [kmeansK, setKmeansK] = useState(3);

  // Telemetry HUD
  const [telemetry, setTelemetry] = useState({
    metricA: "0.000",
    nameA: "Loss",
    metricB: "N/A",
    nameB: "Params",
    status: "READY",
  });

  // Reset to Presets
  const applyPreset = (presetName: string) => {
    if (presetName === "linear") {
      setPoints([
        { id: "1", x: -3.5, y: -2.3, label: 0 },
        { id: "2", x: -2.5, y: -1.4, label: 0 },
        { id: "3", x: -1.5, y: -0.6, label: 0 },
        { id: "4", x: -0.5, y: 0.2, label: 0 },
        { id: "5", x: 0.5, y: 0.9, label: 1 },
        { id: "6", x: 1.5, y: 1.8, label: 1 },
        { id: "7", x: 2.5, y: 2.6, label: 1 },
        { id: "8", x: 3.5, y: 3.4, label: 1 },
      ]);
    } else if (presetName === "curved") {
      setPoints([
        { id: "1", x: -3.5, y: -2.5, label: 0 },
        { id: "2", x: -2.5, y: 1.8, label: 1 },
        { id: "3", x: -1.2, y: -1.6, label: 0 },
        { id: "4", x: 0.0, y: 0.4, label: 1 },
        { id: "5", x: 1.2, y: -1.5, label: 0 },
        { id: "6", x: 2.5, y: 2.0, label: 1 },
        { id: "7", x: 3.5, y: -2.2, label: 0 },
      ]);
    } else if (presetName === "clusters") {
      setPoints([
        { id: "1", x: -2.5, y: -2.0, label: 0 },
        { id: "2", x: -2.0, y: -1.5, label: 0 },
        { id: "3", x: -2.8, y: -1.2, label: 0 },
        { id: "4", x: 2.2, y: 1.8, label: 1 },
        { id: "5", x: 2.7, y: 1.2, label: 1 },
        { id: "6", x: 1.9, y: 2.4, label: 1 },
        { id: "7", x: -0.5, y: 2.0, label: 1 },
        { id: "8", x: 0.2, y: -2.2, label: 0 },
      ]);
    } else {
      setPoints([]);
    }
  };

  // Continuous animation cycle
  useEffect(() => {
    if (!isParallelRunning) return;
    const interval = setInterval(() => {
      setAnimTime((t) => t + 0.05);
    }, 40);
    return () => clearInterval(interval);
  }, [isParallelRunning]);

  // Click & Drag Canvas handling
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;

    if (topic.id === "knn") {
      const dist = Math.hypot(mathX - probe.x, mathY - probe.y);
      if (dist < 0.8) {
        isDraggingProbe.current = true;
        return;
      }
    }

    // Add point at click
    setPoints((prev) => [
      ...prev,
      { id: String(Date.now() + Math.random()), x: mathX, y: mathY, label: activeLabel },
    ]);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingProbe.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;
    setProbe({ x: mathX, y: mathY });
  };

  const handleCanvasMouseUp = () => {
    isDraggingProbe.current = false;
  };

  // ------------------------------------------------------------------
  // Main Mathematical Render Loop (Runs on REAL User Points)
  // ------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 600;
    const h = 420;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 10.5;

    // Tactical Chassis Background
    ctx.fillStyle = "#08090B";
    ctx.fillRect(0, 0, w, h);

    // Instrument Grid
    ctx.strokeStyle = "rgba(250, 246, 243, 0.05)";
    ctx.lineWidth = 1;
    for (let x = -5; x <= 5; x += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + x * scale, 0);
      ctx.lineTo(cx + x * scale, h);
      ctx.stroke();
    }
    for (let y = -5; y <= 5; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, cy - y * scale);
      ctx.lineTo(w, cy - y * scale);
      ctx.stroke();
    }

    // Origin Axes
    ctx.strokeStyle = "rgba(250, 246, 243, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // ----------------------------------------------------------------
    // 1. LINEAR REGRESSION (Exact OLS on User Points)
    // ----------------------------------------------------------------
    if (topic.id === "linear-regression") {
      const coeffs = fitPolynomial(points, 1);
      const intercept = coeffs[0] || 0;
      const slope = coeffs[1] || 0;

      // Animate gradient descent progression
      const wobble = isParallelRunning ? Math.sin(animTime * 2) * 0.08 : 0;
      const activeSlope = slope + wobble;

      // Draw Residuals (Neon Lime dashed bars from each user point)
      ctx.strokeStyle = "rgba(205, 242, 43, 0.4)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      let totalMse = 0;
      points.forEach((p) => {
        const predY = activeSlope * p.x + intercept;
        totalMse += (p.y - predY) ** 2;
        ctx.beginPath();
        ctx.moveTo(cx + p.x * scale, cy - p.y * scale);
        ctx.lineTo(cx + p.x * scale, cy - predY * scale);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      const mse = points.length ? totalMse / points.length : 0;

      // Draw Optimal Line (Neon Lime Green #CDF22B)
      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#CDF22B";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const x1 = -5, y1 = activeSlope * x1 + intercept;
      const x2 = 5, y2 = activeSlope * x2 + intercept;
      ctx.moveTo(cx + x1 * scale, cy - y1 * scale);
      ctx.lineTo(cx + x2 * scale, cy - y2 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      setTelemetry({
        metricA: mse.toFixed(4),
        nameA: "MSE Loss J(w)",
        metricB: `w: ${activeSlope.toFixed(3)}, b: ${intercept.toFixed(3)}`,
        nameB: "Fitted Normal Eq",
        status: points.length < 2 ? "ADD ≥2 POINTS" : "OPTIMAL LEAST-SQUARES",
      });

    // ----------------------------------------------------------------
    // 2. POLYNOMIAL REGRESSION (Exact Normal Equation Fit on User Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "polynomial-regression") {
      const coeffs = fitPolynomial(points, degree);
      const isOverfit = degree >= 5;

      ctx.strokeStyle = isOverfit ? "rgba(250, 246, 243, 0.55)" : "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = isOverfit ? "rgba(250, 246, 243, 0.3)" : "#CDF22B";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      let totalErr = 0;

      for (let px = 0; px <= w; px += 3) {
        const xVal = (px - cx) / scale;
        const yVal = evalPolynomial(coeffs, xVal);
        const py = cy - yVal * scale;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      points.forEach((p) => {
        totalErr += (p.y - evalPolynomial(coeffs, p.x)) ** 2;
      });
      const mse = points.length ? totalErr / points.length : 0;

      setTelemetry({
        metricA: mse.toFixed(4),
        nameA: "Train MSE",
        metricB: `Degree: ${degree} / ${points.length - 1} max`,
        nameB: "Polynomial Vandermonde",
        status: isOverfit ? "RUNGE OSCILLATION / OVERFIT" : "BALANCED FIT",
      });

    // ----------------------------------------------------------------
    // 3. RIDGE & LASSO (Shrinkage on User Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "ridge-lasso") {
      // Unconstrained OLS Line (Soft Ivory dashed)
      const olsCoeffs = fitPolynomial(points, 1, 0);
      ctx.strokeStyle = "rgba(250, 246, 243, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy - evalPolynomial(olsCoeffs, -5) * scale);
      ctx.lineTo(cx + 5 * scale, cy - evalPolynomial(olsCoeffs, 5) * scale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ridge Regularized Line (#CDF22B Neon Lime or #FAF6F3 Soft Ivory for zeroed)
      const ridgeCoeffs = fitPolynomial(points, 1, l2Reg * 5);
      const isLassoZero = l2Reg > 5.5;
      const displaySlope = isLassoZero ? 0 : ridgeCoeffs[1];

      ctx.strokeStyle = isLassoZero ? "#FAF6F3" : "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy - (displaySlope * -5 + ridgeCoeffs[0]) * scale);
      ctx.lineTo(cx + 5 * scale, cy - (displaySlope * 5 + ridgeCoeffs[0]) * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      setTelemetry({
        metricA: l2Reg.toFixed(2),
        nameA: "Penalty (λ)",
        metricB: `w: ${displaySlope.toFixed(3)} ${isLassoZero ? "(EXACT SPARSITY)" : ""}`,
        nameB: "Shrunk Weights",
        status: isLassoZero ? "L1 ZEROED OUT" : "L2 TIKHONOV SHRINKAGE",
      });

    // ----------------------------------------------------------------
    // 4. LOGISTIC REGRESSION (Live Dynamic Sigmoid Field on Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "logistic-regression") {
      const { w1, w2, b } = fitLogisticRegression(points);

      // Decision boundary where w1*x + w2*y + b = 0 => y = -(w1*x + b)/w2
      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#CDF22B";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      if (Math.abs(w2) > 1e-4) {
        const yAtMinus5 = -(w1 * -5 + b) / w2;
        const yAtPlus5 = -(w1 * 5 + b) / w2;
        ctx.moveTo(cx - 5 * scale, cy - yAtMinus5 * scale);
        ctx.lineTo(cx + 5 * scale, cy - yAtPlus5 * scale);
      } else {
        const xCut = -b / (w1 || 1e-4);
        ctx.moveTo(cx + xCut * scale, 0);
        ctx.lineTo(cx + xCut * scale, h);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Accuracy
      let correct = 0;
      points.forEach((p) => {
        const z = w1 * p.x + w2 * p.y + b;
        const pred = z >= 0 ? 1 : 0;
        if (pred === p.label) correct++;
      });
      const acc = points.length ? ((correct / points.length) * 100).toFixed(1) : "100";

      setTelemetry({
        metricA: `${acc}%`,
        nameA: "Classification Accuracy",
        metricB: `w: [${w1.toFixed(2)}, ${w2.toFixed(2)}], b: ${b.toFixed(2)}`,
        nameB: "Hyperplane Weights",
        status: "MAXIMUM LIKELIHOOD ACTIVE",
      });

    // ----------------------------------------------------------------
    // 5. SUPPORT VECTOR MACHINES (Live Hinge Subgradients on Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "svm") {
      const { w1, w2, b } = fitLinearSVM(points, svmC);
      const normW = Math.hypot(w1, w2) || 1;
      const marginPx = (1.0 / normW) * scale;

      // Hyperplane
      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#CDF22B";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      if (Math.abs(w2) > 1e-4) {
        ctx.moveTo(cx - 5 * scale, cy - (-(w1 * -5 + b) / w2) * scale);
        ctx.lineTo(cx + 5 * scale, cy - (-(w1 * 5 + b) / w2) * scale);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Margin Gutters (Neon Lime tint)
      ctx.strokeStyle = "rgba(205, 242, 43, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      if (Math.abs(w2) > 1e-4) {
        ctx.beginPath();
        ctx.moveTo(cx - 5 * scale, cy - (-(w1 * -5 + b) / w2) * scale - marginPx);
        ctx.lineTo(cx + 5 * scale, cy - (-(w1 * 5 + b) / w2) * scale - marginPx);
        ctx.moveTo(cx - 5 * scale, cy - (-(w1 * -5 + b) / w2) * scale + marginPx);
        ctx.lineTo(cx + 5 * scale, cy - (-(w1 * 5 + b) / w2) * scale + marginPx);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Highlight Real Support Vectors (points near/inside margin)
      let svCount = 0;
      points.forEach((p) => {
        const ySigned = p.label === 1 ? 1 : -1;
        const functionalMargin = ySigned * (w1 * p.x + w2 * p.y + b);
        if (functionalMargin <= 1.2) {
          svCount++;
          ctx.strokeStyle = "#CDF22B";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx + p.x * scale, cy - p.y * scale, 12 + Math.sin(animTime * 3) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      setTelemetry({
        metricA: (2 / normW).toFixed(2),
        nameA: "Margin Width (2/||w||)",
        metricB: `Support Vectors: ${svCount} / ${points.length}`,
        nameB: "Active SV Count",
        status: "MAXIMAL GEOMETRIC MARGIN",
      });

    // ----------------------------------------------------------------
    // 6. DECISION TREES (Real Gini Scanline on User Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "decision-tree") {
      const { axis, threshold, giniGain } = findBestSplit(points);

      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#CDF22B";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      if (axis === "x") {
        ctx.moveTo(cx + threshold * scale, 0);
        ctx.lineTo(cx + threshold * scale, h);
      } else {
        ctx.moveTo(0, cy - threshold * scale);
        ctx.lineTo(w, cy - threshold * scale);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      setTelemetry({
        metricA: giniGain.toFixed(4),
        nameA: "Information Gain (ΔGini)",
        metricB: `Split: ${axis.toUpperCase()} = ${threshold.toFixed(2)}`,
        nameB: "Optimal Decision Cut",
        status: "GREEDY CART PARTITION",
      });

    // ----------------------------------------------------------------
    // 7. K-NEAREST NEIGHBORS (Real Dynamic Euclidean Distance on Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "knn") {
      const probePx = cx + probe.x * scale;
      const probePy = cy - probe.y * scale;

      const sorted = [...points]
        .map((p) => ({ ...p, dist: Math.hypot(p.x - probe.x, p.y - probe.y) }))
        .sort((a, b) => a.dist - b.dist);

      const kNearest = sorted.slice(0, knnK);
      const maxKDist = kNearest[kNearest.length - 1]?.dist || 1;

      // Pulsing radar circle
      ctx.strokeStyle = "rgba(205, 242, 43, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(probePx, probePy, maxKDist * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Laser lines connecting probe to K nearest neighbors
      kNearest.forEach((nb) => {
        ctx.strokeStyle = nb.label === 1 ? "rgba(205, 242, 43, 0.85)" : "rgba(250, 246, 243, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(probePx, probePy);
        ctx.lineTo(cx + nb.x * scale, cy - nb.y * scale);
        ctx.stroke();
      });

      // Probe Target Crosshair
      ctx.fillStyle = "#CDF22B";
      ctx.beginPath();
      ctx.arc(probePx, probePy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FAF6F3";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const vote1 = kNearest.filter((nb) => nb.label === 1).length;
      const vote0 = knnK - vote1;
      const pred = vote1 >= vote0 ? 1 : 0;

      setTelemetry({
        metricA: `Class ${pred} (${pred === 1 ? "Neon Lime" : "Soft Ivory"})`,
        nameA: "Majority Vote Output",
        metricB: `Votes: [0: ${vote0}, 1: ${vote1}] | K = ${knnK}`,
        nameB: "Neighbor Tally",
        status: "DRAG PROBE ON CANVAS",
      });

    // ----------------------------------------------------------------
    // 8. K-MEANS CLUSTERING (Real Lloyd's on User Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "kmeans") {
      // Divide points into K groups with Neon Lime & Soft Ivory anchors
      const colors = ["#CDF22B", "#FAF6F3", "rgba(205, 242, 43, 0.75)", "rgba(250, 246, 243, 0.75)"];
      const centroids: Array<{ x: number; y: number; count: number }> = Array.from({ length: kmeansK }, (_, i) => ({
        x: Math.cos((i * 2 * Math.PI) / kmeansK) * 2,
        y: Math.sin((i * 2 * Math.PI) / kmeansK) * 2,
        count: 0,
      }));

      // 1 iteration of Lloyd update on user points
      if (points.length > 0) {
        const sumX = new Array(kmeansK).fill(0);
        const sumY = new Array(kmeansK).fill(0);
        const counts = new Array(kmeansK).fill(0);

        points.forEach((p) => {
          let bestD = Infinity;
          let bestK = 0;
          centroids.forEach((c, idx) => {
            const d = Math.hypot(p.x - c.x, p.y - c.y);
            if (d < bestD) { bestD = d; bestK = idx; }
          });
          sumX[bestK] += p.x;
          sumY[bestK] += p.y;
          counts[bestK]++;
        });

        for (let k = 0; k < kmeansK; k++) {
          if (counts[k] > 0) {
            centroids[k].x = sumX[k] / counts[k];
            centroids[k].y = sumY[k] / counts[k];
            centroids[k].count = counts[k];
          }
        }
      }

      // Draw Centroid Anchors
      centroids.forEach((c, idx) => {
        ctx.fillStyle = colors[idx % colors.length];
        ctx.beginPath();
        ctx.arc(cx + c.x * scale, cy - c.y * scale, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#08090B";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.strokeStyle = colors[idx % colors.length];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + c.x * scale, cy - c.y * scale, 16 + Math.sin(animTime * 3) * 3, 0, Math.PI * 2);
        ctx.stroke();
      });

      setTelemetry({
        metricA: `${kmeansK} Clusters`,
        nameA: "Active Partitions",
        metricB: `Points: ${points.length}`,
        nameB: "Sample Size",
        status: "LLOYD ITERATION ACTIVE",
      });

    // ----------------------------------------------------------------
    // 9. PRINCIPAL COMPONENT ANALYSIS (Analytical Eigendecomposition on Points)
    // ----------------------------------------------------------------
    } else if (topic.id === "pca") {
      const { meanX, meanY, v1, v2, varRatio } = compute2DPCA(points);

      // Primary Eigenvector PC1 (Neon Lime Green #CDF22B)
      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#CDF22B";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx + (meanX - v1[0] * 5) * scale, cy - (meanY - v1[1] * 5) * scale);
      ctx.lineTo(cx + (meanX + v1[0] * 5) * scale, cy - (meanY + v1[1] * 5) * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Secondary Eigenvector PC2 (Soft Ivory #FAF6F3 dashed)
      ctx.strokeStyle = "rgba(250, 246, 243, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx + (meanX - v2[0] * 3) * scale, cy - (meanY - v2[1] * 3) * scale);
      ctx.lineTo(cx + (meanX + v2[0] * 3) * scale, cy - (meanY + v2[1] * 3) * scale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Perpendicular Projection drops
      ctx.strokeStyle = "rgba(205, 242, 43, 0.25)";
      ctx.lineWidth = 1.2;
      points.forEach((p) => {
        const dx = p.x - meanX;
        const dy = p.y - meanY;
        const proj = dx * v1[0] + dy * v1[1];
        const projX = meanX + proj * v1[0];
        const projY = meanY + proj * v1[1];
        ctx.beginPath();
        ctx.moveTo(cx + p.x * scale, cy - p.y * scale);
        ctx.lineTo(cx + projX * scale, cy - projY * scale);
        ctx.stroke();
      });

      setTelemetry({
        metricA: `${(varRatio * 100).toFixed(1)}%`,
        nameA: "PC1 Explained Variance",
        metricB: `v1 = [${v1[0].toFixed(2)}, ${v1[1].toFixed(2)}]`,
        nameB: "Primary Eigenvector",
        status: "ORTHOGONAL DECOMPOSITION",
      });
    }

    // Render Data Points on top (Class 1: Neon Lime Green, Class 0: Soft Ivory)
    points.forEach((p) => {
      ctx.fillStyle = p.label === 1 ? "#CDF22B" : "#FAF6F3";
      ctx.beginPath();
      ctx.arc(cx + p.x * scale, cy - p.y * scale, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#08090B";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.restore();
  }, [points, topic, degree, l2Reg, svmC, knnK, kmeansK, probe, animTime, isParallelRunning]);

  const activeStage = topic.pipelineStages[activePipelineStep] || topic.pipelineStages[0];

  return (
    <div className="space-y-4">
      {/* ⚡ High-Precision Telemetry Diode Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-[#08090B] border border-[#1E2227] font-mono text-xs">
        <div>
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider block">{telemetry.nameA}</span>
          <span className="font-bold text-[#CDF22B] text-sm tracking-tight">{telemetry.metricA}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider block">{telemetry.nameB}</span>
          <span className="font-bold text-[#FAF6F3] text-xs truncate block">{telemetry.metricB}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider block">Total Samples</span>
          <span className="font-bold text-[#CDF22B] text-sm">{points.length} points</span>
        </div>
        <div>
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider block">Engine State</span>
          <span className="font-bold text-[#FAF6F3] text-xs flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#CDF22B] animate-pulse shadow-[0_0_8px_#CDF22B]" />
            {telemetry.status}
          </span>
        </div>
      </div>

      {/* 🎬 Parallel Pipeline Stepper (Auto-Updating Narrative) */}
      <div className="rounded-3xl border border-[#1E2227] bg-[#0C0E12] p-5 shadow-2xl space-y-3 relative overflow-hidden backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2227] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#CDF22B] text-[#08090B] font-mono text-xs font-black shadow-[0_0_10px_rgba(205,242,43,0.3)]">
              {activeStage.step}
            </span>
            <div>
              <span className="text-xs font-mono font-bold text-[#CDF22B] uppercase tracking-wider mr-2">
                Phase {activeStage.step} of {topic.pipelineStages.length}: {activeStage.phase}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14171A] border border-[#1E2227] text-[#FAF6F3]/70">
                {activeStage.badge}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={activePipelineStep === 0}
              onClick={() => onStepChange(Math.max(0, activePipelineStep - 1))}
              className="h-7 px-2.5 text-xs font-mono rounded-xl border-[#1E2227] bg-[#14171A] text-[#FAF6F3] hover:bg-[#1E2227]"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </Button>
            <Button
              size="sm"
              disabled={activePipelineStep >= topic.pipelineStages.length - 1}
              onClick={() => onStepChange(Math.min(topic.pipelineStages.length - 1, activePipelineStep + 1))}
              className="h-7 px-3 text-xs font-mono rounded-xl bg-[#CDF22B] hover:bg-[#bde024] text-[#08090B] font-bold shadow-[0_0_15px_rgba(205,242,43,0.3)]"
            >
              Next <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-[#FAF6F3]/85 font-sans leading-relaxed">
            {activeStage.insight}
          </p>
          <div className="p-2 rounded-xl bg-[#040506] border border-[#1E2227] font-mono text-xs text-[#CDF22B] shrink-0">
            <MathText tex={activeStage.mathExpression} />
          </div>
        </div>
      </div>

      {/* Canvas Viewport with Presets and Point Placing Tools */}
      <div className="relative rounded-3xl border border-[#1E2227] bg-[#08090B] overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="w-full cursor-crosshair block"
        />

        {/* Top Floating Point Palette */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-[#08090B]/90 border border-[#1E2227] backdrop-blur-md text-[11px] font-mono">
          <span className="px-2 text-[#FAF6F3]/60 font-semibold">Click to Add:</span>
          <button
            onClick={() => setActiveLabel(1)}
            className={cn(
              "px-2.5 py-1 rounded-xl transition-all flex items-center gap-1.5",
              activeLabel === 1
                ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_12px_rgba(205,242,43,0.3)]"
                : "text-[#FAF6F3]/70 hover:text-[#FAF6F3]"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", activeLabel === 1 ? "bg-[#08090B]" : "bg-[#CDF22B]")} /> Class 1
          </button>
          <button
            onClick={() => setActiveLabel(0)}
            className={cn(
              "px-2.5 py-1 rounded-xl transition-all flex items-center gap-1.5",
              activeLabel === 0
                ? "bg-[#FAF6F3] text-[#08090B] font-bold shadow-[0_0_12px_rgba(250,246,243,0.2)]"
                : "text-[#FAF6F3]/70 hover:text-[#FAF6F3]"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", activeLabel === 0 ? "bg-[#08090B]" : "bg-[#FAF6F3]")} /> Class 0
          </button>
        </div>

        {/* Preset Shapes Trigger Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-[#08090B]/90 border border-[#1E2227] backdrop-blur-md text-xs font-mono">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-[#FAF6F3]/50 uppercase px-1">Presets:</span>
            <button onClick={() => applyPreset("linear")} className="px-2 py-0.5 rounded-lg bg-[#14171A] border border-[#1E2227] hover:border-[#CDF22B]/40 hover:text-[#CDF22B] text-[#FAF6F3]/80 text-[11px]">Linear</button>
            <button onClick={() => applyPreset("curved")} className="px-2 py-0.5 rounded-lg bg-[#14171A] border border-[#1E2227] hover:border-[#CDF22B]/40 hover:text-[#CDF22B] text-[#FAF6F3]/80 text-[11px]">Curved</button>
            <button onClick={() => applyPreset("clusters")} className="px-2 py-0.5 rounded-lg bg-[#14171A] border border-[#1E2227] hover:border-[#CDF22B]/40 hover:text-[#CDF22B] text-[#FAF6F3]/80 text-[11px]">Clusters</button>
            <button onClick={() => applyPreset("clear")} className="px-2 py-0.5 rounded-lg bg-[#1A1214] border border-[#3A1E24] hover:bg-[#2A161B] text-[#F87171] text-[11px] flex items-center gap-1">
              <Trash2 className="h-2.5 w-2.5" /> Clear
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsParallelRunning(!isParallelRunning)}
              className="px-2.5 py-1 rounded-lg bg-[#CDF22B] hover:bg-[#bde024] text-[#08090B] font-bold text-[11px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(205,242,43,0.3)] transition-all"
            >
              {isParallelRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isParallelRunning ? "Pause Parallel Sim" : "Run Parallel Sim"}
            </button>
          </div>
        </div>
      </div>

      {/* Model-Specific Hyperparameter Tuning Dials */}
      <div className="p-3.5 rounded-2xl bg-[#08090B] border border-[#1E2227] text-xs font-mono space-y-2">
        {topic.id === "polynomial-regression" && (
          <div className="flex items-center gap-3">
            <span className="text-[#FAF6F3] font-semibold">Degree (d = {degree}):</span>
            <div className="w-48">
              <Slider value={[degree]} min={1} max={6} step={1} onValueChange={([v]) => setDegree(v)} />
            </div>
            <span className="text-[#FAF6F3]/50 text-[11px]">Dynamically inverting Vandermonde matrix on user points.</span>
          </div>
        )}
        {topic.id === "ridge-lasso" && (
          <div className="flex items-center gap-3">
            <span className="text-[#FAF6F3] font-semibold">Regularization (λ = {l2Reg.toFixed(1)}):</span>
            <div className="w-48">
              <Slider value={[l2Reg]} min={0} max={10} step={0.2} onValueChange={([v]) => setL2Reg(v)} />
            </div>
            <span className="text-[#FAF6F3]/50 text-[11px]">Adjusts diagonal Tikhonov shrinkage term in real time.</span>
          </div>
        )}
        {topic.id === "svm" && (
          <div className="flex items-center gap-3">
            <span className="text-[#FAF6F3] font-semibold">Slack Penalty (C = {svmC.toFixed(1)}):</span>
            <div className="w-48">
              <Slider value={[svmC]} min={0.2} max={15} step={0.5} onValueChange={([v]) => setSvmC(v)} />
            </div>
            <span className="text-[#FAF6F3]/50 text-[11px]">Recomputes hinge margin boundaries on user coordinates.</span>
          </div>
        )}
        {topic.id === "knn" && (
          <div className="flex items-center gap-3">
            <span className="text-[#FAF6F3] font-semibold">Neighbors (K = {knnK}):</span>
            <div className="w-48">
              <Slider value={[knnK]} min={1} max={7} step={2} onValueChange={([v]) => setKnnK(v)} />
            </div>
            <span className="text-[#CDF22B] text-[11px]">(Click &amp; drag target probe on canvas)</span>
          </div>
        )}
        {topic.id === "kmeans" && (
          <div className="flex items-center gap-3">
            <span className="text-[#FAF6F3] font-semibold">Partitions (K = {kmeansK}):</span>
            <div className="w-48">
              <Slider value={[kmeansK]} min={2} max={4} step={1} onValueChange={([v]) => setKmeansK(v)} />
            </div>
            <span className="text-[#FAF6F3]/50 text-[11px]">Recalculates centroids dynamically as points move.</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Gradient Descent & Stochastic Descent Studio           */
/* ------------------------------------------------------------------ */

export function GradientDescentLab({
  topic,
  activePipelineStep,
  onStepChange,
}: {
  topic: MLTopic;
  activePipelineStep: number;
  onStepChange: (step: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isSGD = topic.id === "stochastic-gradient-descent";
  const isAdam = topic.id === "adam-optimizer";

  // Landscape selection
  const [landscape, setLandscape] = useState<"bowl" | "rosenbrock" | "saddle" | "beale">(
    isSGD ? "saddle" : isAdam ? "rosenbrock" : "bowl"
  );

  // Hyperparameters
  const [learningRate, setLearningRate] = useState<number>(isSGD ? 0.08 : 0.05);
  const [noiseVariance, setNoiseVariance] = useState<number>(0.35); // for SGD
  const [decayEnabled, setDecayEnabled] = useState<boolean>(true); // Robbins-Monro
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stepCount, setStepCount] = useState<number>(0);

  // Initial coordinates
  const defaultStart = useMemo(() => {
    if (landscape === "bowl") return { x: -2.4, y: 1.8 };
    if (landscape === "rosenbrock") return { x: -1.5, y: 1.5 };
    if (landscape === "saddle") return { x: 0.06, y: 0.12 }; // Close to saddle (0,0) to demonstrate escape
    return { x: 1.0, y: 1.5 };
  }, [landscape]);

  const [w, setW] = useState<{ x: number; y: number }>(defaultStart);
  const [path, setPath] = useState<Array<{ x: number; y: number }>>([defaultStart]);
  const [recentGrad, setRecentGrad] = useState<{ gx: number; gy: number; norm: number }>({ gx: 0, gy: 0, norm: 0 });
  const [lastNoiseVector, setLastNoiseVector] = useState<{ nx: number; ny: number }>({ nx: 0, ny: 0 });
  const [status, setStatus] = useState<"READY" | "DESCENDING" | "CONVERGED" | "SADDLE ESCAPED" | "OSCILLATING">("READY");

  // Adam momentum state
  const [mVec, setMVec] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [vVec, setVVec] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset landscape & coordinates when algorithm changes
  useEffect(() => {
    const initLandscape = topic.id === "stochastic-gradient-descent" ? "saddle" : topic.id === "adam-optimizer" ? "rosenbrock" : "bowl";
    setLandscape(initLandscape);
    const initStart = initLandscape === "bowl" ? { x: -2.4, y: 1.8 } : initLandscape === "saddle" ? { x: 0.06, y: 0.12 } : { x: -1.5, y: 1.5 };
    setW(initStart);
    setPath([initStart]);
    setStepCount(0);
    setIsRunning(false);
    setStatus("READY");
    setMVec({ x: 0, y: 0 });
    setVVec({ x: 0, y: 0 });
  }, [topic.id]);

  // Mathematical surfaces and analytical gradients
  const evalLandscape = useCallback((x: number, y: number) => {
    if (landscape === "bowl") {
      // Convex Elliptic Paraboloid: 0.5 * x^2 + 2 * y^2
      const loss = 0.5 * x * x + 2 * y * y;
      const gx = x;
      const gy = 4 * y;
      return { loss, gx, gy, minX: 0, minY: 0 };
    } else if (landscape === "rosenbrock") {
      // Rosenbrock Banana Ravine: (1 - x)^2 + 10 * (y - x^2)^2
      const loss = Math.pow(1 - x, 2) + 10 * Math.pow(y - x * x, 2);
      const gx = -2 * (1 - x) - 40 * x * (y - x * x);
      const gy = 20 * (y - x * x);
      return {
        loss,
        gx: Math.max(-40, Math.min(40, gx)),
        gy: Math.max(-40, Math.min(40, gy)),
        minX: 1,
        minY: 1,
      };
    } else if (landscape === "saddle") {
      // Non-Convex Double Well Saddle: x^2 - y^2 + 0.1*(x^4 + y^4)
      const loss = x * x - y * y + 0.1 * (Math.pow(x, 4) + Math.pow(y, 4));
      const gx = 2 * x + 0.4 * Math.pow(x, 3);
      const gy = -2 * y + 0.4 * Math.pow(y, 3);
      return { loss, gx, gy, minX: 0, minY: 2.236 };
    } else {
      // Beale Surface: (1.5 - x + xy)^2 + (2.25 - x + xy^2)^2
      const loss = Math.pow(1.5 - x + x * y, 2) + Math.pow(2.25 - x + x * y * y, 2);
      const gx = 2 * (1.5 - x + x * y) * (y - 1) + 2 * (2.25 - x + x * y * y) * (y * y - 1);
      const gy = 2 * (1.5 - x + x * y) * x + 4 * (2.25 - x + x * y * y) * x * y;
      return {
        loss,
        gx: Math.max(-30, Math.min(30, gx)),
        gy: Math.max(-30, Math.min(30, gy)),
        minX: 3,
        minY: 0.5,
      };
    }
  }, [landscape]);

  // Execute one discrete descent step
  const performStep = useCallback(() => {
    setW((currW) => {
      const { gx, gy } = evalLandscape(currW.x, currW.y);
      const norm = Math.hypot(gx, gy);
      setRecentGrad({ gx, gy, norm });

      if (norm < 0.02 && !isSGD) {
        setStatus("CONVERGED");
        setIsRunning(false);
        return currW;
      }

      let effLr = learningRate;
      if (isSGD && decayEnabled) {
        // Robbins-Monro schedule: alpha_t = alpha_0 / (1 + 0.015 * t)
        effLr = learningRate / (1 + 0.015 * stepCount);
      }

      let stepX = 0;
      let stepY = 0;

      if (isSGD) {
        // Stochastic perturbation (Box-Muller gaussian noise)
        const u1 = Math.max(1e-6, Math.random());
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        const noiseMag = noiseVariance * (norm * 0.35 + 0.5);
        const noiseX = z0 * noiseMag;
        const noiseY = z1 * noiseMag;
        setLastNoiseVector({ nx: noiseX, ny: noiseY });

        const stochGx = gx + noiseX;
        const stochGy = gy + noiseY;
        stepX = -effLr * stochGx;
        stepY = -effLr * stochGy;

        if (landscape === "saddle" && Math.abs(currW.y) > 0.8) {
          setStatus("SADDLE ESCAPED");
        } else {
          setStatus("DESCENDING");
        }
      } else if (isAdam) {
        // Adam optimization
        const t = stepCount + 1;
        const nm_x = 0.9 * mVec.x + 0.1 * gx;
        const nm_y = 0.9 * mVec.y + 0.1 * gy;
        const nv_x = 0.999 * vVec.x + 0.001 * (gx * gx);
        const nv_y = 0.999 * vVec.y + 0.001 * (gy * gy);
        setMVec({ x: nm_x, y: nm_y });
        setVVec({ x: nv_x, y: nv_y });
        const m_hat_x = nm_x / (1 - Math.pow(0.9, t));
        const m_hat_y = nm_y / (1 - Math.pow(0.9, t));
        const v_hat_x = nv_x / (1 - Math.pow(0.999, t));
        const v_hat_y = nv_y / (1 - Math.pow(0.999, t));
        stepX = -effLr * (m_hat_x / (Math.sqrt(v_hat_x) + 1e-8));
        stepY = -effLr * (m_hat_y / (Math.sqrt(v_hat_y) + 1e-8));
        setStatus(norm < 0.03 ? "CONVERGED" : "DESCENDING");
      } else {
        // Deterministic Batch Gradient Descent
        stepX = -effLr * gx;
        stepY = -effLr * gy;

        if (norm > 30) {
          setStatus("OSCILLATING");
        } else {
          setStatus("DESCENDING");
        }
      }

      const nextX = Math.max(-3.5, Math.min(3.5, currW.x + stepX));
      const nextY = Math.max(-3.5, Math.min(3.5, currW.y + stepY));

      const newPoint = { x: nextX, y: nextY };
      setPath((prev) => [...prev.slice(-100), newPoint]);
      setStepCount((s) => s + 1);
      return newPoint;
    });
  }, [evalLandscape, learningRate, isSGD, isAdam, decayEnabled, noiseVariance, stepCount, landscape, mVec, vVec]);

  // Continuous animation cycle
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(performStep, isSGD ? 40 : 45);
    return () => clearInterval(interval);
  }, [isRunning, performStep, isSGD]);

  // Click on contour canvas to reposition starting parameters
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const wCanvas = rect.width;
    const hCanvas = rect.height;
    const cx = wCanvas / 2;
    const cy = hCanvas / 2;
    const scale = Math.min(wCanvas, hCanvas) / 7.0;

    const mathX = (px - cx) / scale;
    const mathY = -(py - cy) / scale;

    const clampedX = Math.max(-3.2, Math.min(3.2, mathX));
    const clampedY = Math.max(-3.2, Math.min(3.2, mathY));

    setW({ x: clampedX, y: clampedY });
    setPath([{ x: clampedX, y: clampedY }]);
    setStepCount(0);
    setMVec({ x: 0, y: 0 });
    setVVec({ x: 0, y: 0 });
    setStatus("READY");
    toast.success(`Position placed at (${clampedX.toFixed(2)}, ${clampedY.toFixed(2)})`);
  };

  // Render 2D contour isolines and trajectory
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 560;
    const height = 400;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 7.0;

    // Background: Midnight Black #08090B
    ctx.fillStyle = "#08090B";
    ctx.fillRect(0, 0, width, height);

    // Subtle coordinate axes
    ctx.strokeStyle = "rgba(250, 246, 243, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();

    // Contour Isolines
    const levels = [0.15, 0.45, 1.0, 2.2, 4.0, 7.5, 12.0, 18.0, 26.0, 36.0];
    const { minX, minY } = evalLandscape(0, 0);

    levels.forEach((lvl, idx) => {
      ctx.strokeStyle = `rgba(250, 246, 243, ${0.04 + idx * 0.02})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const numSteps = 72;
      for (let i = 0; i <= numSteps; i++) {
        const theta = (i / numSteps) * Math.PI * 2;
        let dx = 0;
        let dy = 0;
        if (landscape === "bowl") {
          dx = Math.cos(theta) * Math.sqrt(lvl * 2.0);
          dy = Math.sin(theta) * Math.sqrt(lvl * 0.5);
        } else if (landscape === "rosenbrock") {
          const r = Math.sqrt(lvl) * 0.6;
          dx = 1.0 + r * Math.cos(theta);
          dy = 1.0 + r * Math.sin(theta) + (dx - 1) * (dx - 1);
        } else if (landscape === "saddle") {
          dx = Math.cos(theta) * Math.sqrt(lvl * 1.2);
          dy = Math.sin(theta) * Math.sqrt(lvl * 0.9) + (Math.sin(theta) > 0 ? 1.5 : -1.5) * 0.5;
        } else {
          dx = 3.0 + Math.cos(theta) * Math.sqrt(lvl * 0.8);
          dy = 0.5 + Math.sin(theta) * Math.sqrt(lvl * 0.8);
        }
        const px = cx + dx * scale;
        const py = cy - dy * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // Optimum Target 🎯
    const targetPx = cx + minX * scale;
    const targetPy = cy - minY * scale;
    ctx.fillStyle = "#CDF22B";
    ctx.beginPath();
    ctx.arc(targetPx, targetPy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#08090B";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pulse ring around target
    ctx.strokeStyle = "rgba(205, 242, 43, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(targetPx, targetPy, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Trajectory History Path
    if (path.length > 1) {
      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = isSGD ? 1.8 : 2.5;
      ctx.shadowColor = "#CDF22B";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      path.forEach((pt, idx) => {
        const px = cx + pt.x * scale;
        const py = cy - pt.y * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dots along trajectory
      path.forEach((pt, idx) => {
        if (idx % 2 === 0 || idx === path.length - 1) {
          const px = cx + pt.x * scale;
          const py = cy - pt.y * scale;
          ctx.fillStyle = idx === path.length - 1 ? "#CDF22B" : "rgba(250, 246, 243, 0.5)";
          ctx.beginPath();
          ctx.arc(px, py, idx === path.length - 1 ? 5 : 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Directional Gradient Vector Arrow (-α ∇J)
    const currPx = cx + w.x * scale;
    const currPy = cy - w.y * scale;
    const { gx, gy } = evalLandscape(w.x, w.y);
    const gradNorm = Math.hypot(gx, gy);

    if (gradNorm > 1e-4) {
      const arrowLength = Math.min(50, Math.max(16, gradNorm * (learningRate * 90)));
      const dirX = -gx / gradNorm;
      const dirY = gy / gradNorm; // Inverted for canvas y-axis

      const tipX = currPx + dirX * arrowLength;
      const tipY = currPy + dirY * arrowLength;

      ctx.strokeStyle = "#CDF22B";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(currPx, currPy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      const angle = Math.atan2(dirY, dirX);
      const headLen = 7;
      ctx.fillStyle = "#CDF22B";
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - headLen * Math.cos(angle - Math.PI / 6), tipY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(tipX - headLen * Math.cos(angle + Math.PI / 6), tipY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // For SGD: also draw noisy sample direction
      if (isSGD && (lastNoiseVector.nx !== 0 || lastNoiseVector.ny !== 0)) {
        const noiseTipX = currPx + (dirX * arrowLength + lastNoiseVector.nx * 7);
        const noiseTipY = currPy + (dirY * arrowLength - lastNoiseVector.ny * 7);
        ctx.strokeStyle = "rgba(250, 246, 243, 0.45)";
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(currPx, currPy);
        ctx.lineTo(noiseTipX, noiseTipY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Starting marker
    const startPt = path[0] || w;
    const startPx = cx + startPt.x * scale;
    const startPy = cy - startPt.y * scale;
    ctx.strokeStyle = "#FAF6F3";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(startPx, startPy, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, [w, path, evalLandscape, landscape, isSGD, learningRate, lastNoiseVector]);

  const currEval = evalLandscape(w.x, w.y);
  const activeStage = topic.pipelineStages[activePipelineStep] || topic.pipelineStages[0];

  return (
    <div className="space-y-4">
      {/* Landscape & Execution Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#08090B] border border-[#1E2227] text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[#FAF6F3]/50 font-semibold mr-1">Landscape:</span>
          {[
            { id: "bowl", label: "Elliptic Bowl (κ=4)" },
            { id: "saddle", label: "Saddle Point" },
            { id: "rosenbrock", label: "Rosenbrock Valley" },
            { id: "beale", label: "Beale Surface" },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLandscape(l.id as any);
                const nextStart = l.id === "bowl" ? { x: -2.4, y: 1.8 } : l.id === "saddle" ? { x: 0.06, y: 0.12 } : { x: -1.5, y: 1.5 };
                setW(nextStart);
                setPath([nextStart]);
                setStepCount(0);
                setIsRunning(false);
                setStatus("READY");
              }}
              className={cn(
                "px-2.5 py-1 rounded-xl font-mono text-xs transition-all",
                landscape === l.id
                  ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_12px_rgba(205,242,43,0.3)]"
                  : "bg-[#14171A] border border-[#1E2227] text-[#FAF6F3]/70 hover:text-[#FAF6F3]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
            className="h-8 text-xs font-mono font-bold bg-[#CDF22B] text-[#08090B] hover:bg-[#bde024] shadow-[0_0_12px_rgba(205,242,43,0.3)] gap-1.5"
          >
            {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? "Pause" : isSGD ? "Run SGD" : "Run Descent"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsRunning(false);
              performStep();
            }}
            className="h-8 text-xs font-mono border-[#1E2227] bg-[#14171A] text-[#FAF6F3] hover:text-[#CDF22B] hover:border-[#CDF22B]/40 gap-1.5"
          >
            <FastForward className="h-3.5 w-3.5" />
            Step 1 Iter
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsRunning(false);
              setW(defaultStart);
              setPath([defaultStart]);
              setStepCount(0);
              setMVec({ x: 0, y: 0 });
              setVVec({ x: 0, y: 0 });
              setStatus("READY");
            }}
            className="h-8 text-xs font-mono text-[#FAF6F3]/70 hover:text-[#FAF6F3] border border-[#1E2227] bg-[#14171A] gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      {/* Interactive 2D Contour Canvas */}
      <div className="relative rounded-3xl border border-[#1E2227] bg-[#08090B] overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full block cursor-crosshair"
          title="Click anywhere to place initial parameter w"
        />
        <div className="absolute top-3 left-3 text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#08090B]/90 border border-[#1E2227] text-[#FAF6F3]/70 flex items-center gap-2 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#CDF22B] animate-pulse" />
          <span>Step {stepCount} • Click anywhere to drop start position (w₁, w₂)</span>
        </div>
        <div className="absolute top-3 right-3 text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#08090B]/90 border border-[#1E2227] text-[#FAF6F3]/70 backdrop-blur-md">
          🎯 Target: Global Minimum
        </div>
      </div>

      {/* Real-Time Telemetry HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        <div className="p-3 rounded-2xl border border-[#1E2227] bg-[#0C0E12] flex flex-col gap-1">
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider">Parameters (w₁, w₂)</span>
          <span className="text-sm font-bold text-[#FAF6F3]">
            ({w.x.toFixed(3)}, {w.y.toFixed(3)})
          </span>
          <span className="text-[10px] text-[#FAF6F3]/40">Dimension: 2D Plane</span>
        </div>

        <div className="p-3 rounded-2xl border border-[#1E2227] bg-[#0C0E12] flex flex-col gap-1">
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider">Current Loss J(w)</span>
          <span className="text-sm font-bold text-[#CDF22B]">
            {currEval.loss.toFixed(4)}
          </span>
          <span className="text-[10px] text-[#FAF6F3]/40">Objective Cost</span>
        </div>

        <div className="p-3 rounded-2xl border border-[#1E2227] bg-[#0C0E12] flex flex-col gap-1">
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider">Gradient Norm ||∇J||</span>
          <span className="text-sm font-bold text-[#FAF6F3]">
            {recentGrad.norm.toFixed(4)}
          </span>
          <span className="text-[10px] text-[#FAF6F3]/40">First-Order Sensitivity</span>
        </div>

        <div className="p-3 rounded-2xl border border-[#1E2227] bg-[#0C0E12] flex flex-col gap-1">
          <span className="text-[10px] text-[#FAF6F3]/50 uppercase tracking-wider">Trajectory Status</span>
          <span
            className={cn(
              "text-xs font-bold truncate",
              status === "CONVERGED" || status === "SADDLE ESCAPED"
                ? "text-[#CDF22B]"
                : status === "OSCILLATING"
                ? "text-amber-400"
                : "text-[#FAF6F3]"
            )}
          >
            {status}
          </span>
          <span className="text-[10px] text-[#FAF6F3]/40">
            {isSGD ? (decayEnabled ? "Annealed Schedule" : "Constant α") : "Monotonic Batch"}
          </span>
        </div>
      </div>

      {/* Hyperparameter Tuning Sliders */}
      <div className="p-3.5 rounded-2xl bg-[#08090B] border border-[#1E2227] text-xs font-mono space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[#FAF6F3] font-semibold whitespace-nowrap">
              Learning Rate (α = {learningRate.toFixed(3)}):
            </span>
            <Slider
              value={[learningRate]}
              min={0.005}
              max={0.35}
              step={0.005}
              onValueChange={([val]) => setLearningRate(val)}
              className="w-36 sm:w-48"
            />
          </div>

          {isSGD && (
            <div className="flex items-center gap-3">
              <span className="text-[#FAF6F3] font-semibold whitespace-nowrap">
                Mini-Batch Noise (σ = {noiseVariance.toFixed(2)}):
              </span>
              <Slider
                value={[noiseVariance]}
                min={0.05}
                max={0.9}
                step={0.05}
                onValueChange={([val]) => setNoiseVariance(val)}
                className="w-32 sm:w-40"
              />
            </div>
          )}

          {isSGD && (
            <button
              type="button"
              onClick={() => setDecayEnabled(!decayEnabled)}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-mono transition-all border",
                decayEnabled
                  ? "bg-[#CDF22B]/15 border-[#CDF22B] text-[#CDF22B] font-bold shadow-[0_0_8px_rgba(205,242,43,0.2)]"
                  : "bg-[#14171A] border-[#1E2227] text-[#FAF6F3]/60 hover:text-[#FAF6F3]"
              )}
            >
              Robbins-Monro Decay: {decayEnabled ? "ENABLED" : "OFF"}
            </button>
          )}
        </div>
      </div>

      {/* 4-Phase Pipeline Stages Sync */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#08090B] border border-[#1E2227]">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#CDF22B]/15 text-[#CDF22B] font-mono text-xs font-bold border border-[#CDF22B]/30">
            {activeStage.step}
          </span>
          <div>
            <span className="text-xs font-mono font-bold text-[#CDF22B] uppercase tracking-wider mr-2">
              Phase {activeStage.step} of {topic.pipelineStages.length}: {activeStage.phase}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14171A] border border-[#1E2227] text-[#FAF6F3]/70">
              {activeStage.badge}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={activePipelineStep === 0}
            onClick={() => onStepChange(Math.max(0, activePipelineStep - 1))}
            className="h-7 px-2.5 text-xs font-mono text-[#FAF6F3]/70 hover:text-[#FAF6F3] border border-[#1E2227] bg-[#14171A]"
          >
            <ChevronLeft className="h-3 w-3" /> Prev
          </Button>
          <Button
            size="sm"
            disabled={activePipelineStep >= topic.pipelineStages.length - 1}
            onClick={() => onStepChange(Math.min(topic.pipelineStages.length - 1, activePipelineStep + 1))}
            className="h-7 px-3 text-xs font-mono rounded-xl bg-[#CDF22B] hover:bg-[#bde024] text-[#08090B] font-bold shadow-[0_0_15px_rgba(205,242,43,0.3)]"
          >
            Next <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-[#0C0E12] border border-[#1E2227] text-left space-y-1">
        <div className="text-xs font-mono text-[#FAF6F3]">
          <MathText tex={activeStage.mathExpression} />
        </div>
        <p className="text-xs text-[#FAF6F3]/70 leading-relaxed font-sans">
          {activeStage.insight}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2D Contour Optimization Lab (4-Way Live Optimizer Race)            */
/* ------------------------------------------------------------------ */

interface OptimizerParticle {
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
  m_x: number;
  m_y: number;
  v_x: number;
  v_y: number;
  t: number;
  path: Array<{ x: number; y: number }>;
}

export function OptimizationLossLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lossFunc, setLossFunc] = useState<"rosenbrock" | "saddle" | "bowl" | "beale">("rosenbrock");
  const [learningRate, setLearningRate] = useState<number>(0.02);
  const [isRacing, setIsRacing] = useState<boolean>(true);
  const [stepCount, setStepCount] = useState<number>(0);

  const [particles, setParticles] = useState<OptimizerParticle[]>([
    { name: "SGD", color: "rgba(205, 242, 43, 0.5)", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "Momentum", color: "rgba(250, 246, 243, 0.65)", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "RMSProp", color: "#FAF6F3", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "Adam", color: "#CDF22B", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
  ]);

  const computeLossAndGrad = useCallback((x: number, y: number) => {
    if (lossFunc === "rosenbrock") {
      const loss = Math.pow(1 - x, 2) + 10 * Math.pow(y - x * x, 2);
      const gx = -2 * (1 - x) - 40 * x * (y - x * x);
      const gy = 20 * (y - x * x);
      return { loss, gx: Math.max(-50, Math.min(50, gx)), gy: Math.max(-50, Math.min(50, gy)) };
    } else if (lossFunc === "saddle") {
      const loss = x * x - y * y;
      return { loss, gx: 2 * x, gy: -2 * y };
    } else if (lossFunc === "beale") {
      const loss = Math.pow(1.5 - x + x * y, 2) + Math.pow(2.25 - x + x * y * y, 2);
      const gx = 2 * (1.5 - x + x * y) * (y - 1) + 2 * (2.25 - x + x * y * y) * (y * y - 1);
      const gy = 2 * (1.5 - x + x * y) * x + 4 * (2.25 - x + x * y * y) * x * y;
      return { loss, gx: Math.max(-40, Math.min(40, gx)), gy: Math.max(-40, Math.min(40, gy)) };
    } else {
      const loss = 0.5 * x * x + 4 * y * y;
      return { loss, gx: x, gy: 8 * y };
    }
  }, [lossFunc]);

  const resetRace = useCallback(() => {
    const startX = lossFunc === "rosenbrock" ? -1.5 : -2;
    const startY = lossFunc === "rosenbrock" ? 1.5 : 2;
    setStepCount(0);
    setParticles([
      { name: "SGD", color: "rgba(205, 242, 43, 0.5)", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
      { name: "Momentum", color: "rgba(250, 246, 243, 0.65)", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
      { name: "RMSProp", color: "#FAF6F3", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
      { name: "Adam", color: "#CDF22B", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
    ]);
  }, [lossFunc]);

  useEffect(() => {
    resetRace();
  }, [lossFunc, resetRace]);

  const stepOptimizers = useCallback(() => {
    setParticles((prev) =>
      prev.map((p) => {
        const { gx, gy } = computeLossAndGrad(p.x, p.y);
        let nx = p.x;
        let ny = p.y;
        let nvx = p.vx, nvy = p.vy;
        let nsx = p.sx, nsy = p.sy;
        let nm_x = p.m_x, nm_y = p.m_y;
        let nv_x = p.v_x, nv_y = p.v_y;
        const t = p.t + 1;

        if (p.name === "SGD") {
          nx -= learningRate * gx;
          ny -= learningRate * gy;
        } else if (p.name === "Momentum") {
          nvx = 0.9 * p.vx + learningRate * gx;
          nvy = 0.9 * p.vy + learningRate * gy;
          nx -= nvx;
          ny -= nvy;
        } else if (p.name === "RMSProp") {
          nsx = 0.9 * p.sx + 0.1 * (gx * gx);
          nsy = 0.9 * p.sy + 0.1 * (gy * gy);
          nx -= (learningRate / (Math.sqrt(nsx) + 1e-8)) * gx;
          ny -= (learningRate / (Math.sqrt(nsy) + 1e-8)) * gy;
        } else if (p.name === "Adam") {
          nm_x = 0.9 * p.m_x + 0.1 * gx;
          nm_y = 0.9 * p.m_y + 0.1 * gy;
          nv_x = 0.999 * p.v_x + 0.001 * (gx * gx);
          nv_y = 0.999 * p.v_y + 0.001 * (gy * gy);
          const m_hat_x = nm_x / (1 - Math.pow(0.9, t));
          const m_hat_y = nm_y / (1 - Math.pow(0.9, t));
          const v_hat_x = nv_x / (1 - Math.pow(0.999, t));
          const v_hat_y = nv_y / (1 - Math.pow(0.999, t));
          nx -= (learningRate / (Math.sqrt(v_hat_x) + 1e-8)) * m_hat_x;
          ny -= (learningRate / (Math.sqrt(v_hat_y) + 1e-8)) * m_hat_y;
        }

        nx = Math.max(-3, Math.min(3, nx));
        ny = Math.max(-3, Math.min(3, ny));

        return {
          ...p,
          x: nx,
          y: ny,
          vx: nvx,
          vy: nvy,
          sx: nsx,
          sy: nsy,
          m_x: nm_x,
          m_y: nm_y,
          v_x: nv_x,
          v_y: nv_y,
          t,
          path: [...p.path.slice(-70), { x: nx, y: ny }],
        };
      })
    );
    setStepCount((s) => s + 1);
  }, [computeLossAndGrad, learningRate]);

  useEffect(() => {
    if (!isRacing) return;
    const interval = setInterval(stepOptimizers, 45);
    return () => clearInterval(interval);
  }, [isRacing, stepOptimizers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 560;
    const h = 400;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 6.5;

    ctx.fillStyle = "#08090B";
    ctx.fillRect(0, 0, w, h);

    const levels = [0.1, 0.4, 1.0, 2.5, 5.0, 10.0, 20.0, 40.0];
    levels.forEach((lvl, idx) => {
      ctx.strokeStyle = `rgba(250, 246, 243, ${0.04 + idx * 0.02})`;
      ctx.beginPath();
      for (let angle = 0; angle <= Math.PI * 2; angle += 0.05) {
        const r = Math.sqrt(lvl) * 0.7;
        const px = cx + (r * Math.cos(angle) + (lossFunc === "rosenbrock" ? 1 : 0)) * scale;
        const py = cy - (r * Math.sin(angle) + (lossFunc === "rosenbrock" ? 1 : 0)) * scale;
        if (angle === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });

    const targetX = lossFunc === "rosenbrock" ? 1 : 0;
    const targetY = lossFunc === "rosenbrock" ? 1 : 0;
    ctx.fillStyle = "#CDF22B";
    ctx.beginPath();
    ctx.arc(cx + targetX * scale, cy - targetY * scale, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#08090B";
    ctx.lineWidth = 2;
    ctx.stroke();

    particles.forEach((p) => {
      if (p.path.length < 2) return;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = p.name === "Adam" ? "#CDF22B" : "transparent";
      ctx.shadowBlur = p.name === "Adam" ? 10 : 0;
      ctx.beginPath();
      p.path.forEach((pt, idx) => {
        const px = cx + pt.x * scale;
        const py = cy - pt.y * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      const head = p.path[p.path.length - 1];
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx + head.x * scale, cy - head.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, [particles, lossFunc]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#08090B] border border-[#1E2227] text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[#FAF6F3]/50 font-semibold">Landscape:</span>
          {[
            { id: "rosenbrock", label: "Rosenbrock Valley" },
            { id: "saddle", label: "Saddle Point" },
            { id: "bowl", label: "Ravine Bowl" },
            { id: "beale", label: "Beale Surface" },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => setLossFunc(l.id as any)}
              className={cn(
                "px-2.5 py-1 rounded-xl font-mono text-xs transition-all",
                lossFunc === l.id
                  ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_12px_rgba(205,242,43,0.3)]"
                  : "bg-[#14171A] border border-[#1E2227] text-[#FAF6F3]/70 hover:text-[#FAF6F3]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 font-mono border-[#1E2227] bg-[#CDF22B] hover:bg-[#bde024] text-[#08090B] font-bold shadow-[0_0_12px_rgba(205,242,43,0.3)]"
            onClick={() => setIsRacing(!isRacing)}
          >
            {isRacing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isRacing ? "Pause Race" : "Start Race"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 font-mono text-[#FAF6F3]/70 hover:text-[#FAF6F3] border border-[#1E2227] bg-[#14171A]" onClick={resetRace}>
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      <div className="relative rounded-3xl border border-[#1E2227] bg-[#08090B] overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} className="w-full block" />
        <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded-md bg-[#08090B]/90 border border-[#1E2227] text-[#FAF6F3]/70">
          Step: {stepCount} • Target: 🎯 (Global Minimum)
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        {particles.map((p) => {
          const { loss } = computeLossAndGrad(p.x, p.y);
          return (
            <div
              key={p.name}
              className="p-3 rounded-2xl border border-[#1E2227] bg-[#0C0E12] flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5" style={{ color: p.name === "SGD" ? "#CDF22B" : p.name === "Momentum" ? "#FAF6F3" : p.color }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <span className="text-[10px] text-[#FAF6F3]/40">t = {p.t}</span>
              </div>
              <div className="text-[11px] text-[#FAF6F3]/70">
                Loss: <span className="text-[#FAF6F3] font-bold">{loss.toFixed(4)}</span>
              </div>
              <div className="text-[10px] text-[#FAF6F3]/50 truncate">
                Pos: ({p.x.toFixed(2)}, {p.y.toFixed(2)})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabular Q-Learning 5x5 Gridworld Simulator                         */
/* ------------------------------------------------------------------ */

export function QLearningGridworld() {
  const [gridSize] = useState(5);
  const [agentPos, setAgentPos] = useState({ r: 0, c: 0 });
  const [goalPos] = useState({ r: 4, c: 4 });
  const [traps] = useState([
    { r: 1, c: 2 },
    { r: 2, c: 2 },
    { r: 3, c: 1 },
    { r: 2, c: 4 },
  ]);
  const [episodes, setEpisodes] = useState(0);
  const [totalReward, setTotalReward] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const qTableRef = useRef<Record<string, number[]>>({});

  if (Object.keys(qTableRef.current).length === 0) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        qTableRef.current[`${r},${c}`] = [0, 0, 0, 0];
      }
    }
  }

  const stepAgent = () => {
    setAgentPos((curr) => {
      const stateKey = `${curr.r},${curr.c}`;
      const qValues = qTableRef.current[stateKey] || [0, 0, 0, 0];

      let action = 0;
      if (Math.random() < 0.15) {
        action = Math.floor(Math.random() * 4);
      } else {
        action = qValues.indexOf(Math.max(...qValues));
      }

      let nr = curr.r;
      let nc = curr.c;
      if (action === 0) nr = Math.max(0, curr.r - 1);
      if (action === 1) nr = Math.min(gridSize - 1, curr.r + 1);
      if (action === 2) nc = Math.max(0, curr.c - 1);
      if (action === 3) nc = Math.min(gridSize - 1, curr.c + 1);

      const isGoal = nr === goalPos.r && nc === goalPos.c;
      const isTrap = traps.some((t) => t.r === nr && t.c === nc);
      const reward = isGoal ? 10 : isTrap ? -10 : -0.1;

      const nextKey = `${nr},${nc}`;
      const nextMax = Math.max(...(qTableRef.current[nextKey] || [0, 0, 0, 0]));
      const currentQ = qTableRef.current[stateKey][action];
      qTableRef.current[stateKey][action] = currentQ + 0.25 * (reward + 0.95 * nextMax - currentQ);

      setTotalReward((r) => r + reward);

      if (isGoal || isTrap) {
        setEpisodes((e) => e + 1);
        return { r: 0, c: 0 };
      }
      return { r: nr, c: nc };
    });
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(stepAgent, 110);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[#CDF22B] font-bold">Episodes: {episodes}</span>
          <span className="text-[#FAF6F3]/60">• Cumulative Reward: {totalReward.toFixed(1)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 font-mono border-[#1E2227] bg-[#CDF22B] hover:bg-[#bde024] text-[#08090B] font-bold shadow-[0_0_12px_rgba(205,242,43,0.3)]"
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isRunning ? "Pause" : "Auto-Explore"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs font-mono text-[#FAF6F3]/70 hover:text-[#FAF6F3] border border-[#1E2227] bg-[#14171A]" onClick={stepAgent}>
            Step
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 p-4 rounded-3xl border border-[#1E2227] bg-[#08090B] max-w-md mx-auto shadow-2xl">
        {Array.from({ length: 25 }, (_, idx) => {
          const r = Math.floor(idx / 5);
          const c = idx % 5;
          const isAgent = agentPos.r === r && agentPos.c === c;
          const isGoal = goalPos.r === r && goalPos.c === c;
          const isTrap = traps.some((t) => t.r === r && t.c === c);

          const qVals = qTableRef.current[`${r},${c}`] || [0, 0, 0, 0];
          const maxQ = Math.max(...qVals);
          const bestAction = qVals.indexOf(maxQ);
          const intensity = Math.min(Math.max((maxQ + 5) / 15, 0), 1);
          const actionArrows = ["↑", "↓", "←", "→"];

          return (
            <div
              key={idx}
              className={cn(
                "h-16 rounded-2xl flex flex-col items-center justify-center font-mono text-xs border border-[#1E2227] transition-all relative overflow-hidden",
                isGoal && "bg-[#CDF22B]/20 border-[#CDF22B] text-[#CDF22B] font-bold",
                isTrap && "bg-[#1A1D24] border-[#3A404D] text-[#FAF6F3]/50",
                !isGoal && !isTrap && "bg-[#14171A]/40"
              )}
              style={!isGoal && !isTrap ? { backgroundColor: `rgba(205, 242, 43, ${intensity * 0.35})` } : {}}
            >
              {isAgent && (
                <div className="h-6 w-6 rounded-full bg-[#CDF22B] animate-pulse shadow-[0_0_16px_rgba(205,242,43,0.5)] flex items-center justify-center text-[#08090B] font-black text-[10px]">
                  AI
                </div>
              )}
              {isGoal && <span className="text-lg">🎯</span>}
              {isTrap && <span className="text-lg">🔥</span>}

              {!isGoal && !isTrap && !isAgent && (
                <span className="text-xs font-bold text-[#CDF22B] opacity-90">
                  {actionArrows[bestAction]}
                </span>
              )}

              <span className="absolute bottom-1 right-1 text-[8px] text-[#FAF6F3]/50 font-mono">
                {maxQ.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] font-mono text-[#FAF6F3]/50 text-center">
        Tile vectors indicate greedy action argmax Q(s, a). Neon lime glow represents state return confidence.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flagship Master ML Arena Component                                  */
/* ------------------------------------------------------------------ */

export function MLArenaTool() {
  const [activeParadigm, setActiveParadigm] = useState<MLParadigm>("regression");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("linear-regression");
  const [studioMode, setStudioMode] = useState<"dynamic-canvas" | "race" | "3d">("dynamic-canvas");
  const [infoTab, setInfoTab] = useState<"math" | "code" | "insights">("math");
  const [activePipelineStep, setActivePipelineStep] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const availableTopics = useMemo(() => {
    return ML_TOPICS.filter((t) => t.paradigm === activeParadigm);
  }, [activeParadigm]);

  const activeTopic = useMemo(() => {
    return ML_TOPICS.find((t) => t.id === selectedTopicId) || ML_TOPICS[0];
  }, [selectedTopicId]);

  useEffect(() => {
    setActivePipelineStep(0);
  }, [selectedTopicId]);

  useEffect(() => {
    if (availableTopics.length > 0 && !availableTopics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(availableTopics[0].id);
    }
  }, [activeParadigm, availableTopics, selectedTopicId]);

  const copyCode = () => {
    navigator.clipboard.writeText(activeTopic.pythonCode);
    setCopied(true);
    toast.success("NumPy from-scratch code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      {/* 🚀 Master Instrument Navigation Bar */}
      <div className="rounded-[32px] bg-[#08090B] border border-[#1E2227] p-5 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2227] pb-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CDF22B] text-[#08090B] shadow-[0_0_20px_rgba(205,242,43,0.35)]">
              <Brain className="h-6 w-6 stroke-[2.5]" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#FAF6F3]">
                Machine Learning Arena
              </h1>
            </div>
          </div>

          {/* 5 Disciplines Segment Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0C0E12] border border-[#1E2227] overflow-x-auto scrollbar-none">
            {[
              { id: "regression", label: "Regression", icon: TrendingUp },
              { id: "classification", label: "Classification", icon: Target },
              { id: "optimization", label: "Optimization", icon: Zap },
              { id: "unsupervised", label: "Unsupervised", icon: Network },
              { id: "reinforcement", label: "Reinforcement", icon: Gamepad2 },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveParadigm(p.id as MLParadigm)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95",
                  activeParadigm === p.id
                    ? "bg-[#CDF22B] text-[#08090B] shadow-[0_0_15px_rgba(205,242,43,0.3)] font-bold"
                    : "text-[#FAF6F3]/70 hover:text-[#FAF6F3] hover:bg-[#14171A]"
                )}
              >
                <p.icon className="h-3.5 w-3.5" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tactical Model Pills */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto scrollbar-none">
          <span className="text-xs font-mono font-bold text-[#FAF6F3]/50 uppercase shrink-0 mr-1">
            Algorithm:
          </span>
          {availableTopics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => setSelectedTopicId(topic.id)}
              className={cn(
                "rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-1.5",
                selectedTopicId === topic.id
                  ? "border-[#CDF22B] bg-[#CDF22B]/15 text-[#CDF22B] font-bold shadow-[0_0_10px_rgba(205,242,43,0.2)]"
                  : "border-[#1E2227] bg-[#0E1116] hover:bg-[#14171A] text-[#FAF6F3]/60 hover:text-[#FAF6F3] hover:border-[#CDF22B]/30"
              )}
            >
              <span>{topic.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 🌟 The Dual Master Stage: Interactive Visualizer & Mathematical Rigor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Stage: 60% Width Responsive Visualizer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl bg-[#08090B] border border-[#1E2227] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2227] pb-3">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0C0E12] border border-[#1E2227]">
                <button
                  type="button"
                  onClick={() => setStudioMode("dynamic-canvas")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    studioMode === "dynamic-canvas"
                      ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_15px_rgba(205,242,43,0.3)]"
                      : "text-[#FAF6F3]/60 hover:text-[#FAF6F3]"
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Dynamic Live Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode("race")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    studioMode === "race"
                      ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_15px_rgba(205,242,43,0.3)]"
                      : "text-[#FAF6F3]/60 hover:text-[#FAF6F3]"
                  )}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>4-Way Optimizer Race</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode("3d")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    studioMode === "3d"
                      ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_15px_rgba(205,242,43,0.3)]"
                      : "text-[#FAF6F3]/60 hover:text-[#FAF6F3]"
                  )}
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>3D Loss Surface</span>
                </button>
              </div>

              <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#CDF22B]/10 border border-[#CDF22B]/30 text-[#CDF22B] font-bold">
                {activeTopic.name}
              </span>
            </div>

            {studioMode === "dynamic-canvas" && (
              activeParadigm === "reinforcement" ? (
                <QLearningGridworld />
              ) : activeParadigm === "optimization" ? (
                <GradientDescentLab
                  topic={activeTopic}
                  activePipelineStep={activePipelineStep}
                  onStepChange={setActivePipelineStep}
                />
              ) : (
                <DynamicModelCanvas
                  topic={activeTopic}
                  activePipelineStep={activePipelineStep}
                  onStepChange={setActivePipelineStep}
                />
              )
            )}

            {studioMode === "race" && <OptimizationLossLab />}

            {studioMode === "3d" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#FAF6F3]">
                      {activeTopic.lossSurfaceName || "Optimization Loss Surface"}
                    </h4>
                    <p className="text-xs font-mono text-[#CDF22B] mt-0.5">
                      z = {activeTopic.lossSurface3d || "x^2 + y^2"}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#CDF22B]/10 border border-[#CDF22B]/30 text-[#CDF22B]">
                    DIRECTIONAL SHADERS
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-[#1E2227] bg-[#08090B] shadow-inner">
                  <Plot3D expr={activeTopic.lossSurface3d || "x^2 + y^2"} height={390} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#FAF6F3]/50 font-mono">
                  <span>• DRAG TO ORBIT • SCROLL TO SCALE • INSPECT CONVEXITY</span>
                  <span className="text-[#CDF22B] font-semibold">60 FPS WEBGL SHADERS</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Stage: 40% Width Mathematical Knowledge Base */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl bg-[#08090B] border border-[#1E2227] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E2227] pb-3">
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#0C0E12] border border-[#1E2227]">
                {[
                  { id: "math", label: "Derivations", icon: BookOpen },
                  { id: "code", label: "NumPy Code", icon: Code2 },
                  { id: "insights", label: "Theory", icon: Atom },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setInfoTab(t.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all",
                      infoTab === t.id
                        ? "bg-[#CDF22B] text-[#08090B] font-bold shadow-[0_0_12px_rgba(205,242,43,0.3)]"
                        : "text-[#FAF6F3]/60 hover:text-[#FAF6F3]"
                    )}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {infoTab === "code" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyCode}
                  className="h-7 text-xs gap-1.5 font-mono rounded-xl border-[#1E2227] bg-[#14171A] text-[#FAF6F3] hover:border-[#CDF22B]/40 hover:text-[#CDF22B]"
                >
                  {copied ? <Check className="h-3 w-3 text-[#CDF22B]" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>

            {infoTab === "math" && (
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-[#FAF6F3] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#CDF22B]" /> 1. Objective Loss Formulation:
                  </span>
                  <div className="p-3.5 rounded-2xl bg-[#040506] border border-[#1E2227] overflow-x-auto text-sm text-[#FAF6F3]">
                    <MathText tex={activeTopic.math.objective} display />
                  </div>
                  <p className="text-xs text-[#FAF6F3]/75 leading-relaxed">{activeTopic.math.objectiveExpl}</p>
                </div>

                {activeTopic.math.gradient && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[#FAF6F3] flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#CDF22B]" /> 2. Analytical Gradient Vector:
                    </span>
                    <div className="p-3.5 rounded-2xl bg-[#040506] border border-[#1E2227] overflow-x-auto text-sm text-[#FAF6F3]">
                      <MathText tex={activeTopic.math.gradient} display />
                    </div>
                    <p className="text-xs text-[#FAF6F3]/75 leading-relaxed">{activeTopic.math.gradientExpl}</p>
                  </div>
                )}

                {activeTopic.math.closedForm && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[#FAF6F3] flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#CDF22B]" /> 3. Closed-Form / Analytical Optimum:
                    </span>
                    <div className="p-3.5 rounded-2xl bg-[#040506] border border-[#1E2227] overflow-x-auto text-sm text-[#FAF6F3]">
                      <MathText tex={activeTopic.math.closedForm} display />
                    </div>
                    <p className="text-xs text-[#FAF6F3]/75 leading-relaxed">{activeTopic.math.closedFormExpl}</p>
                  </div>
                )}
              </div>
            )}

            {infoTab === "code" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#FAF6F3]/60 font-mono">
                  <span>Pure NumPy • Vectorized</span>
                  <span className="text-[#CDF22B] font-bold">No Black Box sklearn</span>
                </div>
                <pre className="p-4 rounded-2xl border border-[#1E2227] bg-[#040506] font-mono text-xs overflow-x-auto text-[#CDF22B] leading-relaxed max-h-[460px] shadow-inner text-left">
                  <code>{activeTopic.pythonCode}</code>
                </pre>
              </div>
            )}

            {infoTab === "insights" && (
              <div className="space-y-3 text-left">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FAF6F3]/50">
                  Mathematical Guarantees &amp; Assumptions:
                </h4>
                <ul className="space-y-2.5">
                  {activeTopic.math.keyPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#FAF6F3]/80 leading-relaxed">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#CDF22B]/15 text-[#CDF22B] font-mono text-[10px] font-bold border border-[#CDF22B]/30">
                        {idx + 1}
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
