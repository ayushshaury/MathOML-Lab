# 🧮 MathOML — Mathematical & Machine Learning Studio

MathOML is an interactive mathematical intelligence and machine learning studio built with **Next.js 16**, **React 19**, **TypeScript**, and **Express**. It brings together computer algebra systems (CAS), interactive machine learning simulations, an Exploratory Data Analysis (EDA) suite with animated data pipelines, and intelligent mathematical OCR capable of parsing multi-part worksheets and matrix structures.

---

## 🏛️ Project Architecture

The repository is structured as a clean two-folder monorepo designed for automated, independent deployments:

```
mathlab-project/
├── backend/                  # Production Express & OCR API Server (Render)
│   ├── src/
│   │   ├── ocr.ts            # Tesseract OCR & matrix extraction engine
│   │   └── server.ts         # Express routes (/health, /api/ocr)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # Next.js 16 App Router & UI Suite (Vercel)
│   ├── src/
│   │   ├── app/              # Routes, API handlers, layout & styling
│   │   ├── components/       # UI components & instrument suites
│   │   │   ├── tools/        # 25+ Math, ML & EDA tools
│   │   │   └── ui/           # Accessible UI primitives (Radix UI)
│   │   └── lib/              # Math engines, stats, solvers & registry
│   ├── package.json
│   └── next.config.ts
│
├── package.json              # Monorepo workspace commands
└── README.md
```

---

## ✨ Core Modules & Instruments

### 📊 1. Exploratory Data Analysis (EDA) Studio
A complete statistical profiling and messy data cleaning suite with live visual feedback:
- **Interactive Visualizations**:
  - **Box Plots**: Displays median, interquartile range ($Q_1, Q_3$), Tukey fences ($1.5 \times \text{IQR}$), and pulsing outlier markers.
  - **Gaussian Kernel Density Estimation (KDE)**: Real-time bandwidth ($h$) smoothing with an interactive toggle for **individual Gaussian kernel bump decomposition** ($K_i(x)$).
  - **Violin Plots**: Mirrored density envelopes combined with box plot markers.
  - **Histograms & Frequency Distributions**: Dynamic bin count and bin width adjustment.
  - **Scatter Plots & OLS Regression**: Best-fit trendline with animated **residual error vectors** ($e_i = y_i - \hat{y}_i$) and live **Sum of Squared Errors (SSE)** readout.
  - **Correlation Heatmap**: Interactive Pearson correlation matrix ($r \in [-1, 1]$).
  - **Missingness Bar Charts & Q-Q Normality Plots**: Diagnostic charts for data distribution and completeness.
- **Interactive 5-Stage Data Cleaning Pipeline Simulator**:
  - Full transport playback controls: **Play**, **Pause**, **Step Forward**, **Reset**, and **Speed Toggles** (`0.5x`, `1.0x`, `2.0x`).
  - **Stage 1 (Scan)**: Identifies anomalies, invalid types, and null/NaN values.
  - **Stage 2 (IQR Calipers)**: Caliper brackets expand from median to $Q_1$, $Q_3$, and Tukey fences.
  - **Stage 3 (Imputation)**: Missing entries smoothly drop into their central tendencies (Mean or Median).
  - **Stage 4 (Winsorization / Outlier Clamping)**: Points outside the $1.5\text{IQR}$ fences slide along the axis and dock at boundary thresholds.
  - **Stage 5 (Normalization)**: Vectors dynamically compress into Min-Max $[0, 1]$ or $Z$-score unit bounds.
- **Data Profiling & Decision Guide**:
  - Decision trees for handling continuous, categorical, and ordinal data.
  - Skewness and kurtosis metrics with transformation recommendations (Log, Box-Cox).
  - Preloaded sample datasets: Titanic Passengers, Housing Prices, and Cardiovascular Health.

---

### 🧠 2. Machine Learning Arena
Interactive playgrounds combining mathematical derivations, visual parameter tuning, and from-scratch Python code:
- **Optimization Studio**:
  - **Gradient Descent (GD) & Stochastic Gradient Descent (SGD)**: Step-by-step trajectory animation.
  - **3D Loss Landscapes & 2D Contour Maps**: Real-time rendering of complex multimodal loss surfaces (e.g., Rosenbrock, Ackley, Saddle points).
  - **Hyperparameter Tuning**: Real-time adjustments for learning rate ($\alpha$), momentum ($\beta$), batch size, and epoch limits.
  - **Optimizer Comparisons**: Visual trajectories comparing Vanilla SGD, Momentum, and Adam.
- **Supervised Learning**:
  - **Linear Regression**: Ordinary Least Squares (OLS) closed-form calculation and gradient updates.
  - **Logistic Regression**: Sigmoid activation curve, decision boundaries, and binary cross-entropy loss.
  - **Support Vector Machines (SVM)**: Maximum margin hyperplanes and support vector identification.
  - **Decision Trees**: Splitting criteria based on Gini impurity and information gain.
- **Unsupervised Learning & RL**:
  - **K-Means Clustering**: Iterative centroid updates with Voronoi region partitioning.
  - **Principal Component Analysis (PCA)**: Eigenvector projection onto principal variance axes.
  - **Tabular Q-Learning**: Real-time agent exploration vs. exploitation in a dynamic Gridworld environment.

---

### 📷 3. Intelligent Math OCR & Matrix Solver
- **Multi-Question Segmentation**: Parses full worksheets containing multiple numbered questions (e.g., `1.`, `2.`, `Q1:`, `a)`).
- **Matrix Extraction**:
  - Detects 2D bracketed numbers and grids from images.
  - Generates clean LaTeX syntax (`\begin{pmatrix} ... \end{pmatrix}`).
  - Automatically routes detected matrices to linear algebra solvers for determinants, inverses, rank, and eigenvalues.
- **Equation & Formula Recognition**: Recognizes exponents, fractions, roots, calculus notation, and Greek letters.
- **Dual Processing Architecture**: Runs client-side via Web Workers or offloads to the dedicated Express OCR backend.
- **Live KaTeX Rendering**: Immediate mathematical typesetting for recognized equations and step-by-step solutions.

---

### 🧮 4. Computer Algebra System (CAS) & Mathematics Instruments
Over 25 dedicated mathematical instruments covering major university and engineering disciplines:
- **Algebra**: Linear, quadratic, and polynomial equation solvers with step-by-step factoring; systems of equations via Gaussian elimination.
- **Calculus**:
  - Any-order derivatives with chain, product, and quotient rules explained.
  - Definite and indefinite integrals with antiderivative verification.
  - Two-sided limits, continuity checks, and L'Hôpital's rule.
  - Multivariable partial derivatives and Taylor/Maclaurin series expansions.
  - Sequence pattern detection and series convergence tests.
- **Linear Algebra**: Matrix operations (addition, multiplication, transpose, powers, rank, trace), cofactor determinant expansion, Gauss-Jordan inversion, and characteristic polynomial eigenvalue solvers.
- **Differential Equations (ODEs)**: First and second-order differential equations with method steps and numerical approximations (Runge-Kutta / RK4).
- **Vector Calculus**: Gradient ($\nabla f$), divergence ($\nabla \cdot \mathbf{F}$), and curl ($\nabla \times \mathbf{F}$) across scalar and vector fields.
- **Trigonometry & Geometry**: Trig equation solver, identity verification, coordinate geometry, and 2D/3D shapes.
- **Graphing Calculators**:
  - **2D Graphing**: Dynamic curve tracing, numerical tangent slopes, critical points, roots, and integral area fills.
  - **3D Surface Plotter**: Real-time directional lighting, mouse orbit camera rotation, wireframe controls, and colormaps (*Viridis*, *Plasma*, *Cool-Warm*).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.18.0 or newer (tested on Node v20 & v22 LTS)
- **npm**: v9 or newer

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ayushshaury/MathOML-Lab.git
   cd mathlab-project
   ```

2. **Install all dependencies**:
   ```bash
   # Installs dependencies across both frontend and backend
   npm run install:all
   ```

3. **Start local development servers**:
   ```bash
   # Run frontend (http://localhost:3000)
   npm run dev

   # In a separate terminal, run backend API (http://localhost:10000)
   npm run backend:dev
   ```

4. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Monorepo Scripts

| Command | Action |
|---|---|
| `npm run dev` | Runs the Next.js frontend development server on port 3000 |
| `npm run build` | Compiles the production Next.js frontend bundle |
| `npm run start` | Starts the production Next.js frontend server |
| `npm run lint` | Runs ESLint across the frontend codebase |
| `npm run backend:dev` | Runs the Express backend server with hot-reload (`tsx watch`) |
| `npm run backend:build` | Compiles the TypeScript backend into JavaScript (`dist/`) |
| `npm run backend:start` | Runs the compiled backend server (`node dist/server.js`) |
| `npm run install:all` | Runs `npm install` in both `frontend` and `backend` directories |

---

## ☁️ Deployment

### Frontend (Vercel)
1. Import the repository on [Vercel](https://vercel.com).
2. Set the **Root Directory** to `frontend`.
3. Set the **Framework Preset** to `Next.js`.
4. Configure Build Command: `next build --webpack` (or default `npm run build`).
5. Set environment variables (optional):
   ```env
   NEXT_PUBLIC_OCR_API_URL=https://your-backend-app.onrender.com
   ```

### Backend (Render)
1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your repository.
3. Set **Root Directory** to `backend`.
4. Set **Runtime** to `Node`.
5. Configure deployment settings:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
6. Set environment variables:
   ```env
   PORT=10000
   ALLOWED_ORIGIN=https://your-frontend-app.vercel.app
   ```

---

## 🧰 Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/), [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Mathematics & CAS**: [Math.js](https://mathjs.org/), [Nerdamer](https://nerdamer.com/), [KaTeX](https://katex.org/)
- **Data & OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/), HTML5 Canvas, Web Workers
- **Backend API**: [Express 4](https://expressjs.com/), [TypeScript 5](https://www.typescriptlang.org/), [CORS](https://github.com/expressjs/cors), [Dotenv](https://github.com/motdotla/dotenv)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
