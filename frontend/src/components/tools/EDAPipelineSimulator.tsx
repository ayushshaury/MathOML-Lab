"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeSummaryStats } from "@/lib/math/eda";
import { cn } from "@/lib/utils";

export function EDAPipelineSimulator({
  columnName,
  datasetName,
  rawNumbers,
}: {
  columnName: string;
  datasetName: string;
  rawNumbers: (number | null)[];
}) {
  const [animStage, setAnimStage] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animSpeed, setAnimSpeed] = useState<number>(1.0);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const rawStats = computeSummaryStats(rawNumbers);

  useEffect(() => {
    setAnimStage(0);
    setIsPlaying(false);
  }, [columnName, datasetName]);

  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      return;
    }

    const intervalMs = Math.round(2800 / animSpeed);
    playTimerRef.current = setInterval(() => {
      setAnimStage((prev) => {
        if (prev >= 4) {
          setIsPlaying(false);
          return 4;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, animSpeed]);

  if (rawNumbers.length === 0 || rawStats.count === 0) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Select a numerical column with valid values to animate the 5-stage EDA pipeline.
      </div>
    );
  }

  // Sample down cleanly to <= 120 markers for crisp SVG animation on massive CSVs
  const step = rawNumbers.length > 120 ? rawNumbers.length / 120 : 1;
  const displayPoints: (number | null)[] = [];
  if (step === 1) {
    displayPoints.push(...rawNumbers);
  } else {
    for (let i = 0; i < 120; i++) {
      displayPoints.push(rawNumbers[Math.min(rawNumbers.length - 1, Math.floor(i * step))]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Interactive Player Controls */}
      <div className="rounded-3xl border border-emerald-500/30 bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Interactive EDA Pipeline Animator
            </span>
            <h3 className="text-lg font-black text-foreground">
              Watch Data Transform Live Across 5 Statistical Stages
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Column: <strong className="text-foreground">{columnName}</strong> ({datasetName})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isPlaying ? "destructive" : "default"}
              onClick={() => setIsPlaying(!isPlaying)}
              className="gap-2 rounded-xl font-bold shadow-xs"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause Simulation" : "Play Full Pipeline"}
            </Button>

            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                setIsPlaying(false);
                setAnimStage(0);
              }}
              title="Reset to Stage 1 (Raw Data)"
              className="rounded-xl h-9 w-9"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-bold">
              {[0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAnimSpeed(s)}
                  className={cn(
                    "px-2 py-0.5 rounded-lg transition-all",
                    animSpeed === s ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          {[
            { stage: 0, title: "1. Raw Scan", subtitle: "Detect Nulls & Anomaly" },
            { stage: 1, title: "2. IQR Calipers", subtitle: "1.5×IQR Fence Expansion" },
            { stage: 2, title: "3. Live Impute", subtitle: "Median Fill Drops In" },
            { stage: 3, title: "4. Outlier Clamping", subtitle: "Winsorize to Fences" },
            { stage: 4, title: "5. Normalization", subtitle: "Compress to Unit Scale" },
          ].map((s) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setAnimStage(s.stage);
              }}
              className={cn(
                "p-3 rounded-2xl border text-left transition-all",
                animStage === s.stage
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20"
                  : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
              )}
            >
              <span className="block text-xs font-extrabold">{s.title}</span>
              <span className="block text-[10px] text-muted-foreground mt-0.5 truncate">{s.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animated SVG Canvas */}
      <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <span className="text-xs font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700 font-mono font-bold text-xs">
              {animStage + 1}
            </span>
            {animStage === 0 && "Stage 1: Scanning Raw Observations for Nulls and Anomalies"}
            {animStage === 1 && "Stage 2: Expanding IQR Caliper Fences (Q1 - 1.5×IQR to Q3 + 1.5×IQR)"}
            {animStage === 2 && `Stage 3: Imputing ${rawStats.missingCount} Missing Value Slots at Median (${rawStats.median})`}
            {animStage === 3 && `Stage 4: Winsorizing & Clamping ${rawStats.outlierCount} Extreme Outliers to Fence Caps`}
            {animStage === 4 && "Stage 5: Normalizing and Scaling Features to Unit Bounds"}
          </span>

          <span className="text-xs font-mono font-bold text-muted-foreground">
            {rawNumbers.length.toLocaleString()} total rows
          </span>
        </div>

        <div className="h-72 w-full flex items-center justify-center relative overflow-hidden bg-muted/10 rounded-2xl border border-dashed border-border/80 p-4">
          <svg viewBox="0 0 700 240" className="w-full h-full max-w-3xl overflow-visible">
            <line x1="50" y1="140" x2="650" y2="140" stroke="#cbd5e1" strokeWidth="2" />
            {(() => {
              const s = rawStats;
              const min = Math.min(s.min, s.lowerBound);
              const max = Math.max(s.max, s.upperBound);
              const range = max - min || 1;
              const toX = (val: number) => 50 + ((val - min) / range) * 600;

              const lowFenceX = toX(Math.max(s.min, s.lowerBound));
              const highFenceX = toX(Math.min(s.max, s.upperBound));
              const medX = toX(s.median);
              const q1X = toX(s.q1);
              const q3X = toX(s.q3);

              return (
                <g>
                  {animStage >= 1 && (
                    <g className="transition-all duration-700 ease-out">
                      <rect
                        x={animStage === 4 ? 200 : q1X}
                        y="70"
                        width={animStage === 4 ? 300 : Math.max(4, q3X - q1X)}
                        height="100"
                        rx="10"
                        fill="#10b981"
                        fillOpacity="0.18"
                        stroke="#059669"
                        strokeWidth="2.5"
                      />
                      <line
                        x1={animStage === 4 ? 350 : medX}
                        y1="60"
                        x2={animStage === 4 ? 350 : medX}
                        y2="180"
                        stroke="#0f172a"
                        strokeWidth="3.5"
                      />
                      <text x={animStage === 4 ? 350 : medX} y="52" fontSize="11" textAnchor="middle" fill="#0f172a" fontWeight="800">
                        Median: {s.median}
                      </text>
                      <line
                        x1={animStage === 4 ? 100 : lowFenceX}
                        y1="120"
                        x2={animStage === 4 ? 200 : q1X}
                        y2="120"
                        stroke="#0f172a"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={animStage === 4 ? 500 : q3X}
                        y1="120"
                        x2={animStage === 4 ? 600 : highFenceX}
                        y2="120"
                        stroke="#0f172a"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                      <line x1={animStage === 4 ? 100 : lowFenceX} y1="95" x2={animStage === 4 ? 100 : lowFenceX} y2="145" stroke="#0f172a" strokeWidth="2.5" />
                      <line x1={animStage === 4 ? 600 : highFenceX} y1="95" x2={animStage === 4 ? 600 : highFenceX} y2="145" stroke="#0f172a" strokeWidth="2.5" />
                      <text x={animStage === 4 ? 100 : lowFenceX} y="85" fontSize="9" textAnchor="middle" fill="#64748b" fontWeight="bold">
                        Lower: {s.lowerBound}
                      </text>
                      <text x={animStage === 4 ? 600 : highFenceX} y="85" fontSize="9" textAnchor="middle" fill="#64748b" fontWeight="bold">
                        Upper: {s.upperBound}
                      </text>
                    </g>
                  )}

                  {displayPoints.map((val, idx) => {
                    const isNull = val === null;
                    const isOutlier = !isNull && (val < s.lowerBound || val > s.upperBound);
                    let currentVal = val ?? s.median;
                    if (animStage >= 3 && isOutlier) {
                      currentVal = val < s.lowerBound ? s.lowerBound : s.upperBound;
                    }
                    let targetX = toX(currentVal);
                    if (animStage === 4) {
                      targetX = 100 + ((currentVal - min) / range) * 500;
                    }
                    const posY = isNull && animStage < 2 ? 40 : 120 + ((idx % 3) - 1) * 12;

                    if (isNull && animStage < 2) {
                      return (
                        <g key={idx} className="transition-all duration-700">
                          <circle cx={toX(s.median)} cy={posY} r="5" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
                          <text x={toX(s.median)} y={posY - 8} fontSize="8" textAnchor="middle" fill="#ef4444" fontWeight="bold">
                            null
                          </text>
                        </g>
                      );
                    }

                    return (
                      <g key={idx} className="transition-all duration-700 ease-out">
                        {isOutlier && animStage < 3 && (
                          <circle cx={targetX} cy={posY} r="9" fill="none" stroke="#ef4444" strokeWidth="1.5" className="animate-ping opacity-60" />
                        )}
                        <circle
                          cx={targetX}
                          cy={posY}
                          r={isOutlier ? "6" : isNull ? "5.5" : "4.5"}
                          fill={
                            isNull
                              ? "#10b981"
                              : isOutlier && animStage < 3
                              ? "#ef4444"
                              : isOutlier && animStage >= 3
                              ? "#f59e0b"
                              : "#0284c7"
                          }
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        {(isOutlier || isNull) && (
                          <text
                            x={targetX}
                            y={posY - 12}
                            fontSize="9"
                            textAnchor="middle"
                            fill={isNull ? "#059669" : isOutlier && animStage < 3 ? "#ef4444" : "#64748b"}
                            fontWeight="bold"
                          >
                            {isNull && animStage >= 2 ? `+${s.median}` : isOutlier && animStage >= 3 ? `clamped` : val}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {animStage === 4 && (
                    <g>
                      <line x1="100" y1="200" x2="600" y2="200" stroke="#059669" strokeWidth="2.5" />
                      <text x="100" y="218" fontSize="10" textAnchor="middle" fill="#059669" fontWeight="bold">
                        0.0 (Min / Z=-3)
                      </text>
                      <text x="350" y="218" fontSize="10" textAnchor="middle" fill="#059669" fontWeight="bold">
                        0.5 (Center / Z=0)
                      </text>
                      <text x="600" y="218" fontSize="10" textAnchor="middle" fill="#059669" fontWeight="bold">
                        1.0 (Max / Z=+3)
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>

        <div className="p-4 rounded-2xl bg-muted/30 border space-y-1.5">
          <span className="text-xs font-bold text-foreground">
            {animStage === 0 && "1. Raw Scanning & Null Diagnostics"}
            {animStage === 1 && "2. 1.5×IQR Interquartile Fence Construction"}
            {animStage === 2 && "3. Median Imputation for Numerical Robustness"}
            {animStage === 3 && "4. Winsorization / Outlier Clamping"}
            {animStage === 4 && "5. Scale Normalization (Z-Score or MinMax)"}
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {animStage === 0 &&
              `Scanning every record in ${columnName}: detected ${rawStats.missingCount} null value(s) and skewness of ${rawStats.skewness}.`}
            {animStage === 1 &&
              `Q1 = ${rawStats.q1}, Q3 = ${rawStats.q3}, IQR = ${rawStats.iqr}. Fences placed at [${rawStats.lowerBound}, ${rawStats.upperBound}].`}
            {animStage === 2 &&
              `Missing values are filled with Median (${rawStats.median}), preserving central tendency without outlier distortion.`}
            {animStage === 3 &&
              `Detected ${rawStats.outlierCount} outlier(s) clipped cleanly onto Tukey fence caps rather than losing observations.`}
            {animStage === 4 &&
              `Feature magnitudes rescale uniformly into unit intervals for unbiased ML distance calculations and faster optimization convergence.`}
          </p>
        </div>
      </div>
    </div>
  );
}
