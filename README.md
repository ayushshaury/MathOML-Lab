# 🧮 MathLab — Interactive Mathematical Intelligence Studio

An advanced, modern mathematics exploration platform built with **Next.js 15**, **React 19**, and **Tailwind CSS**. MathLab combines interactive visualization, symbolic computation, multi-question mathematical OCR, and linear algebra into a cohesive, high-performance web experience.

---

## ✨ Features

### 📈 1. Interactive 2D Function Visualizer
- **Real-time Function Plotting**: Graph single or multivariable functions with instant canvas rendering.
- **Dynamic Curve Tracing & Analysis**: Live cursor tracking with numerical tangent slopes, critical points, roots, and extrema.
- **Interactive Parameter Sliders**: Tune variables in real time with smooth animations and dynamic step intervals.
- **Customizable Viewport**: Pan, zoom, autoscale, and toggle high-contrast grid coordinate axes.

### 🌐 2. 3D Multivariable Surface Explorer
- **Realistic 3D Shading**: Dynamic directional lighting model with surface normal calculations.
- **Custom Color Palettes**: Choose between *Viridis*, *Plasma*, *Cool-Warm*, and *Neon Cyber* colormaps.
- **Smooth Orbit Camera**: Intuitive mouse/pointer drag rotation with bounded pitch and elevation controls.
- **Grid Density & Wireframe Control**: Granular resolution controls for complex mathematical topology.

### 📷 3. Intelligent Math OCR & Queue Solver
- **Multi-Question Detection**: Automatically parses worksheets containing multiple numbered questions (e.g. `1.`, `2.`, `Q1:`, `a)`).
- **Sequential Solver Queue**: Solves complex math equations one by one with live status indicators and progress bars.
- **Cyberpunk HUD Animation**: Real-time laser scanning visual effects during optical character recognition.
- **Offline / Local Processing**: Powered by `tesseract.js` without relying on flaky third-party external APIs.
- **1-Click Demo Worksheets**: Built-in test cases for algebra, calculus, and quadratic equations.

### 🔢 4. Linear Algebra & Matrix Studio
- **Matrix Operations**: Determinants, inverse, transpose, rank, and trace calculations.
- **Eigenvalue & Eigenvector Decomposition**: Fast numerical solvers for systems of linear equations.
- **Step-by-step Gaussian Elimination**: Educational breakdowns of row echelon reductions.

### 📐 5. Calculus, Algebra & Geometry Toolkits
- **Calculus**: Symbolic and numerical differentiation, integration, Taylor series approximations, and limits.
- **Geometry**: Geometric shape builders, polygon properties, and trigonometric solvers.
- **Export & Share**: High-resolution image export and shareable mathematical notebooks.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.18.0 or newer (tested on Node v20 & v24)
- **npm**: v9 or newer

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/mathlab-project.git
   cd mathlab-project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Scripts

- `npm run dev`: Starts the Next.js development server on port 3000.
- `npm run build`: Builds the production bundle with Next.js 15.
- `npm run start`: Runs the built production server.
- `npm run lint`: Runs ESLint checks.

---

## 🏗️ Architecture & Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with Lucide React icons
- **Math & OCR Engine**: `tesseract.js`, custom numerical math engines
- **Database / ORM**: SQLite & Prisma
- **Type Safety**: Full TypeScript strict mode checking

---

## 🛡️ Security & Reliability

- **0 Known Vulnerabilities**: Verified clean through `npm audit`.
- **Sandbox Resilient**: Robust error boundaries and defensive null checks across canvas rendering pipelines.

---

## 📄 License

This project is licensed under the MIT License.
