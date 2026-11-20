# 🚀 MathOML Production Deployment Guide

This guide explains how to deploy **MathOML** in production using a decoupled architecture:
- **Frontend** deployed on **[Vercel](https://vercel.com)** (Next.js 15, edge-optimized, static assets, client-side CAS)
- **Backend** deployed on **[Render](https://render.com)** (Node.js/Express, OCR engine with Tesseract, high-payload image processor, database)

---

## 🏗️ Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              User Browser                    │
                      └──────────────┬───────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
    ┌───────────────────────────┐           ┌───────────────────────────┐
    │     Vercel (Frontend)     │           │      Render (Backend)     │
    │                           │           │                           │
    │  • Next.js 15 App Router  │           │  • Express.js Server      │
    │  • 2D/3D Visualizers      │──────────>│  • Tesseract Math OCR     │
    │  • Symbolic Solvers       │  /api/ocr │  • Health Check (/health) │
    │  • Global CDN Caching     │           │  • Database (Prisma)      │
    └───────────────────────────┘           └───────────────────────────┘
```

---

## Part 1: Deploy Backend to Render

### Option A: Automatic 1-Click via Render Blueprint (Recommended)
1. Go to the **[Render Dashboard](https://dashboard.render.com)**.
2. Click **New +** in the top right and select **Blueprint**.
3. Connect your GitHub repository: `https://github.com/ayushshaury/MathOML-Lab`.
4. Render will automatically detect [`render.yaml`](./render.yaml).
5. Click **Apply**. Render will automatically build and start the `mathoml-backend` web service.
6. Once deployed, copy your Render service URL (e.g., `https://mathoml-backend.onrender.com`).

---

### Option B: Manual Web Service Setup
1. In the **Render Dashboard**, click **New +** -> **Web Service**.
2. Connect your repository: `https://github.com/ayushshaury/MathOML-Lab`.
3. Configure the settings:
   - **Name**: `mathoml-backend`
   - **Region**: Closest to your users (e.g., Oregon, Frankfurt, Singapore)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for 24/7 zero-spin-down)
4. Under **Advanced**:
   - **Health Check Path**: `/health`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: `10000`
     - `ALLOWED_ORIGIN`: `*` (or your Vercel URL once known)
5. Click **Create Web Service**.
6. When live, verify the endpoint:
   ```bash
   curl https://<your-backend-name>.onrender.com/health
   # Returns: {"status":"ok","service":"mathoml-backend",...}
   ```

---

## Part 2: Deploy Frontend to Vercel

1. Go to the **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `https://github.com/ayushshaury/MathOML-Lab`.
4. Configure the project:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./` (leave default repository root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. **Environment Variables**:
   Add the following environment variable:
   - **Name**: `NEXT_PUBLIC_BACKEND_URL`
   - **Value**: `https://<your-backend-name>.onrender.com` (Your Render URL from Part 1, without a trailing slash)
6. Click **Deploy**.
7. Vercel will build and launch your production frontend in under 60 seconds!

---

## Part 3: Local Development (Full-Stack)

You can run both the frontend and backend locally with ease:

### 1. Run Next.js Frontend (Port 3000):
```bash
npm install
npm run dev
```

### 2. Run Render Backend (Port 10000):
In a second terminal window:
```bash
npm run backend:dev
# Or:
cd backend
npm install
npm run dev
```

---

## 🛠️ File Structure Summary

```
mathlab-project/
├── backend/                       # Dedicated Render Web Service
│   ├── src/
│   │   ├── server.ts              # Express API Server (CORS, health, /api/ocr)
│   │   └── ocr.ts                 # Tesseract.js math parser
│   ├── package.json               # Backend dependencies
│   ├── tsconfig.json              # Backend TypeScript config
│   ├── Dockerfile                 # Optional Render Docker container
│   └── .env.example
├── src/                           # Next.js 15 Frontend for Vercel
│   ├── app/                       # App Router UI & routes
│   ├── components/                # Interactive 2D/3D & Math Tools
│   └── lib/
│       └── api-client.ts          # Unified client connecting to Render
├── render.yaml                    # Render Blueprint (Infrastructure as Code)
├── vercel.json                    # Vercel Production Configuration
├── .env.example                   # Root environment configuration
└── DEPLOYMENT.md                  # This deployment manual
```

---

## ✅ Deployment Checklist

- [x] Backend configured with `cors({ origin: "*" })` to allow cross-origin requests from Vercel.
- [x] Healthcheck endpoint `/health` configured for Render monitoring.
- [x] High-payload support (`50mb`) configured for image base64 uploads.
- [x] Frontend `api-client.ts` automatically routes requests to `NEXT_PUBLIC_BACKEND_URL`.
- [x] KaTeX global styles imported in root `layout.tsx` for clean production bundling.
- [x] 0 vulnerabilities, clean TypeScript, and production-ready build.
