"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  size: number;
  opacity: number;
  baseOpacity: number;
  rotation: number;
  vRot: number;
}

const MATH_CHARS = ["∫", "∑", "∂", "π", "∞", "λ", "√", "θ", "∇", "Δ", "e", "φ", "≈", "≠", "±", "×"];

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const handlePointerMove = (e: PointerEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handlePointerLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("mouseleave", handlePointerLeave);

    // Generate floating math particles
    const particleCount = Math.min(32, Math.floor((width * height) / 35000));
    const particles: Particle[] = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.2 - Math.random() * 0.4,
      char: MATH_CHARS[Math.floor(Math.random() * MATH_CHARS.length)],
      size: 14 + Math.random() * 16,
      opacity: 0.15 + Math.random() * 0.25,
      baseOpacity: 0.12 + Math.random() * 0.2,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.01,
    }));

    const isDark = false;

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min(time - lastTime, 100) / 1000;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // 1. Subtle mouse spotlight
      if (mouseRef.current.active) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const radialGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 400);
        if (isDark) {
          radialGrad.addColorStop(0, "rgba(16, 185, 129, 0.09)");
          radialGrad.addColorStop(0.5, "rgba(6, 182, 212, 0.04)");
          radialGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          radialGrad.addColorStop(0, "rgba(16, 185, 129, 0.08)");
          radialGrad.addColorStop(0.5, "rgba(6, 182, 212, 0.03)");
          radialGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        }
        ctx.fillStyle = radialGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Draw subtle perspective grid lines at bottom
      const gridY = height * 0.65;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.03)";
      ctx.lineWidth = 1;
      const step = 80;
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Render floating glyphs
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;

        // Wrap around screen
        if (p.y < -40) {
          p.y = height + 30;
          p.x = Math.random() * width;
        }
        if (p.x < -40) p.x = width + 30;
        if (p.x > width + 40) p.x = -30;

        // Mouse interaction: soft push and glow
        let currentOpacity = p.baseOpacity;
        if (mouseRef.current.active) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const factor = 1 - dist / 180;
            currentOpacity = Math.min(0.65, p.baseOpacity + factor * 0.4);
            p.x += (dx / (dist + 1)) * factor * 1.5;
            p.y += (dy / (dist + 1)) * factor * 1.5;
          }
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `600 ${p.size}px monospace`;
        ctx.fillStyle = isDark
          ? `rgba(52, 211, 153, ${currentOpacity})`
          : `rgba(16, 185, 129, ${currentOpacity * 0.9})`;
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 opacity-80 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}
