"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  Check,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Redo2,
  Sliders,
  Sparkles,
  Table,
  TrendingUp,
  Undo2,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getApiEndpoint } from "@/lib/api-client";
import {
  EDA_LIMITS,
  applyTransformation,
  computeGroupedStats,
  generateAutomatedInsights,
  getTabularSampleDatasets,
  parseCsvText,
  parseNumericToken,
  profileDataset,
  type DataInsight,
  type DataRow,
  type DatasetProfile,
  type ParsedDataset,
  type TransformationAction,
} from "@/lib/math/eda-engine";
import { generateEdaPdfReport, triggerCsvDownload } from "@/lib/math/eda-pdf";
import {
  PLOTLY_2D_CHARTS,
  PLOTLY_3D_CHARTS,
  PlotlyEDAChart,
  isChartTypeEligible,
  type PlotlyChartConfig,
  type PlotlyChartType,
} from "./PlotlyEDAChart";
import { EDACleanerPanel } from "./EDACleanerPanel";
import { EDAPipelineSimulator } from "./EDAPipelineSimulator";
import { cn } from "@/lib/utils";

type EDATab = "overview" | "studio" | "stats" | "cleaning" | "simulator" | "guide";

interface WorkingSnapshot {
  headers: string[];
  rows: DataRow[];
  description: string;
}

export function EDATool() {
  const sampleDatasets = useMemo(() => getTabularSampleDatasets(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureChartRef = useRef<(() => Promise<string | null>) | null>(null);

  const [activeTab, setActiveTab] = useState<EDATab>("overview");

  // Dataset State: Original untouched + Working Copy + History
  const [originalDataset, setOriginalDataset] = useState<ParsedDataset>(sampleDatasets[0]);
  const [workingHeaders, setWorkingHeaders] = useState<string[]>(sampleDatasets[0].headers);
  const [workingRows, setWorkingRows] = useState<DataRow[]>(sampleDatasets[0].rows);
  const [undoStack, setUndoStack] = useState<WorkingSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<WorkingSnapshot[]>([]);
  const [historyLog, setHistoryLog] = useState<{ timestamp: string; action: string }[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  // Backend Session State (optional remote sync when CSV uploaded)
  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [backendDatasetId, setBackendDatasetId] = useState<string | null>(null);

  // Loading & Drag states
  const [uploading, setUploading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Compute live Dataset Profile & Statistical Insights on Working Copy
  const profile: DatasetProfile = useMemo(
    () => profileDataset(originalDataset.name, workingHeaders, workingRows),
    [originalDataset.name, workingHeaders, workingRows]
  );

  const insights: DataInsight[] = useMemo(() => generateAutomatedInsights(profile), [profile]);

  // Interactive Plotly Config State
  const [chartConfig, setChartConfig] = useState<PlotlyChartConfig>({
    chartType: "histogram",
    xCol: sampleDatasets[0].headers[0],
    yCol: sampleDatasets[0].headers[1] || sampleDatasets[0].headers[0],
    zCol: sampleDatasets[0].headers[2] || sampleDatasets[0].headers[0],
    sizeCol: sampleDatasets[0].headers[1] || sampleDatasets[0].headers[0],
    colorCol: sampleDatasets[0].headers[4] || "__NONE__",
    uCol: sampleDatasets[0].headers[0],
    vCol: sampleDatasets[0].headers[1] || sampleDatasets[0].headers[0],
    wCol: sampleDatasets[0].headers[2] || sampleDatasets[0].headers[0],
    multiCols: sampleDatasets[0].headers.slice(0, 3),
    aggMethod: "mean",
    bins: 15,
    kdeBandwidth: 1.0,
    corrMethod: "pearson",
    colorScale: "Viridis",
    markerSize: 6,
    customTitle: "",
    customXLabel: "",
    customYLabel: "",
    customZLabel: "",
  });

  // Grouped stats & Pipeline simulator variable selectors
  const [groupByCol, setGroupByCol] = useState<string>("");
  const [groupMeasureCol, setGroupMeasureCol] = useState<string>("");
  const [simColName, setSimColName] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Synchronize default axes intelligently whenever dataset columns change
  useEffect(() => {
    const nums = profile.numericalColumns;
    const cats = [...profile.categoricalColumns, ...profile.booleanColumns];
    const all = profile.columns.map((c) => c.name);

    const nonIdNums = nums.filter((n) => !profile.potentialIdColumns.includes(n));
    const numPool = nonIdNums.length > 0 ? nonIdNums : nums;

    const defaultX = numPool[0] || all[0] || "";
    const defaultY = numPool[1] || numPool[0] || all[1] || all[0] || "";
    const defaultZ = numPool[2] || numPool[1] || numPool[0] || all[0] || "";
    const defaultSize = numPool[3] || numPool[1] || numPool[0] || "";
    const defaultColor = cats[0] || (numPool[2] ? numPool[2] : "__NONE__");

    // Smart initial chart type recommendation based on actual dataset schema
    const defaultChart: PlotlyChartType = profile.chartEligibility.has3DVector
      ? "cone"
      : profile.chartEligibility.has3DScatter
      ? "scatter3d"
      : nums.length >= 2
      ? "scatter"
      : nums.length >= 1
      ? "histogram"
      : "bar";

    setChartConfig((prev) => ({
      ...prev,
      chartType: all.includes(prev.xCol) && isChartTypeEligible(prev.chartType, profile).eligible ? prev.chartType : defaultChart,
      xCol: all.includes(prev.xCol) ? prev.xCol : defaultX,
      yCol: all.includes(prev.yCol) ? prev.yCol : defaultY,
      zCol: all.includes(prev.zCol) ? prev.zCol : defaultZ,
      sizeCol: all.includes(prev.sizeCol) ? prev.sizeCol : defaultSize,
      colorCol: prev.colorCol === "__NONE__" || all.includes(prev.colorCol) ? prev.colorCol : defaultColor,
      uCol: all.includes(prev.uCol) ? prev.uCol : numPool[3] || defaultX,
      vCol: all.includes(prev.vCol) ? prev.vCol : numPool[4] || defaultY,
      wCol: all.includes(prev.wCol) ? prev.wCol : numPool[5] || defaultZ,
      multiCols:
        prev.multiCols.filter((c) => nums.includes(c)).length >= 2
          ? prev.multiCols.filter((c) => nums.includes(c))
          : numPool.slice(0, 4),
    }));

    setGroupByCol((prev) => (cats.includes(prev) ? prev : cats[0] || ""));
    setGroupMeasureCol((prev) => (nums.includes(prev) ? prev : numPool[0] || ""));
    setSimColName((prev) => (nums.includes(prev) ? prev : numPool[0] || ""));
  }, [profile]);

  // Helper to load a parsed dataset cleanly into workspace
  const loadDatasetIntoWorkspace = (
    ds: ParsedDataset,
    warnings: string[] = [],
    sessId: string | null = null,
    dsId: string | null = null
  ) => {
    setOriginalDataset(ds);
    setWorkingHeaders([...ds.headers]);
    setWorkingRows(ds.rows.map((r) => ({ ...r })));
    setUndoStack([]);
    setRedoStack([]);
    setHistoryLog([]);
    setParseWarnings(warnings);
    setBackendSessionId(sessId);
    setBackendDatasetId(dsId);
    setUploadError(null);
  };

  const handleSelectSample = (id: string) => {
    const found = sampleDatasets.find((d) => d.id === id) || sampleDatasets[0];
    loadDatasetIntoWorkspace(found, [], null, null);
    toast.success(`Loaded "${found.name}" (${found.rows.length} rows)`);
  };

  // CSV Upload Handler (Multipart to Backend/Next API with safe validation & fallback)
  const handleCsvUpload = async (file: File) => {
    setUploadError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["csv", "tsv", "txt"].includes(ext) && file.type && !file.type.includes("csv") && !file.type.includes("text")) {
      const msg = "Invalid file type. Please upload a valid .csv file.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }
    if (file.size === 0) {
      const msg = "The selected CSV file is empty (0 bytes).";
      setUploadError(msg);
      toast.error(msg);
      return;
    }
    if (file.size > EDA_LIMITS.MAX_FILE_BYTES) {
      const msg = `File exceeds maximum size limit of ${Math.round(EDA_LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB.`;
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const headers: Record<string, string> = {};
      if (backendSessionId) headers["x-eda-session"] = backendSessionId;

      const endpoint = getApiEndpoint("/api/eda/upload");
      let uploadedViaApi = false;

      try {
        const res = await fetch(endpoint, { method: "POST", body: formData, headers });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || `Upload error (${res.status})`);
        }
        const loadedDs: ParsedDataset = {
          id: json.datasetId || `csv_${Date.now()}`,
          name: json.profile?.name || file.name.replace(/\.(csv|tsv|txt)$/i, ""),
          headers: json.profile?.columns?.map((c: any) => c.name) || Object.keys(json.rows?.[0] || {}),
          rows: json.rows || [],
          warnings: json.warnings || [],
          source: "csv",
        };
        loadDatasetIntoWorkspace(loadedDs, json.warnings || [], json.sessionId || null, json.datasetId || null);
        setActiveTab("overview");
        uploadedViaApi = true;
        toast.success(`Analyzed "${loadedDs.name}": ${loadedDs.rows.length.toLocaleString()} rows × ${loadedDs.headers.length} columns`);
      } catch (apiErr: any) {
        // Only fall back to local browser parser if network/server unreachable, NOT if server reported invalid CSV
        if (apiErr?.message && !/fetch|network|failed to fetch|404/i.test(apiErr.message)) {
          throw apiErr;
        }
        if (!uploadedViaApi) {
          const text = await file.text();
          const parsed = parseCsvText(text, file.name);
          loadDatasetIntoWorkspace(parsed, parsed.warnings, null, null);
          setActiveTab("overview");
          toast.success(`Parsed "${parsed.name}" locally (${parsed.rows.length.toLocaleString()} rows)`);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to parse uploaded CSV.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Apply Data Transformation + Sync with Backend Session + Track Undo/Redo History
  const handleApplyTransform = (action: TransformationAction) => {
    try {
      const result = applyTransformation(workingHeaders, workingRows, action);
      setUndoStack((prev) => [
        ...prev.slice(-19),
        { headers: workingHeaders, rows: workingRows, description: result.description },
      ]);
      setRedoStack([]);
      setWorkingHeaders(result.headers);
      setWorkingRows(result.rows);
      setHistoryLog((prev) => [...prev, { timestamp: new Date().toISOString(), action: result.description }]);
      toast.success(result.description);

      // Fire background sync if connected to Express backend session
      if (backendSessionId && backendDatasetId && !backendSessionId.startsWith("local_")) {
        fetch(getApiEndpoint("/api/eda/transform"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-eda-session": backendSessionId,
          },
          body: JSON.stringify({ datasetId: backendDatasetId, action }),
        }).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not apply transformation.");
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, { headers: workingHeaders, rows: workingRows, description: prev.description }]);
    setWorkingHeaders(prev.headers);
    setWorkingRows(prev.rows);
    setHistoryLog((h) => [...h, { timestamp: new Date().toISOString(), action: `Undo: ${prev.description}` }]);
    toast.info(`Undid: ${prev.description}`);

    if (backendSessionId && backendDatasetId && !backendSessionId.startsWith("local_")) {
      fetch(getApiEndpoint("/api/eda/transform"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eda-session": backendSessionId },
        body: JSON.stringify({ datasetId: backendDatasetId, mode: "undo" }),
      }).catch(() => {});
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((u) => [...u, { headers: workingHeaders, rows: workingRows, description: next.description }]);
    setWorkingHeaders(next.headers);
    setWorkingRows(next.rows);
    setHistoryLog((h) => [...h, { timestamp: new Date().toISOString(), action: `Redo: ${next.description}` }]);
    toast.info(`Redid: ${next.description}`);

    if (backendSessionId && backendDatasetId && !backendSessionId.startsWith("local_")) {
      fetch(getApiEndpoint("/api/eda/transform"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eda-session": backendSessionId },
        body: JSON.stringify({ datasetId: backendDatasetId, mode: "redo" }),
      }).catch(() => {});
    }
  };

  const handleResetOriginal = () => {
    setUndoStack((u) => [...u, { headers: workingHeaders, rows: workingRows, description: "Reset to original" }]);
    setRedoStack([]);
    setWorkingHeaders([...originalDataset.headers]);
    setWorkingRows(originalDataset.rows.map((r) => ({ ...r })));
    setHistoryLog((h) => [...h, { timestamp: new Date().toISOString(), action: "Restored original dataset" }]);
    toast.success("Restored original unmodified dataset.");

    if (backendSessionId && backendDatasetId && !backendSessionId.startsWith("local_")) {
      fetch(getApiEndpoint("/api/eda/transform"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eda-session": backendSessionId },
        body: JSON.stringify({ datasetId: backendDatasetId, mode: "reset" }),
      }).catch(() => {});
    }
  };

  // Export Complete Processed CSV
  const handleExportCsv = () => {
    try {
      triggerCsvDownload(workingHeaders, workingRows, profile.name);
      toast.success(`Exported complete dataset (${workingRows.length.toLocaleString()} rows) to CSV`);
    } catch (err: any) {
      toast.error(err?.message || "CSV export failed.");
    }
  };

  // Export Comprehensive 16-Section PDF Report
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const activeImg = captureChartRef.current ? await captureChartRef.current() : null;
      await generateEdaPdfReport({
        profile,
        insights,
        rows: workingRows,
        headers: workingHeaders,
        config: chartConfig,
        historyLog,
        activeChartImage: activeImg,
      });
      toast.success("Downloaded full 16-section EDA PDF Analysis Report!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate PDF report.");
    } finally {
      setExportingPdf(false);
    }
  };

  // Auto-recommended charts tailored to the active dataset
  const recommendedCharts = useMemo(() => {
    const recs: { label: string; type: PlotlyChartType; tag: string }[] = [];
    if (profile.chartEligibility.has3DVector) {
      recs.push({ label: "3D Vector Cones", type: "cone", tag: "3D" });
      recs.push({ label: "3D Streamtubes", type: "streamtube", tag: "3D" });
    }
    if (profile.chartEligibility.has3DVolume) {
      recs.push({ label: "3D Volume Field", type: "volume", tag: "3D" });
      recs.push({ label: "3D Isosurface", type: "isosurface", tag: "3D" });
    }
    if (profile.chartEligibility.has3DScatter) {
      recs.push({ label: "3D Scatter Space", type: "scatter3d", tag: "3D" });
      recs.push({ label: "3D Observed Surface", type: "surface", tag: "3D" });
    }
    if (profile.chartEligibility.has3DBubble) {
      recs.push({ label: "3D Bubble", type: "bubble3d", tag: "3D" });
    }
    if (profile.numericalColumns.length >= 2) {
      recs.push({ label: "Correlation Matrix", type: "correlation_heatmap", tag: "2D" });
      recs.push({ label: "Scatter + OLS Fit", type: "scatter", tag: "2D" });
      recs.push({ label: "Pair Plot (SPLOM)", type: "pairplot", tag: "Multi" });
    }
    if (profile.numericalColumns.length >= 1) {
      recs.push({ label: "Box Plot Outliers", type: "box", tag: "2D" });
      recs.push({ label: "Gaussian KDE", type: "kde", tag: "2D" });
    }
    if (profile.chartEligibility.hasCategorical) {
      recs.push({ label: "Category Breakdown", type: "bar", tag: "Cat" });
      recs.push({ label: "Donut Share", type: "donut", tag: "Cat" });
    }
    if (profile.totalMissingCells > 0) {
      recs.push({ label: "Missingness Audit", type: "missing", tag: "QC" });
    }
    return recs;
  }, [profile]);

  const groupedStatsResult = useMemo(() => {
    if (!groupByCol || !groupMeasureCol) return null;
    return computeGroupedStats(workingRows, groupByCol, groupMeasureCol, "mean");
  }, [workingRows, groupByCol, groupMeasureCol]);

  const simulatorRawNumbers = useMemo(() => {
    const col = simColName || profile.numericalColumns[0];
    if (!col) return [];
    return workingRows.map((r) => parseNumericToken(r[col]));
  }, [workingRows, simColName, profile.numericalColumns]);

  const allColNames = profile.columns.map((c) => c.name);
  const numColNames = profile.numericalColumns;
  const isModified = undoStack.length > 0;

  // Dynamic Python EDA code matching the active dataset
  const pythonScript = useMemo(() => {
    const numCol = numColNames[0] || allColNames[0] || "value";
    const yCol = numColNames[1] || numCol;
    const zCol = numColNames[2] || numCol;
    return `import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

# 1. Load Dataset & Automated Schema Inspection
df = pd.read_csv("${profile.name}.csv")
print("Shape:", df.shape)
print("\\nColumn Types & Non-Nulls:")
print(df.info())
print("\\nMissing Values:\\n", df.isnull().sum())
print("Duplicate Rows:", df.duplicated().sum())

# 2. Descriptive Numerical & Outlier Profiling
print("\\nStatistical Summary:")
print(df.describe().T)

# 3. Correlation Matrices (Pearson & Spearman)
num_cols = df.select_dtypes(include=[np.number]).columns
corr_pearson = df[num_cols].corr(method="pearson")
fig_corr = px.imshow(corr_pearson, text_auto=".2f", color_continuous_scale="RdBu_r", title="Pearson Correlation Heatmap")
fig_corr.show()

# 4. Interactive 2D & 3D Plotly EDA Visualizations
fig_hist = px.histogram(df, x="${numCol}", nbins=${chartConfig.bins}, title="Distribution of ${numCol}")
fig_hist.show()
${
  profile.chartEligibility.has3DScatter
    ? `
fig_3d = px.scatter_3d(
    df, x="${chartConfig.xCol}", y="${chartConfig.yCol}", z="${chartConfig.zCol}",
    ${chartConfig.colorCol && chartConfig.colorCol !== "__NONE__" ? `color="${chartConfig.colorCol}", ` : ""}title="3D Exploratory Scatter Space"
)
fig_3d.show()`
    : `fig_scatter = px.scatter(df, x="${numCol}", y="${yCol}", trendline="ols", title="${yCol} vs ${numCol}")
fig_scatter.show()`
}`;
  }, [profile.name, profile.chartEligibility.has3DScatter, numColNames, allColNames, chartConfig]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* =================================================================== */}
      {/* HEADER + CSV UPLOAD + EXPORTS + SAMPLE DATASETS                     */}
      {/* =================================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-card p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
              <Activity className="h-3.5 w-3.5" /> Automated Exploratory Data Analysis (EDA) Studio
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Upload CSV, Auto-Insights, 3D Plotly &amp; Data Cleaning
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload any CSV dataset up to 15 MB to automatically infer schema types, detect statistical insights, explore interactive 2D and WebGL 3D Plotly visualizations, clean data with Undo/Redo history, and export complete CSV or PDF reports.
            </p>
          </div>

          {/* Export & History Quick Bar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="rounded-xl text-xs font-bold gap-1.5"
              title="Undo last cleaning operation"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="rounded-xl text-xs font-bold gap-1.5"
              title="Redo cleaning operation"
            >
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="rounded-xl text-xs font-bold gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700"
            >
              <Download className="h-3.5 w-3.5" /> Download CSV
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="rounded-xl text-xs font-bold gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {exportingPdf ? "Generating PDF..." : "Download PDF Report"}
            </Button>
          </div>
        </div>

        {/* CSV Dropzone + Sample Switcher */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleCsvUpload(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "lg:col-span-7 cursor-pointer rounded-2xl border-2 border-dashed p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all",
              dragActive
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-border hover:border-emerald-500/50 hover:bg-muted/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCsvUpload(f);
              }}
            />
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {uploading ? "Inspecting & Profiling CSV Dataset..." : "Upload Your CSV Dataset"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag & drop or click to select a <code>.csv</code> file (max 15 MB, 100k rows)
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" type="button" className="rounded-xl text-xs font-bold shrink-0">
              Select CSV File
            </Button>
          </div>

          {/* Preset Sample Switcher */}
          <div className="lg:col-span-5 rounded-2xl border bg-muted/20 p-3.5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Built-in Practice Datasets
              </span>
              {originalDataset.source === "csv" && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Active: Custom CSV
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sampleDatasets.map((ds) => (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => handleSelectSample(ds.id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                    originalDataset.id === ds.id
                      ? "bg-background text-foreground border-emerald-500/50 shadow-2xs"
                      : "bg-transparent border-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  {ds.id === "fluid-field-3d" ? "3D Vector Field" : ds.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upload Errors / Parser Warnings */}
        {uploadError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-semibold">{uploadError}</span>
          </div>
        )}
        {parseWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-800 space-y-1">
            {parseWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Workspace Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          {[
            { id: "overview" as const, label: "Overview & Auto Insights", icon: Database },
            { id: "studio" as const, label: "2D & 3D Plotly Studio", icon: Box },
            { id: "stats" as const, label: "Statistics & Correlations", icon: Table },
            { id: "cleaning" as const, label: `Data Cleaning${isModified ? ` (${historyLog.length})` : ""}`, icon: Filter },
            { id: "simulator" as const, label: "Animated Cleaning Pipeline", icon: Zap },
            { id: "guide" as const, label: "Methodology & Python Code", icon: HelpCircle },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  activeTab === t.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW, DATASET UNDERSTANDING & AUTO INSIGHTS              */}
      {/* =================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Domain Explanation */}
          <div className="rounded-3xl border border-sky-500/30 bg-sky-500/5 p-6 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Automated Dataset Understanding — {profile.name}
              </span>
              <span className="rounded-full bg-white border px-3 py-0.5 text-xs font-bold text-foreground">
                {profile.inferredDomain}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{profile.domainExplanation}</p>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Total Rows", val: profile.rowCount.toLocaleString(), sub: isModified ? "Working copy" : "Original records" },
              { label: "Total Columns", val: profile.columnCount, sub: `${profile.numericalColumns.length} Num • ${profile.categoricalColumns.length} Cat` },
              { label: "Memory Footprint", val: profile.memoryFormatted, sub: "Estimated in-memory" },
              {
                label: "Missing Cells",
                val: `${profile.totalMissingPct}%`,
                sub: `${profile.totalMissingCells.toLocaleString()} null fields`,
                warn: profile.totalMissingCells > 0,
              },
              {
                label: "Duplicate Rows",
                val: profile.duplicateRowCount.toLocaleString(),
                sub: `${profile.duplicateRowPct}% duplicated`,
                warn: profile.duplicateRowCount > 0,
              },
              {
                label: "Special Columns",
                val: `${profile.potentialIdColumns.length} ID / ${profile.constantColumns.length} Const`,
                sub: `${profile.booleanColumns.length} Bool • ${profile.datetimeColumns.length} Date`,
              },
            ].map((k) => (
              <div
                key={k.label}
                className={cn(
                  "rounded-2xl border bg-card p-4 space-y-1 shadow-2xs",
                  k.warn && "border-amber-500/40 bg-amber-500/5"
                )}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">{k.label}</span>
                <span className="text-xl font-black text-foreground block">{k.val}</span>
                <span className="text-[11px] text-muted-foreground block truncate">{k.sub}</span>
              </div>
            ))}
          </div>

          {/* Automatic Insights Panel */}
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Automatically Generated Statistical Insights
                </h3>
                <p className="text-xs text-muted-foreground">
                  Every finding below is computed directly from exact statistical formulas on the active dataset.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-muted-foreground">{insights.length} Insights Detected</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className={cn(
                    "rounded-2xl border p-4 space-y-2",
                    ins.severity === "critical"
                      ? "border-rose-500/40 bg-rose-500/5"
                      : ins.severity === "warning"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : ins.severity === "positive"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border bg-muted/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground">{ins.title}</h4>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0",
                        ins.severity === "critical"
                          ? "bg-rose-500/15 text-rose-700"
                          : ins.severity === "warning"
                          ? "bg-amber-500/15 text-amber-800"
                          : ins.severity === "positive"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-sky-500/15 text-sky-700"
                      )}
                    >
                      {ins.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ins.explanation}</p>
                  <div className="rounded-lg bg-background/80 border px-2.5 py-1.5 text-[11px] font-mono text-foreground">
                    <strong>Evidence:</strong> {ins.evidence}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schema Profiling Table */}
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-base text-foreground">Column Schema &amp; Data Quality Profile</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 font-bold">Column Name</th>
                    <th className="p-3 font-bold">Inferred Type</th>
                    <th className="p-3 font-bold">Storage</th>
                    <th className="p-3 font-bold">Non-Null</th>
                    <th className="p-3 font-bold">Missing</th>
                    <th className="p-3 font-bold">Unique Values</th>
                    <th className="p-3 font-bold">Flags / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {profile.columns.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/20">
                      <td className="p-3 font-bold text-foreground">{c.name}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                            c.type === "numerical"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : c.type === "categorical"
                              ? "bg-violet-500/10 text-violet-700"
                              : c.type === "boolean"
                              ? "bg-sky-500/10 text-sky-700"
                              : "bg-amber-500/10 text-amber-700"
                          )}
                        >
                          {c.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{c.rawTypeInfo}</td>
                      <td className="p-3 font-mono">{c.count.toLocaleString()}</td>
                      <td className="p-3 font-mono">
                        <span className={c.missingCount > 0 ? "text-amber-700 font-bold" : "text-emerald-700"}>
                          {c.missingCount} ({c.missingPct}%)
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        {c.uniqueCount.toLocaleString()} ({c.uniquePct}%)
                      </td>
                      <td className="p-3">
                        {c.isConstant ? (
                          <span className="text-[10px] font-bold bg-rose-500/10 text-rose-700 px-2 py-0.5 rounded">Constant</span>
                        ) : c.isPotentialId ? (
                          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded">Potential ID</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700">Healthy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dataset Preview Rows */}
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-foreground">Working Dataset Preview (First 25 Rows)</h3>
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(25, workingRows.length)} of {workingRows.length.toLocaleString()} records
              </span>
            </div>
            <div className="overflow-x-auto max-h-80 border rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="p-2.5 font-mono text-[10px] text-muted-foreground border-b">#</th>
                    {workingHeaders.map((h) => (
                      <th key={h} className="p-2.5 font-bold border-b whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {workingRows.slice(0, 25).map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-muted/20">
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{rIdx + 1}</td>
                      {workingHeaders.map((h) => (
                        <td key={h} className="p-2.5 font-mono whitespace-nowrap">
                          {r[h] === null || r[h] === undefined ? (
                            <span className="text-rose-500 italic text-[10px]">null</span>
                          ) : (
                            String(r[h])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: INTERACTIVE 2D & 3D PLOTLY STUDIO                            */}
      {/* =================================================================== */}
      {activeTab === "studio" && (
        <div className="space-y-6">
          {/* Smart Recommended Charts Bar */}
          <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Auto-Recommended Visualizations for This Dataset
              </span>
              <span className="text-[11px] text-muted-foreground">
                3D charts unlock only when required dimensionality exists (zero synthetic axes)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendedCharts.map((rec) => (
                <button
                  key={rec.type}
                  type="button"
                  onClick={() => setChartConfig((prev) => ({ ...prev, chartType: rec.type }))}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all",
                    chartConfig.chartType === rec.type
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-muted/40 text-foreground border-border/60 hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[9px] font-mono uppercase",
                      rec.tag === "3D" ? "bg-indigo-500 text-white" : "bg-background text-foreground border"
                    )}
                  >
                    {rec.tag}
                  </span>
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Custom EDA Configuration Sidebar */}
            <div className="lg:col-span-4 rounded-3xl border bg-card p-5 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600" /> Custom EDA Controls
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setChartConfig((prev) => ({
                      ...prev,
                      customTitle: "",
                      customXLabel: "",
                      customYLabel: "",
                      customZLabel: "",
                    }))
                  }
                  className="text-[11px] text-muted-foreground hover:text-foreground font-semibold"
                >
                  Reset Labels
                </button>
              </div>

              {/* 3D Charts Picker */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                  3D Plotly WebGL Visualizations (9)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-1.5">
                  {PLOTLY_3D_CHARTS.map((c) => {
                    const check = isChartTypeEligible(c.id, profile);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!check.eligible}
                        title={check.eligible ? c.label : check.reason}
                        onClick={() => setChartConfig((p) => ({ ...p, chartType: c.id }))}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between border text-left transition-all",
                          !check.eligible
                            ? "opacity-45 cursor-not-allowed bg-muted/30 text-muted-foreground"
                            : chartConfig.chartType === c.id
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-background hover:bg-indigo-500/10 border-border/70 text-foreground"
                        )}
                      >
                        <span className="truncate">{c.label}</span>
                        {!check.eligible && <Lock className="h-3 w-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2D & Hierarchical Charts Picker */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  2D &amp; Multi-Dimensional Plots (19)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {PLOTLY_2D_CHARTS.map((c) => {
                    const check = isChartTypeEligible(c.id, profile);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!check.eligible}
                        title={check.eligible ? c.label : check.reason}
                        onClick={() => setChartConfig((p) => ({ ...p, chartType: c.id }))}
                        className={cn(
                          "px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between border text-left transition-all",
                          !check.eligible
                            ? "opacity-45 cursor-not-allowed bg-muted/30 text-muted-foreground"
                            : chartConfig.chartType === c.id
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-background hover:bg-emerald-500/10 border-border/70 text-foreground"
                        )}
                      >
                        <span className="truncate">{c.label}</span>
                        {!check.eligible && <Lock className="h-3 w-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Axes Mapping */}
              <div className="space-y-3 pt-2 border-t">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">X-Axis / Primary</label>
                    <select
                      value={chartConfig.xCol}
                      onChange={(e) => setChartConfig((p) => ({ ...p, xCol: e.target.value }))}
                      className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {allColNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Y-Axis / Metric</label>
                    <select
                      value={chartConfig.yCol}
                      onChange={(e) => setChartConfig((p) => ({ ...p, yCol: e.target.value }))}
                      className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {allColNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Z-Axis and Size when relevant */}
                {(PLOTLY_3D_CHARTS.some((c) => c.id === chartConfig.chartType) || chartConfig.chartType === "heatmap") && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-indigo-700 block mb-1">Z-Axis</label>
                      <select
                        value={chartConfig.zCol}
                        onChange={(e) => setChartConfig((p) => ({ ...p, zCol: e.target.value }))}
                        className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                      >
                        {numColNames.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {["bubble3d", "bubble", "volume", "isosurface"].includes(chartConfig.chartType) && (
                      <div>
                        <label className="text-[11px] font-bold text-indigo-700 block mb-1">
                          {["volume", "isosurface"].includes(chartConfig.chartType) ? "Scalar Intensity (V)" : "Bubble Size"}
                        </label>
                        <select
                          value={chartConfig.sizeCol}
                          onChange={(e) => setChartConfig((p) => ({ ...p, sizeCol: e.target.value }))}
                          className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                        >
                          {numColNames.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Vector U, V, W selectors for Cone / Streamtube */}
                {["cone", "streamtube"].includes(chartConfig.chartType) && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "uCol" as const, label: "Vector U" },
                      { key: "vCol" as const, label: "Vector V" },
                      { key: "wCol" as const, label: "Vector W" },
                    ].map((vec) => (
                      <div key={vec.key}>
                        <label className="text-[10px] font-bold text-indigo-700 block mb-1">{vec.label}</label>
                        <select
                          value={chartConfig[vec.key]}
                          onChange={(e) => setChartConfig((p) => ({ ...p, [vec.key]: e.target.value }))}
                          className="w-full rounded-xl border bg-background px-2 py-1.5 text-xs font-semibold"
                        >
                          {numColNames.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Multi-column selector for PairPlot / Parallel Coords */}
                {["pairplot", "parcoords"].includes(chartConfig.chartType) && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground block">
                      Multi-Column Selection ({chartConfig.multiCols.length} selected)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {numColNames.map((c) => {
                        const checked = chartConfig.multiCols.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setChartConfig((p) => ({
                                ...p,
                                multiCols: checked
                                  ? p.multiCols.length > 2
                                    ? p.multiCols.filter((x) => x !== c)
                                    : p.multiCols
                                  : [...p.multiCols, c],
                              }))
                            }
                            className={cn(
                              "px-2 py-1 rounded-lg text-[11px] font-bold border",
                              checked
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-background text-muted-foreground border-border"
                            )}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grouping / Color & Aggregation */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Color / Group By</label>
                    <select
                      value={chartConfig.colorCol}
                      onChange={(e) => setChartConfig((p) => ({ ...p, colorCol: e.target.value }))}
                      className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="__NONE__">None</option>
                      {allColNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Aggregation</label>
                    <select
                      value={chartConfig.aggMethod}
                      onChange={(e) => setChartConfig((p) => ({ ...p, aggMethod: e.target.value as any }))}
                      className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="mean">Mean</option>
                      <option value="median">Median</option>
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                </div>

                {/* Colorscale & Correlation Method */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Colorscale</label>
                    <select
                      value={chartConfig.colorScale}
                      onChange={(e) => setChartConfig((p) => ({ ...p, colorScale: e.target.value }))}
                      className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {["Viridis", "Plasma", "Inferno", "Turbo", "Portland", "RdBu", "Cividis"].map((cs) => (
                        <option key={cs} value={cs}>
                          {cs}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Correlation</label>
                    <select
                      value={chartConfig.corrMethod}
                      onChange={(e) => setChartConfig((p) => ({ ...p, corrMethod: e.target.value as any }))}
                      className="w-full rounded-xl border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="pearson">Pearson (r)</option>
                      <option value="spearman">Spearman (rho)</option>
                    </select>
                  </div>
                </div>

                {/* Sliders: Bins, Bandwidth, Marker Size */}
                <div className="space-y-2.5 pt-1">
                  {chartConfig.chartType === "histogram" && (
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>Histogram Bins</span>
                        <span className="font-mono">{chartConfig.bins}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="1"
                        value={chartConfig.bins}
                        onChange={(e) => setChartConfig((p) => ({ ...p, bins: Number(e.target.value) }))}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  )}

                  {chartConfig.chartType === "kde" && (
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span>KDE Bandwidth (h multiplier)</span>
                        <span className="font-mono">{chartConfig.kdeBandwidth.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="2.5"
                        step="0.1"
                        value={chartConfig.kdeBandwidth}
                        onChange={(e) => setChartConfig((p) => ({ ...p, kdeBandwidth: parseFloat(e.target.value) }))}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Marker Size</span>
                      <span className="font-mono">{chartConfig.markerSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="16"
                      step="1"
                      value={chartConfig.markerSize}
                      onChange={(e) => setChartConfig((p) => ({ ...p, markerSize: Number(e.target.value) }))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>

                {/* Custom Titles & Axis Labels */}
                <div className="space-y-2 pt-2 border-t">
                  <Input
                    value={chartConfig.customTitle}
                    onChange={(e) => setChartConfig((p) => ({ ...p, customTitle: e.target.value }))}
                    placeholder="Custom Chart Title (optional)..."
                    className="h-8 text-xs rounded-xl"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <Input
                      value={chartConfig.customXLabel}
                      onChange={(e) => setChartConfig((p) => ({ ...p, customXLabel: e.target.value }))}
                      placeholder="X Label"
                      className="h-8 text-[11px] rounded-xl"
                    />
                    <Input
                      value={chartConfig.customYLabel}
                      onChange={(e) => setChartConfig((p) => ({ ...p, customYLabel: e.target.value }))}
                      placeholder="Y Label"
                      className="h-8 text-[11px] rounded-xl"
                    />
                    <Input
                      value={chartConfig.customZLabel}
                      onChange={(e) => setChartConfig((p) => ({ ...p, customZLabel: e.target.value }))}
                      placeholder="Z Label"
                      className="h-8 text-[11px] rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Plotly Chart Stage */}
            <div className="lg:col-span-8 rounded-3xl border bg-card p-5 shadow-xs">
              <PlotlyEDAChart
                rows={workingRows}
                profile={profile}
                config={chartConfig}
                height={520}
                onImageCaptureReady={(fn) => {
                  captureChartRef.current = fn;
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: STATISTICAL PROFILING, CORRELATIONS & GROUPED AGGREGATIONS   */}
      {/* =================================================================== */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Numerical Summary Statistics */}
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-base text-foreground">Numerical Statistical Summary &amp; Outlier Diagnostics</h3>
            {numColNames.length === 0 ? (
              <p className="text-xs text-muted-foreground">No numerical columns present in this dataset.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="p-2.5 font-bold">Feature</th>
                      <th className="p-2.5 font-bold">Mean</th>
                      <th className="p-2.5 font-bold">Median</th>
                      <th className="p-2.5 font-bold">Mode</th>
                      <th className="p-2.5 font-bold">Std Dev</th>
                      <th className="p-2.5 font-bold">Variance</th>
                      <th className="p-2.5 font-bold">Min</th>
                      <th className="p-2.5 font-bold">Q1</th>
                      <th className="p-2.5 font-bold">Q3</th>
                      <th className="p-2.5 font-bold">Max</th>
                      <th className="p-2.5 font-bold">IQR</th>
                      <th className="p-2.5 font-bold">Skew</th>
                      <th className="p-2.5 font-bold">Kurtosis</th>
                      <th className="p-2.5 font-bold">Outliers (IQR / Z)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-mono">
                    {profile.columns
                      .filter((c) => c.type === "numerical" && c.numStats)
                      .map((c) => {
                        const s = c.numStats!;
                        return (
                          <tr key={c.name} className="hover:bg-muted/20">
                            <td className="p-2.5 font-sans font-bold text-foreground">{c.name}</td>
                            <td className="p-2.5">{s.mean}</td>
                            <td className="p-2.5">{s.median}</td>
                            <td className="p-2.5">{s.mode ?? "-"}</td>
                            <td className="p-2.5">{s.stdDev}</td>
                            <td className="p-2.5">{s.variance}</td>
                            <td className="p-2.5">{s.min}</td>
                            <td className="p-2.5">{s.q1}</td>
                            <td className="p-2.5">{s.q3}</td>
                            <td className="p-2.5">{s.max}</td>
                            <td className="p-2.5">{s.iqr}</td>
                            <td className={cn("p-2.5 font-bold", Math.abs(s.skewness) >= 1 ? "text-amber-700" : "")}>
                              {s.skewness}
                            </td>
                            <td className="p-2.5">{s.kurtosis}</td>
                            <td className="p-2.5">
                              <span className={s.iqrOutlierCount > 0 ? "text-rose-600 font-bold" : "text-emerald-700"}>
                                {s.iqrOutlierCount} / {s.zScoreOutlierCount}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Categorical Frequencies + Strongest Correlations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Categorical Frequencies */}
            <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-foreground">Categorical Distribution Breakdown</h3>
              {profile.columns.filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats).length === 0 ? (
                <p className="text-xs text-muted-foreground">No categorical columns in this dataset.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {profile.columns
                    .filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats)
                    .map((c) => (
                      <div key={c.name} className="rounded-2xl border bg-muted/15 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">{c.name}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">{c.uniqueCount} unique labels</span>
                        </div>
                        <div className="space-y-1.5">
                          {c.catStats!.frequencies.slice(0, 6).map((f) => (
                            <div key={f.value} className="space-y-0.5">
                              <div className="flex justify-between text-xs">
                                <span className="font-semibold truncate max-w-48">{f.value}</span>
                                <span className="font-mono text-muted-foreground">
                                  {f.count} ({f.pct}%)
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-violet-600 rounded-full" style={{ width: `${Math.min(100, f.pct)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Pearson & Spearman Correlations + Grouped Aggregations */}
            <div className="space-y-6">
              <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-3">
                <h3 className="font-extrabold text-base text-foreground">Top Correlation Pairs (Pearson &amp; Spearman)</h3>
                {profile.correlations.strongestPairs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Requires at least 2 numerical columns.</p>
                ) : (
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="p-2 font-bold">Feature Pair</th>
                          <th className="p-2 font-bold">Pearson r</th>
                          <th className="p-2 font-bold">Spearman rho</th>
                          <th className="p-2 font-bold">Pairs (n)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 font-mono">
                        {profile.correlations.strongestPairs.slice(0, 10).map((p) => (
                          <tr key={`${p.colA}_${p.colB}`}>
                            <td className="p-2 font-sans font-semibold">
                              {p.colA} ↔ {p.colB}
                            </td>
                            <td
                              className={cn(
                                "p-2 font-bold",
                                Math.abs(p.pearson) >= 0.7 ? "text-emerald-700" : Math.abs(p.pearson) >= 0.4 ? "text-sky-700" : ""
                              )}
                            >
                              {p.pearson}
                            </td>
                            <td className="p-2">{p.spearman}</td>
                            <td className="p-2 text-muted-foreground">{p.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Grouped Statistics */}
              <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold text-base text-foreground">Grouped Statistics Explorer</h3>
                  {profile.categoricalColumns.length + profile.booleanColumns.length > 0 && numColNames.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={groupByCol}
                        onChange={(e) => setGroupByCol(e.target.value)}
                        className="rounded-lg border bg-background px-2 py-1 text-xs font-semibold"
                      >
                        {[...profile.categoricalColumns, ...profile.booleanColumns].map((c) => (
                          <option key={c} value={c}>
                            Group: {c}
                          </option>
                        ))}
                      </select>
                      <select
                        value={groupMeasureCol}
                        onChange={(e) => setGroupMeasureCol(e.target.value)}
                        className="rounded-lg border bg-background px-2 py-1 text-xs font-semibold"
                      >
                        {numColNames.map((c) => (
                          <option key={c} value={c}>
                            Metric: {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {!groupedStatsResult || groupedStatsResult.groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Grouped statistics require at least 1 categorical/boolean column and 1 numerical column.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="p-2 font-bold">{groupByCol}</th>
                          <th className="p-2 font-bold">Count</th>
                          <th className="p-2 font-bold">Mean</th>
                          <th className="p-2 font-bold">Median</th>
                          <th className="p-2 font-bold">StdDev</th>
                          <th className="p-2 font-bold">Min / Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 font-mono">
                        {groupedStatsResult.groups.map((g) => (
                          <tr key={g.group}>
                            <td className="p-2 font-sans font-bold">{g.group}</td>
                            <td className="p-2">{g.count}</td>
                            <td className="p-2 font-bold text-emerald-700">{g.mean}</td>
                            <td className="p-2">{g.median}</td>
                            <td className="p-2">{g.stdDev}</td>
                            <td className="p-2">
                              {g.min} / {g.max}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: DATA CLEANING & TRANSFORMATION HISTORY                       */}
      {/* =================================================================== */}
      {activeTab === "cleaning" && (
        <EDACleanerPanel
          profile={profile}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          isModified={isModified}
          historyLog={historyLog}
          onApply={handleApplyTransform}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleResetOriginal}
        />
      )}

      {/* =================================================================== */}
      {/* TAB 5: ANIMATED CLEANING PIPELINE SIMULATOR                         */}
      {/* =================================================================== */}
      {activeTab === "simulator" && (
        <div className="space-y-4">
          {numColNames.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs font-bold text-muted-foreground">Animate Variable:</span>
              <select
                value={simColName || numColNames[0]}
                onChange={(e) => setSimColName(e.target.value)}
                className="rounded-xl border bg-background px-3 py-1.5 text-xs font-semibold"
              >
                {numColNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <EDAPipelineSimulator
            columnName={simColName || numColNames[0] || "Feature"}
            datasetName={profile.name}
            rawNumbers={simulatorRawNumbers}
          />
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: METHODOLOGY DECISION MATRIX & PYTHON CODE GENERATOR          */}
      {/* =================================================================== */}
      {activeTab === "guide" && (
        <div className="space-y-6">
          <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs space-y-4">
            <div>
              <h3 className="font-extrabold text-lg text-foreground">
                Data Type Decision Matrix: Which EDA Operations Apply Where?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Matching statistical tools accurately to semantic column types prevents meaningless averages or distorted visual models.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 font-bold">Data Type</th>
                    <th className="p-3 font-bold">Recommended Plots &amp; Tests</th>
                    <th className="p-3 font-bold">Cleaning / Scaling</th>
                    <th className="p-3 font-bold text-rose-700">Avoid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="p-3 font-bold">Continuous Numerical</td>
                    <td className="p-3 text-emerald-700">Histogram, KDE, Box Plot, Q-Q Plot, 2D/3D Scatter, Pearson/Spearman</td>
                    <td className="p-3">Median/Mean impute, IQR Winsorize, Log(1+x), Standard / Min-Max Scale</td>
                    <td className="p-3 text-rose-700">Pie/Donut charts or high-cardinality One-Hot Encoding</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Nominal Categorical</td>
                    <td className="p-3 text-emerald-700">Bar Chart, Pie/Donut, Treemap/Sunburst, Frequency %, Mode</td>
                    <td className="p-3">Mode impute, Rare-class grouping, One-Hot / Target Encoding</td>
                    <td className="p-3 text-rose-700">Mean, Standard Deviation, Z-Score outliers, Pearson r</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Boolean Binary</td>
                    <td className="p-3 text-emerald-700">Class Balance Bar, Donut Share, Grouped Box/Violin stratification</td>
                    <td className="p-3">Mode impute, binary 0/1 mapping</td>
                    <td className="p-3 text-rose-700">KDE smoothing or Z-Score standardization</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold">Datetime / Temporal</td>
                    <td className="p-3 text-emerald-700">Time-indexed Line Chart, 3D trajectory, missing gap checks</td>
                    <td className="p-3">Forward/Backward fill, Calendar feature extraction</td>
                    <td className="p-3 text-rose-700">Arithmetic mean or random row shuffling prior to lag splits</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-foreground">Reproducible Python Pandas + Plotly Script</h3>
                <p className="text-xs text-muted-foreground">Customized to your active dataset schema &amp; selected axes</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(pythonScript);
                  setCopiedCode(true);
                  toast.success("Copied Python script!");
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="gap-2 rounded-xl text-xs font-bold"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? "Copied!" : "Copy Python Code"}
              </Button>
            </div>
            <pre className="p-4 rounded-2xl bg-muted/30 border font-mono text-xs overflow-x-auto leading-relaxed max-h-96">
              {pythonScript}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
