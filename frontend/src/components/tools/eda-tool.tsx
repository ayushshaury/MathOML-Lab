"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  SAMPLE_DATASETS,
  computeSummaryStats,
  computeKDE,
  computeHistogram,
  computeCorrelation,
  cleanDataColumn,
  computeIndividualKernels,
  type Dataset,
  type ImputeMethod,
  type OutlierTreatment,
  type ScalingMethod,
} from "@/lib/math/eda";
import {
  BarChart3,
  Sliders,
  Sparkles,
  Layers,
  TrendingUp,
  Filter,
  Check,
  Copy,
  Info,
  Activity,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Table,
  LineChart as LineChartIcon,
  HelpCircle,
  Zap,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Eye,
  ArrowRight,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EDATab = "visualizer" | "cleaner" | "simulator" | "guide" | "code";
type ChartType = "boxplot" | "kde" | "histogram" | "violin" | "scatter" | "heatmap" | "missing" | "qq";

export function EDATool() {
  const [activeTab, setActiveTab] = useState<EDATab>("visualizer");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("titanic");
  const [activeChart, setActiveChart] = useState<ChartType>("boxplot");

  // Visualizer controls
  const [selectedColIndex, setSelectedColIndex] = useState<number>(0);
  const [scatterYIndex, setScatterYIndex] = useState<number>(1);
  const [kdeBandwidth, setKdeBandwidth] = useState<number>(1.0);
  const [histogramBins, setHistogramBins] = useState<number>(12);

  // Animation toggles inside Visualizer
  const [showIndividualKernels, setShowIndividualKernels] = useState<boolean>(true);
  const [showResidualErrors, setShowResidualErrors] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; value: number | string } | null>(null);

  // Cleaner controls
  const [imputeMethod, setImputeMethod] = useState<ImputeMethod>("none");
  const [outlierTreatment, setOutlierTreatment] = useState<OutlierTreatment>("none");
  const [scalingMethod, setScalingMethod] = useState<ScalingMethod>("none");

  // Copy code feedback state
  const [copiedCode, setCopiedCode] = useState(false);

  // ==================================================================
  // ANIMATED PIPELINE SIMULATOR STATE
  // ==================================================================
  const [animStage, setAnimStage] = useState<number>(0); // 0..4
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animSpeed, setAnimSpeed] = useState<number>(1.0); // 0.5, 1.0, 2.0
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-play timer for Animated Pipeline Simulator
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

  // Active dataset
  const currentDataset: Dataset = useMemo(() => {
    return SAMPLE_DATASETS.find((d) => d.id === selectedDatasetId) ?? SAMPLE_DATASETS[0];
  }, [selectedDatasetId]);

  // Numerical columns in active dataset
  const numericalCols = useMemo(() => {
    return currentDataset.columns.filter((c) => c.type === "numerical");
  }, [currentDataset]);

  // Selected column data
  const activeCol = useMemo(() => {
    return numericalCols[selectedColIndex] ?? numericalCols[0];
  }, [numericalCols, selectedColIndex]);

  // Raw numerical values
  const rawNumbers = useMemo(() => {
    return activeCol.rawValues.map((v) => (typeof v === "number" ? v : null));
  }, [activeCol]);

  // Summary statistics on raw numbers
  const rawStats = useMemo(() => {
    return computeSummaryStats(rawNumbers);
  }, [rawNumbers]);

  // Cleaned numbers & stats via Cleaner
  const cleanedDataResult = useMemo(() => {
    return cleanDataColumn(rawNumbers, imputeMethod, outlierTreatment, scalingMethod);
  }, [rawNumbers, imputeMethod, outlierTreatment, scalingMethod]);

  // KDE points for visualizer
  const kdePoints = useMemo(() => {
    return computeKDE(cleanedDataResult.cleaned, kdeBandwidth, 80);
  }, [cleanedDataResult.cleaned, kdeBandwidth]);

  // Individual kernel decomposition for animated KDE curve
  const kernelDecomposition = useMemo(() => {
    return computeIndividualKernels(cleanedDataResult.cleaned, kdeBandwidth, 60);
  }, [cleanedDataResult.cleaned, kdeBandwidth]);

  // Histogram bins for visualizer
  const histBins = useMemo(() => {
    return computeHistogram(cleanedDataResult.cleaned, histogramBins);
  }, [cleanedDataResult.cleaned, histogramBins]);

  // Bivariate correlation
  const scatterYCol = useMemo(() => {
    return numericalCols[scatterYIndex] ?? numericalCols[1] ?? numericalCols[0];
  }, [numericalCols, scatterYIndex]);

  const correlationResult = useMemo(() => {
    const yVals = scatterYCol.rawValues.map((v) => (typeof v === "number" ? v : null));
    return computeCorrelation(rawNumbers, yVals);
  }, [rawNumbers, scatterYCol]);

  // Correlation Matrix for all numerical columns
  const correlationMatrix = useMemo(() => {
    return numericalCols.map((c1) => {
      const v1 = c1.rawValues.map((v) => (typeof v === "number" ? v : null));
      return numericalCols.map((c2) => {
        const v2 = c2.rawValues.map((v) => (typeof v === "number" ? v : null));
        return computeCorrelation(v1, v2).r;
      });
    });
  }, [numericalCols]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success("Python EDA script copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-card p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              <Activity className="h-3.5 w-3.5" /> Exploratory Data Analysis (EDA) Laboratory
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Data Profiling, Distributions &amp; Hygiene
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Explore distributions with interactive Box Plots, KDE density waves, and Violin curves; watch animated data cleaning transformations; diagnose skewness and IQR outliers; and inspect the full data type decision matrix.
            </p>
          </div>

          {/* Dataset Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-2xl border">
              {SAMPLE_DATASETS.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => {
                    setSelectedDatasetId(ds.id);
                    setSelectedColIndex(0);
                    setScatterYIndex(1);
                    setAnimStage(0);
                    setIsPlaying(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    selectedDatasetId === ds.id
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ds.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 pt-6 mt-6 border-t border-border/60">
          <button
            onClick={() => setActiveTab("visualizer")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "visualizer"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <BarChart3 className="h-4 w-4" /> All EDA Charts
          </button>
          <button
            onClick={() => setActiveTab("simulator")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative",
              activeTab === "simulator"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
            )}
          >
            <Zap className="h-4 w-4 text-emerald-500 fill-emerald-500" />
            <span>Animated Cleaning Pipeline</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </button>
          <button
            onClick={() => setActiveTab("cleaner")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "cleaner"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Filter className="h-4 w-4" /> Fix Messy Data
          </button>
          <button
            onClick={() => setActiveTab("guide")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "guide"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <HelpCircle className="h-4 w-4" /> Methodology &amp; Data Types
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "code"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Copy className="h-4 w-4" /> Python Code
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB: ANIMATED CLEANING PIPELINE SIMULATOR                          */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          {/* Interactive Player Controls */}
          <div className="rounded-3xl border border-emerald-500/30 bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Interactive EDA Simulator
                </span>
                <h3 className="text-lg font-black text-foreground">
                  Watch Messy Data Transform Live (5-Stage Visual Pipeline)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Variable: <strong className="text-foreground">{activeCol.name}</strong> ({currentDataset.name})
                </p>
              </div>

              {/* Player Button Group */}
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

                {/* Speed Toggle */}
                <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs font-bold">
                  {[0.5, 1.0, 2.0].map((s) => (
                    <button
                      key={s}
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

            {/* Stepper Milestones */}
            <div className="grid grid-cols-5 gap-2 pt-2">
              {[
                { stage: 0, title: "1. Raw Scan", subtitle: "Detect Nulls & Anomaly" },
                { stage: 1, title: "2. IQR Calipers", subtitle: "1.5×IQR Fence Expansion" },
                { stage: 2, title: "3. Live Impute", subtitle: "Median Fill Drops In" },
                { stage: 3, title: "4. Outlier Clamping", subtitle: "Winsorize to Fences" },
                { stage: 4, title: "5. Normalization", subtitle: "Compress to Unit Scale" },
              ].map((s) => (
                <button
                  key={s.stage}
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

          {/* Animated Stage Visualizer Canvas */}
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
                {rawNumbers.length} total rows in &quot;{activeCol.name}&quot;
              </span>
            </div>

            {/* SVG Interactive Canvas */}
            <div className="h-72 w-full flex items-center justify-center relative overflow-hidden bg-muted/10 rounded-2xl border border-dashed border-border/80 p-4">
              <svg viewBox="0 0 700 240" className="w-full h-full max-w-3xl overflow-visible">
                {/* Horizontal Baseline / Number Axis */}
                <line x1="50" y1="140" x2="650" y2="140" stroke="#cbd5e1" strokeWidth="2" />

                {(() => {
                  const s = rawStats;
                  const min = Math.min(s.min, s.lowerBound);
                  const max = Math.max(s.max, s.upperBound);
                  const range = max - min || 1;

                  const toX = (val: number) => 50 + ((val - min) / range) * 600;

                  // Stage coordinates
                  const lowFenceX = toX(Math.max(s.min, s.lowerBound));
                  const highFenceX = toX(Math.min(s.max, s.upperBound));
                  const medX = toX(s.median);
                  const q1X = toX(s.q1);
                  const q3X = toX(s.q3);

                  return (
                    <g>
                      {/* STAGE 1+: IQR Core Box and Whisker Calipers */}
                      {animStage >= 1 && (
                        <g className="transition-all duration-700 ease-out">
                          {/* 50% Core IQR band */}
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

                          {/* Median Marker Line */}
                          <line
                            x1={animStage === 4 ? 350 : medX}
                            y1="60"
                            x2={animStage === 4 ? 350 : medX}
                            y2="180"
                            stroke="#0f172a"
                            strokeWidth="3.5"
                          />
                          <text
                            x={animStage === 4 ? 350 : medX}
                            y="52"
                            fontSize="11"
                            textAnchor="middle"
                            fill="#0f172a"
                            fontWeight="800"
                          >
                            Median: {s.median}
                          </text>

                          {/* Left / Right Whiskers */}
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

                          {/* Caliper Whisker Caps */}
                          <line
                            x1={animStage === 4 ? 100 : lowFenceX}
                            y1="95"
                            x2={animStage === 4 ? 100 : lowFenceX}
                            y2="145"
                            stroke="#0f172a"
                            strokeWidth="2.5"
                          />
                          <line
                            x1={animStage === 4 ? 600 : highFenceX}
                            y1="95"
                            x2={animStage === 4 ? 600 : highFenceX}
                            y2="145"
                            stroke="#0f172a"
                            strokeWidth="2.5"
                          />

                          <text
                            x={animStage === 4 ? 100 : lowFenceX}
                            y="85"
                            fontSize="9"
                            textAnchor="middle"
                            fill="#64748b"
                            fontWeight="bold"
                          >
                            Lower: {s.lowerBound}
                          </text>
                          <text
                            x={animStage === 4 ? 600 : highFenceX}
                            y="85"
                            fontSize="9"
                            textAnchor="middle"
                            fill="#64748b"
                            fontWeight="bold"
                          >
                            Upper: {s.upperBound}
                          </text>
                        </g>
                      )}

                      {/* DATA POINTS MAPPING & MORPHING */}
                      {rawNumbers.map((val, idx) => {
                        const isNull = val === null;
                        const isOutlier = !isNull && (val < s.lowerBound || val > s.upperBound);

                        // Stage-specific coordinates
                        let currentVal = val ?? s.median;
                        if (animStage >= 3 && isOutlier) {
                          // Clamped in Winsorization
                          currentVal = val < s.lowerBound ? s.lowerBound : s.upperBound;
                        }

                        let targetX = toX(currentVal);
                        if (animStage === 4) {
                          // Normalization compressed range into [100, 600]
                          targetX = 100 + ((currentVal - min) / range) * 500;
                        }

                        // Animate vertical drop for imputed values in Stage 2
                        const posY = isNull && animStage < 2 ? 40 : 120 + ((idx % 3) - 1) * 12;

                        if (isNull && animStage < 2) {
                          // Ghost missing slot indicator
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
                            {/* Halo pulse for outliers in Stage 1/2 */}
                            {isOutlier && animStage < 3 && (
                              <circle cx={targetX} cy={posY} r="9" fill="none" stroke="#ef4444" strokeWidth="1.5" className="animate-ping opacity-60" />
                            )}

                            {/* Main Point Marker */}
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

                            {/* Value label on hover / key points */}
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

                      {/* Normalization Scale Bar in Stage 4 */}
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

            {/* Stage Mathematical Explanation */}
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
                  `The pipeline scans every record in ${activeCol.name}. Found ${rawStats.missingCount} missing (null) values and extreme skewness. Missing values cause model training to fail, while extreme values distort gradient updates.`}
                {animStage === 1 &&
                  `The algorithm calculates Q1 (${rawStats.q1}) and Q3 (${rawStats.q3}). The Interquartile Range (IQR = ${rawStats.iqr}) forms fences at Q1 - 1.5×IQR (${rawStats.lowerBound}) and Q3 + 1.5×IQR (${rawStats.upperBound}). Points past these calipers are mathematically confirmed outliers.`}
                {animStage === 2 &&
                  `Missing slots are imputed with the median (${rawStats.median}). Median is chosen over mean because mean is heavily distorted by extreme values, whereas median preserves the authentic center of mass.`}
                {animStage === 3 &&
                  `Rather than blindly dropping records (which discards sample data), Winsorization clamps outlier values exceeding the fences directly onto the boundary thresholds. The dataset variance stabilizes while preserving 100% of observations.`}
                {animStage === 4 &&
                  `Features are rescaled so all inputs share compatible magnitude intervals (e.g. [0, 1] via MinMax or standard normal Z-scores). Distance-based algorithms (KNN, K-Means) and neural networks train symmetrically without dominating weights.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: ALL EDA CHARTS VISUALIZER                                   */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "visualizer" && (
        <div className="space-y-6">
          {/* Chart Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border bg-card shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground mr-1">Chart:</span>
              {(
                [
                  { id: "boxplot", label: "Box Plot", icon: Sliders },
                  { id: "kde", label: "KDE Density", icon: TrendingUp },
                  { id: "histogram", label: "Histogram", icon: BarChart3 },
                  { id: "violin", label: "Violin Plot", icon: Layers },
                  { id: "scatter", label: "Scatter & OLS", icon: LineChartIcon },
                  { id: "heatmap", label: "Correlation Matrix", icon: Table },
                  { id: "missing", label: "Missing Data", icon: AlertTriangle },
                  { id: "qq", label: "Q-Q Normal", icon: Activity },
                ] as const
              ).map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveChart(c.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all",
                      activeChart === c.id
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Feature Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Variable:</span>
              <select
                value={selectedColIndex}
                onChange={(e) => setSelectedColIndex(Number(e.target.value))}
                className="bg-background border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {numericalCols.map((col, idx) => (
                  <option key={col.name} value={idx}>
                    {col.name} ({col.unit ?? "units"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Visualizer Stage */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Canvas Area */}
            <div className="lg:col-span-2 rounded-3xl border bg-card p-6 shadow-xs flex flex-col justify-between min-h-[420px]">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-base text-foreground capitalize">
                    {activeChart === "boxplot" && "Five-Number Summary Box Plot"}
                    {activeChart === "kde" && "Kernel Density Estimation (Gaussian KDE)"}
                    {activeChart === "histogram" && "Frequency Distribution Histogram"}
                    {activeChart === "violin" && "Mirrored Probability Density (Violin Plot)"}
                    {activeChart === "scatter" && `Bivariate Correlation: ${activeCol.name} vs ${scatterYCol.name}`}
                    {activeChart === "heatmap" && "Pairwise Pearson Correlation Heatmap"}
                    {activeChart === "missing" && "Missing Values & Null Sparsity Matrix"}
                    {activeChart === "qq" && "Quantile-Quantile (Q-Q) Normality Plot"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Analyzing variable: <strong className="text-foreground">{activeCol.name}</strong> ({activeCol.rawValues.length} observations)
                  </p>
                </div>

                {/* Sub-controls depending on chart */}
                {activeChart === "kde" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setShowIndividualKernels(!showIndividualKernels)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all",
                        showIndividualKernels ? "bg-emerald-500/20 text-emerald-700 border border-emerald-500/40" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Eye className="h-3 w-3" /> Show Individual Bell Curves
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Bandwidth (h):</span>
                      <input
                        type="range"
                        min="0.3"
                        max="2.5"
                        step="0.1"
                        value={kdeBandwidth}
                        onChange={(e) => setKdeBandwidth(parseFloat(e.target.value))}
                        className="w-20 accent-emerald-500"
                      />
                      <span className="text-xs font-mono font-bold">{kdeBandwidth.toFixed(1)}</span>
                    </div>
                  </div>
                )}

                {activeChart === "histogram" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Bins:</span>
                    <input
                      type="range"
                      min="5"
                      max="25"
                      step="1"
                      value={histogramBins}
                      onChange={(e) => setHistogramBins(parseInt(e.target.value))}
                      className="w-24 accent-emerald-500"
                    />
                    <span className="text-xs font-mono font-bold">{histogramBins}</span>
                  </div>
                )}

                {activeChart === "scatter" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowResidualErrors(!showResidualErrors)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all",
                        showResidualErrors ? "bg-amber-500/20 text-amber-700 border border-amber-500/40" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Zap className="h-3 w-3" /> Animate Residual Errors (SSE)
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Y-Axis:</span>
                      <select
                        value={scatterYIndex}
                        onChange={(e) => setScatterYIndex(Number(e.target.value))}
                        className="bg-background border rounded-lg px-2 py-1 text-xs font-semibold"
                      >
                        {numericalCols.map((col, idx) => (
                          <option key={col.name} value={idx}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart Renderer */}
              <div className="flex-1 flex items-center justify-center p-2 relative">
                {/* 1. BOX PLOT */}
                {activeChart === "boxplot" && (
                  <div className="w-full h-72 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 600 240" className="w-full h-full max-w-xl overflow-visible">
                      <line x1="50" y1="180" x2="550" y2="180" stroke="#cbd5e1" strokeWidth="1.5" />

                      {(() => {
                        const s = rawStats;
                        const minScale = Math.min(s.min, s.lowerBound);
                        const maxScale = Math.max(s.max, s.upperBound);
                        const range = maxScale - minScale || 1;
                        const toX = (val: number) => 50 + ((val - minScale) / range) * 500;

                        const q1X = toX(s.q1);
                        const q2X = toX(s.median);
                        const q3X = toX(s.q3);
                        const lowWhiskX = toX(Math.max(s.min, s.lowerBound));
                        const highWhiskX = toX(Math.min(s.max, s.upperBound));

                        return (
                          <g>
                            {/* Whiskers */}
                            <line x1={lowWhiskX} y1="100" x2={q1X} y2="100" stroke="#0f172a" strokeWidth="2" strokeDasharray="3 3" />
                            <line x1={q3X} y1="100" x2={highWhiskX} y2="100" stroke="#0f172a" strokeWidth="2" strokeDasharray="3 3" />

                            {/* Whisker End Caps */}
                            <line x1={lowWhiskX} y1="75" x2={lowWhiskX} y2="125" stroke="#0f172a" strokeWidth="2.5" />
                            <line x1={highWhiskX} y1="75" x2={highWhiskX} y2="125" stroke="#0f172a" strokeWidth="2.5" />

                            {/* IQR Box (Q1 to Q3) */}
                            <rect
                              x={q1X}
                              y="60"
                              width={Math.max(4, q3X - q1X)}
                              height="80"
                              rx="8"
                              fill="#10b981"
                              fillOpacity="0.25"
                              stroke="#059669"
                              strokeWidth="2.5"
                            />

                            {/* Median Line (Q2) */}
                            <line x1={q2X} y1="60" x2={q2X} y2="140" stroke="#0f172a" strokeWidth="3.5" />

                            {/* Mean Indicator Diamond */}
                            <polygon
                              points={`${toX(s.mean)},52 ${toX(s.mean) + 6},60 ${toX(s.mean)},68 ${toX(s.mean) - 6},60`}
                              fill="#f59e0b"
                              stroke="#b45309"
                              strokeWidth="1.5"
                            />

                            {/* Outlier Points with Animated Pulse */}
                            {s.outlierIndices.map((idx) => {
                              const val = rawNumbers[idx];
                              if (val === null) return null;
                              return (
                                <g key={idx}>
                                  <circle cx={toX(val)} cy="100" r="8" fill="none" stroke="#ef4444" strokeWidth="1.5" className="animate-ping opacity-75" />
                                  <circle
                                    cx={toX(val)}
                                    cy="100"
                                    r="5.5"
                                    fill="#ef4444"
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                    className="cursor-pointer hover:scale-125 transition-transform"
                                    onMouseEnter={() => setHoveredPoint({ label: `Outlier #${idx + 1}`, value: val })}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  />
                                  <text x={toX(val)} y="82" fontSize="9" textAnchor="middle" fill="#ef4444" fontWeight="bold">
                                    {val}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Scale Ticks & Labels */}
                            <text x={lowWhiskX} y="150" fontSize="10" textAnchor="middle" fill="#64748b" fontWeight="600">
                              Min ({Math.max(s.min, s.lowerBound)})
                            </text>
                            <text x={q1X} y="162" fontSize="10" textAnchor="middle" fill="#059669" fontWeight="700">
                              Q1: {s.q1}
                            </text>
                            <text x={q2X} y="150" fontSize="11" textAnchor="middle" fill="#0f172a" fontWeight="800">
                              Med: {s.median}
                            </text>
                            <text x={q3X} y="162" fontSize="10" textAnchor="middle" fill="#059669" fontWeight="700">
                              Q3: {s.q3}
                            </text>
                            <text x={highWhiskX} y="150" fontSize="10" textAnchor="middle" fill="#64748b" fontWeight="600">
                              Max ({Math.min(s.max, s.upperBound)})
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* 2. KDE PLOT WITH INDIVIDUAL KERNEL ANIMATIONS */}
                {activeChart === "kde" && (
                  <div className="w-full h-72 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 600 240" className="w-full h-full max-w-xl overflow-visible">
                      <line x1="40" y1="210" x2="560" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="40" y1="20" x2="40" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />

                      {(() => {
                        if (kdePoints.length === 0) return null;
                        const maxDensity = Math.max(...kdePoints.map((p) => p.density)) || 0.01;
                        const minX = kdePoints[0].x;
                        const maxX = kdePoints[kdePoints.length - 1].x;
                        const rangeX = maxX - minX || 1;

                        const toSvgX = (x: number) => 40 + ((x - minX) / rangeX) * 520;
                        const toSvgY = (d: number) => 210 - (d / maxDensity) * 180;

                        const pathData = kdePoints
                          .map((p, i) => `${i === 0 ? "M" : "L"} ${toSvgX(p.x)} ${toSvgY(p.density)}`)
                          .join(" ");

                        const areaData = `${pathData} L ${toSvgX(maxX)} 210 L ${toSvgX(minX)} 210 Z`;

                        return (
                          <g>
                            <defs>
                              <linearGradient id="kdeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>

                            {/* Individual Gaussian Bell Curves (How KDE is Built) */}
                            {showIndividualKernels &&
                              kernelDecomposition.kernels.map((k, i) => {
                                const kPath = k.points
                                  .map((pt, pIdx) => `${pIdx === 0 ? "M" : "L"} ${toSvgX(pt.x)} ${toSvgY(pt.density)}`)
                                  .join(" ");
                                return (
                                  <path
                                    key={i}
                                    d={kPath}
                                    fill="none"
                                    stroke={["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b"][i % 4]}
                                    strokeWidth="1.2"
                                    strokeOpacity="0.35"
                                  />
                                );
                              })}

                            {/* Data points rug plot on the axis line */}
                            {cleanedDataResult.cleaned.map((pt, i) => (
                              <circle key={i} cx={toSvgX(pt)} cy="210" r="2.5" fill="#059669" fillOpacity="0.6" />
                            ))}

                            {/* Total KDE Aggregate Curve */}
                            <path d={areaData} fill="url(#kdeAreaGrad)" />
                            <path d={pathData} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />

                            {/* X-axis tick labels */}
                            <text x={toSvgX(minX)} y="226" fontSize="10" textAnchor="middle" fill="#64748b">
                              {minX}
                            </text>
                            <text x={toSvgX((minX + maxX) / 2)} y="226" fontSize="10" textAnchor="middle" fill="#64748b">
                              {((minX + maxX) / 2).toFixed(1)}
                            </text>
                            <text x={toSvgX(maxX)} y="226" fontSize="10" textAnchor="middle" fill="#64748b">
                              {maxX}
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* 3. HISTOGRAM */}
                {activeChart === "histogram" && (
                  <div className="w-full h-72 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 600 240" className="w-full h-full max-w-xl overflow-visible">
                      <line x1="40" y1="210" x2="560" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />
                      {(() => {
                        if (histBins.length === 0) return null;
                        const maxCount = Math.max(...histBins.map((b) => b.count)) || 1;
                        const binW = 520 / histBins.length;

                        return (
                          <g>
                            {histBins.map((b, i) => {
                              const barH = (b.count / maxCount) * 170;
                              const x = 40 + i * binW;
                              const y = 210 - barH;
                              return (
                                <g key={i}>
                                  <rect
                                    x={x + 2}
                                    y={y}
                                    width={binW - 4}
                                    height={barH}
                                    rx="4"
                                    fill="#0284c7"
                                    fillOpacity={0.3 + 0.6 * (b.count / maxCount)}
                                    stroke="#0369a1"
                                    strokeWidth="1.5"
                                  />
                                  {b.count > 0 && (
                                    <text x={x + binW / 2} y={y - 5} fontSize="9" textAnchor="middle" fill="#0369a1" fontWeight="bold">
                                      {b.count}
                                    </text>
                                  )}
                                  <text x={x + binW / 2} y="226" fontSize="8" textAnchor="middle" fill="#64748b">
                                    {b.from.toFixed(0)}
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* 4. VIOLIN PLOT */}
                {activeChart === "violin" && (
                  <div className="w-full h-72 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 600 240" className="w-full h-full max-w-xl overflow-visible">
                      <line x1="50" y1="210" x2="550" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />
                      {(() => {
                        if (kdePoints.length === 0) return null;
                        const maxDensity = Math.max(...kdePoints.map((p) => p.density)) || 0.01;
                        const minX = kdePoints[0].x;
                        const maxX = kdePoints[kdePoints.length - 1].x;
                        const rangeX = maxX - minX || 1;

                        const toSvgX = (x: number) => 50 + ((x - minX) / rangeX) * 500;
                        const centerY = 110;

                        // Top & Bottom mirrored curves
                        const topPoints = kdePoints.map((p) => `${toSvgX(p.x)},${centerY - (p.density / maxDensity) * 70}`).join(" ");
                        const bottomPoints = [...kdePoints].reverse().map((p) => `${toSvgX(p.x)},${centerY + (p.density / maxDensity) * 70}`).join(" ");

                        return (
                          <g>
                            {/* Mirrored Violin Hull */}
                            <polygon
                              points={`${topPoints} ${bottomPoints}`}
                              fill="#8b5cf6"
                              fillOpacity="0.25"
                              stroke="#7c3aed"
                              strokeWidth="2"
                            />

                            {/* Mini Embedded Box Plot */}
                            {(() => {
                              const s = rawStats;
                              const q1X = toSvgX(s.q1);
                              const q2X = toSvgX(s.median);
                              const q3X = toSvgX(s.q3);
                              return (
                                <g>
                                  <line x1={toSvgX(Math.max(s.min, s.lowerBound))} y1={centerY} x2={toSvgX(Math.min(s.max, s.upperBound))} y2={centerY} stroke="#1e293b" strokeWidth="4" />
                                  <rect x={q1X} y={centerY - 8} width={Math.max(4, q3X - q1X)} height="16" rx="4" fill="#1e293b" />
                                  <circle cx={q2X} cy={centerY} r="3.5" fill="#ffffff" />
                                </g>
                              );
                            })()}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* 5. SCATTER & OLS WITH RESIDUAL ERROR ANIMATION */}
                {activeChart === "scatter" && (
                  <div className="w-full h-72 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 600 240" className="w-full h-full max-w-xl overflow-visible">
                      <line x1="50" y1="210" x2="550" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="50" y1="20" x2="50" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />

                      {(() => {
                        const xVals = rawNumbers;
                        const yVals = scatterYCol.rawValues.map((v) => (typeof v === "number" ? v : null));

                        const validPairs: [number, number][] = [];
                        for (let i = 0; i < Math.min(xVals.length, yVals.length); i++) {
                          if (xVals[i] !== null && yVals[i] !== null) {
                            validPairs.push([xVals[i] as number, yVals[i] as number]);
                          }
                        }

                        if (validPairs.length === 0) return null;

                        const minX = Math.min(...validPairs.map((p) => p[0]));
                        const maxX = Math.max(...validPairs.map((p) => p[0]));
                        const minY = Math.min(...validPairs.map((p) => p[1]));
                        const maxY = Math.max(...validPairs.map((p) => p[1]));

                        const toSvgX = (x: number) => 50 + ((x - minX) / (maxX - minX || 1)) * 500;
                        const toSvgY = (y: number) => 210 - ((y - minY) / (maxY - minY || 1)) * 180;

                        const { slope, intercept, r, r2 } = correlationResult;
                        const lineX1 = minX;
                        const lineY1 = slope * lineX1 + intercept;
                        const lineX2 = maxX;
                        const lineY2 = slope * lineX2 + intercept;

                        let totalSse = 0;

                        return (
                          <g>
                            {/* OLS Fit Line */}
                            <line
                              x1={toSvgX(lineX1)}
                              y1={toSvgY(lineY1)}
                              x2={toSvgX(lineX2)}
                              y2={toSvgY(lineY2)}
                              stroke="#f59e0b"
                              strokeWidth="2.5"
                              strokeDasharray="4 4"
                            />

                            {/* Residual Error Lines from Points to Line */}
                            {showResidualErrors &&
                              validPairs.map(([x, y], idx) => {
                                const yPred = slope * x + intercept;
                                const err = y - yPred;
                                totalSse += err * err;
                                return (
                                  <line
                                    key={`res_${idx}`}
                                    x1={toSvgX(x)}
                                    y1={toSvgY(y)}
                                    x2={toSvgX(x)}
                                    y2={toSvgY(yPred)}
                                    stroke="#ef4444"
                                    strokeWidth="1.2"
                                    strokeDasharray="2 2"
                                    opacity="0.6"
                                  />
                                );
                              })}

                            {/* Scatter Points */}
                            {validPairs.map(([x, y], idx) => (
                              <circle
                                key={idx}
                                cx={toSvgX(x)}
                                cy={toSvgY(y)}
                                r="4.5"
                                fill="#10b981"
                                fillOpacity="0.75"
                                stroke="#047857"
                                strokeWidth="1"
                              />
                            ))}

                            {/* Stats Badge */}
                            <g transform="translate(420, 25)">
                              <rect width="135" height="52" rx="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
                              <text x="10" y="18" fontSize="10" fill="#0f172a" fontWeight="700">
                                Pearson r = {r}
                              </text>
                              <text x="10" y="32" fontSize="9" fill="#64748b">
                                R² = {r2} (OLS fit)
                              </text>
                              {showResidualErrors && (
                                <text x="10" y="44" fontSize="8" fill="#ef4444" fontWeight="bold">
                                  SSE = {totalSse.toFixed(1)}
                                </text>
                              )}
                            </g>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* 6. CORRELATION HEATMAP */}
                {activeChart === "heatmap" && (
                  <div className="w-full flex flex-col items-center justify-center p-2">
                    <div className="overflow-x-auto max-w-full">
                      <table className="border-collapse text-center">
                        <thead>
                          <tr>
                            <th className="p-2 text-xs font-bold text-muted-foreground"></th>
                            {numericalCols.map((c) => (
                              <th key={c.name} className="p-2 text-xs font-bold text-foreground truncate max-w-[90px]">
                                {c.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {numericalCols.map((rowCol, rIdx) => (
                            <tr key={rowCol.name}>
                              <td className="p-2 text-xs font-bold text-foreground text-right">{rowCol.name}</td>
                              {numericalCols.map((colCol, cIdx) => {
                                const r = correlationMatrix[rIdx]?.[cIdx] ?? 0;
                                let bg = "rgba(16, 185, 129, 0.1)";
                                if (r > 0.5) bg = "rgba(16, 185, 129, 0.7)";
                                else if (r > 0.1) bg = "rgba(16, 185, 129, 0.35)";
                                else if (r < -0.5) bg = "rgba(239, 68, 68, 0.7)";
                                else if (r < -0.1) bg = "rgba(239, 68, 68, 0.35)";

                                return (
                                  <td
                                    key={colCol.name}
                                    style={{ backgroundColor: bg }}
                                    className="p-3 text-xs font-mono font-bold border border-border/40 rounded-lg min-w-[65px]"
                                    title={`${rowCol.name} vs ${colCol.name}: r = ${r}`}
                                  >
                                    {r === 1 ? "1.00" : r.toFixed(2)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. MISSING DATA CHART */}
                {activeChart === "missing" && (
                  <div className="w-full space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Missing value proportions across all dataset variables. Missingness threshold: &gt;40% indicates high risk.
                    </p>
                    <div className="space-y-3">
                      {currentDataset.columns.map((col) => {
                        const total = col.rawValues.length;
                        const nulls = col.rawValues.filter((v) => v === null || v === undefined).length;
                        const pct = (nulls / total) * 100;
                        return (
                          <div key={col.name} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-foreground">
                                {col.name} <span className="text-muted-foreground font-normal">({col.type})</span>
                              </span>
                              <span className={cn("font-mono font-bold", pct > 0 ? "text-amber-600" : "text-emerald-600")}>
                                {nulls} missing ({pct.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  pct > 40 ? "bg-rose-500" : pct > 0 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${pct || 1}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 8. Q-Q PLOT */}
                {activeChart === "qq" && (
                  <div className="w-full h-72 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 600 240" className="w-full h-full max-w-xl overflow-visible">
                      <line x1="50" y1="210" x2="550" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="50" y1="20" x2="50" y2="210" stroke="#cbd5e1" strokeWidth="1.5" />
                      <line x1="50" y1="210" x2="550" y2="20" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />

                      {(() => {
                        const valid = rawNumbers.filter((v): v is number => v !== null).sort((a, b) => a - b);
                        const n = valid.length;
                        if (n < 4) return null;

                        const s = rawStats;
                        return (
                          <g>
                            {valid.map((v, i) => {
                              const p = (i + 0.5) / n;
                              const zTheor = (p - 0.5) * 4;
                              const zSample = s.stdDev > 0 ? (v - s.mean) / s.stdDev : 0;

                              const svgX = 50 + ((zTheor + 3) / 6) * 500;
                              const svgY = 210 - ((zSample + 3) / 6) * 190;

                              return (
                                <circle
                                  key={i}
                                  cx={svgX}
                                  cy={svgY}
                                  r="4"
                                  fill="#0284c7"
                                  fillOpacity="0.8"
                                  stroke="#0369a1"
                                  strokeWidth="1"
                                />
                              );
                            })}
                            <text x="530" y="35" fontSize="10" fill="#f59e0b" fontWeight="bold">
                              y = x (Normal)
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                )}

                {/* Hover Tooltip Popup */}
                {hoveredPoint && (
                  <div className="absolute top-4 left-4 rounded-xl border bg-background/95 backdrop-blur-md p-2 shadow-lg text-xs font-mono space-y-0.5">
                    <span className="font-bold text-foreground block">{hoveredPoint.label}</span>
                    <span className="text-emerald-600 block">Value: {hoveredPoint.value}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Statistical Diagnostics Card */}
            <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Info className="h-4 w-4 text-emerald-600" />
                <h4 className="font-bold text-sm text-foreground">Statistical Profile</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[11px]">Mean (μ)</span>
                  <span className="font-mono font-bold text-base text-foreground">{rawStats.mean}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[11px]">Median (Q2)</span>
                  <span className="font-mono font-bold text-base text-foreground">{rawStats.median}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[11px]">Std Deviation (σ)</span>
                  <span className="font-mono font-bold text-base text-foreground">{rawStats.stdDev}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[11px]">IQR (Q3 - Q1)</span>
                  <span className="font-mono font-bold text-base text-foreground">{rawStats.iqr}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[11px]">Skewness</span>
                  <span className={cn("font-mono font-bold text-base", Math.abs(rawStats.skewness) > 0.5 ? "text-amber-600" : "text-emerald-600")}>
                    {rawStats.skewness}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border">
                  <span className="text-muted-foreground block text-[11px]">Kurtosis</span>
                  <span className="font-mono font-bold text-base text-foreground">{rawStats.kurtosis}</span>
                </div>
              </div>

              {/* IQR Outlier Diagnostics */}
              <div className="rounded-2xl border bg-muted/20 p-3.5 space-y-2 text-xs">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  IQR Outlier Fence Analysis
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Lower Fence: <strong className="font-mono text-foreground">{rawStats.lowerBound}</strong> · Upper Fence:{" "}
                  <strong className="font-mono text-foreground">{rawStats.upperBound}</strong>
                </p>
                <div className="flex items-center justify-between font-bold pt-1">
                  <span>Detected Outliers:</span>
                  <span className={cn("font-mono px-2 py-0.5 rounded text-[11px]", rawStats.outlierCount > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600")}>
                    {rawStats.outlierCount} records ({((rawStats.outlierCount / rawStats.count) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: FIX MESSY DATA WORKBENCH                                    */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "cleaner" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-3xl border bg-card shadow-xs">
            {/* 1. Missing Values */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-emerald-600" /> 1. Missing Value Imputation
              </span>
              <p className="text-[11px] text-muted-foreground">
                Current column has <strong>{rawStats.missingCount}</strong> missing values ({rawStats.missingPct.toFixed(1)}%).
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "none", label: "None (Raw)" },
                    { id: "mean", label: "Mean (μ)" },
                    { id: "median", label: "Median (Q2)" },
                    { id: "drop", label: "Drop Rows" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setImputeMethod(opt.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left",
                      imputeMethod === opt.id
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Outlier Treatment */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> 2. Outlier Remediation
              </span>
              <p className="text-[11px] text-muted-foreground">
                Found <strong>{rawStats.outlierCount}</strong> points outside 1.5×IQR boundaries.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "none", label: "None (Keep)" },
                    { id: "cap_iqr", label: "Cap 1.5×IQR" },
                    { id: "trim", label: "Trim Outliers" },
                    { id: "log", label: "Log(1+x)" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setOutlierTreatment(opt.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left",
                      outlierTreatment === opt.id
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Feature Scaling */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-cyan-600" /> 3. Feature Normalization
              </span>
              <p className="text-[11px] text-muted-foreground">
                Rescale features for gradient-based or distance-based algorithms.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "none", label: "None (Raw)" },
                    { id: "standard", label: "StandardScaler" },
                    { id: "minmax", label: "MinMaxScaler [0,1]" },
                    { id: "robust", label: "RobustScaler" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setScalingMethod(opt.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left",
                      scalingMethod === opt.id
                        ? "bg-cyan-600 text-white shadow-2xs"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Side-by-Side Before vs After Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Raw Dataset State */}
            <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Before Cleaning (Raw Data)
                </h4>
                <span className="text-xs font-mono text-muted-foreground">{rawStats.count} records</span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground block">Mean</span>
                  <span className="font-mono font-bold text-sm">{rawStats.mean}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground block">Median</span>
                  <span className="font-mono font-bold text-sm">{rawStats.median}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground block">Std Dev</span>
                  <span className="font-mono font-bold text-sm">{rawStats.stdDev}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground block">Missing</span>
                  <span className="font-mono font-bold text-sm text-rose-600">{rawStats.missingCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground block">Outliers</span>
                  <span className="font-mono font-bold text-sm text-amber-600">{rawStats.outlierCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border">
                  <span className="text-[10px] text-muted-foreground block">Skewness</span>
                  <span className="font-mono font-bold text-sm">{rawStats.skewness}</span>
                </div>
              </div>
            </div>

            {/* Cleaned Dataset State */}
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/[0.015] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                <h4 className="font-bold text-sm text-emerald-700 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> After Cleaning &amp; Transformations
                </h4>
                <span className="text-xs font-mono text-emerald-700 font-bold">
                  {cleanedDataResult.stats.count} records
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-background border border-emerald-500/20 shadow-2xs">
                  <span className="text-[10px] text-muted-foreground block">Clean Mean</span>
                  <span className="font-mono font-bold text-sm text-foreground">{cleanedDataResult.stats.mean}</span>
                </div>
                <div className="p-3 rounded-xl bg-background border border-emerald-500/20 shadow-2xs">
                  <span className="text-[10px] text-muted-foreground block">Clean Median</span>
                  <span className="font-mono font-bold text-sm text-foreground">{cleanedDataResult.stats.median}</span>
                </div>
                <div className="p-3 rounded-xl bg-background border border-emerald-500/20 shadow-2xs">
                  <span className="text-[10px] text-muted-foreground block">Clean Std Dev</span>
                  <span className="font-mono font-bold text-sm text-foreground">{cleanedDataResult.stats.stdDev}</span>
                </div>
                <div className="p-3 rounded-xl bg-background border border-emerald-500/20 shadow-2xs">
                  <span className="text-[10px] text-muted-foreground block">Imputed</span>
                  <span className="font-mono font-bold text-sm text-emerald-600">
                    {cleanedDataResult.imputedCount} values
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-background border border-emerald-500/20 shadow-2xs">
                  <span className="text-[10px] text-muted-foreground block">Treated Outliers</span>
                  <span className="font-mono font-bold text-sm text-emerald-600">
                    {cleanedDataResult.outliersTreatedCount} values
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-background border border-emerald-500/20 shadow-2xs">
                  <span className="text-[10px] text-muted-foreground block">Clean Skew</span>
                  <span className="font-mono font-bold text-sm text-foreground">{cleanedDataResult.stats.skewness}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: METHODOLOGY & DATA TYPE MATRIX                               */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "guide" && (
        <div className="space-y-8">
          {/* Step-by-Step Methodology Cards */}
          <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <h3 className="font-extrabold text-xl text-foreground">How We Perform Exploratory Data Analysis (EDA)</h3>
              <p className="text-sm text-muted-foreground">
                Follow this industry-standard 5-stage sequential roadmap to profile any tabular dataset before building machine learning models.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                {
                  step: "01",
                  title: "First Look & Shape",
                  desc: "Inspect rows × columns, data types, head/tail samples, and column semantic meanings.",
                  tag: "df.info(), df.shape",
                },
                {
                  step: "02",
                  title: "Missing Data Hygiene",
                  desc: "Map null percentages. Decide MCAR vs MAR; apply mean, median, or iterative KNN imputation.",
                  tag: "df.isnull().sum()",
                },
                {
                  step: "03",
                  title: "Outlier Diagnostics",
                  desc: "Calculate 1.5×IQR fences and Z-scores (|z| > 3). Choose between Winsorization and trimming.",
                  tag: "IQR & boxplot",
                },
                {
                  step: "04",
                  title: "Univariate Spread",
                  desc: "Examine histograms, KDE density curves, skewness coefficients, and modal peaks.",
                  tag: "sns.kdeplot()",
                },
                {
                  step: "05",
                  title: "Bivariate & Correlation",
                  desc: "Analyze Pearson r, scatter trendlines, cross-tabs, and multicollinearity heatmaps.",
                  tag: "sns.heatmap(df.corr())",
                },
              ].map((stage) => (
                <div key={stage.step} className="p-4 rounded-2xl border bg-muted/20 space-y-2">
                  <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Phase {stage.step}
                  </span>
                  <h4 className="font-bold text-sm text-foreground">{stage.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{stage.desc}</p>
                  <code className="text-[10px] font-mono text-muted-foreground block bg-background px-2 py-1 rounded border">
                    {stage.tag}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Data Type Decision Matrix */}
          <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-lg text-foreground">
                Data Type Decision Matrix: Which Operations Apply Where?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Never apply mean or scatter plots to categorical variables, or frequency tables to high-precision continuous metrics.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 font-bold text-foreground">Data Type</th>
                    <th className="p-3 font-bold text-foreground">Typical Examples</th>
                    <th className="p-3 font-bold text-emerald-700">Recommended Operations</th>
                    <th className="p-3 font-bold text-rose-700">Operations to Avoid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="p-3 font-bold text-foreground">Continuous Numerical</td>
                    <td className="p-3 text-muted-foreground">Salary, Age, Temperature, Loss, Price</td>
                    <td className="p-3 text-emerald-700">
                      Mean, Median, Std Dev, Box Plot, KDE, Histogram, StandardScaler, Pearson correlation
                    </td>
                    <td className="p-3 text-rose-700">Frequency count tables with 1000+ unique rows, Label Encoding</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Discrete Numerical</td>
                    <td className="p-3 text-muted-foreground">Family count (SibSp), Bug counts, Visits</td>
                    <td className="p-3 text-emerald-700">
                      Mode, Median, Bar chart, Poisson distribution check, Count plot
                    </td>
                    <td className="p-3 text-rose-700">Log transforms on frequent zeros without +1 offset</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Nominal Categorical</td>
                    <td className="p-3 text-muted-foreground">Gender, Country, Blood Group, Device</td>
                    <td className="p-3 text-emerald-700">
                      Mode, Frequency %, Bar/Count chart, One-Hot Encoding (pd.get_dummies), Chi-square
                    </td>
                    <td className="p-3 text-rose-700">Mean, Median, Standard Deviation, Scatter Plots, Correlation matrix</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Ordinal Categorical</td>
                    <td className="p-3 text-muted-foreground">Customer Rating (1-5), Ticket Class (1st, 2nd, 3rd)</td>
                    <td className="p-3 text-emerald-700">
                      Median, Mode, Ordinal Encoding preserving ranks, Spearman rank correlation
                    </td>
                    <td className="p-3 text-rose-700">One-Hot Encoding (destroys rank relationship)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-foreground">Datetime / Temporal</td>
                    <td className="p-3 text-muted-foreground">Timestamp, Purchase Date, Session Start</td>
                    <td className="p-3 text-emerald-700">
                      Feature extraction (day of week, hour, month), Forward-fill imputation, Lag plots
                    </td>
                    <td className="p-3 text-rose-700">Mean of timestamps, random row shuffling before time splits</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: PRODUCTION PYTHON CODE GENERATOR                             */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === "code" && (
        <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-lg text-foreground">Production-Ready Python EDA Script</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete script utilizing Pandas, NumPy, Scipy, and Seaborn for automated EDA and data cleaning.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                handleCopyCode(`import pandas as pd
import numpy as np
import scipy.stats as stats
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Load Dataset
df = pd.read_csv("dataset.csv")
print("=== SHAPE & TYPES ===")
print(df.info())
print(df.describe())

# 2. Missing Value Analysis & Imputation
print("\\n=== MISSING VALUES ===")
missing_summary = df.isnull().sum()
print(missing_summary[missing_summary > 0])

# Impute numerical with Median (robust against outliers)
for col in df.select_dtypes(include=[np.number]).columns:
    if df[col].isnull().any():
        df[col] = df[col].fillna(df[col].median())

# 3. Outlier Detection via 1.5x IQR Rule
def detect_and_cap_outliers(data, column):
    Q1 = data[column].quantile(0.25)
    Q3 = data[column].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    outliers = data[(data[column] < lower_bound) | (data[column] > upper_bound)]
    print(f"{column}: {len(outliers)} outliers detected [Lower: {lower_bound:.2f}, Upper: {upper_bound:.2f}]")
    # Winsorization (capping)
    data[column] = np.clip(data[column], lower_bound, upper_bound)
    return data

# 4. Univariate Distributions: Box Plot, KDE & Histogram
plt.figure(figsize=(14, 4))
plt.subplot(1, 3, 1)
sns.boxplot(y=df["${activeCol.name}"], color="#10b981")
plt.title("${activeCol.name} Box Plot")

plt.subplot(1, 3, 2)
sns.kdeplot(df["${activeCol.name}"], fill=True, color="#059669")
plt.title("${activeCol.name} KDE Density")

plt.subplot(1, 3, 3)
sns.histplot(df["${activeCol.name}"], kde=True, bins=15, color="#0284c7")
plt.title("${activeCol.name} Histogram")
plt.tight_layout()
plt.show()

# 5. Correlation Heatmap
plt.figure(figsize=(8, 6))
sns.heatmap(df.corr(numeric_only=True), annot=True, cmap="coolwarm", fmt=".2f")
plt.title("Pearson Correlation Heatmap")
plt.show()
`)
              }
              className="gap-2 rounded-xl text-xs font-semibold"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCode ? "Copied!" : "Copy Python Script"}
            </Button>
          </div>

          <pre className="p-4 rounded-2xl bg-muted/30 border font-mono text-xs overflow-x-auto text-foreground leading-relaxed max-h-[460px]">
{`import pandas as pd
import numpy as np
import scipy.stats as stats
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Load Dataset
df = pd.read_csv("dataset.csv")
print("=== SHAPE & TYPES ===")
print(df.info())
print(df.describe())

# 2. Missing Value Analysis & Imputation
print("\\n=== MISSING VALUES ===")
missing_summary = df.isnull().sum()
print(missing_summary[missing_summary > 0])

# Impute numerical with Median (robust against outliers)
for col in df.select_dtypes(include=[np.number]).columns:
    if df[col].isnull().any():
        df[col] = df[col].fillna(df[col].median())

# 3. Outlier Detection via 1.5x IQR Rule
def detect_and_cap_outliers(data, column):
    Q1 = data[column].quantile(0.25)
    Q3 = data[column].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    outliers = data[(data[column] < lower_bound) | (data[column] > upper_bound)]
    print(f"{column}: {len(outliers)} outliers detected [Lower: {lower_bound:.2f}, Upper: {upper_bound:.2f}]")
    # Winsorization (capping)
    data[column] = np.clip(data[column], lower_bound, upper_bound)
    return data

# 4. Univariate Distributions: Box Plot, KDE & Histogram
plt.figure(figsize=(14, 4))
plt.subplot(1, 3, 1)
sns.boxplot(y=df["${activeCol.name}"], color="#10b981")
plt.title("${activeCol.name} Box Plot")

plt.subplot(1, 3, 2)
sns.kdeplot(df["${activeCol.name}"], fill=True, color="#059669")
plt.title("${activeCol.name} KDE Density")

plt.subplot(1, 3, 3)
sns.histplot(df["${activeCol.name}"], kde=True, bins=15, color="#0284c7")
plt.title("${activeCol.name} Histogram")
plt.tight_layout()
plt.show()

# 5. Correlation Heatmap
plt.figure(figsize=(8, 6))
sns.heatmap(df.corr(numeric_only=True), annot=True, cmap="coolwarm", fmt=".2f")
plt.title("Pearson Correlation Heatmap")
plt.show()`}
          </pre>
        </div>
      )}
    </div>
  );
}
