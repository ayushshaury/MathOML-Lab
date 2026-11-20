"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, Crosshair, Camera, Sparkles,
  Sliders, Play, Pause, RotateCcw, Eye, EyeOff, Grid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { compileFn, findRoots, type PlotSpec } from "@/lib/math/core";
import { tangentLine, signedArea } from "@/lib/math/integrals";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const PLOT_COLORS = [
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#84cc16", // Lime
];

interface Plot2DProps {
  spec?: PlotSpec;
  className?: string;
  height?: number;
}

interface View {
  cx: number;
  cy: number;
  sx: number; // px per unit x
  sy: number; // px per unit y
}

interface KeyPoint {
  x: number;
  y: number;
  kind: "root" | "min" | "max" | "intercept";
  label: string;
}

export function Plot2D({ spec, className, height = 400 }: Plot2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState({ w: 640, h: height });

  // View state (center and scale)
  const [view, setView] = useState<View>(() => {
    const xr = spec?.xRange ?? [-10, 10];
    const yr = spec?.yRange ?? [-8, 8];
    return {
      cx: (xr[0] + xr[1]) / 2,
      cy: (yr[0] + yr[1]) / 2,
      sx: 400 / (xr[1] - xr[0]),
      sy: 320 / (yr[1] - yr[0]),
    };
  });

  // Toggles and settings
  const [showKeyPoints, setShowKeyPoints] = useState(true);
  const [gridMode, setGridMode] = useState<"cartesian" | "polar" | "minimal">("cartesian");
  const [curveGlow, setCurveGlow] = useState(true);
  const [hiddenCurves, setHiddenCurves] = useState<Record<number, boolean>>({});

  const rawCurves = useMemo(() => (spec?.curves ?? []).slice(0, 8), [spec]);

  // Check if any curve references parameter `a`
  const hasParamA = useMemo(() => {
    return rawCurves.some((c) => /\ba\b/.test(c.expr));
  }, [rawCurves]);

  // Dynamic parameter `a` support
  const [paramA, setParamA] = useState<number>(1);
  const [forceParamSlider, setForceParamSlider] = useState<boolean>(false);
  const [paramPlaying, setParamPlaying] = useState<boolean>(false);
  const showParamSlider = hasParamA || forceParamSlider;

  // Interaction states
  const [cursor, setCursor] = useState<{
    px: number;
    py: number;
    x: number;
    y: number;
    snapped?: { x: number; y: number; curveIdx: number; slope: number };
  } | null>(null);

  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; sx: number; sy: number } | null>(null);

  // Compile curves with `x` and optional `a`
  const fns = useMemo(() => {
    return rawCurves.map((c, idx) => {
      try {
        const fn = compileFn(c.expr, ["x", "a"]);
        return {
          ...c,
          idx,
          f: (x: number) => fn(x, paramA),
          error: null,
        };
      } catch {
        return {
          ...c,
          idx,
          f: null as null | ((x: number) => number),
          error: "Syntax error",
        };
      }
    });
  }, [rawCurves, paramA]);

  // Direction field support
  const fieldExpr = spec?.field;
  const fieldFn = useMemo(() => {
    if (!fieldExpr) return null;
    try {
      return compileFn(fieldExpr, ["x", "y"]);
    } catch {
      return null;
    }
  }, [fieldExpr]);

  // Parameter slider animation loop
  useEffect(() => {
    if (!paramPlaying) return;
    let animId = 0;
    let lastTime = performance.now();
    let dir = 1;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      setParamA((prev) => {
        let next = prev + dir * dt * 1.5;
        if (next > 5) {
          next = 5;
          dir = -1;
        } else if (next < -5) {
          next = -5;
          dir = 1;
        }
        return next;
      });
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [paramPlaying]);

  // Responsive size observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height: h } = entries[0].contentRect;
      if (width > 0) {
        setSize({
          w: width,
          h: isFullscreen ? Math.max(h, window.innerHeight - 80) : height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, isFullscreen]);

  // Coordinate transformations
  const xToPx = useCallback((x: number) => (x - view.cx) * view.sx + size.w / 2, [view, size]);
  const yToPx = useCallback((y: number) => size.h / 2 - (y - view.cy) * view.sy, [view, size]);
  const pxToX = useCallback((px: number) => (px - size.w / 2) / view.sx + view.cx, [view, size]);
  const pxToY = useCallback((py: number) => view.cy - (py - size.h / 2) / view.sy, [view, size]);

  // Calculate Key Feature Points (roots, extrema, intercepts) on the visible window
  const keyPoints = useMemo<KeyPoint[]>(() => {
    if (!showKeyPoints) return [];
    const active = fns.filter((f, idx) => f.f && !hiddenCurves[idx]);
    if (!active.length) return [];

    const first = active[0].f!;
    const xMin = pxToX(0);
    const xMax = pxToX(size.w);
    const span = xMax - xMin;
    const pts: KeyPoint[] = [];

    try {
      // 1. Y-intercept
      const y0 = first(0);
      if (Number.isFinite(y0) && 0 >= xMin && 0 <= xMax) {
        pts.push({ x: 0, y: y0, kind: "intercept", label: `(0, ${y0.toFixed(2)})` });
      }

      // 2. Roots (f(x) = 0)
      const roots = findRoots(first, Math.max(xMin, -150), Math.min(xMax, 150), 3000);
      roots.slice(0, 6).forEach((r) => {
        pts.push({ x: r, y: 0, kind: "root", label: `Root: ${r.toFixed(3)}` });
      });

      // 3. Local Extrema (f'(x) = 0)
      const df = (x: number) => (first(x + 1e-4) - first(x - 1e-4)) / 2e-4;
      const d2f = (x: number) => (first(x + 1e-3) - 2 * first(x) + first(x - 1e-3)) / 1e-6;
      const crit = findRoots(df, Math.max(xMin, -150), Math.min(xMax, 150), 3000);
      crit.slice(0, 5).forEach((c) => {
        const yc = first(c);
        if (Number.isFinite(yc) && Math.abs(yc) < 1e5) {
          const isMin = d2f(c) > 0;
          pts.push({
            x: c,
            y: yc,
            kind: isMin ? "min" : "max",
            label: `${isMin ? "Min" : "Max"}: (${c.toFixed(2)}, ${yc.toFixed(2)})`,
          });
        }
      });
    } catch {
      // Numerical edge cases gracefully handled
    }
    return pts;
  }, [fns, hiddenCurves, showKeyPoints, size.w, pxToX]);

  // Main Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const dark = document.documentElement.classList.contains("dark");
    const bg = dark ? "#0a0d14" : "#fcfdfd";
    const gridMinor = dark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.035)";
    const gridMajor = dark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
    const axisColor = dark ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.4)";
    const textColor = dark ? "rgba(255, 255, 255, 0.65)" : "rgba(0, 0, 0, 0.65)";

    // Clean gradient canvas background
    const bgGrad = ctx.createRadialGradient(size.w / 2, size.h / 2, 10, size.w / 2, size.h / 2, size.w * 0.7);
    bgGrad.addColorStop(0, dark ? "#0e131f" : "#ffffff");
    bgGrad.addColorStop(1, bg);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size.w, size.h);

    const xMin = pxToX(0), xMax = pxToX(size.w);
    const yMin = pxToY(size.h), yMax = pxToY(0);

    /* Grid rendering */
    if (gridMode === "polar") {
      // Polar grid circles
      const maxRadius = Math.hypot(Math.max(Math.abs(xMin), Math.abs(xMax)), Math.max(Math.abs(yMin), Math.abs(yMax)));
      const stepR = Math.max(1, Math.pow(10, Math.floor(Math.log10(maxRadius / 4))));
      ctx.strokeStyle = gridMinor;
      ctx.lineWidth = 1;
      const origX = xToPx(0);
      const origY = yToPx(0);
      for (let r = stepR; r <= maxRadius; r += stepR) {
        ctx.beginPath();
        ctx.arc(origX, origY, r * view.sx, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Radial spokes
      for (let angle = 0; angle < Math.PI; angle += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(origX - Math.cos(angle) * size.w * 2, origY - Math.sin(angle) * size.h * 2);
        ctx.lineTo(origX + Math.cos(angle) * size.w * 2, origY + Math.sin(angle) * size.h * 2);
        ctx.stroke();
      }
    } else if (gridMode === "cartesian") {
      const niceStep = (range: number, target: number) => {
        const raw = range / target;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const norm = raw / mag;
        const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
        return step * mag;
      };
      const stepX = niceStep(xMax - xMin, Math.max(4, size.w / 110));
      const stepY = niceStep(yMax - yMin, Math.max(4, size.h / 90));

      // Minor grid
      ctx.strokeStyle = gridMinor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = Math.ceil(xMin / (stepX / 5)) * (stepX / 5); gx <= xMax; gx += stepX / 5) {
        const px = Math.round(xToPx(gx)) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, size.h);
      }
      for (let gy = Math.ceil(yMin / (stepY / 5)) * (stepY / 5); gy <= yMax; gy += stepY / 5) {
        const py = Math.round(yToPx(gy)) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(size.w, py);
      }
      ctx.stroke();

      // Major grid + ticks
      ctx.strokeStyle = gridMajor;
      ctx.fillStyle = textColor;
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.beginPath();

      const fmtTick = (v: number, step: number) => {
        if (Math.abs(v) < step / 100) return "0";
        const dec = Math.max(0, -Math.floor(Math.log10(step)));
        return v.toFixed(Math.min(dec, 4));
      };

      for (let gx = Math.ceil(xMin / stepX) * stepX; gx <= xMax; gx += stepX) {
        const px = Math.round(xToPx(gx)) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, size.h);
        if (Math.abs(gx) > stepX / 100) {
          const textY = Math.min(Math.max(yToPx(0) + 5, 2), size.h - 18);
          ctx.fillText(fmtTick(gx, stepX), px, textY);
        }
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (let gy = Math.ceil(yMin / stepY) * stepY; gy <= yMax; gy += stepY) {
        const py = Math.round(yToPx(gy)) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(size.w, py);
        if (Math.abs(gy) > stepY / 100) {
          const textX = Math.min(Math.max(xToPx(0) + 7, 4), size.w - 42);
          ctx.fillText(fmtTick(gy, stepY), textX, py);
        }
      }
      ctx.stroke();
    }

    /* Primary Coordinate Axes */
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    const x0 = xToPx(0), y0 = yToPx(0);
    ctx.moveTo(0, y0); ctx.lineTo(size.w, y0);
    ctx.moveTo(x0, 0); ctx.lineTo(x0, size.h);
    ctx.stroke();

    // Subtle origin indicator
    ctx.fillStyle = axisColor;
    ctx.beginPath();
    ctx.arc(x0, y0, 3, 0, Math.PI * 2);
    ctx.fill();

    /* Direction field overlay (for ODEs) */
    if (fieldFn) {
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      const cols = Math.floor(size.w / 45);
      const rowsN = Math.floor(size.h / 45);
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rowsN; j++) {
          const gx = pxToX((i + 0.5) * (size.w / cols));
          const gy = pxToY((j + 0.5) * (size.h / rowsN));
          let slope: number;
          try {
            slope = fieldFn(gx, gy);
          } catch {
            continue;
          }
          if (!Number.isFinite(slope)) continue;
          const len = 9;
          const norm = Math.hypot(1, slope) || 1;
          const dx = len / norm, dy = (len * slope) / norm;
          const px = xToPx(gx), py = yToPx(gy);
          ctx.beginPath();
          ctx.moveTo(px - dx, py + dy);
          ctx.lineTo(px + dx, py - dy);
          ctx.stroke();
        }
      }
    }

    /* Shaded Integral Area */
    if (spec?.area) {
      try {
        const f = compileFn(spec.area.expr, ["x"]);
        const a = Math.min(spec.area.from, spec.area.to);
        const b = Math.max(spec.area.from, spec.area.to);
        const areaGrad = ctx.createLinearGradient(0, yToPx(0) - 100, 0, yToPx(0) + 100);
        areaGrad.addColorStop(0, "rgba(16, 185, 129, 0.28)");
        areaGrad.addColorStop(1, "rgba(16, 185, 129, 0.05)");
        ctx.fillStyle = areaGrad;
        ctx.beginPath();
        const steps = Math.min(2000, Math.max(200, Math.floor((b - a) * 40)));
        const xa = xToPx(a), xb = xToPx(b);
        ctx.moveTo(xa, yToPx(0));
        for (let i = 0; i <= steps; i++) {
          const x = a + ((b - a) * i) / steps;
          const y = f(x);
          ctx.lineTo(xToPx(x), yToPx(Number.isFinite(y) ? y : 0));
        }
        ctx.lineTo(xb, yToPx(0));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(16, 185, 129, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } catch {
        /* skip invalid area */
      }
    }

    /* Curves with neon glow option */
    fns.forEach((c) => {
      if (!c.f || hiddenCurves[c.idx]) return;
      const color = c.color ?? PLOT_COLORS[c.idx % PLOT_COLORS.length];

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      if (curveGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = dark ? 8 : 4;
      }
      if (c.dashed) ctx.setLineDash([7, 4]);

      ctx.beginPath();
      const pxStep = 1;
      let prevPy: number | null = null;
      let penDown = false;

      for (let px = 0; px <= size.w; px += pxStep) {
        const x = pxToX(px);
        let y: number;
        try {
          y = c.f(x);
        } catch {
          y = NaN;
        }

        if (!Number.isFinite(y)) {
          penDown = false;
          prevPy = null;
          continue;
        }

        const py = yToPx(y);

        // Discontinuity / asymptote break
        if (prevPy !== null && Math.abs(py - prevPy) > size.h * 1.5) {
          penDown = false;
        }
        if (py < -2000 || py > size.h + 2000) {
          penDown = false;
          prevPy = py;
          continue;
        }

        if (!penDown) {
          ctx.moveTo(px, py);
          penDown = true;
        } else {
          ctx.lineTo(px, py);
        }
        prevPy = py;
      }
      ctx.stroke();
      ctx.restore();
    });

    /* Tangent Line */
    if (spec?.tangent) {
      try {
        const tl = tangentLine(spec.tangent.expr, spec.tangent.at);
        if (tl) {
          const f = compileFn(tl.expr, ["x"]);
          ctx.save();
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yToPx(f(xMin)));
          ctx.lineTo(size.w, yToPx(f(xMax)));
          ctx.stroke();
          ctx.restore();

          // Tangency point
          const tpx = xToPx(tl.point.x);
          const tpy = yToPx(tl.point.y);
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(tpx, tpy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } catch {
        /* skip */
      }
    }

    /* Key Points Markers (Roots, Extrema, Intercept) */
    if (showKeyPoints && keyPoints.length > 0) {
      keyPoints.forEach((kp) => {
        const px = xToPx(kp.x);
        const py = yToPx(kp.y);
        if (px < -10 || px > size.w + 10 || py < -10 || py > size.h + 10) return;

        const colorMap = {
          root: "#10b981",      // Emerald
          max: "#f59e0b",       // Amber
          min: "#8b5cf6",       // Violet
          intercept: "#06b6d4", // Cyan
        };
        const pointColor = colorMap[kp.kind];

        // Outer pulse circle
        ctx.fillStyle = pointColor + "33";
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();

        // Solid inner dot
        ctx.fillStyle = pointColor;
        ctx.strokeStyle = dark ? "#0a0d14" : "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label tag
        ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.fillText(kp.label, px, py - 9);
      });
    }

    /* Interactive Snapped Tracer & Tooltip */
    if (cursor) {
      // Crosshair lines
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cursor.px, 0); ctx.lineTo(cursor.px, size.h);
      ctx.moveTo(0, cursor.py); ctx.lineTo(size.w, cursor.py);
      ctx.stroke();
      ctx.restore();

      // If snapped to a curve point
      if (cursor.snapped) {
        const { x, y, curveIdx, slope } = cursor.snapped;
        const spx = xToPx(x);
        const spy = yToPx(y);
        const snapColor = PLOT_COLORS[curveIdx % PLOT_COLORS.length];

        // Animated glowing tracer bead
        ctx.save();
        ctx.shadowColor = snapColor;
        ctx.shadowBlur = 12;
        ctx.fillStyle = snapColor;
        ctx.beginPath();
        ctx.arc(spx, spy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Tooltip badge
        const badgeText = `(${x.toFixed(3)}, ${y.toFixed(3)})  dy/dx = ${slope.toFixed(3)}`;
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
        const textWidth = ctx.measureText(badgeText).width + 16;
        const badgeX = Math.min(Math.max(spx + 12, 10), size.w - textWidth - 10);
        const badgeY = Math.max(spy - 34, 10);

        ctx.fillStyle = dark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.95)";
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, textWidth, 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(badgeText, badgeX + 8, badgeY + 12);
      }
    }
  }, [
    size, view, fns, fieldFn, spec, cursor, keyPoints,
    showKeyPoints, gridMode, curveGlow, hiddenCurves,
    xToPx, yToPx, pxToX, pxToY,
  ]);

  /* Pointer interactions */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = pxToX(px);
    const y = pxToY(py);

    // Curve snapping: find closest visible function
    let snapped: { x: number; y: number; curveIdx: number; slope: number } | undefined;
    let minDistance = 28; // snapping threshold in pixels

    fns.forEach((c) => {
      if (!c.f || hiddenCurves[c.idx]) return;
      try {
        const fy = c.f(x);
        if (Number.isFinite(fy)) {
          const fpy = yToPx(fy);
          const dist = Math.abs(fpy - py);
          if (dist < minDistance) {
            minDistance = dist;
            // Numerical derivative for slope
            const slope = (c.f(x + 1e-4) - c.f(x - 1e-4)) / 2e-4;
            snapped = { x, y: fy, curveIdx: c.idx, slope };
          }
        }
      } catch {
        /* skip */
      }
    });

    setCursor({ px, py, x, y, snapped });

    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      setView((v) => ({
        ...v,
        cx: drag.cx - dx / v.sx,
        cy: drag.cy + dy / v.sy,
      }));
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    pinchRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mx = pxToX(px), my = pxToY(py);
    const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const sx = Math.min(Math.max(v.sx * k, 1e-5), 1e7);
      const sy = Math.min(Math.max(v.sy * k, 1e-5), 1e7);
      return {
        sx, sy,
        cx: mx - (px - size.w / 2) / sx,
        cy: my + (py - size.h / 2) / sy,
      };
    });
  };

  const resetView = () => {
    const xr = spec?.xRange ?? [-10, 10];
    const yr = spec?.yRange ?? [-8, 8];
    setView({
      cx: (xr[0] + xr[1]) / 2,
      cy: (yr[0] + yr[1]) / 2,
      sx: size.w / (xr[1] - xr[0]),
      sy: size.h / (yr[1] - yr[0]),
    });
  };

  // High-resolution Snapshot Export
  const downloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      link.download = `mathlab-2d-plot-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Graph snapshot saved!");
    } catch {
      toast.error("Could not export snapshot");
    }
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "relative w-full rounded-2xl overflow-hidden border bg-card/60 backdrop-blur select-none transition-all shadow-md",
        isFullscreen && "fixed inset-0 z-50 rounded-none bg-background",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: size.h, display: "block", cursor: "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { onPointerUp(); setCursor(null); }}
        onWheel={onWheel}
        role="img"
        aria-label="Interactive 2D graph"
      />

      {/* Floating Modern Toolbar (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-xl border bg-background/80 dark:bg-background/70 backdrop-blur-md p-1 shadow-md">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Zoom in"
          onClick={() => setView((v) => ({ ...v, sx: v.sx * 1.3, sy: v.sy * 1.3 }))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Zoom out"
          onClick={() => setView((v) => ({ ...v, sx: v.sx / 1.3, sy: v.sy / 1.3 }))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Reset to default bounds"
          onClick={resetView}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="h-4 w-[1px] bg-border my-auto" />
        <Button
          variant={showKeyPoints ? "secondary" : "ghost"}
          size="icon"
          className={cn("h-8 w-8", showKeyPoints && "text-emerald-600 dark:text-emerald-400")}
          title="Toggle key feature points (roots, extrema, intercepts)"
          onClick={() => setShowKeyPoints(!showKeyPoints)}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title={`Grid style: ${gridMode}`}
          onClick={() => setGridMode((m) => (m === "cartesian" ? "polar" : m === "polar" ? "minimal" : "cartesian"))}
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Save image (PNG)"
          onClick={downloadSnapshot}
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Dynamic Parameter `a` Slider Bar */}
      {showParamSlider && (
        <div className="absolute top-3 left-3 flex items-center gap-3 rounded-xl border bg-background/85 dark:bg-background/75 backdrop-blur-md px-3 py-1.5 shadow-md">
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            a = {paramA.toFixed(2)}
          </span>
          <Slider
            value={[paramA]}
            min={-5}
            max={5}
            step={0.05}
            onValueChange={([val]) => setParamA(val)}
            className="w-28 sm:w-36"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={paramPlaying ? "Pause animation" : "Animate parameter"}
            onClick={() => setParamPlaying(!paramPlaying)}
          >
            {paramPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}

      {/* Interactive Legend with toggleable visibility */}
      {rawCurves.length > 0 && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl border bg-background/85 dark:bg-background/75 backdrop-blur-md p-1.5 shadow-md max-w-[80%]">
          {rawCurves.map((c, i) => {
            const isHidden = hiddenCurves[i];
            const color = c.color ?? PLOT_COLORS[i % PLOT_COLORS.length];
            return (
              <button
                key={i}
                type="button"
                onClick={() => setHiddenCurves((prev) => ({ ...prev, [i]: !prev[i] }))}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-mono transition-all",
                  isHidden
                    ? "opacity-40 hover:opacity-70 bg-muted/30"
                    : "hover:bg-muted/60"
                )}
                title="Click to toggle visibility"
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="truncate max-w-44">{c.label}</span>
                {isHidden ? <EyeOff className="h-3 w-3 text-muted-foreground ml-1" /> : <Eye className="h-3 w-3 text-muted-foreground ml-1" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Coordinate & Hint Readout */}
      <div className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/80 dark:bg-background/60 backdrop-blur rounded-lg px-2.5 py-1 border shadow-xs pointer-events-none">
        {cursor ? (
          <span className="font-mono">
            x: {cursor.x.toFixed(3)}, y: {cursor.y.toFixed(3)}
          </span>
        ) : (
          <span>Drag to pan · Scroll to zoom</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Analysis helpers for the graphing calculator UI                     */
/* ------------------------------------------------------------------ */

export interface CurveAnalysis {
  roots: number[];
  extrema: { x: number; y: number; kind: "min" | "max" }[];
  yIntercept: number | null;
  inflection: number[];
}

export function analyzeCurve(expr: string): CurveAnalysis | null {
  try {
    const f = compileFn(expr, ["x"]);
    const roots = findRoots(f, -100, 100, 20000);
    const df = (x: number) => (f(x + 1e-5) - f(x - 1e-5)) / 2e-5;
    const d2f = (x: number) => (f(x + 1e-4) - 2 * f(x) + f(x - 1e-4)) / 1e-8;
    const crit = findRoots(df, -100, 100, 20000);
    const extrema = crit
      .filter((x) => Number.isFinite(f(x)))
      .map((x) => ({ x, y: f(x), kind: (d2f(x) > 0 ? "min" : "max") as "min" | "max" }))
      .filter((p) => Number.isFinite(p.y) && Math.abs(p.y) < 1e6)
      .slice(0, 12);
    const inflect = findRoots(d2f, -50, 50, 8000).slice(0, 6);
    const y0 = f(0);
    return {
      roots: roots.filter((r) => Math.abs(r) < 100).sort((a, b) => Math.abs(a) - Math.abs(b)).slice(0, 8),
      extrema,
      yIntercept: Number.isFinite(y0) ? y0 : null,
      inflection: inflect.filter((x) => Number.isFinite(f(x))).sort((a, b) => Math.abs(a) - Math.abs(b)).slice(0, 5),
    };
  } catch {
    return null;
  }
}

export { signedArea, tangentLine };
