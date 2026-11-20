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
  Cpu, ArrowUpRight, BarChart3, Atom
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & Comprehensive Model Explainer Definitions                  */
/* ------------------------------------------------------------------ */

export type MLParadigm = "regression" | "classification" | "optimization" | "unsupervised" | "reinforcement";

export interface ExplainerStep {
  stepNum: number;
  title: string;
  desc: string;
  mathFormula?: string;
  visualCue: string;
}

export interface MLTopic {
  id: string;
  name: string;
  paradigm: MLParadigm;
  badge: string;
  shortDesc: string;
  lossSurface3d?: string;
  lossSurfaceName?: string;
  explainerSteps: ExplainerStep[];
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
    name: "Linear Regression & OLS",
    paradigm: "regression",
    badge: "Supervised Learning",
    shortDesc: "Ordinary Least Squares minimizes residual sum of squares between predicted and true targets.",
    lossSurface3d: "(x - 1)^2 + 2*(y - 1)^2",
    lossSurfaceName: "Convex Quadratic MSE Loss Bowl",
    explainerSteps: [
      {
        stepNum: 1,
        title: "Random Parameter Initialization",
        desc: "The model starts with random initial slope (w) and bias (b). The line y = wx + b has not yet learned the dataset pattern.",
        mathFormula: "\\hat{y} = w x + b, \\quad w_0 \\sim \\mathcal{N}(0, 1)",
        visualCue: "Notice the tilted grey line cutting through empty space with huge errors."
      },
      {
        stepNum: 2,
        title: "Residual Error Vector Computation",
        desc: "For every single data point (x_i, y_i), compute the vertical distance between true target and prediction. Residual e_i = ŷ_i - y_i.",
        mathFormula: "e_i = \\hat{y}_i - y_i, \\quad J(w, b) = \\frac{1}{2m} \\sum_{i=1}^m e_i^2",
        visualCue: "Red dashed vertical lines appear, showing the residual errors pulling on the line."
      },
      {
        stepNum: 3,
        title: "Gradient Vector Calculus",
        desc: "Compute partial derivatives of MSE loss with respect to w and b. The gradient vector ∇J points toward the steepest error ascent.",
        mathFormula: "\\frac{\\partial J}{\\partial w} = \\frac{1}{m} \\sum (\\hat{y}_i - y_i) x_i, \\quad \\frac{\\partial J}{\\partial b} = \\frac{1}{m} \\sum (\\hat{y}_i - y_i)",
        visualCue: "The direction of adjustment is mathematically calculated from all residuals combined."
      },
      {
        stepNum: 4,
        title: "Gradient Descent Weight Update",
        desc: "Take a step opposite to the gradient scaled by learning rate α. The line rotates and translates closer to the optimal fit.",
        mathFormula: "w \\leftarrow w - \\alpha \\frac{\\partial J}{\\partial w}, \\quad b \\leftarrow b - \\alpha \\frac{\\partial J}{\\partial b}",
        visualCue: "Watch the green line pivot and slide into position, shrinking the red residual bars."
      },
      {
        stepNum: 5,
        title: "Global Convergence & Normal Equation",
        desc: "The convex quadratic loss bowl guarantees a single global minimum where ∇J = 0. The exact analytical solution is w* = (XᵀX)⁻¹Xᵀy.",
        mathFormula: "w^* = (X^T X)^{-1} X^T y \\quad \\Longrightarrow \\quad \\nabla_w J(w^*) = 0",
        visualCue: "Line locks into perfect least-squares fit with minimal sum of squared residuals."
      }
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
    """Linear Regression trained via Closed-Form Normal Equation and Gradient Descent."""
    def __init__(self, lr: float = 0.05, epochs: int = 200, fit_intercept: bool = True):
        self.lr = lr
        self.epochs = epochs
        self.fit_intercept = fit_intercept
        self.weights = None
        self.bias = 0.0

    def fit_normal_equation(self, X: np.ndarray, y: np.ndarray):
        if self.fit_intercept:
            X_b = np.hstack([np.ones((X.shape[0], 1)), X])
        else:
            X_b = X
        # Normal Equation: w* = (X^T X)^(-1) X^T y
        theta = np.linalg.pinv(X_b.T @ X_b) @ X_b.T @ y
        if self.fit_intercept:
            self.bias = theta[0]
            self.weights = theta[1:]
        else:
            self.weights = theta
        return self

    def fit_gradient_descent(self, X: np.ndarray, y: np.ndarray):
        m, d = X.shape
        self.weights = np.zeros(d)
        self.bias = 0.0
        for _ in range(self.epochs):
            y_pred = X @ self.weights + self.bias
            error = y_pred - y
            dw = (1.0 / m) * (X.T @ error)
            db = (1.0 / m) * np.sum(error)
            self.weights -= self.lr * dw
            self.bias -= self.lr * db
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return X @ self.weights + self.bias`
  },
  {
    id: "polynomial-regression",
    name: "Polynomial Regression & Overfitting",
    paradigm: "regression",
    badge: "Nonlinear Regression",
    shortDesc: "Projects features into higher-order powers to capture nonlinear curvature; demonstrates bias-variance tradeoff.",
    lossSurface3d: "(x^2 + y - 11)^2 / 30 + (x + y^2 - 7)^2 / 30",
    lossSurfaceName: "Himmelblau Multimodal Loss Surface",
    explainerSteps: [
      {
        stepNum: 1,
        title: "The Underfitting Limitation (Degree 1)",
        desc: "A linear model y = wx + b has high bias. When underlying data is curved, a straight line cannot capture the relationship.",
        mathFormula: "\\hat{y} = w_0 + w_1 x \\quad (\\text{High Bias / Underfitting})",
        visualCue: "Straight line cuts poorly through nonlinear data clusters."
      },
      {
        stepNum: 2,
        title: "Polynomial Basis Expansion",
        desc: "Transform single feature x into higher-order powers using Vandermonde matrix mapping: phi(x) = [1, x, x², x³, ..., x^d].",
        mathFormula: "\\Phi(x) = \\begin{bmatrix} 1 & x & x^2 & \\dots & x^d \\end{bmatrix}^T",
        visualCue: "Input dimension expands into a polynomial Hilbert space."
      },
      {
        stepNum: 3,
        title: "The Sweet Spot (Degree 3)",
        desc: "A cubic polynomial matches the true curvature of the physical system, minimizing both training error and test generalization error.",
        mathFormula: "\\hat{y} = w_0 + w_1 x + w_2 x^2 + w_3 x^3",
        visualCue: "Cyan curve smoothly wraps around all point groups without wild fluctuations."
      },
      {
        stepNum: 4,
        title: "Catastrophic Overfitting (Degree ≥ 6)",
        desc: "High degrees cause high variance. The curve bends aggressively to hit every noise point, producing severe Runge's phenomenon oscillations at edges!",
        mathFormula: "\\text{Variance} \\to \\infty, \\quad \\text{Runge's Phenomenon at } |x| \\to x_{\\max}",
        visualCue: "Curve violently oscillates up and down near borders."
      }
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

    def _transform(self, X: np.ndarray) -> np.ndarray:
        return np.hstack([X ** i for i in range(self.degree + 1)])

    def fit(self, X: np.ndarray, y: np.ndarray):
        Phi = self._transform(X)
        self.weights = np.linalg.pinv(Phi.T @ Phi) @ Phi.T @ y
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        Phi = self._transform(X)
        return Phi @ self.weights`
  },
  {
    id: "ridge-lasso",
    name: "Ridge (L2) & Lasso (L1) Regularization",
    paradigm: "regression",
    badge: "Regularization",
    shortDesc: "Constrains parameter magnitudes to prevent overfitting. Ridge shrinks smoothly; Lasso drives weights to exact zero.",
    lossSurface3d: "x^2 + y^2 + 0.8*abs(x) + 0.8*abs(y)",
    lossSurfaceName: "L1/L2 Penalized Loss Basin",
    explainerSteps: [
      {
        stepNum: 1,
        title: "The Problem of Weight Explosion",
        desc: "Without regularization, OLS models with correlated features inflate weight magnitudes to cancel out noise, resulting in fragile models.",
        mathFormula: "\\|w\\| \\to \\infty \\quad \\text{in ill-conditioned systems}",
        visualCue: "Unconstrained OLS line (dashed white) reacts excessively to outliers."
      },
      {
        stepNum: 2,
        title: "Ridge L2 Regularization (Weight Decay)",
        desc: "Ridge adds λ ||w||₂² penalty. The spherical constraint shrinks weight magnitudes proportionally without zeroing them out completely.",
        mathFormula: "J_{\\text{Ridge}}(w) = \\text{MSE} + \\frac{\\lambda}{2} \\sum_{j=1}^d w_j^2",
        visualCue: "Purple regularized line rotates toward horizontal, resisting noisy outliers."
      },
      {
        stepNum: 3,
        title: "Lasso L1 Regularization (Diamond Constraint)",
        desc: "Lasso adds λ ||w||₁ absolute value penalty. The diamond constraint has sharp vertices on the coordinate axes.",
        mathFormula: "J_{\\text{Lasso}}(w) = \\text{MSE} + \\lambda \\sum_{j=1}^d |w_j|",
        visualCue: "Loss contour intersects the L1 diamond exactly at a vertex where w_j = 0."
      },
      {
        stepNum: 4,
        title: "Exact Feature Selection (Sparsity)",
        desc: "As penalty parameter λ exceeds threshold, less informative weights snap to EXACTLY 0.000, performing automated feature selection!",
        mathFormula: "w_j = \\text{sign}(\\rho_j) \\max(0, |\\rho_j| - \\lambda)",
        visualCue: "Notice the coordinate snapping to zero as λ slider increases."
      }
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
    I = np.eye(d)
    return np.linalg.inv(X.T @ X + alpha * I) @ X.T @ y

def lasso_coordinate_descent(X: np.ndarray, y: np.ndarray, alpha: float = 0.1, max_iter: int = 1000) -> np.ndarray:
    n, d = X.shape
    w = np.zeros(d)
    for _ in range(max_iter):
        for j in range(d):
            X_j = X[:, j]
            y_pred = X @ w
            residual = y - y_pred + w[j] * X_j
            rho = X_j.T @ residual
            if rho < -alpha:
                w[j] = (rho + alpha) / (X_j.T @ X_j)
            elif rho > alpha:
                w[j] = (rho - alpha) / (X_j.T @ X_j)
            else:
                w[j] = 0.0 # Exact sparsity!
    return w`
  },

  /* ================= CLASSIFICATION ================= */
  {
    id: "logistic-regression",
    name: "Logistic Regression & Sigmoid",
    paradigm: "classification",
    badge: "Binary Classification",
    shortDesc: "Models class probability using the logistic sigmoid function with maximum likelihood estimation.",
    lossSurface3d: "-log(1 / (1 + exp(-x))) - log(1 - 1 / (1 + exp(-y)))",
    lossSurfaceName: "Cross-Entropy Convex Loss Surface",
    explainerSteps: [
      {
        stepNum: 1,
        title: "Computing the Linear Logit Score",
        desc: "Compute the linear combination z = w₁x₁ + w₂x₂ + b. z produces raw unconstrained values ranging from -∞ to +∞.",
        mathFormula: "z = \\mathbf{w}^T \\mathbf{x} + b \\in (-\\infty, +\\infty)",
        visualCue: "Points evaluate to positive or negative real scores based on position."
      },
      {
        stepNum: 2,
        title: "The Sigmoid Activation Function",
        desc: "Pass z through the logistic sigmoid curve σ(z) = 1 / (1 + e⁻ᶻ). This squashes any real score into a valid probability P ∈ (0, 1)!",
        mathFormula: "P(Y=1 \\mid \\mathbf{x}) = \\sigma(z) = \\frac{1}{1 + e^{-z}}",
        visualCue: "Continuous color gradient reflects class confidence from 0.0 (Amber) to 1.0 (Cyan)."
      },
      {
        stepNum: 3,
        title: "Binary Cross-Entropy Loss (Log-Loss)",
        desc: "Penalizes confident incorrect predictions with infinite loss! If true label is 1 and model predicts 0.01, loss surges exponentially.",
        mathFormula: "J(\\mathbf{w}) = -\\frac{1}{m} \\sum [y \\log(\\hat{y}) + (1-y) \\log(1-\\hat{y})]",
        visualCue: "Notice loss dropping as the boundary separates the two classes."
      },
      {
        stepNum: 4,
        title: "The P = 0.50 Decision Boundary",
        desc: "The decision boundary occurs exactly where z = 0, meaning σ(0) = 0.50. This creates an optimal hyperplane separating the classes.",
        mathFormula: "\\mathbf{w}^T \\mathbf{x} + b = 0 \\quad \\Longleftrightarrow \\quad P(Y=1) = 0.50",
        visualCue: "Cyan boundary line cleanly splits the feature space into two prediction regions."
      }
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
        self.lr = lr
        self.epochs = epochs
        self.w = None
        self.b = 0.0

    def _sigmoid(self, z: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(z, -250, 250)))

    def fit(self, X: np.ndarray, y: np.ndarray):
        m, d = X.shape
        self.w = np.zeros(d)
        for _ in range(self.epochs):
            z = X @ self.w + self.b
            y_hat = self._sigmoid(z)
            dw = (1.0 / m) * (X.T @ (y_hat - y))
            db = (1.0 / m) * np.sum(y_hat - y)
            self.w -= self.lr * dw
            self.b -= self.lr * db
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self._sigmoid(X @ self.w + self.b)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return (self.predict_proba(X) >= 0.5).astype(int)`
  },
  {
    id: "svm",
    name: "Support Vector Machines (SVM)",
    paradigm: "classification",
    badge: "Maximum Margin Classifier",
    shortDesc: "Constructs the optimal hyperplane that maximizes geometric margin to the nearest support vectors.",
    lossSurface3d: "0.5*(x^2 + y^2) + max(0, 1 - x*y)",
    lossSurfaceName: "SVM Hinge Loss Surface with Regularizer",
    explainerSteps: [
      {
        stepNum: 1,
        title: "The Problem with Arbitrary Hyperplanes",
        desc: "Many lines can separate two classes, but lines passing too close to data points have poor generalization and fail on new test data.",
        mathFormula: "y^{(i)}(\\mathbf{w}^T \\mathbf{x}^{(i)} + b) > 0 \\quad (\\text{Satisfied by many lines})",
        visualCue: "Arbitrary lines leave very narrow margins to nearby points."
      },
      {
        stepNum: 2,
        title: "Geometric Margin Maximization",
        desc: "SVM searches for the unique hyperplane that maximizes the geometric margin distance γ = 2 / ||w|| between positive and negative margin gutters.",
        mathFormula: "\\max_{\\mathbf{w}, b} \\frac{2}{\\|\\mathbf{w}\\|} \\quad \\Longleftrightarrow \\quad \\min_{\\mathbf{w}} \\frac{1}{2} \\|\\mathbf{w}\\|^2",
        visualCue: "Dashed margin gutters push outward until they hit the nearest data points."
      },
      {
        stepNum: 3,
        title: "Discovering Support Vectors",
        desc: "The entire hyperplane is determined exclusively by the closest points lying on the margin gutters! All other points can move without affecting the model.",
        mathFormula: "y^{(i)}(\\mathbf{w}^T \\mathbf{x}^{(i)} + b) = 1 \\quad \\Longrightarrow \\quad \\text{Active Support Vector}",
        visualCue: "Pulsing neon violet rings light up on the true Support Vectors!"
      },
      {
        stepNum: 4,
        title: "Soft Margin Slack Penalty (C)",
        desc: "In non-separable data, slack variables ξ_i allow controlled violations. Parameter C governs trade-off: high C forbids errors; low C widens margin.",
        mathFormula: "\\min \\frac{1}{2}\\|w\\|^2 + C \\sum \\xi_i, \\quad \\xi_i = \\max(0, 1 - y_i(w^T x_i + b))",
        visualCue: "Adjust C slider to watch margin gutters contract or expand."
      }
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

class LinearSVMHingeLoss:
    """Linear Support Vector Machine trained with Subgradient Descent."""
    def __init__(self, C: float = 1.0, lr: float = 0.001, epochs: int = 1000):
        self.C = C
        self.lr = lr
        self.epochs = epochs
        self.w = None
        self.b = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray):
        y_signed = np.where(y <= 0, -1, 1)
        m, d = X.shape
        self.w = np.zeros(d)
        for _ in range(self.epochs):
            for i in range(m):
                condition = y_signed[i] * (np.dot(X[i], self.w) + self.b) >= 1
                if condition:
                    self.w -= self.lr * (self.w / m)
                else:
                    self.w -= self.lr * (self.w / m - self.C * y_signed[i] * X[i])
                    self.b -= self.lr * (-self.C * y_signed[i])
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.sign(X @ self.w + self.b)`
  },
  {
    id: "decision-tree",
    name: "Decision Trees & Gini Impurity",
    paradigm: "classification",
    badge: "Tree-Based Models",
    shortDesc: "Recursively partitions feature space using greedy threshold splits that minimize node impurity.",
    lossSurface3d: "1 - (x^2 + y^2)",
    lossSurfaceName: "Impurity Reduction Paraboloid",
    explainerSteps: [
      {
        stepNum: 1,
        title: "Measuring Node Impurity (Gini)",
        desc: "Gini Impurity measures how mixed the labels are in a region. A completely pure node has Gini = 0; a 50/50 mix has Gini = 0.50.",
        mathFormula: "I_G(p) = 1 - \\sum_{k=1}^K p_k^2 = 1 - (p_0^2 + p_1^2)",
        visualCue: "Root node contains all points with mixed labels (Gini ≈ 0.48)."
      },
      {
        stepNum: 2,
        title: "Greedy Scanline Threshold Search",
        desc: "An imaginary scanline sweeps across feature X and Y, evaluating candidate splits to find the feature and threshold that maximizes Information Gain.",
        mathFormula: "\\Delta I_G = I_G(\\text{Parent}) - \\left[ \\frac{N_L}{N} I_G(L) + \\frac{N_R}{N} I_G(R) \\right]",
        visualCue: "Horizontal and vertical test cuts evaluate reduction in impurity."
      },
      {
        stepNum: 3,
        title: "First Orthogonal Partition Cut",
        desc: "The tree executes the best split (e.g. x ≤ 0). The 2D feature space is divided into two distinct sub-rectangles.",
        mathFormula: "\\text{Split: } x_1 \\le 0 \\implies D_{\\text{left}}, D_{\\text{right}}",
        visualCue: "Bold vertical split line slices the canvas in half."
      },
      {
        stepNum: 4,
        title: "Recursive Subdivision to Leaves",
        desc: "Each sub-region is split again recursively until maximum depth is reached or all leaves are pure.",
        mathFormula: "\\text{Leaf Prediction: } \\hat{y} = \\arg\\max_c \\sum_{i \\in \\text{Leaf}} \\mathbb{I}(y_i = c)",
        visualCue: "Feature space becomes an axis-aligned grid of colored decision regions."
      }
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

def gini_impurity(y: np.ndarray) -> float:
    if len(y) == 0:
        return 0.0
    _, counts = np.unique(y, return_counts=True)
    probs = counts / len(y)
    return 1.0 - np.sum(probs ** 2)

def best_split(X: np.ndarray, y: np.ndarray):
    best_gain = -1.0
    split_feat, split_thresh = None, None
    parent_gini = gini_impurity(y)
    m, d = X.shape
    for feat in range(d):
        thresholds = np.unique(X[:, feat])
        for t in thresholds:
            left_mask = X[:, feat] <= t
            y_left, y_right = y[left_mask], y[~left_mask]
            if len(y_left) == 0 or len(y_right) == 0:
                continue
            child_gini = (len(y_left)/m) * gini_impurity(y_left) + (len(y_right)/m) * gini_impurity(y_right)
            gain = parent_gini - child_gini
            if gain > best_gain:
                best_gain = gain
                split_feat = feat
                split_thresh = t
    return split_feat, split_thresh`
  },
  {
    id: "knn",
    name: "K-Nearest Neighbors (KNN)",
    paradigm: "classification",
    badge: "Instance-Based Learning",
    shortDesc: "Non-parametric lazy learner classifying query points by local majority vote among the K nearest neighbors.",
    lossSurface3d: "sqrt(x^2 + y^2)",
    lossSurfaceName: "Euclidean Distance Cone",
    explainerSteps: [
      {
        stepNum: 1,
        title: "Query Point Arrival",
        desc: "A new unclassified sample arrives at query coordinates (x_q, y_q). KNN stores all training data without an explicit training phase.",
        mathFormula: "\\mathbf{x}_q = (x_{\\text{probe}}, y_{\\text{probe}}) \\in \\mathbb{R}^2",
        visualCue: "Target reticle appears at probe location (you can drag it anywhere!)."
      },
      {
        stepNum: 2,
        title: "Distance Metric Matrix",
        desc: "Compute Euclidean distance d(x_q, x_i) from query point to EVERY training point in the entire dataset.",
        mathFormula: "d_2(\\mathbf{x}_q, \\mathbf{x}_i) = \\sqrt{(x_q - x_i)^2 + (y_q - y_i)^2}",
        visualCue: "Distance matrix calculated across all coordinates."
      },
      {
        stepNum: 3,
        title: "Expanding Radial Radar Ring",
        desc: "Sort distances in ascending order. Expand a radar pulse circle until it encloses the K nearest neighbors.",
        mathFormula: "N_K(\\mathbf{x}_q) = \\{ \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)}, \\dots, \\mathbf{x}_{(K)} \\}",
        visualCue: "Dashed radar circle expands to radius of K-th neighbor; laser lines connect to them."
      },
      {
        stepNum: 4,
        title: "Majority Voting & Posterior Probability",
        desc: "Count labels of the K neighbors. The class with the highest vote wins! Posterior probability is simply the vote fraction.",
        mathFormula: "P(Y=c \\mid \\mathbf{x}_q) = \\frac{1}{K} \\sum_{i \\in N_K(\\mathbf{x}_q)} \\mathbb{I}(y_i = c)",
        visualCue: "Live vote tally counts Amber vs Cyan neighbors and assigns prediction."
      }
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

class KNNClassifier:
    def __init__(self, k: int = 3):
        self.k = k
        self.X_train = None
        self.y_train = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        self.X_train = X
        self.y_train = y
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        predictions = []
        for x in X:
            distances = np.linalg.norm(self.X_train - x, axis=1)
            k_indices = np.argsort(distances)[:self.k]
            k_nearest_labels = self.y_train[k_indices]
            vals, counts = np.unique(k_nearest_labels, return_counts=True)
            predictions.append(vals[np.argmax(counts)])
        return np.array(predictions)`
  },

  /* ================= OPTIMIZATION ================= */
  {
    id: "adam-optimizer",
    name: "Adam, RMSProp & Momentum",
    paradigm: "optimization",
    badge: "Deep Learning Optimizer",
    shortDesc: "Combines Momentum (first moment) with RMSProp (second moment) and bias correction for robust convergence.",
    lossSurface3d: "log(1 + (1 - x)^2 + 10*(y - x^2)^2)/3",
    lossSurfaceName: "Rosenbrock Banana Optimization Canyon",
    explainerSteps: [
      {
        stepNum: 1,
        title: "The Failure of Vanilla SGD in Ravines",
        desc: "In elongated ravines, loss surface is steep along one axis and flat along another. SGD oscillates violently perpendicularly to the valley floor.",
        mathFormula: "\\mathbf{w}_{t+1} = \\mathbf{w}_t - \\alpha \\nabla J(\\mathbf{w}_t) \\quad (\\text{Severe Oscillation})",
        visualCue: "Red SGD particle bounces wildly back and forth across canyon walls."
      },
      {
        stepNum: 2,
        title: "Momentum: Velocity Accumulation",
        desc: "Momentum adds friction-damped velocity v_t. Perpendicular oscillations cancel out, while continuous forward gradients build speed down the canyon!",
        mathFormula: "v_t = \\beta_1 v_{t-1} + \\alpha g_t, \\quad w_{t+1} = w_t - v_t",
        visualCue: "Yellow Momentum particle dampens jitter and accelerates along the valley floor."
      },
      {
        stepNum: 3,
        title: "RMSProp: Adaptive Per-Parameter Scaling",
        desc: "RMSProp tracks exponential average of squared gradients s_t. Steep dimensions with large gradients are scaled down; flat dimensions are accelerated.",
        mathFormula: "s_t = \\beta_2 s_{t-1} + (1-\\beta_2)g_t^2, \\quad \\Delta w = -\\frac{\\alpha}{\\sqrt{s_t + \\epsilon}} g_t",
        visualCue: "Blue RMSProp particle navigates ravines smoothly without blowing up."
      },
      {
        stepNum: 4,
        title: "Adam: The Synthesis with Bias Correction",
        desc: "Adam combines Momentum (first moment m_t) + RMSProp (second moment v_t) with bias corrections m̂ and v̂ to prevent initial vanishing steps.",
        mathFormula: "w_{t+1} = w_t - \\frac{\\alpha}{\\sqrt{\\hat{v}_t} + \\epsilon} \\hat{m}_t",
        visualCue: "Green Adam particle glides swiftly and directly to global minimum (1, 1)!"
      }
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

class AdamOptimizer:
    def __init__(self, lr: float = 0.001, beta1: float = 0.9, beta2: float = 0.999, eps: float = 1e-8):
        self.lr = lr
        self.beta1 = beta1
        self.beta2 = beta2
        self.eps = eps
        self.m = None
        self.v = None
        self.t = 0

    def step(self, theta: np.ndarray, grad: np.ndarray) -> np.ndarray:
        if self.m is None:
            self.m = np.zeros_like(theta)
            self.v = np.zeros_like(theta)
        self.t += 1
        self.m = self.beta1 * self.m + (1.0 - self.beta1) * grad
        self.v = self.beta2 * self.v + (1.0 - self.beta2) * (grad ** 2)
        m_hat = self.m / (1.0 - self.beta1 ** self.t)
        v_hat = self.v / (1.0 - self.beta2 ** self.t)
        return theta - self.lr * m_hat / (np.sqrt(v_hat) + self.eps)`
  },

  /* ================= UNSUPERVISED ================= */
  {
    id: "kmeans",
    name: "K-Means Clustering",
    paradigm: "unsupervised",
    badge: "Clustering",
    shortDesc: "Partitions n observations into k clusters by alternating assignment and centroid update steps.",
    lossSurface3d: "sin(x)*cos(y)",
    lossSurfaceName: "Multimodal Periodic Cluster Potential",
    explainerSteps: [
      {
        stepNum: 1,
        title: "Centroid Initialization",
        desc: "Initialize K cluster centroids randomly across the feature space (or via K-Means++ to maximize distance between starting points).",
        mathFormula: "\\mu_1, \\mu_2, \\dots, \\mu_K \\in \\mathbb{R}^d \\quad (\\text{Random Seed})",
        visualCue: "K large glowing circles appear at arbitrary coordinates."
      },
      {
        stepNum: 2,
        title: "Voronoi Assignment Phase",
        desc: "Each data point computes its Euclidean distance to all K centroids and assigns itself to the nearest centroid.",
        mathFormula: "c^{(i)} = \\arg\\min_k \\|x^{(i)} - \\mu_k\\|^2",
        visualCue: "Points instantly change colors matching their closest centroid."
      },
      {
        stepNum: 3,
        title: "Center of Mass Update Phase",
        desc: "Each centroid moves to the exact mathematical mean (center of mass) of all data points currently assigned to it.",
        mathFormula: "\\mu_k = \\frac{1}{|C_k|} \\sum_{i \\in C_k} x^{(i)}",
        visualCue: "Centroids smoothly glide across canvas to their cluster centers."
      },
      {
        stepNum: 4,
        title: "Convergence & Inertia Minimization",
        desc: "Repeat assignment and update until centroid coordinates stabilize. Within-Cluster Sum of Squares (Inertia) reaches local minimum.",
        mathFormula: "J(\\mu) = \\sum_{k=1}^K \\sum_{i \\in C_k} \\|x^{(i)} - \\mu_k\\|^2 \\to \\min",
        visualCue: "Centroids lock into place; Voronoi partitions reach final equilibrium."
      }
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

class KMeansFromScratch:
    def __init__(self, k: int = 3, max_iter: int = 100):
        self.k = k
        self.max_iter = max_iter
        self.centroids = None

    def fit(self, X: np.ndarray):
        idx = np.random.choice(len(X), self.k, replace=False)
        self.centroids = X[idx]
        for _ in range(self.max_iter):
            distances = np.linalg.norm(X[:, None] - self.centroids, axis=2)
            labels = np.argmin(distances, axis=1)
            new_centroids = np.array([X[labels == k].mean(axis=0) if np.any(labels == k) 
                                      else self.centroids[k] for k in range(self.k)])
            if np.allclose(self.centroids, new_centroids):
                break
            self.centroids = new_centroids
        return self`
  },
  {
    id: "pca",
    name: "Principal Component Analysis (PCA)",
    paradigm: "unsupervised",
    badge: "Dimensionality Reduction",
    shortDesc: "Projects high-dimensional data onto orthogonal axes of maximum variance via eigendecomposition.",
    lossSurface3d: "2*x^2 + 0.5*y^2",
    lossSurfaceName: "Ellipsoidal Covariance Energy Basin",
    explainerSteps: [
      {
        stepNum: 1,
        title: "Zero-Mean Data Centering",
        desc: "Subtract the empirical mean vector μ from every data point so that the scatter cloud is perfectly centered at origin (0, 0).",
        mathFormula: "\\tilde{\\mathbf{x}} = \\mathbf{x} - \\frac{1}{m}\\sum_{i=1}^m \\mathbf{x}^{(i)}",
        visualCue: "Scatter cloud shifts to coordinate origin."
      },
      {
        stepNum: 2,
        title: "Sample Covariance Matrix Σ",
        desc: "Compute covariance matrix Σ = (1/m) X̃ᵀX̃. Diagonal elements represent feature variance; off-diagonals represent cross-feature correlation.",
        mathFormula: "\\Sigma = \\frac{1}{m} \\tilde{X}^T \\tilde{X} = \\begin{bmatrix} \\text{Var}(x_1) & \\text{Cov}(x_1, x_2) \\\\ \\text{Cov}(x_1, x_2) & \\text{Var}(x_2) \\end{bmatrix}",
        visualCue: "Captures the direction of maximum dispersion in data."
      },
      {
        stepNum: 3,
        title: "Eigendecomposition & Principal Axes",
        desc: "Solve characteristic equation Σ v = λ v. The eigenvector v₁ with largest eigenvalue λ₁ is PC1 (maximum variance axis); v₂ is orthogonal PC2.",
        mathFormula: "\\Sigma \\mathbf{v}_1 = \\lambda_1 \\mathbf{v}_1, \\quad \\mathbf{v}_1^T \\mathbf{v}_2 = 0",
        visualCue: "Green axis (PC1) rotates to line up with maximum data spread; blue axis (PC2) is perpendicular."
      },
      {
        stepNum: 4,
        title: "Orthogonal Projection (2D → 1D)",
        desc: "Drop perpendicular orthogonal projections from 2D points onto PC1. Data dimension is compressed from 2D to 1D with 86%+ variance preserved!",
        mathFormula: "z_i = \\mathbf{x}_i^T \\mathbf{v}_1 \\in \\mathbb{R}^1",
        visualCue: "White dashed projection lines drop points directly onto the PC1 axis."
      }
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

class PCAFromScratch:
    def __init__(self, n_components: int = 2):
        self.n_components = n_components
        self.components = None
        self.mean = None

    def fit(self, X: np.ndarray):
        self.mean = np.mean(X, axis=0)
        X_centered = X - self.mean
        cov = np.cov(X_centered, rowvar=False)
        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        idx = np.argsort(eigenvalues)[::-1]
        self.components = eigenvectors[:, idx[:self.n_components]]
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        return (X - self.mean) @ self.components`
  },

  /* ================= REINFORCEMENT LEARNING ================= */
  {
    id: "q-learning",
    name: "Q-Learning & Bellman Equation",
    paradigm: "reinforcement",
    badge: "Model-Free RL",
    shortDesc: "Off-policy temporal difference algorithm that learns optimal action-value functions through environment interaction.",
    lossSurface3d: "(x^2 - 4)^2 / 8 + y^2 / 2",
    lossSurfaceName: "Double-Well Value Function Basin",
    explainerSteps: [
      {
        stepNum: 1,
        title: "State & Action Space Observation",
        desc: "Agent observes current discrete state s = (r, c) on the 5x5 grid. There are 4 possible actions: Up, Down, Left, Right.",
        mathFormula: "s \\in \\mathcal{S} = \\{0, \\dots, 24\\}, \\quad a \\in \\mathcal{A} = \\{\\uparrow, \\downarrow, \\leftarrow, \\rightarrow\\}",
        visualCue: "Agent AI starts at top-left [0, 0] with Target at [4, 4] and Lava Traps in between."
      },
      {
        stepNum: 2,
        title: "Epsilon-Greedy Action Selection",
        desc: "Balances exploration vs exploitation: with probability ε, pick random action (discover paths); with 1-ε, pick action with highest Q(s, a).",
        mathFormula: "a = \\begin{cases} \\text{random action} & \\text{with prob } \\epsilon \\\\ \\arg\\max_{a'} Q(s, a') & \\text{with prob } 1 - \\epsilon \\end{cases}",
        visualCue: "Arrows in each grid cell show current greedy policy argmax Q(s, a)."
      },
      {
        stepNum: 3,
        title: "Environment Step & Reward Signal",
        desc: "Execute action a, transition to state s', and observe scalar reward R (+10 for Target 🎯, -10 for Lava 🔥, -0.1 for step cost).",
        mathFormula: "R = \\begin{cases} +10 & \\text{if Target reached} \\\\ -10 & \\text{if Lava Trap hit} \\\\ -0.1 & \\text{per motion step} \\end{cases}",
        visualCue: "Agent steps onto new tile, triggering positive or negative reward signal."
      },
      {
        stepNum: 4,
        title: "Bellman Optimality Temporal Difference Update",
        desc: "Update Q-table value toward the Bellman target (immediate reward + discounted maximum future reward). Q values propagate backward!",
        mathFormula: "Q(s, a) \\leftarrow Q(s, a) + \\alpha \\left[ R + \\gamma \\max_{a'} Q(s', a') - Q(s, a) \\right]",
        visualCue: "Cyan heat intensity scales as states learn the shortest safe path to goal."
      }
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
    def __init__(self, n_states: int, n_actions: int, lr: float = 0.1, gamma: float = 0.95, epsilon: float = 0.2):
        self.q_table = np.zeros((n_states, n_actions))
        self.lr = lr
        self.gamma = gamma
        self.epsilon = epsilon
        self.n_actions = n_actions

    def choose_action(self, state: int) -> int:
        if np.random.rand() < self.epsilon:
            return np.random.choice(self.n_actions) # Explore
        return np.argmax(self.q_table[state])       # Exploit

    def update(self, s: int, a: int, r: float, s_prime: int):
        best_future_q = np.max(self.q_table[s_prime])
        td_target = r + self.gamma * best_future_q
        td_error = td_target - self.q_table[s, a]
        self.q_table[s, a] += self.lr * td_error`
  }
];

/* ------------------------------------------------------------------ */
/* Interactive Guided Model Canvas                                    */
/* ------------------------------------------------------------------ */

interface Point2D {
  x: number;
  y: number;
  label?: number;
}

export function GuidedModelVisualizer({
  topic,
  activeStepIdx,
  onStepChange,
}: {
  topic: MLTopic;
  activeStepIdx: number;
  onStepChange: (idx: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Hyperparameters
  const [degree, setDegree] = useState(3);
  const [lambda, setLambda] = useState(1.5);
  const [svmC, setSvmC] = useState(2.0);
  const [knnK, setKnnK] = useState(3);
  const [treeDepth, setTreeDepth] = useState(2);
  const [kmeansK, setKmeansK] = useState(3);

  // Probe point for KNN
  const [probePos, setProbePos] = useState({ x: 0.6, y: 0.8 });
  const isDragging = useRef(false);

  // Default clean data
  const [points, setPoints] = useState<Point2D[]>([
    { x: -3.5, y: -2.0, label: 0 },
    { x: -2.6, y: -1.2, label: 0 },
    { x: -1.8, y: -0.4, label: 0 },
    { x: -1.0, y: -0.1, label: 0 },
    { x: -0.4, y: 0.8, label: 1 },
    { x: 0.5, y: 1.0, label: 1 },
    { x: 1.4, y: 1.9, label: 1 },
    { x: 2.3, y: 2.2, label: 1 },
    { x: 3.2, y: 3.1, label: 1 },
    { x: 1.9, y: -1.4, label: 0 },
    { x: -1.9, y: 1.8, label: 1 },
    { x: 1.2, y: -0.9, label: 0 },
  ]);

  const stepInfo = topic.explainerSteps[activeStepIdx] || topic.explainerSteps[0];

  // Mouse drag handling
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;

    if (topic.id === "knn") {
      isDragging.current = true;
      setProbePos({ x: mathX, y: mathY });
    } else {
      setPoints((prev) => [...prev, { x: mathX, y: mathY, label: mathY >= 0 ? 1 : 0 }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || topic.id !== "knn") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;
    setProbePos({ x: mathX, y: mathY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Canvas Drawing Routine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 560;
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

    // Background
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
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

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // ----------------------------------------------------------------
    // Model Visuals Tied Directly to Explainer Steps
    // ----------------------------------------------------------------

    if (topic.id === "linear-regression") {
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      points.forEach((p) => {
        sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y;
      });
      const n = points.length || 1;
      const trueSlope = (n * sxy - sx * sy) / Math.max(n * sxx - sx * sx, 1e-6);
      const trueIntercept = (sy - trueSlope * sx) / n;

      // Step-dependent line parameters
      let lineSlope = 0.1;
      let lineIntercept = -1.8;
      let showResiduals = false;
      let showGradientArrow = false;

      if (activeStepIdx === 0) {
        // Step 1: Initial line
        lineSlope = -0.2;
        lineIntercept = 1.5;
      } else if (activeStepIdx === 1) {
        // Step 2: Residuals highlighted
        lineSlope = 0.2;
        lineIntercept = -1.0;
        showResiduals = true;
      } else if (activeStepIdx === 2) {
        // Step 3: Gradient vector
        lineSlope = 0.4;
        lineIntercept = -0.5;
        showResiduals = true;
        showGradientArrow = true;
      } else if (activeStepIdx === 3) {
        // Step 4: Descending gradient
        lineSlope = trueSlope * 0.75;
        lineIntercept = trueIntercept * 0.75;
        showResiduals = true;
      } else {
        // Step 5: Converged
        lineSlope = trueSlope;
        lineIntercept = trueIntercept;
      }

      // Draw Residuals
      if (showResiduals) {
        ctx.strokeStyle = "rgba(244, 63, 94, 0.75)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        points.forEach((p) => {
          const predY = lineSlope * p.x + lineIntercept;
          ctx.beginPath();
          ctx.moveTo(cx + p.x * scale, cy - p.y * scale);
          ctx.lineTo(cx + p.x * scale, cy - predY * scale);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // Draw Regression Line
      ctx.strokeStyle = activeStepIdx >= 4 ? "#10b981" : activeStepIdx === 0 ? "#94a3b8" : "#06b6d4";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const x1 = -5, y1 = lineSlope * x1 + lineIntercept;
      const x2 = 5, y2 = lineSlope * x2 + lineIntercept;
      ctx.moveTo(cx + x1 * scale, cy - y1 * scale);
      ctx.lineTo(cx + x2 * scale, cy - y2 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Gradient Arrow if step 3
      if (showGradientArrow) {
        ctx.strokeStyle = "#eab308";
        ctx.fillStyle = "#eab308";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 1.8 * scale, cy - 2.2 * scale);
        ctx.stroke();
        ctx.fillText("-∇J (Descent Vector)", cx + 1.2 * scale, cy - 2.4 * scale);
      }

    } else if (topic.id === "polynomial-regression") {
      const d = activeStepIdx === 0 ? 1 : activeStepIdx === 1 ? 2 : activeStepIdx === 2 ? 3 : degree;
      ctx.strokeStyle = d >= 6 ? "#f43f5e" : "#06b6d4";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let px = 0; px <= w; px += 2) {
        const xVal = (px - cx) / scale;
        let yVal = 0;
        if (d === 1) yVal = 0.5 * xVal;
        else if (d === 2) yVal = 0.25 * xVal * xVal + 0.3 * xVal - 1.2;
        else if (d === 3) yVal = 0.12 * Math.pow(xVal, 3) + 0.3 * xVal;
        else {
          // Overfitting oscillation
          yVal = 0.08 * Math.pow(xVal, d) + Math.sin(xVal * 3) * 1.5;
        }
        const py = cy - yVal * scale;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

    } else if (topic.id === "ridge-lasso") {
      // Unconstrained OLS Line (dashed)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 4.2 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 4.2 * scale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Regularized Line
      const isLasso = activeStepIdx >= 2;
      const shrink = isLasso && lambda > 3 ? 0 : 0.8 / (1 + lambda * 0.4);
      ctx.strokeStyle = isLasso ? "#ec4899" : "#8b5cf6";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 5 * shrink * scale);
      ctx.lineTo(cx + 5 * scale, cy - 5 * shrink * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

    } else if (topic.id === "logistic-regression") {
      // Sigmoid decision boundary
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.2 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3.2 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Probability regions
      ctx.fillStyle = "rgba(6, 182, 212, 0.1)";
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.2 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3.2 * scale);
      ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(245, 158, 11, 0.1)";
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.2 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3.2 * scale);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fill();

    } else if (topic.id === "svm") {
      const margin = (1.3 / Math.sqrt(svmC)) * scale;

      // Hyperplane
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.6 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3.6 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Margins
      ctx.strokeStyle = "rgba(139, 92, 246, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.6 * scale - margin);
      ctx.lineTo(cx + 5 * scale, cy - 3.6 * scale - margin);
      ctx.moveTo(cx - 5 * scale, cy + 3.6 * scale + margin);
      ctx.lineTo(cx + 5 * scale, cy - 3.6 * scale + margin);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pulsing Support Vectors
      if (activeStepIdx >= 2) {
        points.slice(2, 6).forEach((sv) => {
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx + sv.x * scale, cy - sv.y * scale, 12, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

    } else if (topic.id === "decision-tree") {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      // Split 1
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
      ctx.stroke();

      // Split 2
      if (treeDepth >= 2 || activeStepIdx >= 2) {
        ctx.strokeStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(cx, cy - 1 * scale); ctx.lineTo(w, cy - 1 * scale);
        ctx.stroke();
      }

    } else if (topic.id === "knn") {
      const probePx = cx + probePos.x * scale;
      const probePy = cy - probePos.y * scale;

      const sorted = points
        .map((p) => ({ ...p, dist: Math.hypot(p.x - probePos.x, p.y - probePos.y) }))
        .sort((a, b) => a.dist - b.dist);

      const kNearest = sorted.slice(0, knnK);
      const maxKDist = kNearest[kNearest.length - 1]?.dist || 1;

      // Radar pulse
      ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(probePx, probePy, maxKDist * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Laser ties
      kNearest.forEach((nb) => {
        ctx.strokeStyle = nb.label === 1 ? "rgba(6, 182, 212, 0.8)" : "rgba(245, 158, 11, 0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(probePx, probePy);
        ctx.lineTo(cx + nb.x * scale, cy - nb.y * scale);
        ctx.stroke();
      });

      // Target reticle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(probePx, probePy, 7, 0, Math.PI * 2);
      ctx.fill();

    } else if (topic.id === "kmeans") {
      const centroids = [
        { x: -2.0, y: -1.5, color: "#10b981" },
        { x: 1.8, y: 1.8, color: "#06b6d4" },
        { x: -0.5, y: 1.6, color: "#8b5cf6" },
      ];

      centroids.slice(0, kmeansK).forEach((c) => {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(cx + c.x * scale, cy - c.y * scale, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });

    } else if (topic.id === "pca") {
      // PC1 (green)
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 4.5 * scale, cy + 4.5 * 0.8 * scale);
      ctx.lineTo(cx + 4.5 * scale, cy - 4.5 * 0.8 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // PC2 (blue)
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 2.5 * scale, cy - 2.5 * 1.25 * scale);
      ctx.lineTo(cx + 2.5 * scale, cy + 2.5 * 1.25 * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Render Data Points
    points.forEach((p) => {
      ctx.fillStyle = p.label === 1 ? "#06b6d4" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(cx + p.x * scale, cy - p.y * scale, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.restore();
  }, [points, topic, activeStepIdx, degree, lambda, svmC, knnK, treeDepth, kmeansK, probePos]);

  return (
    <div className="space-y-4">
      {/* 🎬 Floating Cyber Explainer Card */}
      <div className="rounded-3xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950/80 p-5 shadow-2xl space-y-3 relative overflow-hidden backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500 text-white font-black text-xs shadow-md shadow-indigo-500/30">
              {stepInfo.stepNum}
            </span>
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
              Step {stepInfo.stepNum} of {topic.explainerSteps.length}: {stepInfo.title}
            </span>
          </div>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={activeStepIdx === 0}
              onClick={() => onStepChange(Math.max(0, activeStepIdx - 1))}
              className="h-7 px-2.5 text-xs font-mono rounded-xl border-border/70"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </Button>
            <Button
              size="sm"
              disabled={activeStepIdx >= topic.explainerSteps.length - 1}
              onClick={() => onStepChange(Math.min(topic.explainerSteps.length - 1, activeStepIdx + 1))}
              className="h-7 px-3 text-xs font-mono rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
            >
              Next <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <p className="text-sm text-foreground/90 leading-relaxed font-sans font-medium">
          {stepInfo.desc}
        </p>

        {stepInfo.mathFormula && (
          <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 overflow-x-auto text-xs font-mono text-cyan-300">
            <MathText tex={stepInfo.mathFormula} />
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Visual Signal: {stepInfo.visualCue}</span>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div className="relative rounded-3xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full cursor-crosshair block"
        />
        <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded-md bg-black/70 border border-white/10 text-muted-foreground">
          Click canvas to add points • Drag probe in KNN
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 4-Way Optimizer Race Lab (2D Contour Simulation)               */
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
    { name: "SGD", color: "#ef4444", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "Momentum", color: "#eab308", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "RMSProp", color: "#3b82f6", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "Adam", color: "#10b981", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
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
      { name: "SGD", color: "#ef4444", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
      { name: "Momentum", color: "#eab308", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
      { name: "RMSProp", color: "#3b82f6", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
      { name: "Adam", color: "#10b981", x: startX, y: startY, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [{ x: startX, y: startY }] },
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

    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, w, h);

    // Contours
    const levels = [0.1, 0.4, 1.0, 2.5, 5.0, 10.0, 20.0, 40.0];
    levels.forEach((lvl, idx) => {
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.12 + idx * 0.04})`;
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

    // Target minimum
    const targetX = lossFunc === "rosenbrock" ? 1 : 0;
    const targetY = lossFunc === "rosenbrock" ? 1 : 0;
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(cx + targetX * scale, cy - targetY * scale, 6, 0, Math.PI * 2);
    ctx.fill();

    // Paths
    particles.forEach((p) => {
      if (p.path.length < 2) return;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-muted/20 border border-border/50 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground font-semibold">Landscape:</span>
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
                  ? "bg-indigo-600 text-white font-bold shadow-xs"
                  : "bg-background/60 text-muted-foreground hover:bg-muted"
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
            className="h-8 text-xs gap-1.5 font-mono"
            onClick={() => setIsRacing(!isRacing)}
          >
            {isRacing ? <Pause className="h-3 w-3 text-amber-400" /> : <Play className="h-3 w-3 text-emerald-400" />}
            {isRacing ? "Pause Race" : "Start Race"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 font-mono" onClick={resetRace}>
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} className="w-full block" />
        <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded-md bg-black/70 border border-white/10 text-muted-foreground">
          Step: {stepCount} • Target: 🎯 (Global Minimum)
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
        {particles.map((p) => {
          const { loss } = computeLossAndGrad(p.x, p.y);
          return (
            <div
              key={p.name}
              className="p-3 rounded-2xl border border-white/10 bg-slate-950/80 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5" style={{ color: p.color }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <span className="text-[10px] text-muted-foreground">t = {p.t}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Loss: <span className="text-foreground font-bold">{loss.toFixed(4)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
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
/* 3. Tabular Q-Learning 5x5 Gridworld Simulation                     */
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
          <span className="text-cyan-400 font-bold">Episodes: {episodes}</span>
          <span className="text-muted-foreground">• Cumulative Reward: {totalReward.toFixed(1)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 font-mono"
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? <Pause className="h-3 w-3 text-amber-400" /> : <Play className="h-3 w-3 text-emerald-400" />}
            {isRunning ? "Pause" : "Auto-Explore"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs font-mono" onClick={stepAgent}>
            Step
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 p-4 rounded-3xl border border-white/10 bg-slate-950 max-w-md mx-auto shadow-2xl">
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
                "h-16 rounded-2xl flex flex-col items-center justify-center font-mono text-xs border border-white/10 transition-all relative overflow-hidden",
                isGoal && "bg-emerald-500/30 border-emerald-500 text-emerald-400 font-bold",
                isTrap && "bg-rose-500/30 border-rose-500 text-rose-400",
                !isGoal && !isTrap && "bg-white/5"
              )}
              style={!isGoal && !isTrap ? { backgroundColor: `rgba(6, 182, 212, ${intensity * 0.35})` } : {}}
            >
              {isAgent && (
                <div className="h-6 w-6 rounded-full bg-cyan-400 animate-pulse shadow-lg flex items-center justify-center text-slate-950 font-black text-[10px]">
                  AI
                </div>
              )}
              {isGoal && <span className="text-lg">🎯</span>}
              {isTrap && <span className="text-lg">🔥</span>}

              {!isGoal && !isTrap && !isAgent && (
                <span className="text-xs font-bold text-cyan-300 opacity-80">
                  {actionArrows[bestAction]}
                </span>
              )}

              <span className="absolute bottom-1 right-1 text-[8px] opacity-50 font-mono">
                {maxQ.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] font-mono text-muted-foreground text-center">
        Arrows indicate greedy policy argmax Q(s, a). Cyan glow scales with state confidence.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Flagship Master Studio Layout (Organized & Intuitive)           */
/* ------------------------------------------------------------------ */

export function MLArenaTool() {
  const [activeParadigm, setActiveParadigm] = useState<MLParadigm>("regression");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("linear-regression");
  const [studioMode, setStudioMode] = useState<"explainer" | "race" | "3d">("explainer");
  const [infoTab, setInfoTab] = useState<"math" | "code" | "insights">("math");
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const availableTopics = useMemo(() => {
    return ML_TOPICS.filter((t) => t.paradigm === activeParadigm);
  }, [activeParadigm]);

  const activeTopic = useMemo(() => {
    return ML_TOPICS.find((t) => t.id === selectedTopicId) || ML_TOPICS[0];
  }, [selectedTopicId]);

  // Reset step index when topic changes
  useEffect(() => {
    setActiveStepIdx(0);
  }, [selectedTopicId]);

  // Sync topic when paradigm switches
  useEffect(() => {
    if (availableTopics.length > 0 && !availableTopics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(availableTopics[0].id);
    }
  }, [activeParadigm, availableTopics, selectedTopicId]);

  const copyCode = () => {
    navigator.clipboard.writeText(activeTopic.pythonCode);
    setCopied(true);
    toast.success("NumPy from-scratch code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-6">
      {/* 🚀 Top Flagship Control Bar */}
      <div className="rounded-[32px] glass-panel border border-indigo-500/30 p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-xl shadow-indigo-500/30">
              <Brain className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold uppercase tracking-wider">
                  Interactive Lab
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">• 100% Client-Side Engine</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">Machine Learning Arena</h1>
            </div>
          </div>

          {/* 5 ML Disciplines Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/60 overflow-x-auto scrollbar-none">
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
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 active:scale-95",
                  activeParadigm === p.id
                    ? "bg-indigo-600 text-white shadow-md font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <p.icon className="h-3.5 w-3.5" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Pills for Models under Active Paradigm */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto scrollbar-none">
          <span className="text-xs font-mono font-bold text-muted-foreground uppercase shrink-0 mr-1">
            Models:
          </span>
          {availableTopics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => setSelectedTopicId(topic.id)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-1.5",
                selectedTopicId === topic.id
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 font-bold shadow-xs"
                  : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{topic.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 🌟 The Dual Interactive Stage: Visualizer (Left) & Mathematical Code (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Explainer Studio (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl glass-panel border border-border/70 p-5 shadow-2xl space-y-4">
            {/* View Switcher Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/60">
                <button
                  type="button"
                  onClick={() => setStudioMode("explainer")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    studioMode === "explainer"
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  <span>How It Works (Animated)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode("race")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    studioMode === "race"
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span>4-Way Optimizer Race</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioMode("3d")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    studioMode === "3d"
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Compass className="h-3.5 w-3.5 text-emerald-400" />
                  <span>3D Loss Surface</span>
                </button>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold">
                {activeTopic.name}
              </span>
            </div>

            {/* View 1: Guided Explainer */}
            {studioMode === "explainer" && (
              activeParadigm === "reinforcement" ? (
                <QLearningGridworld />
              ) : (
                <GuidedModelVisualizer
                  topic={activeTopic}
                  activeStepIdx={activeStepIdx}
                  onStepChange={setActiveStepIdx}
                />
              )
            )}

            {/* View 2: Optimizer Race */}
            {studioMode === "race" && <OptimizationLossLab />}

            {/* View 3: 3D Surface */}
            {studioMode === "3d" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      {activeTopic.lossSurfaceName || "Optimization Loss Surface"}
                    </h4>
                    <p className="text-xs font-mono text-cyan-400 mt-0.5">
                      z = {activeTopic.lossSurface3d || "x^2 + y^2"}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    SURFACE NORMALS
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border/60 bg-black/40 shadow-inner">
                  <Plot3D expr={activeTopic.lossSurface3d || "x^2 + y^2"} height={390} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>• DRAG TO ORBIT • SCROLL TO SCALE • INSPECT LOCAL MINIMA</span>
                  <span className="text-cyan-400 font-semibold">60 FPS REAL-TIME CANVAS</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Mathematics, Insights & NumPy Implementation (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl glass-panel border border-border/70 p-5 shadow-2xl space-y-4">
            {/* Header Tabs for Info Column */}
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/60">
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
                        ? "bg-foreground text-background font-bold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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
                  className="h-7 text-xs gap-1.5 font-mono rounded-xl"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>

            {/* Tab 1: Mathematical Derivations */}
            {infoTab === "math" && (
              <div className="space-y-4 text-left">
                {/* Objective Function */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" /> 1. Objective Loss Formulation:
                  </span>
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 overflow-x-auto text-sm text-cyan-300">
                    <MathText tex={activeTopic.math.objective} display />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{activeTopic.math.objectiveExpl}</p>
                </div>

                {/* Analytical Gradient */}
                {activeTopic.math.gradient && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" /> 2. Analytical Gradient Vector:
                    </span>
                    <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 overflow-x-auto text-sm text-amber-300">
                      <MathText tex={activeTopic.math.gradient} display />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{activeTopic.math.gradientExpl}</p>
                  </div>
                )}

                {/* Closed Form Solution */}
                {activeTopic.math.closedForm && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 3. Closed-Form / Analytical Optimum:
                    </span>
                    <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 overflow-x-auto text-sm text-emerald-300">
                      <MathText tex={activeTopic.math.closedForm} display />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{activeTopic.math.closedFormExpl}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Vectorized Python & NumPy Code */}
            {infoTab === "code" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span>Pure NumPy • From-Scratch</span>
                  <span className="text-emerald-400 font-bold">No Scikit-Learn</span>
                </div>
                <pre className="p-4 rounded-2xl border border-white/10 bg-slate-950 font-mono text-xs overflow-x-auto text-emerald-400/90 leading-relaxed max-h-[460px] shadow-inner text-left">
                  <code>{activeTopic.pythonCode}</code>
                </pre>
              </div>
            )}

            {/* Tab 3: Theoretical Insights & Guarantees */}
            {infoTab === "insights" && (
              <div className="space-y-3 text-left">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                  Mathematical Guarantees &amp; Assumptions:
                </h4>
                <ul className="space-y-2.5">
                  {activeTopic.math.keyPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 font-mono text-[10px] font-bold">
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
