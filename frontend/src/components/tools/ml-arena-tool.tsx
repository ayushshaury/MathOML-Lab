"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  Layers, Code2, BookOpen, Activity, ArrowRight, Compass
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
    lossSurface3d: "(x - 1)^2 + (y - 2)^2",
    math: {
      objective: "J(w, b) = \\frac{1}{2m} \\sum_{i=1}^{m} \\left( w x^{(i)} + b - y^{(i)} \\right)^2 = \\frac{1}{2m} \\|Xw - y\\|^2",
      objectiveExpl: "Mean Squared Error (MSE) measures the average squared Euclidean distance of residuals.",
      gradient: "\\nabla_w J = \\frac{1}{m} X^T (Xw - y), \\quad \\frac{\\partial J}{\\partial b} = \\frac{1}{m} \\sum_{i=1}^m (\\hat{y}^{(i)} - y^{(i)})",
      gradientExpl: "Gradient points in the direction of steepest loss ascent; we step in the negative direction.",
      closedForm: "w^* = (X^T X)^{-1} X^T y",
      closedFormExpl: "The Normal Equation derives the exact global minimum in one matrix operation via the Moore-Penrose pseudoinverse.",
      keyPoints: [
        "Convex quadratic loss bowl guarantees a single global minimum.",
        "Closed-form OLS complexity is O(d^3); gradient descent is preferred when features d > 10,000.",
        "Assumes homoscedasticity, normality of residuals, and no severe multicollinearity."
      ]
    },
    pythonCode: `import numpy as np

class LinearRegressionOLS:
    """Linear Regression trained via Closed-Form Normal Equation."""
    def __init__(self, fit_intercept: bool = True):
        self.fit_intercept = fit_intercept
        self.weights = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        # Add bias column if needed: X_b = [1, X]
        if self.fit_intercept:
            ones = np.ones((X.shape[0], 1))
            X = np.hstack([ones, X])
        
        # Normal Equation: w = (X^T X)^(-1) X^T y
        self.weights = np.linalg.pinv(X.T @ X) @ X.T @ y
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.fit_intercept:
            ones = np.ones((X.shape[0], 1))
            X = np.hstack([ones, X])
        return X @ self.weights

# Example Run:
X = np.array([[1], [2], [3], [4], [5]])
y = np.array([2.2, 3.9, 6.1, 8.0, 10.2])
model = LinearRegressionOLS().fit(X, y)
print("Learned Weights:", model.weights)`
  },
  {
    id: "polynomial-regression",
    name: "Polynomial Regression & Overfitting",
    paradigm: "regression",
    badge: "Nonlinear Regression",
    shortDesc: "Projects features into higher-order powers to capture nonlinear curvature; demonstrates bias-variance tradeoff.",
    lossSurface3d: "(x^2 + y - 11)^2 / 30 + (x + y^2 - 7)^2 / 30",
    math: {
      objective: "\\hat{y} = w_0 + w_1 x + w_2 x^2 + w_3 x^3 + \\dots + w_d x^d = \\sum_{j=0}^{d} w_j \\phi_j(x)",
      objectiveExpl: "Feature mapping function phi maps scalar x into a Vandermonde polynomial feature vector.",
      gradient: "\\nabla_w J = \\frac{1}{m} \\Phi(X)^T (\\Phi(X)w - y)",
      gradientExpl: "Optimized identically to linear regression in the transformed polynomial Hilbert space.",
      closedForm: "w^* = (\\Phi^T \\Phi)^{-1} \\Phi^T y",
      closedFormExpl: "Direct matrix solution over the Vandermonde design matrix Phi.",
      keyPoints: [
        "Low degree d=1 causes high bias (underfitting).",
        "High degree d>6 causes high variance (severe overfitting and Runge's phenomenon oscillations).",
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
            # Compute residual excluding feature j
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
        "Generalizes to multiclass via Softmax (Cross-Entropy)."
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
            
            # Gradients
            dw = (1 / m) * (X.T @ (y_hat - y))
            db = (1 / m) * np.sum(y_hat - y)
            
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
        # Ensure labels are {-1, +1}
        y_signed = np.where(y <= 0, -1, 1)
        m, d = X.shape
        self.w = np.zeros(d)
        
        for _ in range(self.epochs):
            for i in range(m):
                condition = y_signed[i] * (np.dot(X[i], self.w) + self.b) >= 1
                if condition:
                    # Only regularizer gradient
                    self.w -= self.lr * (self.w / m)
                else:
                    # Regularizer + Hinge loss subgradient
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
    """Finds the optimal feature and threshold to split on."""
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

  /* ================= OPTIMIZATION ================= */
  {
    id: "adam-optimizer",
    name: "Adam Optimizer & Momentum",
    paradigm: "optimization",
    badge: "Deep Learning Optimizer",
    shortDesc: "Combines Momentum (first moment) with RMSProp (second moment) and bias correction for robust convergence.",
    lossSurface3d: "log(1 + (1 - x)^2 + 10*(y - x^2)^2)/3",
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
            # Assignment step: compute Euclidean distance to all centroids
            distances = np.linalg.norm(X[:, None] - self.centroids, axis=2)
            labels = np.argmin(distances, axis=1)

            # Update step: recalculate centroids
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
        # 1. Mean center the data
        self.mean = np.mean(X, axis=0)
        X_centered = X - self.mean
        
        # 2. Compute covariance matrix
        cov = np.cov(X_centered, rowvar=False)
        
        # 3. Eigen decomposition
        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        
        # 4. Sort eigenvectors by decreasing eigenvalue
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
        # Exploration vs Exploitation
        if np.random.rand() < self.epsilon:
            return np.random.choice(self.n_actions) # Random explore
        return np.argmax(self.q_table[state]) # Greedy exploit

    def update(self, s: int, a: int, r: float, s_prime: int):
        best_future_q = np.max(self.q_table[s_prime])
        td_target = r + self.gamma * best_future_q
        td_error = td_target - self.q_table[s, a]
        self.q_table[s, a] += self.lr * td_error`
  }
];

/* ------------------------------------------------------------------ */
/* Interactive 2D Visualizer for Regression & Classification          */
/* ------------------------------------------------------------------ */

function Interactive2DVisualizer({ topicId }: { topicId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [param, setParam] = useState<number>(1);
  const [points, setPoints] = useState<Array<{ x: number; y: number; label?: number }>>([
    { x: -3, y: -2.5, label: 0 },
    { x: -2, y: -1.2, label: 0 },
    { x: -1, y: -0.5, label: 0 },
    { x: 0, y: 0.2, label: 1 },
    { x: 1, y: 1.1, label: 1 },
    { x: 2, y: 2.3, label: 1 },
    { x: 3, y: 3.1, label: 1 },
  ]);

  // Click canvas to add custom point
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = ((px - rect.width / 2) / (rect.width / 2)) * 5;
    const mathY = -((py - rect.height / 2) / (rect.height / 2)) * 5;
    const label = mathY >= 0 ? 1 : 0;
    setPoints((prev) => [...prev, { x: mathX, y: mathY, label }]);
  };

  const resetPoints = () => {
    setPoints([
      { x: -3, y: -2.5, label: 0 },
      { x: -2, y: -1.2, label: 0 },
      { x: -1, y: -0.5, label: 0 },
      { x: 0, y: 0.2, label: 1 },
      { x: 1, y: 1.1, label: 1 },
      { x: 2, y: 2.3, label: 1 },
      { x: 3, y: 3.1, label: 1 },
    ]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (canvas.width = canvas.parentElement?.clientWidth || 500);
    const h = (canvas.height = 340);
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) / 11;

    ctx.clearRect(0, 0, w, h);

    // Draw coordinate axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Render topic-specific function curves
    if (topicId === "linear-regression") {
      // Fit line: y = slope * x + intercept
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      points.forEach((p) => {
        sx += p.x;
        sy += p.y;
        sxx += p.x * p.x;
        sxy += p.x * p.y;
      });
      const n = points.length || 1;
      const slope = (n * sxy - sx * sy) / Math.max(n * sxx - sx * sx, 1e-6);
      const intercept = (sy - slope * sx) / n;

      // Draw fitted regression line
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const x1 = -5, y1 = slope * x1 + intercept;
      const x2 = 5, y2 = slope * x2 + intercept;
      ctx.moveTo(cx + x1 * scale, cy - y1 * scale);
      ctx.lineTo(cx + x2 * scale, cy - y2 * scale);
      ctx.stroke();

      // Draw residuals (dashed red lines)
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      points.forEach((p) => {
        const predY = slope * p.x + intercept;
        ctx.beginPath();
        ctx.moveTo(cx + p.x * scale, cy - p.y * scale);
        ctx.lineTo(cx + p.x * scale, cy - predY * scale);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    } else if (topicId === "logistic-regression") {
      // Draw sigmoid curve: y = 1 / (1 + exp(-param * x))
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let px = 0; px <= w; px += 2) {
        const xVal = (px - cx) / scale;
        const prob = 1 / (1 + Math.exp(-param * xVal));
        const py = cy - (prob * 4 - 2) * scale;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Threshold line at P=0.5
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (topicId === "svm") {
      // Maximum margin line and margin gutters
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 4 * scale);
      ctx.lineTo(cx + 5 * scale, cy - 4 * scale);
      ctx.stroke();

      // Margins
      ctx.strokeStyle = "rgba(139, 92, 246, 0.35)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx - 5 * scale, cy + 4 * scale - 25);
      ctx.lineTo(cx + 5 * scale, cy - 4 * scale - 25);
      ctx.moveTo(cx - 5 * scale, cy + 4 * scale + 25);
      ctx.lineTo(cx + 5 * scale, cy - 4 * scale + 25);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (topicId === "kmeans") {
      // Draw 3 cluster regions
      const centers = [
        { x: -2, y: 1.5, color: "#10b981" },
        { x: 2, y: 2, color: "#06b6d4" },
        { x: 0, y: -2, color: "#8b5cf6" },
      ];
      centers.forEach((c) => {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(cx + c.x * scale, cy - c.y * scale, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Render data points
    points.forEach((p) => {
      ctx.fillStyle = p.label === 1 ? "#06b6d4" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(cx + p.x * scale, cy - p.y * scale, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [points, topicId, param]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Click on the canvas to add custom mathematical points!</span>
        <Button variant="ghost" size="sm" onClick={resetPoints} className="h-7 text-xs gap-1">
          <RotateCcw className="h-3 w-3" /> Reset Points
        </Button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/80 overflow-hidden shadow-inner relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full cursor-crosshair block"
        />
        <div className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/60 px-2 py-0.5 rounded text-muted-foreground">
          Interactive Canvas 2D
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Q-Learning 5x5 Gridworld Simulation                     */
/* ------------------------------------------------------------------ */

function QLearningGridworld() {
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
  const [isRunning, setIsRunning] = useState(false);
  const qTableRef = useRef<Record<string, number[]>>({});

  // Initialize Q-table if empty
  if (Object.keys(qTableRef.current).length === 0) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        qTableRef.current[`${r},${c}`] = [0, 0, 0, 0]; // Up, Down, Left, Right
      }
    }
  }

  const stepAgent = () => {
    setAgentPos((curr) => {
      const stateKey = `${curr.r},${curr.c}`;
      const qValues = qTableRef.current[stateKey] || [0, 0, 0, 0];
      
      // Epsilon-greedy
      let action = 0;
      if (Math.random() < 0.2) {
        action = Math.floor(Math.random() * 4);
      } else {
        action = qValues.indexOf(Math.max(...qValues));
      }

      // Action: 0: Up, 1: Down, 2: Left, 3: Right
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

      // Q-update: Q(s,a) = Q(s,a) + alpha * (R + gamma * max Q(s',a') - Q(s,a))
      const nextKey = `${nr},${nc}`;
      const nextMax = Math.max(...(qTableRef.current[nextKey] || [0, 0, 0, 0]));
      const currentQ = qTableRef.current[stateKey][action];
      qTableRef.current[stateKey][action] = currentQ + 0.2 * (reward + 0.9 * nextMax - currentQ);

      if (isGoal || isTrap) {
        setEpisodes((e) => e + 1);
        return { r: 0, c: 0 };
      }
      return { r: nr, c: nc };
    });
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(stepAgent, 120);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-cyan-400">
          Episodes: <span className="font-bold text-foreground">{episodes}</span> • Target: [4, 4]
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {isRunning ? "Pause" : "Auto-Train"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={stepAgent}>
            Step
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5 p-3 rounded-2xl border border-white/10 bg-slate-950/80 max-w-sm mx-auto">
        {Array.from({ length: 25 }, (_, idx) => {
          const r = Math.floor(idx / 5);
          const c = idx % 5;
          const isAgent = agentPos.r === r && agentPos.c === c;
          const isGoal = goalPos.r === r && goalPos.c === c;
          const isTrap = traps.some((t) => t.r === r && t.c === c);

          const maxQ = Math.max(...(qTableRef.current[`${r},${c}`] || [0]));
          const intensity = Math.min(Math.max((maxQ + 5) / 15, 0), 1);

          return (
            <div
              key={idx}
              className={cn(
                "h-14 rounded-xl flex items-center justify-center font-mono text-xs border border-white/5 transition-all relative",
                isGoal && "bg-emerald-500/30 border-emerald-500 text-emerald-400 font-bold",
                isTrap && "bg-rose-500/30 border-rose-500 text-rose-400",
                !isGoal && !isTrap && "bg-white/5"
              )}
              style={!isGoal && !isTrap ? { backgroundColor: `rgba(6, 182, 212, ${intensity * 0.3})` } : {}}
            >
              {isAgent && (
                <span className="h-5 w-5 rounded-full bg-cyan-400 animate-pulse shadow-md" />
              )}
              {isGoal && "🎯"}
              {isTrap && "🔥"}
              <span className="absolute bottom-1 right-1 text-[8px] opacity-40 font-mono">
                {maxQ.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        Cyan glow intensity represents Q-value confidence. The agent learns to navigate around fire traps (🔥) to reach the target (🎯).
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
    toast.success("NumPy from-scratch code copied to clipboard!");
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
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-400" />
              Live Visualizer &amp; Loss Landscapes
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              {activeTopic.name}
            </span>
          </div>

          {/* Specialized Interactive Visualizer */}
          {activeParadigm === "reinforcement" ? (
            <div className="rounded-3xl border border-white/10 bg-card/60 p-4 shadow-lg">
              <h4 className="text-xs font-bold text-muted-foreground mb-3 font-mono">
                Tabular Q-Learning 5×5 Gridworld Simulation:
              </h4>
              <QLearningGridworld />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-card/60 p-4 shadow-lg space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground font-mono">
                2D Interactive Geometry &amp; Decision Boundary:
              </h4>
              <Interactive2DVisualizer topicId={activeTopic.id} />
            </div>
          )}

          {/* 3D Loss Optimization Landscape */}
          {activeTopic.lossSurface3d && (
            <div className="rounded-3xl border border-white/10 bg-card/60 p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground font-mono flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-cyan-400" /> 3D Optimization Objective Surface:
                </span>
                <span className="text-[11px] font-mono text-cyan-400">
                  Loss: {activeTopic.lossSurface3d}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-border/60">
                <Plot3D expr={activeTopic.lossSurface3d} height={380} />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                • ORBIT CAMERA TO INSPECT SADDLES &amp; MINIMA • ROTATE TO EXAMINE CONVEXITY
              </p>
            </div>
          )}
        </div>
      }
    />
  );
}
