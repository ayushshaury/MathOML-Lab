/**
 * Registry of all workspaces and tools across MathOML.
 * Drives navigation, quick search, and structured directories.
 */
export type CategoryId = "data-ml" | "graphing" | "calculus" | "algebra" | "stats";

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: string;
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
  {
    id: "data-ml",
    name: "Data & Machine Learning",
    description: "CSV profiling, 2D/3D Plotly charts, data cleaning, and ML algorithms",
    icon: "BarChart3",
  },
  {
    id: "graphing",
    name: "Graphing & OCR",
    description: "2D curves, 3D surface plotting, and photo equation scanning",
    icon: "LineChart",
  },
  {
    id: "calculus",
    name: "Calculus & ODEs",
    description: "Derivatives, integrals, limits, series, differential equations, vectors",
    icon: "TrendingUp",
  },
  {
    id: "algebra",
    name: "Algebra & Matrices",
    description: "Equations, systems, matrices, determinants, and eigenvalues",
    icon: "Grid3x3",
  },
  {
    id: "stats",
    name: "Statistics & General Math",
    description: "Descriptive statistics, probability, regression, geometry, calculator",
    icon: "Sigma",
  },
];

export const TOOLS: Tool[] = [
  // Data & Machine Learning
  {
    id: "eda-studio",
    name: "EDA Studio",
    category: "data-ml",
    description: "Upload CSV datasets, inspect statistics, explore 2D/3D plots, clean data, and export reports.",
    keywords: ["eda", "exploratory data analysis", "csv", "3d", "plotly", "box plot", "kde", "violin", "outliers", "missing values", "correlation", "pdf"],
    icon: "BarChart3",
  },
  {
    id: "ml-arena",
    name: "Machine Learning",
    category: "data-ml",
    description: "Interactive visualizations, mathematical derivations, and NumPy code for regression, classification, optimizers, and RL.",
    keywords: ["machine learning", "ml", "regression", "svm", "classification", "gradient descent", "sgd", "adam", "kmeans", "pca", "q-learning"],
    icon: "Brain",
  },

  // Graphing & OCR
  {
    id: "graph-2d",
    name: "2D Graphing Calculator",
    category: "graphing",
    description: "Plot curves with roots, extrema, tangent lines, and definite integrals.",
    keywords: ["graph", "plot", "2d", "function", "tangent", "area", "curve"],
    icon: "LineChart",
  },
  {
    id: "graph-3d",
    name: "3D Surface Plotter",
    category: "graphing",
    description: "Explore z = f(x, y) surfaces interactively with rotation and colormaps.",
    keywords: ["3d", "surface", "plot", "rotate", "xyz", "graph"],
    icon: "Mountain",
  },
  {
    id: "image-to-equation",
    name: "Image to Equation",
    category: "graphing",
    description: "Scan photos of handwritten equations and matrices into step-by-step solutions.",
    keywords: ["image", "photo", "ocr", "picture", "scan", "upload", "matrix"],
    icon: "ScanLine",
  },

  // Calculus & ODEs
  {
    id: "derivative",
    name: "Derivative Calculator",
    category: "calculus",
    description: "Differentiate expressions of any order with step-by-step rules.",
    keywords: ["derivative", "differentiate", "dy/dx", "slope", "tangent", "chain rule"],
    icon: "TrendingUp",
  },
  {
    id: "integral",
    name: "Integral Calculator",
    category: "calculus",
    description: "Definite and indefinite integrals with antiderivative checks.",
    keywords: ["integral", "integrate", "antiderivative", "area", "dx"],
    icon: "SquareStack",
  },
  {
    id: "limit",
    name: "Limit & Continuity",
    category: "calculus",
    description: "Two-sided limits, L'Hôpital's rule, and continuity checks.",
    keywords: ["limit", "continuity", "lhopital", "approaches", "converge"],
    icon: "MoveRight",
  },
  {
    id: "partial-derivative",
    name: "Partial Derivatives",
    category: "calculus",
    description: "Compute multivariable partial derivatives step by step.",
    keywords: ["partial", "multivariable", "gradient"],
    icon: "GitBranch",
  },
  {
    id: "taylor",
    name: "Taylor Series",
    category: "calculus",
    description: "Taylor and Maclaurin polynomial expansions of any degree.",
    keywords: ["taylor", "maclaurin", "series", "approximation", "polynomial"],
    icon: "Infinity",
  },
  {
    id: "sequences",
    name: "Sequences & Series",
    category: "calculus",
    description: "Pattern detection, nth terms, partial sums, and convergence tests.",
    keywords: ["sequence", "series", "arithmetic", "geometric", "sum", "convergence"],
    icon: "ListOrdered",
  },
  {
    id: "ode-solver",
    name: "ODE Solver",
    category: "calculus",
    description: "First and second-order differential equations with direction fields.",
    keywords: ["differential", "ode", "dy/dx", "y'", "rk4"],
    icon: "Waves",
  },
  {
    id: "vector-calculus",
    name: "Gradient, Divergence & Curl",
    category: "calculus",
    description: "Vector operators across scalar and 3D vector fields.",
    keywords: ["gradient", "divergence", "curl", "nabla", "vector field"],
    icon: "Compass",
  },

  // Algebra & Matrices
  {
    id: "equation-solver",
    name: "Equation Solver",
    category: "algebra",
    description: "Linear, quadratic, and polynomial equations with full solution steps.",
    keywords: ["solve", "equation", "linear", "quadratic", "root", "algebra"],
    icon: "Equal",
  },
  {
    id: "algebra-tool",
    name: "Expression Tool",
    category: "algebra",
    description: "Simplify, expand, and factor algebraic expressions.",
    keywords: ["simplify", "expand", "factor", "expression", "algebra"],
    icon: "Shuffle",
  },
  {
    id: "system-solver",
    name: "System of Equations",
    category: "algebra",
    description: "Solve linear systems step by step using Gaussian elimination.",
    keywords: ["system", "simultaneous", "gauss", "linear", "solve"],
    icon: "Layers",
  },
  {
    id: "matrix-calculator",
    name: "Matrix Calculator",
    category: "algebra",
    description: "Add, multiply, transpose, invert, and compute rank or trace.",
    keywords: ["matrix", "matrices", "multiply", "transpose", "rank", "trace"],
    icon: "Grid3x3",
  },
  {
    id: "determinant",
    name: "Determinant & Inverse",
    category: "algebra",
    description: "Determinants via cofactor expansion and inverses via Gauss-Jordan.",
    keywords: ["determinant", "inverse", "det", "gauss jordan", "singular"],
    icon: "SquareDashed",
  },
  {
    id: "eigen",
    name: "Eigenvalues & Eigenvectors",
    category: "algebra",
    description: "Compute characteristic equations, eigenvalues, and eigenvectors.",
    keywords: ["eigenvalue", "eigenvector", "characteristic"],
    icon: "Grid3x3",
  },

  // Statistics & General Math
  {
    id: "statistics",
    name: "Descriptive Statistics",
    category: "stats",
    description: "Mean, median, quartiles, standard deviation, outliers, and charts.",
    keywords: ["statistics", "mean", "median", "mode", "std", "variance", "quartile"],
    icon: "BarChart3",
  },
  {
    id: "probability",
    name: "Probability & Distributions",
    category: "stats",
    description: "Binomial, normal, Poisson distributions, and combinatorics.",
    keywords: ["probability", "binomial", "normal", "poisson", "permutation", "combination"],
    icon: "Dice5",
  },
  {
    id: "regression",
    name: "Regression & Correlation",
    category: "stats",
    description: "Least-squares regression lines, R², and residual checks.",
    keywords: ["regression", "correlation", "scatter", "least squares", "r2"],
    icon: "LineChart",
  },
  {
    id: "hypothesis",
    name: "Hypothesis Testing",
    category: "stats",
    description: "Run z-tests and t-tests with p-values and critical thresholds.",
    keywords: ["hypothesis", "z-test", "t-test", "p-value", "significance"],
    icon: "FlaskConical",
  },
  {
    id: "trig-solver",
    name: "Trigonometry",
    category: "stats",
    description: "Solve trigonometric equations, verify identities, and evaluate angles.",
    keywords: ["trig", "sin", "cos", "tan", "identity", "radians", "degrees"],
    icon: "Triangle",
  },
  {
    id: "geometry",
    name: "Geometry",
    category: "stats",
    description: "Compute areas, volumes, perimeters, and coordinate distances.",
    keywords: ["geometry", "area", "volume", "circle", "sphere", "triangle"],
    icon: "Shapes",
  },
  {
    id: "calculator",
    name: "Scientific Calculator",
    category: "stats",
    description: "Evaluate mathematical expressions, functions, and constants.",
    keywords: ["calculator", "evaluate", "compute", "scientific"],
    icon: "Calculator",
  },
];

export function getTool(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByCategory(cat: CategoryId): Tool[] {
  return TOOLS.filter((t) => t.category === cat);
}

/** Fuzzy search across all tools. */
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
  determinant: ["[[4,7],[2,6]]", "[[1,2,3],[4,5,6],[7,8,10]]"],
  eigen: ["[[-2,-4,2],[-2,-1,2],[4,2,5]]", "[[2,0],[0,3]]", "[[4,1],[2,3]]"],
  "ode-solver": ["y' + 2*y = e^(-x)", "y' = x*y", "y'' - 3*y' + 2*y = 0", "y'' + y = 0", "y' = x^2"],
  "vector-calculus": ["x^2*y + y^2*z", "x*y, y*z, x*z"],
  "trig-solver": ["sin(x) = 0.5", "cos(x) = -0.5", "tan(x) = 1", "2*sin(x) - 1 = 0"],
  geometry: ["circle", "sphere"],
  statistics: ["12 15 11 20 17 14 12 19 16 13", "2, 4, 4, 4, 5, 5, 7, 9"],
  "eda-studio": ["Titanic", "Housing", "Cardiovascular"],
  probability: ["binomial", "normal", "poisson"],
  regression: ["1 2\n2 4.1\n3 5.8\n4 8.2\n5 10.1", "0 1\n1 2.2\n2 4.3\n3 7.9"],
  hypothesis: ["102 98 101 99 103 97 100 104 98 100"],
  "graph-2d": ["sin(x)", "x^2", "1/x"],
  "graph-3d": ["sin(x)*cos(y)", "x^2 - y^2", "exp(-(x^2+y^2)/4)"],
  calculator: ["2^(10)", "sqrt(144) + 3^3", "log(1000)", "sin(pi/6)"],
  "image-to-equation": [],
  "ml-arena": ["Linear Regression", "Logistic Regression", "SVM", "Adam Optimizer", "K-Means", "Q-Learning"],
};
