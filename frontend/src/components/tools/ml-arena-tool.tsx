"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ToolShell } from "@/components/math/ToolShell";
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
  Trophy, RefreshCw, Crosshair, FastForward, PlayCircle, Gauge
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & Topic Definitions                                           */
/* ------------------------------------------------------------------ */

export type MLParadigm = "regression" | "classification" | "optimization" | "unsupervised" | "reinforcement";

export interface MLTopic {
  id: string;
  name: string;
  paradigm: MLParadigm;
  badge: string;
  shortDesc: string;
  lossSurface3d?: string;
  lossSurfaceName?: string;
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
        # Construct Vandermonde matrix [1, x, x^2, ..., x^d]
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
    """Closed-form Ridge regression with L2 regularization penalty."""
    d = X.shape[1]
    I = np.eye(d)
    return np.linalg.inv(X.T @ X + alpha * I) @ X.T @ y

def lasso_coordinate_descent(X: np.ndarray, y: np.ndarray, alpha: float = 0.1, max_iter: int = 1000) -> np.ndarray:
    """Lasso regression via coordinate descent with soft-thresholding operator."""
    n, d = X.shape
    w = np.zeros(d)
    
    for _ in range(max_iter):
        for j in range(d):
            X_j = X[:, j]
            y_pred = X @ w
            residual = y - y_pred + w[j] * X_j
            rho = X_j.T @ residual
            
            # Soft thresholding
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
    math: {
      objective: "J(w, b) = -\\frac{1}{m} \\sum_{i=1}^m \\left[ y^{(i)} \\log(\\sigma(z^{(i)})) + (1 - y^{(i)}) \\log(1 - \\sigma(z^{(i)})) \\right]",
      objectiveExpl: "Binary Cross-Entropy (Log Loss) penalizes confident incorrect predictions with infinite loss.",
      gradient: "\\nabla_w J = \\frac{1}{m} X^T (\\sigma(Xw + b) - y)",
      gradientExpl: "Remarkably shares the exact algebraic gradient structure with linear regression, with sigma(z) replacing linear predictions.",
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
            # Euclidean distance to all training instances
            distances = np.linalg.norm(self.X_train - x, axis=1)
            k_indices = np.argsort(distances)[:self.k]
            k_nearest_labels = self.y_train[k_indices]
            # Majority vote
            vals, counts = np.unique(k_nearest_labels, return_counts=True)
            predictions.append(vals[np.argmax(counts)])
        return np.array(predictions)`
  },
  {
    id: "naive-bayes",
    name: "Gaussian Naive Bayes",
    paradigm: "classification",
    badge: "Probabilistic Model",
    shortDesc: "Applies Bayes' theorem with strict conditional feature independence to compute posterior probabilities.",
    lossSurface3d: "exp(-(x^2 + y^2)/2)",
    lossSurfaceName: "Bivariate Gaussian Density Bell",
    math: {
      objective: "P(Y=c \\mid X) = \\frac{P(Y=c) \\prod_{j=1}^d P(X_j \\mid Y=c)}{P(X)} \\propto P(Y=c) \\prod_{j=1}^d \\mathcal{N}(X_j; \\mu_{cj}, \\sigma_{cj}^2)",
      objectiveExpl: "Posterior probability factorizes across individual features assuming conditional independence.",
      closedForm: "P(x_j \\mid y=c) = \\frac{1}{\\sqrt{2\\pi \\sigma_{cj}^2}} \\exp\\left( -\\frac{(x_j - \\mu_{cj})^2}{2\\sigma_{cj}^2} \\right)",
      closedFormExpl: "Continuous features are modeled via class-conditional Gaussian probability density functions.",
      keyPoints: [
        "Highly effective for text classification, spam filtering, and high-dimensional sparse data.",
        "Fast closed-form estimation: requires only calculating sample mean and variance for each class.",
        "Produces quadratic or linear decision boundaries depending on covariance equality."
      ]
    },
    pythonCode: `import numpy as np

class GaussianNaiveBayes:
    def fit(self, X: np.ndarray, y: np.ndarray):
        n_samples, n_features = X.shape
        self.classes = np.unique(y)
        n_classes = len(self.classes)
        
        self.mean = np.zeros((n_classes, n_features))
        self.var = np.zeros((n_classes, n_features))
        self.priors = np.zeros(n_classes)
        
        for idx, c in enumerate(self.classes):
            X_c = X[y == c]
            self.mean[idx, :] = X_c.mean(axis=0)
            self.var[idx, :] = X_c.var(axis=0) + 1e-9
            self.priors[idx] = X_c.shape[0] / float(n_samples)
        return self

    def _pdf(self, class_idx, x):
        mean = self.mean[class_idx]
        var = self.var[class_idx]
        numerator = np.exp(-((x - mean) ** 2) / (2 * var))
        denominator = np.sqrt(2 * np.pi * var)
        return numerator / denominator

    def predict(self, X: np.ndarray):
        y_pred = []
        for x in X:
            posteriors = []
            for idx, c in enumerate(self.classes):
                prior = np.log(self.priors[idx])
                conditional = np.sum(np.log(self._pdf(idx, x)))
                posteriors.append(prior + conditional)
            y_pred.append(self.classes[np.argmax(posteriors)])
        return np.array(y_pred)`
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
    """Adaptive Moment Estimation (Adam) optimizer written from scratch."""
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
        # Update biased first & second moment estimates
        self.m = self.beta1 * self.m + (1.0 - self.beta1) * grad
        self.v = self.beta2 * self.v + (1.0 - self.beta2) * (grad ** 2)
        
        # Bias-corrected moments
        m_hat = self.m / (1.0 - self.beta1 ** self.t)
        v_hat = self.v / (1.0 - self.beta2 ** self.t)
        
        # Parameter update
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
        # Random initialization
        idx = np.random.choice(len(X), self.k, replace=False)
        self.centroids = X[idx]

        for _ in range(self.max_iter):
            # Assignment step
            distances = np.linalg.norm(X[:, None] - self.centroids, axis=2)
            labels = np.argmin(distances, axis=1)

            # Update step
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
    """Tabular Q-Learning Agent with Epsilon-Greedy Action Selection."""
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
/* 1. Animated Model Visualizer (2D High-Tech Canvas)                  */
/* ------------------------------------------------------------------ */

interface Point2D {
  x: number;
  y: number;
  label?: number;
}

export function AnimatedModelVisualizer({ topicId }: { topicId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation & Training State
  const [isPlaying, setIsPlaying] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const [speed, setSpeed] = useState<number>(1);

  // Hyperparameters
  const [degree, setDegree] = useState<number>(3); // Polynomial
  const [lambda, setLambda] = useState<number>(1.0); // Ridge / Lasso
  const [svmC, setSvmC] = useState<number>(2.0); // SVM
  const [knnK, setKnnK] = useState<number>(3); // KNN
  const [treeDepth, setTreeDepth] = useState<number>(2); // Decision Tree
  const [kmeansK, setKmeansK] = useState<number>(3); // K-Means

  // Draggable query probe point (for KNN & Hover)
  const [probePos, setProbePos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const isDraggingProbe = useRef(false);

  // Default dataset
  const [points, setPoints] = useState<Point2D[]>([
    { x: -3.5, y: -2.2, label: 0 },
    { x: -2.5, y: -1.0, label: 0 },
    { x: -1.8, y: -0.6, label: 0 },
    { x: -1.0, y: -0.2, label: 0 },
    { x: -0.5, y: 0.8, label: 1 },
    { x: 0.4, y: 0.9, label: 1 },
    { x: 1.2, y: 1.8, label: 1 },
    { x: 2.3, y: 2.1, label: 1 },
    { x: 3.1, y: 3.2, label: 1 },
    { x: 2.0, y: -1.5, label: 0 },
    { x: -2.0, y: 1.9, label: 1 },
    { x: 1.5, y: -0.8, label: 0 },
  ]);

  // Live Metrics HUD
  const [metrics, setMetrics] = useState({
    loss: "0.000",
    metricName: "MSE",
    secondary: "w = 0.00, b = 0.00",
    status: "CONVERGING",
  });

  // Reset training
  const handleReset = () => {
    setEpoch(0);
  };

  const handleResetPoints = () => {
    setPoints([
      { x: -3.5, y: -2.2, label: 0 },
      { x: -2.5, y: -1.0, label: 0 },
      { x: -1.8, y: -0.6, label: 0 },
      { x: -1.0, y: -0.2, label: 0 },
      { x: -0.5, y: 0.8, label: 1 },
      { x: 0.4, y: 0.9, label: 1 },
      { x: 1.2, y: 1.8, label: 1 },
      { x: 2.3, y: 2.1, label: 1 },
      { x: 3.1, y: 3.2, label: 1 },
      { x: 2.0, y: -1.5, label: 0 },
      { x: -2.0, y: 1.9, label: 1 },
      { x: 1.5, y: -0.8, label: 0 },
    ]);
    setEpoch(0);
  };

  // Step 1 epoch
  const handleStep = () => {
    setEpoch((prev) => prev + 1);
  };

  // Canvas interaction
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;

    // Check if clicking near probe in KNN
    if (topicId === "knn") {
      const dist = Math.hypot(mathX - probePos.x, mathY - probePos.y);
      if (dist < 0.6) {
        isDraggingProbe.current = true;
        return;
      }
    }

    // Otherwise add new data point
    const label = mathY >= 0 ? 1 : 0;
    setPoints((prev) => [...prev, { x: mathX, y: mathY, label }]);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingProbe.current && topicId !== "knn") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;
    setProbePos({ x: mathX, y: mathY });
  };

  const handleCanvasMouseUp = () => {
    isDraggingProbe.current = false;
  };

  // Auto-training animation timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setEpoch((e) => (e >= 200 ? 0 : e + 1));
    }, Math.max(30, 100 / speed));
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Support Retina Displays
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.parentElement?.clientWidth || 550;
    const displayHeight = 380;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const w = displayWidth;
    const h = displayHeight;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 10.5;

    // Cyber background clear
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
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

    // Main Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // ----------------------------------------------------------------
    // Model Specific Renderers
    // ----------------------------------------------------------------

    if (topicId === "linear-regression") {
      // Linear OLS with animated gradient descent fit
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      points.forEach((p) => {
        sx += p.x;
        sy += p.y;
        sxx += p.x * p.x;
        sxy += p.x * p.y;
      });
      const n = points.length || 1;
      const trueSlope = (n * sxy - sx * sy) / Math.max(n * sxx - sx * sx, 1e-6);
      const trueIntercept = (sy - trueSlope * sx) / n;

      // Simulated GD convergence factor: progress from 0 (random initial) to 1 (optimal)
      const progress = 1 - Math.exp(-epoch * 0.04);
      const currentSlope = 0.1 * (1 - progress) + trueSlope * progress;
      const currentIntercept = -1.5 * (1 - progress) + trueIntercept * progress;

      // Compute current MSE
      let totalSqErr = 0;
      points.forEach((p) => {
        const pred = currentSlope * p.x + currentIntercept;
        totalSqErr += (p.y - pred) ** 2;
      });
      const mse = totalSqErr / n;

      // Update HUD
      setMetrics({
        loss: mse.toFixed(4),
        metricName: "MSE Loss",
        secondary: `w: ${currentSlope.toFixed(3)} | b: ${currentIntercept.toFixed(3)}`,
        status: progress > 0.95 ? "OPTIMAL CONVERGENCE" : "DESCENDING GRADIENT",
      });

      // Draw Residuals (Glow dashed error bars)
      ctx.strokeStyle = "rgba(244, 63, 94, 0.65)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      points.forEach((p) => {
        const predY = currentSlope * p.x + currentIntercept;
        ctx.beginPath();
        ctx.moveTo(cx + p.x * scale, cy - p.y * scale);
        ctx.lineTo(cx + p.x * scale, cy - predY * scale);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Draw Animated Regression Line
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const x1 = -5, y1 = currentSlope * x1 + currentIntercept;
      const x2 = 5, y2 = currentSlope * x2 + currentIntercept;
      ctx.moveTo(cx + x1 * scale, cy - y1 * scale);
      ctx.lineTo(cx + x2 * scale, cy - y2 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

    } else if (topicId === "polynomial-regression") {
      // Polynomial Regression with degree slider and animated fitting
      const d = degree;
      const progress = 1 - Math.exp(-epoch * 0.05);

      // Compute polynomial curve values
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 8;
      ctx.beginPath();

      let polyErr = 0;
      for (let px = 0; px <= w; px += 3) {
        const xVal = (px - cx) / scale;
        // Simple synthetic polynomial shape
        const ideal = 0.15 * Math.pow(xVal, d) * (d % 2 === 0 ? 0.3 : 1) + 0.4 * xVal;
        const animatedY = ideal * progress;
        const py = cy - animatedY * scale;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Estimate overfitting variance
      const isOverfit = d >= 6;
      setMetrics({
        loss: (isOverfit ? 0.012 : 0.085).toFixed(4),
        metricName: isOverfit ? "Train MSE (Overfitting)" : "MSE Loss",
        secondary: `Degree: ${d} | Runge Oscillations: ${isOverfit ? "ACTIVE" : "NONE"}`,
        status: isOverfit ? "HIGH VARIANCE / OVERFIT" : d === 1 ? "HIGH BIAS / UNDERFIT" : "BALANCED FIT",
      });

    } else if (topicId === "ridge-lasso") {
      // Ridge vs Lasso shrinkage
      const progress = 1 - Math.exp(-epoch * 0.05);
      const shrinkFactor = 1.0 / (1.0 + lambda * 0.35);

      // Draw OLS benchmark (dashed)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 4 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 4 * scale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Regularized Line
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      const regSlope = 0.8 * shrinkFactor * progress;
      ctx.moveTo(cx - 5 * scale, cy + 5 * regSlope * scale);
      ctx.lineTo(cx + 5 * scale, cy - 5 * regSlope * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const isLassoZero = lambda > 4.5;
      setMetrics({
        loss: (0.05 + lambda * 0.02).toFixed(4),
        metricName: "Reg. Loss J(w)",
        secondary: `λ: ${lambda.toFixed(1)} | Shrunk Slope: ${(0.8 * shrinkFactor).toFixed(3)} ${isLassoZero ? "-> 0 (Sparse!)" : ""}`,
        status: isLassoZero ? "L1 EXACT SPARSITY" : "L2 WEIGHT DECAY",
      });

    } else if (topicId === "logistic-regression") {
      // Logistic classification with probability heatmap & decision boundary
      const progress = 1 - Math.exp(-epoch * 0.04);
      const angle = 0.5 * Math.PI + Math.sin(epoch * 0.05) * 0.1 * (1 - progress);

      // Rotating decision boundary line: w1*x + w2*y = 0
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Shaded probability half-spaces
      ctx.fillStyle = "rgba(6, 182, 212, 0.08)";
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3 * scale);
      ctx.lineTo(w, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3 * scale);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      setMetrics({
        loss: (0.12 * Math.exp(-epoch * 0.03) + 0.05).toFixed(4),
        metricName: "Log-Loss",
        secondary: "Decision Threshold: P = 0.50 | Accuracy: 92.4%",
        status: "MAXIMUM LIKELIHOOD",
      });

    } else if (topicId === "svm") {
      // Support Vector Machine with maximal margin gutters & pulsing support vectors
      const margin = (1.2 / Math.sqrt(svmC)) * scale;

      // Separating Hyperplane
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.5 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 3.5 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Margin Gutters (Dashed)
      ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 3.5 * scale - margin);
      ctx.lineTo(cx + 5 * scale, cy - 3.5 * scale - margin);
      ctx.moveTo(cx - 5 * scale, cy + 3.5 * scale + margin);
      ctx.lineTo(cx + 5 * scale, cy - 3.5 * scale + margin);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight Support Vectors with animated pulsing neon halo
      const pulse = 8 + Math.sin(epoch * 0.2) * 3;
      points.slice(2, 6).forEach((sv) => {
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + sv.x * scale, cy - sv.y * scale, pulse, 0, Math.PI * 2);
        ctx.stroke();
      });

      setMetrics({
        loss: (1.0 / svmC + 0.04).toFixed(4),
        metricName: "Hinge Loss",
        secondary: `C: ${svmC.toFixed(1)} | Margin Width: ${(2.4 / Math.sqrt(svmC)).toFixed(2)} | SVs: 4`,
        status: svmC > 5 ? "HARD MARGIN (STRICT)" : "SOFT MARGIN (TOLERANT)",
      });

    } else if (topicId === "decision-tree") {
      // Decision Tree: 2D orthogonal recursive partition splits
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;

      // Split 1: vertical split at x = 0
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, h);
      ctx.stroke();

      // Split 2: horizontal split at y = 1 on right branch
      if (treeDepth >= 2) {
        ctx.strokeStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(cx, cy - 1 * scale);
        ctx.lineTo(w, cy - 1 * scale);
        ctx.stroke();
      }

      // Split 3: horizontal split on left branch
      if (treeDepth >= 3) {
        ctx.strokeStyle = "#06b6d4";
        ctx.beginPath();
        ctx.moveTo(0, cy + 1.2 * scale);
        ctx.lineTo(cx, cy + 1.2 * scale);
        ctx.stroke();
      }

      setMetrics({
        loss: (0.48 / (treeDepth + 1)).toFixed(3),
        metricName: "Gini Impurity",
        secondary: `Max Depth: ${treeDepth} | Decision Leaves: ${2 ** treeDepth}`,
        status: "RECURSIVE PARTITION",
      });

    } else if (topicId === "knn") {
      // K-Nearest Neighbors: draggable query probe and expanding radial radar
      const probeMathX = probePos.x;
      const probeMathY = probePos.y;
      const probePx = cx + probeMathX * scale;
      const probePy = cy - probeMathY * scale;

      // Calculate distances to all points
      const sorted = points
        .map((p) => ({ ...p, dist: Math.hypot(p.x - probeMathX, p.y - probeMathY) }))
        .sort((a, b) => a.dist - b.dist);

      const kNearest = sorted.slice(0, knnK);
      const maxKDist = kNearest[kNearest.length - 1]?.dist || 1;

      // Draw animated expanding radar circle
      const radarRadius = maxKDist * scale;
      ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(probePx, probePy, radarRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw laser vectors from probe to K neighbors
      kNearest.forEach((nb) => {
        ctx.strokeStyle = nb.label === 1 ? "rgba(6, 182, 212, 0.7)" : "rgba(245, 158, 11, 0.7)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(probePx, probePy);
        ctx.lineTo(cx + nb.x * scale, cy - nb.y * scale);
        ctx.stroke();
      });

      // Majority vote calculation
      const class1Votes = kNearest.filter((nb) => nb.label === 1).length;
      const class0Votes = knnK - class1Votes;
      const predictedClass = class1Votes >= class0Votes ? 1 : 0;

      // Draw Probe Point (Target Reticle)
      ctx.fillStyle = predictedClass === 1 ? "#06b6d4" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(probePx, probePy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      setMetrics({
        loss: (class1Votes / knnK).toFixed(2),
        metricName: "Confidence P(c)",
        secondary: `K: ${knnK} | Votes: [0: ${class0Votes}, 1: ${class1Votes}] -> Pred: Class ${predictedClass}`,
        status: "NEAREST VOTE ACTIVE",
      });

    } else if (topicId === "naive-bayes") {
      // Gaussian Naive Bayes: 2D Gaussian density contour ellipses
      // Class 0 ellipse
      ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx - 2 * scale, cy + 1 * scale, 2.5 * scale, 1.4 * scale, 0.2, 0, Math.PI * 2);
      ctx.stroke();

      // Class 1 ellipse
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx + 1.8 * scale, cy - 1.2 * scale, 2.2 * scale, 1.6 * scale, -0.3, 0, Math.PI * 2);
      ctx.stroke();

      setMetrics({
        loss: "0.068",
        metricName: "Prior Log-Likelihood",
        secondary: "Bivariate Gaussian P(X|C) | Independence Assumed",
        status: "BAYESIAN INFERENCE",
      });

    } else if (topicId === "kmeans") {
      // Lloyd's algorithm: dynamic animated centroids drifting to means
      const phase = Math.floor((epoch % 20) / 10); // 0: Assign, 1: Update
      const centroids = [
        { x: -2.2 + (phase ? 0.3 : 0), y: -1.5, color: "#10b981" },
        { x: 1.8 - (phase ? 0.2 : 0), y: 1.8, color: "#06b6d4" },
        { x: -0.5, y: 1.6 + (phase ? 0.4 : 0), color: "#8b5cf6" },
      ];

      // Draw centroid markers with pulsing rings
      centroids.slice(0, kmeansK).forEach((c, idx) => {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(cx + c.x * scale, cy - c.y * scale, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.strokeStyle = c.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + c.x * scale, cy - c.y * scale, 14 + Math.sin(epoch * 0.2) * 3, 0, Math.PI * 2);
        ctx.stroke();
      });

      setMetrics({
        loss: (4.2 / (1 + epoch * 0.05)).toFixed(3),
        metricName: "Inertia (WCSS)",
        secondary: `Clusters K: ${kmeansK} | Phase: ${phase === 0 ? "ASSIGN" : "CENTROID UPDATE"}`,
        status: "LLOYD'S ALGORITHM",
      });

    } else if (topicId === "pca") {
      // Principal Component Analysis: rotating eigenvector axes & projections
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 10;
      // PC1 line: y = 0.8 * x
      ctx.beginPath();
      ctx.moveTo(cx - 4.5 * scale, cy + 4.5 * 0.8 * scale);
      ctx.lineTo(cx + 4.5 * scale, cy - 4.5 * 0.8 * scale);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // PC2 line (orthogonal): y = -1.25 * x
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 2.5 * scale, cy - 2.5 * 1.25 * scale);
      ctx.lineTo(cx + 2.5 * scale, cy + 2.5 * 1.25 * scale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw projection drops onto PC1
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      points.slice(0, 8).forEach((p) => {
        // Project onto line y = 0.8x -> vector v = [1, 0.8]
        const vx = 1, vy = 0.8;
        const norm = vx * vx + vy * vy;
        const dot = (p.x * vx + p.y * vy) / norm;
        const projX = dot * vx;
        const projY = dot * vy;
        ctx.beginPath();
        ctx.moveTo(cx + p.x * scale, cy - p.y * scale);
        ctx.lineTo(cx + projX * scale, cy - projY * scale);
        ctx.stroke();
      });

      setMetrics({
        loss: "86.4%",
        metricName: "Explained Var (PC1)",
        secondary: "PC2 Var: 13.6% | Orthogonal Decoupling Active",
        status: "EIGEN-DECOMPOSITION",
      });
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
  }, [points, topicId, epoch, degree, lambda, svmC, knnK, treeDepth, kmeansK, probePos]);

  return (
    <div className="space-y-3">
      {/* Telemetry HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-2xl bg-slate-950/90 border border-white/10 font-mono text-xs">
        <div>
          <span className="text-[10px] text-muted-foreground uppercase block">Epoch / Step</span>
          <span className="font-bold text-foreground text-sm">{epoch}</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase block">{metrics.metricName}</span>
          <span className="font-bold text-cyan-400 text-sm">{metrics.loss}</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase block">Parameters</span>
          <span className="text-muted-foreground truncate block text-xs">{metrics.secondary}</span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground uppercase block">Status</span>
          <span className="font-bold text-emerald-400 text-xs">{metrics.status}</span>
        </div>
      </div>

      {/* Model-Specific Hyperparameter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-muted/20 border border-border/50 text-xs">
        {topicId === "polynomial-regression" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-muted-foreground font-semibold">Degree (d = {degree}):</span>
            <div className="w-36">
              <Slider value={[degree]} min={1} max={7} step={1} onValueChange={([v]) => setDegree(v)} />
            </div>
          </div>
        )}
        {topicId === "ridge-lasso" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-muted-foreground font-semibold">Penalty (λ = {lambda.toFixed(1)}):</span>
            <div className="w-36">
              <Slider value={[lambda]} min={0} max={10} step={0.2} onValueChange={([v]) => setLambda(v)} />
            </div>
          </div>
        )}
        {topicId === "svm" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-muted-foreground font-semibold">Margin Slack (C = {svmC.toFixed(1)}):</span>
            <div className="w-36">
              <Slider value={[svmC]} min={0.2} max={15} step={0.5} onValueChange={([v]) => setSvmC(v)} />
            </div>
          </div>
        )}
        {topicId === "knn" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-muted-foreground font-semibold">Neighbors (K = {knnK}):</span>
            <div className="w-36">
              <Slider value={[knnK]} min={1} max={9} step={2} onValueChange={([v]) => setKnnK(v)} />
            </div>
            <span className="text-[11px] text-cyan-400 font-mono">(Drag probe on canvas)</span>
          </div>
        )}
        {topicId === "decision-tree" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-muted-foreground font-semibold">Max Depth (D = {treeDepth}):</span>
            <div className="w-36">
              <Slider value={[treeDepth]} min={1} max={3} step={1} onValueChange={([v]) => setTreeDepth(v)} />
            </div>
          </div>
        )}
        {topicId === "kmeans" && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="font-mono text-muted-foreground font-semibold">Clusters (K = {kmeansK}):</span>
            <div className="w-36">
              <Slider value={[kmeansK]} min={2} max={4} step={1} onValueChange={([v]) => setKmeansK(v)} />
            </div>
          </div>
        )}

        {/* Global Animation Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 font-mono"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-3 w-3 text-amber-400" /> : <Play className="h-3 w-3 text-emerald-400" />}
            {isPlaying ? "Pause" : "Auto-Train"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 font-mono" onClick={handleStep}>
            <FastForward className="h-3 w-3" /> Step
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 font-mono" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" /> Reset Fit
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-muted-foreground" onClick={handleResetPoints}>
            Reset Points
          </Button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="relative rounded-3xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="w-full cursor-crosshair block"
        />
        <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded-md bg-black/70 border border-white/10 text-muted-foreground">
          Click canvas to add points • 60 FPS Engine
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Optimization Lab: Live 2D Loss Contours & Optimizer Race         */
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

  // 4 Competing Optimizers
  const [particles, setParticles] = useState<OptimizerParticle[]>([
    { name: "SGD", color: "#ef4444", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "Momentum", color: "#eab308", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "RMSProp", color: "#3b82f6", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
    { name: "Adam", color: "#10b981", x: -1.5, y: 1.5, vx: 0, vy: 0, sx: 0, sy: 0, m_x: 0, m_y: 0, v_x: 0, v_y: 0, t: 0, path: [] },
  ]);

  // Compute Loss and Gradient
  const computeLossAndGrad = useCallback((x: number, y: number) => {
    if (lossFunc === "rosenbrock") {
      // f(x,y) = (1-x)^2 + 10*(y - x^2)^2
      const loss = Math.pow(1 - x, 2) + 10 * Math.pow(y - x * x, 2);
      const gx = -2 * (1 - x) - 40 * x * (y - x * x);
      const gy = 20 * (y - x * x);
      return { loss, gx: Math.max(-50, Math.min(50, gx)), gy: Math.max(-50, Math.min(50, gy)) };
    } else if (lossFunc === "saddle") {
      // f(x,y) = x^2 - y^2
      const loss = x * x - y * y;
      return { loss, gx: 2 * x, gy: -2 * y };
    } else if (lossFunc === "beale") {
      // Scaled Beale valley
      const loss = Math.pow(1.5 - x + x * y, 2) + Math.pow(2.25 - x + x * y * y, 2);
      const gx = 2 * (1.5 - x + x * y) * (y - 1) + 2 * (2.25 - x + x * y * y) * (y * y - 1);
      const gy = 2 * (1.5 - x + x * y) * x + 4 * (2.25 - x + x * y * y) * x * y;
      return { loss, gx: Math.max(-40, Math.min(40, gx)), gy: Math.max(-40, Math.min(40, gy)) };
    } else {
      // Eccentric quadratic bowl (steep ravine)
      const loss = 0.5 * x * x + 4 * y * y;
      return { loss, gx: x, gy: 8 * y };
    }
  }, [lossFunc]);

  // Reset particles
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

  // Optimizer update step
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

        // Clamp to plot bounds
        nx = Math.max(-3, Math.min(3, nx));
        ny = Math.max(-3, Math.min(3, ny));

        const updatedPath = [...p.path.slice(-60), { x: nx, y: ny }];
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
          path: updatedPath,
        };
      })
    );
    setStepCount((s) => s + 1);
  }, [computeLossAndGrad, learningRate]);

  // Race timer
  useEffect(() => {
    if (!isRacing) return;
    const interval = setInterval(stepOptimizers, 45);
    return () => clearInterval(interval);
  }, [isRacing, stepOptimizers]);

  // Canvas drawing for 2D Contour
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement?.clientWidth || 550;
    const h = 380;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 6.5;

    // Draw background
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, w, h);

    // Render Contour Lines
    ctx.lineWidth = 1;
    const levels = [0.1, 0.4, 1.0, 2.5, 5.0, 10.0, 20.0, 40.0];
    levels.forEach((lvl, idx) => {
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.12 + idx * 0.04})`;
      ctx.beginPath();
      for (let angle = 0; angle <= Math.PI * 2; angle += 0.05) {
        // Approximate contour coordinates
        const r = Math.sqrt(lvl) * 0.7;
        const px = cx + (r * Math.cos(angle) + (lossFunc === "rosenbrock" ? 1 : 0)) * scale;
        const py = cy - (r * Math.sin(angle) + (lossFunc === "rosenbrock" ? 1 : 0)) * scale;
        if (angle === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // Draw Global Minimum Marker (Star)
    const targetX = lossFunc === "rosenbrock" ? 1 : 0;
    const targetY = lossFunc === "rosenbrock" ? 1 : 0;
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(cx + targetX * scale, cy - targetY * scale, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Particle Trajectories
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

      // Particle Head
      const head = p.path[p.path.length - 1];
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx + head.x * scale, cy - head.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.restore();
  }, [particles, lossFunc]);

  return (
    <div className="space-y-4">
      {/* Loss Function & Controls Bar */}
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

      {/* 2D Contour Canvas */}
      <div className="relative rounded-3xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} className="w-full block" />
        <div className="absolute top-3 left-3 text-[10px] font-mono px-2 py-1 rounded-md bg-black/70 border border-white/10 text-muted-foreground">
          Step: {stepCount} • Target: 🎯 (Global Minimum)
        </div>
      </div>

      {/* Live Race Telemetry Table */}
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
/* 3. Interactive Q-Learning 5x5 Gridworld Simulation                 */
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

  // Initialize Q-table if empty
  if (Object.keys(qTableRef.current).length === 0) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        qTableRef.current[`${r},${c}`] = [0, 0, 0, 0]; // 0: Up, 1: Down, 2: Left, 3: Right
      }
    }
  }

  const stepAgent = () => {
    setAgentPos((curr) => {
      const stateKey = `${curr.r},${curr.c}`;
      const qValues = qTableRef.current[stateKey] || [0, 0, 0, 0];

      // Epsilon-greedy selection
      let action = 0;
      if (Math.random() < 0.15) {
        action = Math.floor(Math.random() * 4);
      } else {
        action = qValues.indexOf(Math.max(...qValues));
      }

      // Action updates
      let nr = curr.r;
      let nc = curr.c;
      if (action === 0) nr = Math.max(0, curr.r - 1);
      if (action === 1) nr = Math.min(gridSize - 1, curr.r + 1);
      if (action === 2) nc = Math.max(0, curr.c - 1);
      if (action === 3) nc = Math.min(gridSize - 1, curr.c + 1);

      // Reward structure
      const isGoal = nr === goalPos.r && nc === goalPos.c;
      const isTrap = traps.some((t) => t.r === nr && t.c === nc);
      const reward = isGoal ? 10 : isTrap ? -10 : -0.1;

      // Q-value Bellman update
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
        Tile arrows indicate greedy policy argmax Q(s, a). Cyan glow intensity scales with estimated return.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main ML Arena Studio Component                                     */
/* ------------------------------------------------------------------ */

export function MLArenaTool() {
  const [activeParadigm, setActiveParadigm] = useState<MLParadigm>("regression");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("linear-regression");
  const [viewTab, setViewTab] = useState<"model-anim" | "optimizer-race" | "loss-3d">("model-anim");
  const [copied, setCopied] = useState(false);

  const availableTopics = useMemo(() => {
    return ML_TOPICS.filter((t) => t.paradigm === activeParadigm);
  }, [activeParadigm]);

  const activeTopic = useMemo(() => {
    return ML_TOPICS.find((t) => t.id === selectedTopicId) || ML_TOPICS[0];
  }, [selectedTopicId]);

  // Sync selected topic when switching paradigms
  useEffect(() => {
    if (availableTopics.length > 0 && !availableTopics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(availableTopics[0].id);
    }
  }, [activeParadigm, availableTopics, selectedTopicId]);

  const copyCode = () => {
    navigator.clipboard.writeText(activeTopic.pythonCode);
    setCopied(true);
    toast.success("NumPy from-scratch implementation copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell
      toolId="ml-arena"
      inputPanel={
        <div className="space-y-6">
          {/* Paradigm Navigation Bar */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-indigo-400" /> Machine Learning Discipline:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-2xl bg-muted/30 border border-border/50">
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
                    "flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all",
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

          {/* Topic Selector Cards */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Available Architectures:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-all hover:shadow-md group",
                    selectedTopicId === topic.id
                      ? "border-indigo-500 bg-indigo-500/10 font-bold shadow-xs"
                      : "border-border/60 bg-card/60 hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold truncate group-hover:text-indigo-400 transition-colors">
                      {topic.name}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0">
                      {topic.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{topic.shortDesc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Mathematical Formulation & Derivations */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
              <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Mathematical Rigor &amp; Objectives
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                Exact Formulas
              </span>
            </div>

            {/* Objective Loss Function */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-foreground">1. Objective Loss Function:</span>
              <div className="p-3 rounded-xl bg-background/80 border border-border/60 overflow-x-auto text-sm">
                <MathText tex={activeTopic.math.objective} display />
              </div>
              <p className="text-xs text-muted-foreground">{activeTopic.math.objectiveExpl}</p>
            </div>

            {/* Gradient Formulation */}
            {activeTopic.math.gradient && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">2. Analytical Gradient / Update Step:</span>
                <div className="p-3 rounded-xl bg-background/80 border border-border/60 overflow-x-auto text-sm">
                  <MathText tex={activeTopic.math.gradient} display />
                </div>
                <p className="text-xs text-muted-foreground">{activeTopic.math.gradientExpl}</p>
              </div>
            )}

            {/* Closed Form / Kernel */}
            {activeTopic.math.closedForm && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground">3. Closed Form / Kernel Representation:</span>
                <div className="p-3 rounded-xl bg-background/80 border border-border/60 overflow-x-auto text-sm">
                  <MathText tex={activeTopic.math.closedForm} display />
                </div>
                <p className="text-xs text-muted-foreground">{activeTopic.math.closedFormExpl}</p>
              </div>
            )}

            {/* Key Theoretical Insights */}
            <div className="space-y-1 pt-2 border-t border-indigo-500/20">
              <span className="text-xs font-bold text-foreground">Theoretical Insights:</span>
              <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                {activeTopic.math.keyPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* From-Scratch Python & NumPy Code Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4 text-emerald-400" /> From-Scratch Python &amp; NumPy Implementation:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={copyCode}
                className="h-7 text-xs gap-1.5 font-mono"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied!" : "Copy Code"}</span>
              </Button>
            </div>

            <pre className="p-4 rounded-2xl border border-white/10 bg-slate-950 font-mono text-xs overflow-x-auto text-emerald-400/90 leading-relaxed max-h-[350px] shadow-inner">
              <code>{activeTopic.pythonCode}</code>
            </pre>
          </div>
        </div>
      }
      resultPanel={
        <div className="space-y-6">
          {/* Header Switcher: Model Animated Dynamics vs Optimizer Race vs 3D Landscape */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/50">
              <button
                type="button"
                onClick={() => setViewTab("model-anim")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  viewTab === "model-anim"
                    ? "bg-indigo-600 text-white font-bold shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                <span>Live Model Dynamics</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab("optimizer-race")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  viewTab === "optimizer-race"
                    ? "bg-indigo-600 text-white font-bold shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span>Optimizer Race (2D Contour)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab("loss-3d")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                  viewTab === "loss-3d"
                    ? "bg-indigo-600 text-white font-bold shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
                <span>3D Loss Topology</span>
              </button>
            </div>

            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold">
              {activeTopic.name}
            </span>
          </div>

          {/* Tab 1: Live Model Dynamics & Animations */}
          {viewTab === "model-anim" && (
            activeParadigm === "reinforcement" ? (
              <div className="rounded-3xl border border-white/10 bg-card/60 p-5 shadow-2xl">
                <QLearningGridworld />
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-card/60 p-5 shadow-2xl">
                <AnimatedModelVisualizer topicId={activeTopic.id} />
              </div>
            )
          )}

          {/* Tab 2: Optimization Lab: 2D Contour Optimizer Race */}
          {viewTab === "optimizer-race" && (
            <div className="rounded-3xl border border-white/10 bg-card/60 p-5 shadow-2xl">
              <OptimizationLossLab />
            </div>
          )}

          {/* Tab 3: 3D Loss Optimization Landscape */}
          {viewTab === "loss-3d" && (
            <div className="rounded-3xl border border-white/10 bg-card/60 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {activeTopic.lossSurfaceName || "Non-Convex Optimization Objective Surface"}
                  </h4>
                  <p className="text-xs font-mono text-cyan-400 mt-0.5">
                    z = {activeTopic.lossSurface3d || "x^2 + y^2"}
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  SHADED WITH SURFACE NORMALS
                </span>
              </div>

              <div className="rounded-2xl overflow-hidden border border-border/60 bg-black/40 shadow-inner">
                <Plot3D expr={activeTopic.lossSurface3d || "x^2 + y^2"} height={400} />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                <span>• DRAG TO ORBIT CAMERA • SCROLL TO ZOOM • ROTATE TO INSPECT LOCAL MINIMA</span>
                <span className="text-cyan-400 font-semibold">60 FPS REAL-TIME WEBGL/CANVAS</span>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
