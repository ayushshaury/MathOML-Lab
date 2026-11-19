"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  ZoomIn, ZoomOut, RotateCcw, Pause, Play, Camera, Maximize2, Minimize2,
  Layers, Palette, Compass, Sliders
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { compileFn } from "@/lib/math/core";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Plot3DProps {
  expr?: string;
  className?: string;
  height?: number;
}

interface Cam {
  yaw: number;   // rotation around z
  pitch: number; // tilt
  zoom: number;
}

type PaletteName = "synthwave" | "viridis" | "sunset" | "emerald" | "ice";
type RenderMode = "solid" | "wireframe" | "contours";

const PALETTES: Record<PaletteName, { name: string; stops: [number, number, number][] }> = {
  synthwave: {
    name: "Neon Synthwave",
    stops: [
      [59, 7, 100],   // Deep violet
      [192, 38, 211], // Fuchsia
      [6, 182, 212],  // Cyan
      [250, 204, 21], // Yellow
    ],
  },
  viridis: {
    name: "Viridis",
    stops: [
      [68, 1, 84],    // Deep indigo
      [49, 104, 142], // Teal
      [53, 183, 121], // Emerald
      [253, 231, 37], // Bright yellow
    ],
  },
  sunset: {
    name: "Sunset Fire",
    stops: [
      [30, 27, 75],   // Dark plum
      [159, 18, 57],  // Crimson
      [245, 158, 11], // Amber
      [254, 240, 138],// Golden yellow
    ],
  },
  emerald: {
    name: "Emerald Jade",
    stops: [
      [6, 78, 59],    // Deep pine
      [5, 150, 105],  // Emerald
      [52, 211, 153], // Mint
      [167, 243, 208],// Soft seafoam
    ],
  },
  ice: {
    name: "Ice Aurora",
    stops: [
      [15, 23, 42],   // Slate navy
      [2, 132, 199],  // Deep sky
      [56, 189, 248], // Sky blue
      [248, 250, 252],// Ice white
    ],
  },
};

function samplePalette(t: number, paletteKey: PaletteName, lightShade = 1): string {
  const stops = PALETTES[paletteKey].stops;
  const clampedT = Math.min(Math.max(t, 0), 1);
  const x = clampedT * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;

  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];

  const r = Math.round(Math.min(255, (r1 + (r2 - r1) * f) * lightShade));
  const g = Math.round(Math.min(255, (g1 + (g2 - g1) * f) * lightShade));
  const b = Math.round(Math.min(255, (b1 + (b2 - b1) * f) * lightShade));

  return `rgba(${r},${g},${b},0.92)`;
}

export function Plot3D({ expr, className, height = 480 }: Plot3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState({ w: 640, h: height });

  // Camera orientation
  const [cam, setCam] = useState<Cam>({ yaw: -0.75, pitch: 0.52, zoom: 1 });
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateSpeed, setRotateSpeed] = useState<number>(0.6);
  const [range, setRange] = useState<[number, number]>([-5, 5]);

  // Aesthetic settings
  const [palette, setPalette] = useState<PaletteName>("synthwave");
  const [renderMode, setRenderMode] = useState<RenderMode>("solid");

  // Check if expression contains parameter `a`
  const hasParamA = useMemo(() => {
    return expr ? /\ba\b/.test(expr) : false;
  }, [expr]);

  // Dynamic parameter `a` support
  const [paramA, setParamA] = useState<number>(1);
  const [forceParamSlider, setForceParamSlider] = useState<boolean>(false);
  const [paramPlaying, setParamPlaying] = useState<boolean>(false);
  const showParamSlider = hasParamA || forceParamSlider;

  // Interaction refs
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const autoRef = useRef(false);
  useEffect(() => {
    autoRef.current = autoRotate;
  }, [autoRotate]);

  // Compile expression with x, y, and optional a
  const compiled = useMemo(() => {
    if (!expr) return { f: null, error: null };
    try {
      const fn = compileFn(expr, ["x", "y", "a"]);
      return {
        f: (x: number, y: number) => fn(x, y, paramA),
        error: null,
      };
    } catch (e) {
      return { f: null, error: (e as Error).message };
    }
  }, [expr, paramA]);

  // Responsive resize
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

  // Auto-rotation loop
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (autoRef.current) {
        setCam((c) => ({ ...c, yaw: c.yaw + dt * rotateSpeed }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, rotateSpeed]);

  // Parameter slider animation
  useEffect(() => {
    if (!paramPlaying) return;
    let raf = 0;
    let lastTime = performance.now();
    let dir = 1;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      setParamA((prev) => {
        let next = prev + dir * dt * 1.5;
        if (next > 4) {
          next = 4;
          dir = -1;
        } else if (next < -4) {
          next = -4;
          dir = 1;
        }
        return next;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paramPlaying]);

  // Main 3D Render Loop with Lighting and Normals
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const f = compiled.f;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dark = document.documentElement.classList.contains("dark");
    const bgGrad = ctx.createRadialGradient(size.w / 2, size.h / 2, 10, size.w / 2, size.h / 2, size.w * 0.7);
    bgGrad.addColorStop(0, dark ? "#0f172a" : "#ffffff");
    bgGrad.addColorStop(1, dark ? "#070b14" : "#f8fafc");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size.w, size.h);

    if (!f) {
      ctx.fillStyle = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(compiled.error ?? "Enter a valid 3D surface: z = f(x, y)", size.w / 2, size.h / 2);
      return;
    }

    const N = 48; // Mesh resolution
    const [lo, hi] = range;

    // Sample height grid
    const zs: number[][] = [];
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i <= N; i++) {
      zs.push([]);
      for (let j = 0; j <= N; j++) {
        const x = lo + ((hi - lo) * i) / N;
        const y = lo + ((hi - lo) * j) / N;
        let z: number;
        try {
          z = f(x, y);
        } catch {
          z = NaN;
        }
        if (!Number.isFinite(z)) z = NaN;
        zs[i].push(z);
        if (Number.isFinite(z)) {
          zmin = Math.min(zmin, z);
          zmax = Math.max(zmax, z);
        }
      }
    }

    if (!Number.isFinite(zmin) || !Number.isFinite(zmax)) {
      ctx.fillStyle = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("No finite values generated over this domain", size.w / 2, size.h / 2);
      return;
    }

    if (zmax - zmin < 1e-9) {
      zmax = zmin + 1;
    }
    const zLo = zmin, zSpan = zmax - zmin;

    // Scale normalization
    const span = hi - lo;
    const worldScale = (Math.min(size.w, size.h) / (span * 1.55)) * cam.zoom;
    const zRatio = Math.min(1, (span * 1.1) / Math.max(zSpan, 1e-9));
    const zMid = zLo + zSpan / 2;

    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);

    // 3D projection matrix with depth
    const project = (x: number, y: number, z: number): [number, number, number] => {
      const rx = x * cy - y * sy;
      const ry = x * sy + y * cy;
      const sxp = rx;
      const syp = ry * sp + z * cp;
      const depth = ry * cp - z * sp;
      return [size.w / 2 + sxp * worldScale, size.h / 2 - syp * worldScale, depth];
    };

    // Normalized Directional Light Vector
    const lightDir = [0.45, 0.55, 0.7];
    const lightLen = Math.hypot(lightDir[0], lightDir[1], lightDir[2]) || 1;
    const lx = lightDir[0] / lightLen;
    const ly = lightDir[1] / lightLen;
    const lz = lightDir[2] / lightLen;

    // Draw Coordinate Axes
    const axisLen = span * 0.58;
    const axes = [
      { pts: [[-axisLen, 0, 0], [axisLen, 0, 0]] as [[number, number, number], [number, number, number]], label: "x", color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" },
      { pts: [[0, -axisLen, 0], [0, axisLen, 0]] as [[number, number, number], [number, number, number]], label: "y", color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" },
      { pts: [[0, 0, -axisLen * 0.5], [0, 0, axisLen * 0.5]] as [[number, number, number], [number, number, number]], label: "z", color: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" },
    ];
    axes.forEach((ax) => {
      const p1 = project(...ax.pts[0]);
      const p2 = project(...ax.pts[1]);
      ctx.strokeStyle = ax.color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
      ctx.fillStyle = ax.color;
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(ax.label, p2[0] + 6, p2[1]);
    });

    // Mesh Quads with Painter's Algorithm & Real Directional Shading
    interface Quad {
      depth: number;
      pts: [number, number][];
      color: string;
      wireColor: string;
      isContour: boolean;
    }
    const quads: Quad[] = [];

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const z00 = zs[i][j], z10 = zs[i + 1][j], z01 = zs[i][j + 1], z11 = zs[i + 1][j + 1];
        if (!Number.isFinite(z00) || !Number.isFinite(z10) || !Number.isFinite(z01) || !Number.isFinite(z11)) continue;

        const x0 = lo + ((hi - lo) * i) / N, x1 = lo + ((hi - lo) * (i + 1)) / N;
        const y0 = lo + ((hi - lo) * j) / N, y1 = lo + ((hi - lo) * (j + 1)) / N;

        const pZ00 = (z00 - zMid) * zRatio;
        const pZ10 = (z10 - zMid) * zRatio;
        const pZ01 = (z01 - zMid) * zRatio;
        const pZ11 = (z11 - zMid) * zRatio;

        const P00 = project(x0, y0, pZ00);
        const P10 = project(x1, y0, pZ10);
        const P01 = project(x0, y1, pZ01);
        const P11 = project(x1, y1, pZ11);

        const depth = (P00[2] + P10[2] + P01[2] + P11[2]) / 4;
        const avgZ = (z00 + z10 + z01 + z11) / 4;
        const t = (avgZ - zLo) / zSpan;

        // Approximate surface normal vector
        const v1x = x1 - x0, v1y = 0, v1z = pZ10 - pZ00;
        const v2x = 0, v2y = y1 - y0, v2z = pZ01 - pZ00;

        // Cross product
        const nx = v1y * v2z - v1z * v2y;
        const ny = v1z * v2x - v1x * v2z;
        const nz = v1x * v2y - v1y * v2x;
        const nLen = Math.hypot(nx, ny, nz) || 1;

        // Dot product with directional light
        const dot = Math.max(0, (nx * lx + ny * ly + nz * lz) / nLen);
        const lightShade = 0.42 + dot * 0.58; // Ambient + Diffuse

        // Isoline detection for contour mode
        const isContour = Math.floor(t * 12) !== Math.floor(((z00 - zLo) / zSpan) * 12);

        quads.push({
          depth,
          pts: [[P00[0], P00[1]], [P10[0], P10[1]], [P11[0], P11[1]], [P01[0], P01[1]]],
          color: samplePalette(t, palette, lightShade),
          wireColor: samplePalette(t, palette, 1.2),
          isContour,
        });
      }
    }

    // Sort back-to-front
    quads.sort((a, b) => a.depth - b.depth);

    // Render quads according to selected mode
    quads.forEach((q) => {
      ctx.beginPath();
      ctx.moveTo(q.pts[0][0], q.pts[0][1]);
      for (let k = 1; k < 4; k++) ctx.lineTo(q.pts[k][0], q.pts[k][1]);
      ctx.closePath();

      if (renderMode === "solid") {
        ctx.fillStyle = q.color;
        ctx.fill();
        // Subtle clean mesh outline
        ctx.strokeStyle = dark ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      } else if (renderMode === "wireframe") {
        ctx.strokeStyle = q.wireColor;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      } else if (renderMode === "contours") {
        ctx.fillStyle = q.color;
        ctx.fill();
        if (q.isContour) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    });

    // Clean HUD Info Badge
    ctx.fillStyle = dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
    ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`z ∈ [${zLo.toFixed(2)}, ${(zLo + zSpan).toFixed(2)}]`, 14, size.h - 14);
    ctx.fillText(`Domain: [${lo}, ${hi}]²`, 14, size.h - 28);
  }, [size, cam, compiled, range, palette, renderMode]);

  /* Pointer interactions for free 3D rotation */
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
    setAutoRotate(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const nextYaw = drag.yaw + dx * 0.008;
    const nextPitch = Math.min(Math.max(drag.pitch + dy * 0.006, -0.2), 1.5);
    setCam((c) => ({
      ...c,
      yaw: nextYaw,
      pitch: nextPitch,
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setCam((c) => ({ ...c, zoom: Math.min(Math.max(c.zoom * k, 0.2), 8) }));
  };

  // Preset Views
  const setPresetView = (viewType: "iso" | "top" | "front" | "side") => {
    setAutoRotate(false);
    switch (viewType) {
      case "iso":
        setCam({ yaw: -0.75, pitch: 0.52, zoom: 1 });
        break;
      case "top":
        setCam({ yaw: 0, pitch: 1.56, zoom: 1 });
        break;
      case "front":
        setCam({ yaw: 0, pitch: 0.05, zoom: 1 });
        break;
      case "side":
        setCam({ yaw: Math.PI / 2, pitch: 0.05, zoom: 1 });
        break;
    }
  };

  // Export 3D Snapshot
  const downloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement("a");
      link.download = `mathlab-3d-surface-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("3D surface snapshot saved!");
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
        style={{ width: "100%", height: size.h, display: "block", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        role="img"
        aria-label="Interactive 3D surface plot"
      />

      {/* Floating Modern Toolbar (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-xl border bg-background/85 dark:bg-background/75 backdrop-blur-md p-1 shadow-md">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Zoom in"
          onClick={() => setCam((c) => ({ ...c, zoom: Math.min(c.zoom * 1.25, 8) }))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Zoom out"
          onClick={() => setCam((c) => ({ ...c, zoom: Math.max(c.zoom / 1.25, 0.2) }))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant={autoRotate ? "secondary" : "ghost"}
          size="icon"
          className={cn("h-8 w-8", autoRotate && "text-emerald-600 dark:text-emerald-400")}
          title={autoRotate ? "Pause rotation" : "Auto rotate surface"}
          onClick={() => setAutoRotate(!autoRotate)}
        >
          {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-muted"
          title="Reset to Isometric view"
          onClick={() => setPresetView("iso")}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <div className="h-4 w-[1px] bg-border my-auto" />

        {/* View Angles Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="Camera Perspectives">
              <Compass className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setPresetView("iso")}>Isometric View</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPresetView("top")}>Top (XY) View</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPresetView("front")}>Front (XZ) View</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPresetView("side")}>Side (YZ) View</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Colormap Palette Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="Colormap Palette">
              <Palette className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.entries(PALETTES).map(([key, item]) => (
              <DropdownMenuItem key={key} onClick={() => setPalette(key as PaletteName)}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: `rgb(${item.stops[1].join(",")})` }}
                  />
                  {item.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Render Mode Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="Rendering Mode">
              <Layers className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenderMode("solid")}>Solid Surface</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenderMode("wireframe")}>Wireframe Mesh</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenderMode("contours")}>Contour Lines</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

      {/* Domain Controls (Top Left) */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-xl border bg-background/85 dark:bg-background/75 backdrop-blur-md px-2 py-1 shadow-md">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">Domain:</span>
        {([-3, -5, -10, -20] as const).map((bound) => (
          <button
            key={bound}
            type="button"
            onClick={() => setRange([bound, Math.abs(bound)])}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-mono transition-all",
              range[0] === bound
                ? "bg-emerald-600 text-white shadow-xs font-semibold"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            ±{Math.abs(bound)}
          </button>
        ))}
      </div>

      {/* Dynamic Parameter `a` Slider Bar */}
      {showParamSlider && (
        <div className="absolute bottom-12 left-3 flex items-center gap-3 rounded-xl border bg-background/85 dark:bg-background/75 backdrop-blur-md px-3 py-1.5 shadow-md">
          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            a = {paramA.toFixed(2)}
          </span>
          <Slider
            value={[paramA]}
            min={-4}
            max={4}
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

      {/* Footer Navigation Tip */}
      <div className="absolute bottom-3 right-3 text-[11px] text-muted-foreground bg-background/80 dark:bg-background/60 backdrop-blur rounded-lg px-2.5 py-1 border shadow-xs pointer-events-none">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
