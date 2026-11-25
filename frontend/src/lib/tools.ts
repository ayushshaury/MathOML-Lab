/**
 * Registry of every tool in the maths laboratory — drives navigation,
 * search and the home page.
 */
export type CategoryId = "algebra" | "calculus" | "linear" | "odes" | "vector" | "trig" | "geometry" | "stats" | "graphing" | "utilities" | "ml";

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind classes for accents
}

export interface Tool {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  keywords: string[];
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: "algebra", name: "Algebra", description: "Equations, expressions, systems", icon: "Sigma", color: "emerald" },
  { id: "calculus", name: "Calculus", description: "Derivatives, integrals, limits, series", icon: "TrendingUp", color: "amber" },
  { id: "linear", name: "Matrices & Linear Algebra", description: "Operations, determinants, eigenvalues", icon: "Grid3x3", color: "rose" },
  { id: "odes", name: "Differential Equations", description: "ODEs with full methods", icon: "Waves", color: "cyan" },
  { id: "vector", name: "Vector Calculus", description: "Gradient, divergence, curl", icon: "Compass", color: "violet" },
  { id: "trig", name: "Trigonometry", description: "Equations, identities, evaluation", icon: "Triangle", color: "orange" },
  { id: "geometry", name: "Geometry", description: "Shapes, solids, coordinates", icon: "Shapes", color: "lime" },
  { id: "stats", name: "Statistics & Probability", description: "Data, distributions, regression", icon: "BarChart3", color: "sky" },
  { id: "graphing", name: "Graphing", description: "2D and 3D visual calculators", icon: "LineChart", color: "teal" },
  { id: "utilities", name: "Utilities", description: "Calculator, image-to-equation", icon: "Calculator", color: "slate" },
  { id: "ml", name: "Machine Learning Arena", description: "Regression, classification, optimizers, unsupervised & RL", icon: "Brain", color: "indigo" },
];

export const TOOLS: Tool[] = [
  // Algebra
  { id: "equation-solver", name: "Equation Solver", category: "algebra", description: "Linear, quadratic and polynomial equations with full working.", keywords: ["solve", "equation", "linear", "quadratic", "root", "algebra"], icon: "Equal" },
  { id: "algebra-tool", name: "Expression Tool", category: "algebra", description: "Simplify, expand and factor any algebraic expression.", keywords: ["simplify", "expand", "factor", "expression", "algebra"], icon: "Shuffle" },
  { id: "system-solver", name: "System of Equations", category: "algebra", description: "Solve linear systems with Gaussian elimination steps.", keywords: ["system", "simultaneous", "gauss", "linear", "solve"], icon: "Layers" },
  // Calculus
  { id: "derivative", name: "Derivative Calculator", category: "calculus", description: "Any-order derivatives with every rule explained.", keywords: ["derivative", "differentiate", "dy/dx", "slope", "tangent", "chain rule"], icon: "TrendingUp" },
  { id: "integral", name: "Integral Calculator", category: "calculus", description: "Definite and indefinite integrals with verification.", keywords: ["integral", "integrate", "antiderivative", "area", "dx"], icon: "SquareStack" },
  { id: "limit", name: "Limit & Continuity", category: "calculus", description: "Two-sided limits, L'Hôpital and continuity checks.", keywords: ["limit", "continuity", "lhopital", "approaches", "converge"], icon: "MoveRight" },
  { id: "partial-derivative", name: "Partial Derivatives", category: "calculus", description: "Differentiate multivariable functions step by step.", keywords: ["partial", "multivariable", "delf", "gradient component"], icon: "GitBranch" },
  { id: "taylor", name: "Taylor Series", category: "calculus", description: "Taylor & Maclaurin polynomials of any order.", keywords: ["taylor", "maclaurin", "series", "approximation", "polynomial"], icon: "Infinity" },
  { id: "sequences", name: "Sequences & Series", category: "calculus", description: "Pattern detection, nth terms, sums and convergence.", keywords: ["sequence", "series", "arithmetic", "geometric", "sum", "convergence"], icon: "ListOrdered" },
  // Linear algebra
  { id: "matrix-calculator", name: "Matrix Calculator", category: "linear", description: "Add, subtract, multiply, transpose, powers, rank, trace.", keywords: ["matrix", "matrices", "multiply", "transpose", "rank", "trace"], icon: "Grid3x3" },
  { id: "determinant", name: "Determinant & Inverse", category: "linear", description: "Cofactor expansion and Gauss-Jordan with steps.", keywords: ["determinant", "inverse", "det", "gauss jordan", "singular"], icon: "SquareDashed" },
  { id: "eigen", name: "Eigenvalue Calculator", category: "linear", description: "Eigenvalues and eigenvectors with the characteristic equation.", keywords: ["eigenvalue", "eigenvector", "spectrum", "characteristic"], icon: "Eigenvector" },
  // ODEs
  { id: "ode-solver", name: "ODE Solver", category: "odes", description: "First & second order ODEs with method steps and direction fields.", keywords: ["differential", "ode", "dy/dx", "y'", "integrating factor", "rk4"], icon: "Waves" },
  // Vector calculus
  { id: "vector-calculus", name: "Gradient · Divergence · Curl", category: "vector", description: "Vector calculus operators on scalar and vector fields.", keywords: ["gradient", "divergence", "curl", "nabla", "vector field", "del"], icon: "Compass" },
  // Trig
  { id: "trig-solver", name: "Trigonometry Toolkit", category: "trig", description: "Solve trig equations, verify identities, evaluate angles.", keywords: ["trig", "sin", "cos", "tan", "identity", "radians", "degrees"], icon: "Triangle" },
  // Geometry
  { id: "geometry", name: "Geometry Calculator", category: "geometry", description: "Areas, volumes, perimeters and coordinate geometry.", keywords: ["geometry", "area", "volume", "circle", "sphere", "triangle", "distance"], icon: "Shapes" },
  // Stats
  { id: "statistics", name: "Descriptive Statistics", category: "stats", description: "Mean, median, quartiles, deviation, outliers, charts.", keywords: ["statistics", "mean", "median", "mode", "std", "variance", "quartile"], icon: "BarChart3" },
  { id: "eda-studio", name: "EDA Studio (Exploratory Data Analysis)", category: "stats", description: "Interactive data profiling, distribution visualizer (Box Plots, KDE, Violin, Heatmap), and messy data cleaning (outliers, missing values, scaling).", keywords: ["eda", "exploratory data analysis", "box plot", "kde", "violin", "outliers", "missing values", "heatmap", "correlation", "data cleaning", "imputation", "skewness", "pairplot"], icon: "BarChart3" },
  { id: "probability", name: "Probability & Distributions", category: "stats", description: "Binomial, normal, Poisson and combinatorics.", keywords: ["probability", "binomial", "normal", "poisson", "permutation", "combination", "distribution"], icon: "Dice5" },
  { id: "regression", name: "Regression & Correlation", category: "stats", description: "Least-squares fitting with R² and residual analysis.", keywords: ["regression", "correlation", "scatter", "least squares", "fit", "r2"], icon: "LineChart" },
  { id: "hypothesis", name: "Hypothesis Testing", category: "stats", description: "z-tests and t-tests with p-values.", keywords: ["hypothesis", "z-test", "t-test", "p-value", "significance"], icon: "FlaskConical" },
  // Graphing
  { id: "graph-2d", name: "2D Graphing Calculator", category: "graphing", description: "Interactive plots: tangents, areas, roots, extrema.", keywords: ["graph", "plot", "2d", "function", "tangent", "area", "curve"], icon: "LineChart" },
  { id: "graph-3d", name: "3D Surface Plotter", category: "graphing", description: "Rotate and explore z = f(x, y) surfaces.", keywords: ["3d", "surface", "plot", "rotate", "xyz", "graph"], icon: "Mountain" },
  // Utilities
  { id: "calculator", name: "Scientific Calculator", category: "utilities", description: "Evaluate any expression with constants and functions.", keywords: ["calculator", "evaluate", "compute", "scientific"], icon: "Calculator" },
  { id: "image-to-equation", name: "Image to Equation", category: "utilities", description: "Upload a photo of a problem and get an editable equation.", keywords: ["image", "photo", "ocr", "picture", "scan", "upload", "recognize"], icon: "ScanLine" },
  // Machine Learning Arena
  { id: "ml-arena", name: "Machine Learning Arena", category: "ml", description: "Interactive visualizations, mathematical derivations, and Python code for Regression, Classification, Optimization, and RL.", keywords: ["machine learning", "ml", "regression", "svm", "classification", "gradient descent", "sgd", "adam", "kmeans", "pca", "q-learning", "reinforcement learning"], icon: "Brain" },
];

export function getTool(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByCategory(cat: CategoryId): Tool[] {
  return TOOLS.filter((t) => t.category === cat);
}

/** Simple fuzzy search across tools. */
export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = TOOLS.map((t) => {
    let score = 0;
    const name = t.name.toLowerCase();
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 50;
    if (name.includes(q)) score += 25;
    if (t.description.toLowerCase().includes(q)) score += 10;
    t.keywords.forEach((k) => {
      if (k === q) score += 40;
      if (k.includes(q)) score += 15;
      if (q.includes(k) && k.length > 2) score += 8;
    });
    return { tool: t, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.tool);
}

export const EXAMPLES: Record<string, string[]> = {
  "equation-solver": ["2*x + 5 = 17", "x^2 - 5*x + 6 = 0", "3*x^2 + 2*x - 8 = 0", "2*x + 3 = x - 7"],
  "algebra-tool": ["(x + 3)*(x - 2)", "x^2 - 9", "(x+2)^3", "sin(x)^2 + cos(x)^2"],
  "system-solver": ["2*x + 3*y = 8\nx - y = 1", "x + y + z = 6\n2*x - y + z = 3\nx + 2*y - z = 2"],
  derivative: ["x^3 - 6*x^2 + 11*x - 6", "sin(x)*cos(x)", "x^2*e^x", "(x^2+1)/(x^2-1)", "e^(2*x)*sin(x)", "ln(x^2 + 1)"],
  integral: ["x^2 + 3*x", "sin(x)*x", "1/(x^2 + 1)", "e^(-x)*x", "x*sqrt(x+1)"],
  limit: ["sin(x)/x", "(x^2-4)/(x-2)", "(1+1/n)^n", "x*ln(x)"],
  "partial-derivative": ["x^2*y + sin(x*y)", "x*y*z^2", "e^(x*y)"],
  taylor: ["sin(x)", "e^x", "ln(1+x)", "cos(x)"],
  sequences: ["2, 5, 8, 11, 14", "3, 6, 12, 24", "1, 4, 9, 16, 25"],
  "matrix-calculator": ["[[1,2],[3,4]]", "[[2,0,1],[1,3,0]]"],
  "determinant": ["[[4,7],[2,6]]", "[[1,2,3],[4,5,6],[7,8,10]]"],
  eigen: ["[[-2,-4,2],[-2,-1,2],[4,2,5]]", "[[2,0],[0,3]]", "[[4,1],[2,3]]"],
  "ode-solver": ["y' + 2*y = e^(-x)", "y' = x*y", "y'' - 3*y' + 2*y = 0", "y'' + y = 0", "y' = x^2"],
  "vector-calculus": ["x^2*y + y^2*z", "x*y, y*z, x*z"],
  "trig-solver": ["sin(x) = 0.5", "cos(x) = -0.5", "tan(x) = 1", "2*sin(x) - 1 = 0"],
  geometry: ["circle", "sphere"],
  statistics: ["12 15 11 20 17 14 12 19 16 13", "2, 4, 4, 4, 5, 5, 7, 9"],
  "eda-studio": ["Titanic Age & Fare Distribution", "Housing Outliers & Missing LotFrontage", "Cardiovascular Cholesterol Skewness"],
  probability: ["binomial", "normal", "poisson"],
  regression: ["1 2\n2 4.1\n3 5.8\n4 8.2\n5 10.1", "0 1\n1 2.2\n2 4.3\n3 7.9"],
  hypothesis: ["102 98 101 99 103 97 100 104 98 100"],
  "graph-2d": ["sin(x)", "x^2", "1/x"],
  "graph-3d": ["sin(x)*cos(y)", "x^2 - y^2", "exp(-(x^2+y^2)/4)"],
  calculator: ["2^(10)", "sqrt(144) + 3^3", "log(1000)", "sin(pi/6)"],
  "image-to-equation": [],
  "ml-arena": ["Linear Regression OLS", "Logistic Regression Sigmoid", "Support Vector Machines (SVM)", "Adam Optimizer", "K-Means Clustering", "Q-Learning Gridworld"],
};
