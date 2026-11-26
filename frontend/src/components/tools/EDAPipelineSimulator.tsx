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
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-10 text-center text-sm text-zinc-500">
        Select a numeric column with valid entries to simulate the data cleaning pipeline.
      </div>
    );
  }

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
      {/* Apple Transport Controls Header */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <Zap className="h-4 w-4 text-zinc-500" /> Cleaning Pipeline Simulator
            </h3>
            <p className="text-xs text-zinc-500">
              Visualizing transformations on <strong className="text-zinc-900">{columnName}</strong> ({datasetName})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                "gap-1.5 rounded-xl font-medium h-8 px-3.5 text-xs",
                isPlaying ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-zinc-900 hover:bg-zinc-800 text-white"
              )}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : "Play Pipeline"}
            </Button>

            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                setIsPlaying(false);
                setAnimStage(0);
              }}
              title="Reset to Stage 1"
              className="rounded-xl border-zinc-200 h-8 w-8 text-zinc-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center gap-0.5 bg-zinc-100 p-0.5 rounded-full border border-zinc-200/60 text-xs font-medium">
              {[0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAnimSpeed(s)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full transition-all",
                    animSpeed === s ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5 Clean Stepper Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { stage: 0, title: "1. Raw Scan", subtitle: "Identify nulls & outliers" },
            { stage: 1, title: "2. IQR Bounds", subtitle: "Compute 1.5×IQR caps" },
            { stage: 2, title: "3. Imputation", subtitle: "Fill nulls with median" },
            { stage: 3, title: "4. Clamping", subtitle: "Cap extreme outliers" },
            { stage: 4, title: "5. Scaling", subtitle: "Normalize to [0, 1]" },
          ].map((s) => (
            <button
              key={s.stage}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setAnimStage(s.stage);
              }}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                animStage === s.stage
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-2xs"
                  : "border-zinc-200/80 bg-zinc-50/60 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <span className="block text-xs font-semibold">{s.title}</span>
              <span className={cn("block text-[11px] mt-0.5 truncate", animStage === s.stage ? "text-zinc-300" : "text-zinc-400")}>
                {s.subtitle}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Animated SVG Canvas */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <span className="text-xs font-semibold text-zinc-900 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white font-mono text-[11px]">
              {animStage + 1}
            </span>
            {animStage === 0 && "Scanning raw values for missing entries and extremes"}
            {animStage === 1 && "Computing interquartile range (Q1 to Q3) and fence bounds"}
            {animStage === 2 && `Imputing ${rawStats.missingCount} missing entries using Median (${rawStats.median})`}
            {animStage === 3 && `Clamping ${rawStats.outlierCount} outlier values to boundary caps`}
            {animStage === 4 && "Scaling distribution into normalized [0, 1] unit bounds"}
          </span>

          <span className="text-xs font-mono text-zinc-400 tabular-nums">
            {rawNumbers.length.toLocaleString()} rows
          </span>
        </div>

        <div className="h-72 w-full flex items-center justify-center relative overflow-hidden bg-zinc-50/50 rounded-xl border border-zinc-200/70 p-4">
          <svg viewBox="0 0 700 240" className="w-full h-full max-w-3xl overflow-visible">
            <line x1="50" y1="140" x2="650" y2="140" stroke="#e4e4e7" strokeWidth="2" />
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
                        fill="#0071e3"
                        fillOpacity="0.12"
                        stroke="#0071e3"
                        strokeWidth="2"
                      />
                      <line
                        x1={animStage === 4 ? 350 : medX}
                        y1="60"
                        x2={animStage === 4 ? 350 : medX}
                        y2="180"
                        stroke="#18181b"
                        strokeWidth="3"
                      />
                      <text x={animStage === 4 ? 350 : medX} y="52" fontSize="11" textAnchor="middle" fill="#18181b" fontWeight="600">
                        Median: {s.median}
                      </text>
                      <line
                        x1={animStage === 4 ? 100 : lowFenceX}
                        y1="120"
                        x2={animStage === 4 ? 200 : q1X}
                        y2="120"
                        stroke="#71717a"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={animStage === 4 ? 500 : q3X}
                        y1="120"
                        x2={animStage === 4 ? 600 : highFenceX}
                        y2="120"
                        stroke="#71717a"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <line x1={animStage === 4 ? 100 : lowFenceX} y1="95" x2={animStage === 4 ? 100 : lowFenceX} y2="145" stroke="#18181b" strokeWidth="2" />
                      <line x1={animStage === 4 ? 600 : highFenceX} y1="95" x2={animStage === 4 ? 600 : highFenceX} y2="145" stroke="#18181b" strokeWidth="2" />
                      <text x={animStage === 4 ? 100 : lowFenceX} y="85" fontSize="9" textAnchor="middle" fill="#71717a" fontWeight="500">
                        Lower: {s.lowerBound}
                      </text>
                      <text x={animStage === 4 ? 600 : highFenceX} y="85" fontSize="9" textAnchor="middle" fill="#71717a" fontWeight="500">
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
                          <circle cx={toX(s.median)} cy={posY} r="5" fill="none" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="2 2" />
                          <text x={toX(s.median)} y={posY - 8} fontSize="8" textAnchor="middle" fill="#e11d48" fontWeight="600">
                            null
                          </text>
                        </g>
                      );
                    }

                    return (
                      <g key={idx} className="transition-all duration-700 ease-out">
                        <circle
                          cx={targetX}
                          cy={posY}
                          r={isOutlier ? "5.5" : isNull ? "5" : "4"}
                          fill={
                            isNull
                              ? "#059669"
                              : isOutlier && animStage < 3
                              ? "#e11d48"
                              : isOutlier && animStage >= 3
                              ? "#d97706"
                              : "#0071e3"
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
                            fill={isNull ? "#059669" : isOutlier && animStage < 3 ? "#e11d48" : "#71717a"}
                            fontWeight="600"
                          >
                            {isNull && animStage >= 2 ? `+${s.median}` : isOutlier && animStage >= 3 ? `capped` : val}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {animStage === 4 && (
                    <g>
                      <line x1="100" y1="200" x2="600" y2="200" stroke="#0071e3" strokeWidth="2" />
                      <text x="100" y="218" fontSize="10" textAnchor="middle" fill="#0071e3" fontWeight="600">
                        0.0 (Min)
                      </text>
                      <text x="350" y="218" fontSize="10" textAnchor="middle" fill="#0071e3" fontWeight="600">
                        0.5 (Center)
                      </text>
                      <text x="600" y="218" fontSize="10" textAnchor="middle" fill="#0071e3" fontWeight="600">
                        1.0 (Max)
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1">
          <span className="text-xs font-semibold text-zinc-900">
            {animStage === 0 && "1. Scan & Detect"}
            {animStage === 1 && "2. Interquartile Fence Construction"}
            {animStage === 2 && "3. Median Imputation"}
            {animStage === 3 && "4. Outlier Clamping (Winsorization)"}
            {animStage === 4 && "5. Unit Scaling"}
          </span>
          <p className="text-xs text-zinc-500 leading-relaxed">
            {animStage === 0 &&
              `Scanned ${columnName}: detected ${rawStats.missingCount} missing entries and skewness of ${rawStats.skewness}.`}
            {animStage === 1 &&
              `Q1 = ${rawStats.q1}, Q3 = ${rawStats.q3}, IQR = ${rawStats.iqr}. Fences set at [${rawStats.lowerBound}, ${rawStats.upperBound}].`}
            {animStage === 2 &&
              `Missing observations are replaced with Median (${rawStats.median}), preserving central tendency without outlier distortion.`}
            {animStage === 3 &&
              `${rawStats.outlierCount} extreme values are clamped to boundary fences rather than discarding valid rows.`}
            {animStage === 4 &&
              `All values are linearly compressed into unit bounds [0, 1] for consistent feature magnitudes.`}
          </p>
        </div>
      </div>
    </div>
  );
}
