"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Loader2,
  Redo2,
  Sliders,
  Table,
  TrendingUp,
  Undo2,
  Upload,
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

type EDATab = "overview" | "studio" | "stats" | "cleaning" | "guide";

interface WorkingSnapshot {
  headers: string[];
  rows: DataRow[];
  description: string;
}

const INSPECTOR_SELECT =
  "w-full h-9 rounded-xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 px-2.5 text-xs font-medium text-zinc-800 transition-colors";

export function EDATool() {
  const sampleDatasets = useMemo(() => getTabularSampleDatasets(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureChartRef = useRef<(() => Promise<string | null>) | null>(null);

  const [activeTab, setActiveTab] = useState<EDATab>("overview");
  const [cleaningView, setCleaningView] = useState<"tools" | "preview">("tools");
  const [chartDimMode, setChartDimMode] = useState<"2d" | "3d">("2d");
  const [showLabelsEditor, setShowLabelsEditor] = useState(false);

  // Dataset State
  const [originalDataset, setOriginalDataset] = useState<ParsedDataset>(sampleDatasets[0]);
  const [workingHeaders, setWorkingHeaders] = useState<string[]>(sampleDatasets[0].headers);
  const [workingRows, setWorkingRows] = useState<DataRow[]>(sampleDatasets[0].rows);
  const [undoStack, setUndoStack] = useState<WorkingSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<WorkingSnapshot[]>([]);
  const [historyLog, setHistoryLog] = useState<{ timestamp: string; action: string }[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [backendDatasetId, setBackendDatasetId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const profile: DatasetProfile = useMemo(
    () => profileDataset(originalDataset.name, workingHeaders, workingRows),
    [originalDataset.name, workingHeaders, workingRows]
  );

  const insights: DataInsight[] = useMemo(() => generateAutomatedInsights(profile), [profile]);

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

  const [groupByCol, setGroupByCol] = useState<string>("");
  const [groupMeasureCol, setGroupMeasureCol] = useState<string>("");
  const [simColName, setSimColName] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync default axes cleanly when schema changes
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

    const defaultChart: PlotlyChartType = profile.chartEligibility.has3DVector
      ? "cone"
      : profile.chartEligibility.has3DScatter
      ? "scatter3d"
      : nums.length >= 2
      ? "scatter"
      : nums.length >= 1
      ? "histogram"
      : "bar";

    setChartConfig((prev) => {
      const nextType = all.includes(prev.xCol) && isChartTypeEligible(prev.chartType, profile).eligible ? prev.chartType : defaultChart;
      setChartDimMode(PLOTLY_3D_CHARTS.some((c) => c.id === nextType) ? "3d" : "2d");
      return {
        ...prev,
        chartType: nextType,
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
      };
    });

    setGroupByCol((prev) => (cats.includes(prev) ? prev : cats[0] || ""));
    setGroupMeasureCol((prev) => (nums.includes(prev) ? prev : numPool[0] || ""));
    setSimColName((prev) => (nums.includes(prev) ? prev : numPool[0] || ""));
  }, [profile]);

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

  const handleCsvUpload = async (file: File) => {
    setUploadError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["csv", "tsv", "txt"].includes(ext) && file.type && !file.type.includes("csv") && !file.type.includes("text")) {
      const msg = "Please upload a valid CSV file (.csv, .tsv).";
      setUploadError(msg);
      toast.error(msg);
      return;
    }
    if (file.size === 0) {
      const msg = "The uploaded file is empty.";
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
        toast.success(`Loaded "${loadedDs.name}" (${loadedDs.rows.length.toLocaleString()} rows)`);
      } catch (apiErr: any) {
        if (apiErr?.message && !/fetch|network|failed to fetch|404/i.test(apiErr.message)) {
          throw apiErr;
        }
        if (!uploadedViaApi) {
          const text = await file.text();
          const parsed = parseCsvText(text, file.name);
          loadDatasetIntoWorkspace(parsed, parsed.warnings, null, null);
          setActiveTab("overview");
          toast.success(`Loaded "${parsed.name}" (${parsed.rows.length.toLocaleString()} rows)`);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to read CSV file.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

      if (backendSessionId && backendDatasetId) {
        fetch(getApiEndpoint("/api/eda/transform"), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-eda-session": backendSessionId },
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
    toast.success("Restored original dataset.");

    if (backendSessionId && backendDatasetId && !backendSessionId.startsWith("local_")) {
      fetch(getApiEndpoint("/api/eda/transform"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-eda-session": backendSessionId },
        body: JSON.stringify({ datasetId: backendDatasetId, mode: "reset" }),
      }).catch(() => {});
    }
  };

  const handleExportCsv = () => {
    try {
      triggerCsvDownload(workingHeaders, workingRows, profile.name);
      toast.success(`Exported ${workingRows.length.toLocaleString()} rows to CSV`);
    } catch (err: any) {
      toast.error(err?.message || "CSV export failed.");
    }
  };

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
      toast.success("PDF Analysis Report downloaded.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate PDF report.");
    } finally {
      setExportingPdf(false);
    }
  };

  // Curated suggested charts tailored to the active dataset (clean names, no clutter tags)
  const recommendedCharts = useMemo(() => {
    const recs: { label: string; type: PlotlyChartType }[] = [];
    if (profile.chartEligibility.has3DVector) {
      recs.push({ label: "3D Vector Cones", type: "cone" });
      recs.push({ label: "3D Streamtubes", type: "streamtube" });
    }
    if (profile.chartEligibility.has3DVolume) {
      recs.push({ label: "3D Volume", type: "volume" });
      recs.push({ label: "3D Isosurface", type: "isosurface" });
    }
    if (profile.chartEligibility.has3DScatter) {
      recs.push({ label: "3D Scatter", type: "scatter3d" });
      recs.push({ label: "3D Surface", type: "surface" });
    }
    if (profile.numericalColumns.length >= 2) {
      recs.push({ label: "Correlation Matrix", type: "correlation_heatmap" });
      recs.push({ label: "Scatter & Trend", type: "scatter" });
      recs.push({ label: "Pair Plot", type: "pairplot" });
    }
    if (profile.numericalColumns.length >= 1) {
      recs.push({ label: "Box Plot", type: "box" });
      recs.push({ label: "Density Curve", type: "kde" });
      recs.push({ label: "Histogram", type: "histogram" });
    }
    if (profile.chartEligibility.hasCategorical) {
      recs.push({ label: "Bar Chart", type: "bar" });
      recs.push({ label: "Donut Chart", type: "donut" });
    }
    if (profile.totalMissingCells > 0) {
      recs.push({ label: "Missing Values", type: "missing" });
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

  const is3DChart = PLOTLY_3D_CHARTS.some((c) => c.id === chartConfig.chartType);
  const needsYAxis = !["histogram", "box", "violin", "kde", "qq", "pie", "donut", "missing", "correlation_heatmap", "pairplot", "parcoords"].includes(chartConfig.chartType);
  const needsZAxis = is3DChart || chartConfig.chartType === "heatmap";
  const needsSizeAxis = ["bubble3d", "bubble", "volume", "isosurface"].includes(chartConfig.chartType);
  const needsVectorAxes = ["cone", "streamtube"].includes(chartConfig.chartType);
  const needsMultiCols = ["pairplot", "parcoords"].includes(chartConfig.chartType);
  const needsColorSelector = !["correlation_heatmap", "pairplot", "missing", "parcoords"].includes(chartConfig.chartType);
  const needsAggregation = ["bar", "line", "heatmap", "surface", "treemap", "sunburst"].includes(chartConfig.chartType);

  const pythonScript = useMemo(() => {
    const numCol = numColNames[0] || allColNames[0] || "value";
    const yCol = numColNames[1] || numCol;
    return `import pandas as pd
import plotly.express as px

# Load Dataset
df = pd.read_csv("${profile.name}.csv")
print(df.info())
print(df.describe())

# Distribution & Outlier Check
fig_box = px.box(df, y="${numCol}", title="${numCol} Distribution")
fig_box.show()
${
  profile.chartEligibility.has3DScatter
    ? `
# 3D Spatial Exploration
fig_3d = px.scatter_3d(
    df, x="${chartConfig.xCol}", y="${chartConfig.yCol}", z="${chartConfig.zCol}",
    ${chartConfig.colorCol && chartConfig.colorCol !== "__NONE__" ? `color="${chartConfig.colorCol}", ` : ""}title="3D Feature Space"
)
fig_3d.show()`
    : `
# Bivariate Relationship
fig_scatter = px.scatter(df, x="${numCol}", y="${yCol}", trendline="ols", title="${yCol} vs ${numCol}")
fig_scatter.show()`
}`;
  }, [profile.name, profile.chartEligibility.has3DScatter, numColNames, allColNames, chartConfig]);

  const selectChart = (type: PlotlyChartType) => {
    setChartConfig((prev) => ({ ...prev, chartType: type }));
    setChartDimMode(PLOTLY_3D_CHARTS.some((c) => c.id === type) ? "3d" : "2d");
  };

  return (
    <div
      className="space-y-6 max-w-7xl mx-auto pb-12"
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
    >
      {/* Hidden CSV Input */}
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

      {/* =================================================================== */}
      {/* NOTION / APPLE DOCUMENT HEADER & TOOLBAR                            */}
      {/* =================================================================== */}
      <div
        className={cn(
          "rounded-2xl border bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.025),0_6px_20px_rgba(0,0,0,0.02)] space-y-5 transition-all",
          dragActive ? "border-[#0071e3] ring-4 ring-[#0071e3]/10 bg-sky-50/20" : "border-zinc-200/80"
        )}
      >
        {/* Top Document Title + Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                {profile.name}
              </h1>
              <span className="rounded-full bg-zinc-100 border border-zinc-200/80 px-2.5 py-0.5 text-xs font-medium text-zinc-600 tabular-nums">
                {profile.rowCount.toLocaleString()} rows × {profile.columnCount} cols
              </span>
              {isModified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Edited
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-zinc-500">
              {profile.domainExplanation}
            </p>
          </div>

          {/* Apple Toolbar Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl text-xs font-medium gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100 h-9 px-3.5"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload CSV
            </Button>

            <div className="h-5 w-px bg-zinc-200 mx-0.5 hidden sm:block" />

            <Button
              size="icon"
              variant="outline"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="rounded-xl border-zinc-200 h-9 w-9 text-zinc-600 hover:bg-zinc-100"
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="rounded-xl border-zinc-200 h-9 w-9 text-zinc-600 hover:bg-zinc-100"
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="rounded-xl text-xs font-medium gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100 h-9 px-3"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="rounded-xl text-xs font-medium gap-1.5 bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-2xs h-9 px-3.5"
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {exportingPdf ? "Exporting..." : "PDF Report"}
            </Button>
          </div>
        </div>

        {/* Sample Datasets Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-zinc-100">
          <span className="text-xs font-medium text-zinc-400 mr-1 flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Sample Datasets:
          </span>
          {sampleDatasets.map((ds) => (
            <button
              key={ds.id}
              type="button"
              onClick={() => handleSelectSample(ds.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                originalDataset.id === ds.id
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                  : "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              {ds.id === "fluid-field-3d" ? "Vector Field" : ds.name.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Error / Warnings */}
        {uploadError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{uploadError}</span>
          </div>
        )}
        {parseWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 space-y-1">
            {parseWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Segmented Navigation Tabs */}
        <div className="pt-1">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-zinc-100/90 border border-zinc-200/60">
            {[
              { id: "overview" as const, label: "Overview", icon: Database },
              { id: "studio" as const, label: "Visualize", icon: Box },
              { id: "stats" as const, label: "Statistics", icon: Table },
              { id: "cleaning" as const, label: `Clean Data${isModified ? ` (${historyLog.length})` : ""}`, icon: Filter },
              { id: "guide" as const, label: "Guide & Python", icon: HelpCircle },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "px-3.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5",
                    isActive ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW                                                     */}
      {/* =================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* 4-Column Metric Strip */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-zinc-200/70 overflow-hidden">
            {[
              {
                label: "Rows",
                val: profile.rowCount.toLocaleString(),
                dot: "bg-zinc-400",
                sub: `${profile.columnCount} columns total`,
              },
              {
                label: "Column Types",
                val: `${profile.numericalColumns.length} numeric`,
                dot: "bg-[#0071e3]",
                sub: `${profile.categoricalColumns.length + profile.booleanColumns.length} categorical`,
              },
              {
                label: "Missing Values",
                val: `${profile.totalMissingPct}%`,
                dot: profile.totalMissingCells > 0 ? "bg-amber-500" : "bg-emerald-500",
                sub: `${profile.totalMissingCells.toLocaleString()} empty cells`,
              },
              {
                label: "Duplicate Rows",
                val: profile.duplicateRowCount.toLocaleString(),
                dot: profile.duplicateRowCount > 0 ? "bg-amber-500" : "bg-emerald-500",
                sub: `${profile.duplicateRowPct}% of rows`,
              },
            ].map((m) => (
              <div key={m.label} className="p-4 sm:p-5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                  <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                  <span>{m.label}</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 tabular-nums">{m.val}</div>
                <div className="text-[11px] text-zinc-400 tabular-nums">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* 2-Column Workspace Split: Schema + Automated Findings */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Column Schema */}
            <div className="lg:col-span-7 rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-200/70 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-zinc-900">Column Schema</h3>
                <span className="text-xs text-zinc-400 tabular-nums">{profile.columnCount} columns</span>
              </div>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-200/70 text-zinc-500 font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Column</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Valid</th>
                      <th className="py-2.5 px-3">Missing</th>
                      <th className="py-2.5 px-3">Unique</th>
                      <th className="py-2.5 px-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {profile.columns.map((c) => (
                      <tr key={c.name} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-zinc-900 whitespace-nowrap">{c.name}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded-md bg-zinc-100 border border-zinc-200/60 px-2 py-0.5 text-[11px] font-medium text-zinc-700 capitalize">
                            {c.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-zinc-700">{c.count.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                          <span className={c.missingCount > 0 ? "text-amber-700 font-medium" : "text-zinc-500"}>
                            {c.missingCount} ({c.missingPct}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-zinc-600">{c.uniqueCount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {c.isConstant ? (
                            <span className="text-[11px] font-medium text-rose-600">Constant</span>
                          ) : c.isPotentialId ? (
                            <span className="text-[11px] font-medium text-zinc-500">ID</span>
                          ) : (
                            <span className="text-[11px] text-zinc-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Automated Findings Feed */}
            <div className="lg:col-span-5 rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-200/70 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-zinc-500" /> Statistical Insights
                </h3>
                <span className="text-xs text-zinc-400 tabular-nums">{insights.length} findings</span>
              </div>

              <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-100">
                {insights.map((ins) => (
                  <div key={ins.id} className="p-4 space-y-1.5 hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0 mt-1.5",
                          ins.severity === "critical"
                            ? "bg-rose-500"
                            : ins.severity === "warning"
                            ? "bg-amber-500"
                            : ins.severity === "positive"
                            ? "bg-emerald-500"
                            : "bg-[#0071e3]"
                        )}
                      />
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-semibold text-xs text-zinc-900 leading-snug">{ins.title}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">{ins.explanation}</p>
                        <div className="inline-block rounded bg-zinc-50 border border-zinc-200/60 px-2 py-0.5 text-[11px] font-mono text-zinc-600">
                          {ins.evidence}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200/70 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-zinc-900">Data Preview</h3>
              <span className="text-xs text-zinc-400 tabular-nums">
                First {Math.min(20, workingRows.length)} of {workingRows.length.toLocaleString()} rows
              </span>
            </div>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur z-10 border-b border-zinc-200/70">
                  <tr className="text-zinc-500 font-medium">
                    <th className="py-2 px-3 font-mono text-[10px]">#</th>
                    {workingHeaders.map((h) => (
                      <th key={h} className="py-2 px-3 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {workingRows.slice(0, 20).map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2 px-3 font-mono text-[10px] text-zinc-400 tabular-nums">{rIdx + 1}</td>
                      {workingHeaders.map((h) => (
                        <td key={h} className="py-2 px-3 font-mono whitespace-nowrap text-zinc-700">
                          {r[h] === null || r[h] === undefined ? (
                            <span className="text-zinc-300">—</span>
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
      {/* TAB 2: CHARTS (APPLE NUMBERS / KEYNOTE INSPECTOR LAYOUT)            */}
      {/* =================================================================== */}
      {activeTab === "studio" && (
        <div className="space-y-4">
          {/* Top Suggested Charts Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white px-5 py-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-zinc-400 mr-1">Suggested:</span>
              {recommendedCharts.slice(0, 7).map((rec) => (
                <button
                  key={rec.type}
                  type="button"
                  onClick={() => selectChart(rec.type)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                    chartConfig.chartType === rec.type
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                      : "bg-zinc-50 border-zinc-200/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  {rec.label}
                </button>
              ))}
            </div>

            {/* 2D vs 3D Segmented Switch */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-zinc-100 border border-zinc-200/60 text-xs font-medium shrink-0">
              <button
                type="button"
                onClick={() => {
                  setChartDimMode("2d");
                  if (is3DChart) selectChart(recommendedCharts.find((r) => !PLOTLY_3D_CHARTS.some((d) => d.id === r.type))?.type || "histogram");
                }}
                className={cn(
                  "px-3 py-1 rounded-full transition-all",
                  chartDimMode === "2d" ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                2D Charts
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartDimMode("3d");
                  if (!is3DChart) {
                    const eligible3d = PLOTLY_3D_CHARTS.find((c) => isChartTypeEligible(c.id, profile).eligible);
                    if (eligible3d) selectChart(eligible3d.id);
                  }
                }}
                className={cn(
                  "px-3 py-1 rounded-full transition-all",
                  chartDimMode === "3d" ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                3D WebGL
              </button>
            </div>
          </div>

          {/* Main Chart Stage (8 Cols) + Clean Inspector (4 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
              <PlotlyEDAChart
                rows={workingRows}
                profile={profile}
                config={chartConfig}
                height={540}
                onImageCaptureReady={(fn) => {
                  captureChartRef.current = fn;
                }}
              />
            </div>

            {/* Apple-Style Chart Inspector Sidebar */}
            <div className="lg:col-span-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-zinc-500" /> Chart Inspector
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
                  className="text-xs text-zinc-400 hover:text-zinc-800 font-medium transition-colors"
                >
                  Reset Labels
                </button>
              </div>

              {/* Section 1: Chart Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-500 block">
                  {chartDimMode === "3d" ? "3D Visualization Type" : "2D Chart Type"}
                </label>
                <select
                  value={chartConfig.chartType}
                  onChange={(e) => selectChart(e.target.value as PlotlyChartType)}
                  className={INSPECTOR_SELECT}
                >
                  {chartDimMode === "3d"
                    ? PLOTLY_3D_CHARTS.map((c) => {
                        const check = isChartTypeEligible(c.id, profile);
                        return (
                          <option key={c.id} value={c.id} disabled={!check.eligible}>
                            {c.label} {!check.eligible ? `(${c.requirement})` : ""}
                          </option>
                        );
                      })
                    : PLOTLY_2D_CHARTS.map((c) => {
                        const check = isChartTypeEligible(c.id, profile);
                        return (
                          <option key={c.id} value={c.id} disabled={!check.eligible}>
                            {c.group}: {c.label} {!check.eligible ? "(Unavailable)" : ""}
                          </option>
                        );
                      })}
                </select>
              </div>

              {/* Section 2: Data Mapping (Context-Aware) */}
              {chartConfig.chartType !== "correlation_heatmap" && chartConfig.chartType !== "missing" && (
                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    Data Mapping
                  </span>

                  {!needsMultiCols && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1">
                          {needsYAxis ? "X Axis" : "Feature"}
                        </label>
                        <select
                          value={chartConfig.xCol}
                          onChange={(e) => setChartConfig((p) => ({ ...p, xCol: e.target.value }))}
                          className={INSPECTOR_SELECT}
                        >
                          {allColNames.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      {needsYAxis && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 block mb-1">Y Axis</label>
                          <select
                            value={chartConfig.yCol}
                            onChange={(e) => setChartConfig((p) => ({ ...p, yCol: e.target.value }))}
                            className={INSPECTOR_SELECT}
                          >
                            {allColNames.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {needsZAxis && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 block mb-1">Z Axis</label>
                          <select
                            value={chartConfig.zCol}
                            onChange={(e) => setChartConfig((p) => ({ ...p, zCol: e.target.value }))}
                            className={INSPECTOR_SELECT}
                          >
                            {numColNames.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {needsSizeAxis && (
                        <div>
                          <label className="text-xs font-medium text-zinc-500 block mb-1">
                            {["volume", "isosurface"].includes(chartConfig.chartType) ? "Intensity Field" : "Size Metric"}
                          </label>
                          <select
                            value={chartConfig.sizeCol}
                            onChange={(e) => setChartConfig((p) => ({ ...p, sizeCol: e.target.value }))}
                            className={INSPECTOR_SELECT}
                          >
                            {numColNames.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {needsVectorAxes && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: "uCol" as const, label: "U" },
                            { key: "vCol" as const, label: "V" },
                            { key: "wCol" as const, label: "W" },
                          ].map((vec) => (
                            <div key={vec.key}>
                              <label className="text-[11px] font-medium text-zinc-500 block mb-1">{vec.label}</label>
                              <select
                                value={chartConfig[vec.key]}
                                onChange={(e) => setChartConfig((p) => ({ ...p, [vec.key]: e.target.value }))}
                                className={INSPECTOR_SELECT}
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
                    </div>
                  )}

                  {needsMultiCols && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-500 block">
                        Included Columns ({chartConfig.multiCols.length})
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
                                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                checked
                                  ? "bg-zinc-900 text-white border-zinc-900"
                                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                              )}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {needsColorSelector && (
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Group / Color By</label>
                      <select
                        value={chartConfig.colorCol}
                        onChange={(e) => setChartConfig((p) => ({ ...p, colorCol: e.target.value }))}
                        className={INSPECTOR_SELECT}
                      >
                        <option value="__NONE__">Single color</option>
                        {allColNames.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {needsAggregation && (
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Aggregation</label>
                      <select
                        value={chartConfig.aggMethod}
                        onChange={(e) => setChartConfig((p) => ({ ...p, aggMethod: e.target.value as any }))}
                        className={INSPECTOR_SELECT}
                      >
                        <option value="mean">Average (Mean)</option>
                        <option value="median">Median</option>
                        <option value="sum">Sum</option>
                        <option value="count">Count</option>
                        <option value="min">Minimum</option>
                        <option value="max">Maximum</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Style & Parameters */}
              <div className="space-y-3 pt-3 border-t border-zinc-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                  Appearance
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Palette</label>
                    <select
                      value={chartConfig.colorScale}
                      onChange={(e) => setChartConfig((p) => ({ ...p, colorScale: e.target.value }))}
                      className={INSPECTOR_SELECT}
                    >
                      {["Viridis", "Plasma", "Inferno", "Turbo", "Portland", "RdBu", "Cividis"].map((cs) => (
                        <option key={cs} value={cs}>
                          {cs}
                        </option>
                      ))}
                    </select>
                  </div>

                  {chartConfig.chartType === "correlation_heatmap" && (
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Method</label>
                      <select
                        value={chartConfig.corrMethod}
                        onChange={(e) => setChartConfig((p) => ({ ...p, corrMethod: e.target.value as any }))}
                        className={INSPECTOR_SELECT}
                      >
                        <option value="pearson">Pearson r</option>
                        <option value="spearman">Spearman rho</option>
                      </select>
                    </div>
                  )}
                </div>

                {chartConfig.chartType === "histogram" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-zinc-600">
                      <span>Bins</span>
                      <span className="font-mono tabular-nums">{chartConfig.bins}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={chartConfig.bins}
                      onChange={(e) => setChartConfig((p) => ({ ...p, bins: Number(e.target.value) }))}
                      className="w-full accent-zinc-900"
                    />
                  </div>
                )}

                {chartConfig.chartType === "kde" && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-zinc-600">
                      <span>Smoothing</span>
                      <span className="font-mono tabular-nums">{chartConfig.kdeBandwidth.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.1"
                      value={chartConfig.kdeBandwidth}
                      onChange={(e) => setChartConfig((p) => ({ ...p, kdeBandwidth: parseFloat(e.target.value) }))}
                      className="w-full accent-zinc-900"
                    />
                  </div>
                )}

                {["scatter", "scatter3d", "bubble", "bubble3d", "line", "line3d", "pairplot"].includes(chartConfig.chartType) && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-zinc-600">
                      <span>Point Size</span>
                      <span className="font-mono tabular-nums">{chartConfig.markerSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="14"
                      step="1"
                      value={chartConfig.markerSize}
                      onChange={(e) => setChartConfig((p) => ({ ...p, markerSize: Number(e.target.value) }))}
                      className="w-full accent-zinc-900"
                    />
                  </div>
                )}
              </div>

              {/* Section 4: Custom Labels Collapsible */}
              <div className="pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowLabelsEditor(!showLabelsEditor)}
                  className="flex items-center justify-between w-full text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  <span>Customize Titles &amp; Labels</span>
                  {showLabelsEditor ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {showLabelsEditor && (
                  <div className="space-y-2 mt-3">
                    <Input
                      value={chartConfig.customTitle}
                      onChange={(e) => setChartConfig((p) => ({ ...p, customTitle: e.target.value }))}
                      placeholder="Chart Title..."
                      className="h-8 text-xs rounded-lg border-zinc-200 bg-zinc-50/70"
                    />
                    <div className="grid grid-cols-3 gap-1.5">
                      <Input
                        value={chartConfig.customXLabel}
                        onChange={(e) => setChartConfig((p) => ({ ...p, customXLabel: e.target.value }))}
                        placeholder="X Label"
                        className="h-8 text-[11px] rounded-lg border-zinc-200 bg-zinc-50/70"
                      />
                      <Input
                        value={chartConfig.customYLabel}
                        onChange={(e) => setChartConfig((p) => ({ ...p, customYLabel: e.target.value }))}
                        placeholder="Y Label"
                        className="h-8 text-[11px] rounded-lg border-zinc-200 bg-zinc-50/70"
                      />
                      <Input
                        value={chartConfig.customZLabel}
                        onChange={(e) => setChartConfig((p) => ({ ...p, customZLabel: e.target.value }))}
                        placeholder="Z Label"
                        className="h-8 text-[11px] rounded-lg border-zinc-200 bg-zinc-50/70"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: STATISTICS & CORRELATIONS                                    */}
      {/* =================================================================== */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Numerical Summary Table */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200/70">
              <h3 className="font-semibold text-sm text-zinc-900">Descriptive Statistics</h3>
            </div>
            {numColNames.length === 0 ? (
              <p className="p-6 text-xs text-zinc-400">No numeric columns present in this dataset.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200/70 bg-zinc-50/70 text-zinc-500 font-medium">
                      <th className="py-2.5 px-3">Column</th>
                      <th className="py-2.5 px-3">Mean</th>
                      <th className="py-2.5 px-3">Median</th>
                      <th className="py-2.5 px-3">Std Dev</th>
                      <th className="py-2.5 px-3">Min</th>
                      <th className="py-2.5 px-3">Q1</th>
                      <th className="py-2.5 px-3">Q3</th>
                      <th className="py-2.5 px-3">Max</th>
                      <th className="py-2.5 px-3">IQR</th>
                      <th className="py-2.5 px-3">Skew</th>
                      <th className="py-2.5 px-3">Outliers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono tabular-nums">
                    {profile.columns
                      .filter((c) => c.type === "numerical" && c.numStats)
                      .map((c) => {
                        const s = c.numStats!;
                        return (
                          <tr key={c.name} className="hover:bg-zinc-50/70">
                            <td className="py-2.5 px-3 font-sans font-semibold text-zinc-900">{c.name}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.mean}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.median}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.stdDev}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.min}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.q1}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.q3}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.max}</td>
                            <td className="py-2.5 px-3 text-zinc-700">{s.iqr}</td>
                            <td className={cn("py-2.5 px-3", Math.abs(s.skewness) >= 1 ? "text-amber-700 font-semibold" : "text-zinc-600")}>
                              {s.skewness}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={s.iqrOutlierCount > 0 ? "text-rose-600 font-semibold" : "text-zinc-500"}>
                                {s.iqrOutlierCount}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Categorical Frequencies */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs space-y-4">
              <h3 className="font-semibold text-sm text-zinc-900">Categorical Breakdown</h3>
              {profile.columns.filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats).length === 0 ? (
                <p className="text-xs text-zinc-400">No categorical columns in this dataset.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {profile.columns
                    .filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats)
                    .map((c) => (
                      <div key={c.name} className="rounded-xl border border-zinc-200/70 bg-zinc-50/50 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-zinc-900">{c.name}</span>
                          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{c.uniqueCount} unique</span>
                        </div>
                        <div className="space-y-2">
                          {c.catStats!.frequencies.slice(0, 6).map((f) => (
                            <div key={f.value} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="font-medium text-zinc-700 truncate max-w-48">{f.value}</span>
                                <span className="font-mono text-zinc-500 tabular-nums">
                                  {f.count} ({f.pct}%)
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-zinc-200/70 rounded-full overflow-hidden">
                                <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${Math.min(100, f.pct)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Correlations & Grouped Stats */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200/70">
                  <h3 className="font-semibold text-sm text-zinc-900">Top Feature Correlations</h3>
                </div>
                {profile.correlations.strongestPairs.length === 0 ? (
                  <p className="p-6 text-xs text-zinc-400">Requires at least 2 numerical columns.</p>
                ) : (
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200/70 bg-zinc-50/70 text-zinc-500 font-medium">
                          <th className="py-2 px-4">Pair</th>
                          <th className="py-2 px-4">Pearson r</th>
                          <th className="py-2 px-4">Spearman rho</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-mono tabular-nums">
                        {profile.correlations.strongestPairs.slice(0, 10).map((p) => (
                          <tr key={`${p.colA}_${p.colB}`} className="hover:bg-zinc-50/70">
                            <td className="py-2 px-4 font-sans font-medium text-zinc-900">
                              {p.colA} &amp; {p.colB}
                            </td>
                            <td
                              className={cn(
                                "py-2 px-4 font-semibold",
                                Math.abs(p.pearson) >= 0.7 ? "text-[#0071e3]" : "text-zinc-700"
                              )}
                            >
                              {p.pearson}
                            </td>
                            <td className="py-2 px-4 text-zinc-600">{p.spearman}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Grouped Statistics */}
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm text-zinc-900">Grouped Summary</h3>
                  {profile.categoricalColumns.length + profile.booleanColumns.length > 0 && numColNames.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={groupByCol}
                        onChange={(e) => setGroupByCol(e.target.value)}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800"
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
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800"
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
                  <p className="text-xs text-zinc-400">
                    Requires at least 1 categorical column and 1 numerical column.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200/70 bg-zinc-50/70 text-zinc-500 font-medium">
                          <th className="py-2 px-3">{groupByCol}</th>
                          <th className="py-2 px-3">Count</th>
                          <th className="py-2 px-3">Mean</th>
                          <th className="py-2 px-3">Median</th>
                          <th className="py-2 px-3">Min / Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-mono tabular-nums">
                        {groupedStatsResult.groups.map((g) => (
                          <tr key={g.group} className="hover:bg-zinc-50/70">
                            <td className="py-2 px-3 font-sans font-semibold text-zinc-900">{g.group}</td>
                            <td className="py-2 px-3 text-zinc-600">{g.count}</td>
                            <td className="py-2 px-3 font-semibold text-[#0071e3]">{g.mean}</td>
                            <td className="py-2 px-3 text-zinc-700">{g.median}</td>
                            <td className="py-2 px-3 text-zinc-600">
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
      {/* TAB 4: CLEAN DATA & TRANSFORM SIMULATOR                             */}
      {/* =================================================================== */}
      {activeTab === "cleaning" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-zinc-100 border border-zinc-200/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCleaningView("tools")}
                className={cn(
                  "px-3.5 py-1 rounded-full transition-all",
                  cleaningView === "tools" ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Cleaning Tools
              </button>
              <button
                type="button"
                onClick={() => setCleaningView("preview")}
                className={cn(
                  "px-3.5 py-1 rounded-full transition-all",
                  cleaningView === "preview" ? "bg-white text-zinc-900 shadow-2xs font-semibold" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                Transform Simulator
              </button>
            </div>

            {cleaningView === "preview" && numColNames.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Target Column:</span>
                <select
                  value={simColName || numColNames[0]}
                  onChange={(e) => setSimColName(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-2xs"
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

          {cleaningView === "tools" ? (
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
          ) : (
            <EDAPipelineSimulator
              columnName={simColName || numColNames[0] || "Feature"}
              datasetName={profile.name}
              rawNumbers={simulatorRawNumbers}
            />
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: METHODOLOGY & PYTHON EXPORT                                  */}
      {/* =================================================================== */}
      {activeTab === "guide" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200/70">
              <h3 className="font-semibold text-sm text-zinc-900">
                EDA Methodology Reference
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Choosing the right plots and data cleaning operations for each column type.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200/70 bg-zinc-50/70 text-zinc-500 font-medium">
                    <th className="py-3 px-4">Data Type</th>
                    <th className="py-3 px-4">Recommended Visualizations</th>
                    <th className="py-3 px-4">Cleaning &amp; Scaling</th>
                    <th className="py-3 px-4">Avoid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-zinc-900">Numeric</td>
                    <td className="py-3 px-4 text-zinc-700">Histogram, KDE, Box Plot, Q-Q Plot, Scatter, 3D Scatter</td>
                    <td className="py-3 px-4 text-zinc-600">Mean/Median imputation, IQR clamping, Standard/Min-Max scale</td>
                    <td className="py-3 px-4 text-rose-600">Pie charts or high-cardinality One-Hot Encoding</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-zinc-900">Categorical</td>
                    <td className="py-3 px-4 text-zinc-700">Bar Chart, Donut Chart, Treemap, Frequency Counts</td>
                    <td className="py-3 px-4 text-zinc-600">Mode imputation, Rare-category grouping, Encoding</td>
                    <td className="py-3 px-4 text-rose-600">Mean, Standard Deviation, Z-Score normalization</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-zinc-900">Boolean</td>
                    <td className="py-3 px-4 text-zinc-700">Class Balance Bar, Donut Share, Grouped Box Plot</td>
                    <td className="py-3 px-4 text-zinc-600">Mode imputation, Binary 0/1 encoding</td>
                    <td className="py-3 px-4 text-rose-600">Density curves or continuous scaling</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-zinc-900">Date / Time</td>
                    <td className="py-3 px-4 text-zinc-700">Time-series Line Chart, Trend analysis</td>
                    <td className="py-3 px-4 text-zinc-600">Forward/Backward fill, Calendar feature extraction</td>
                    <td className="py-3 px-4 text-rose-600">Arithmetic mean or random row shuffling</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-zinc-900">Python Script Export</h3>
                <p className="text-xs text-zinc-500">Generated Pandas and Plotly script matching your active dataset</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(pythonScript);
                  setCopiedCode(true);
                  toast.success("Copied Python script!");
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="gap-1.5 rounded-xl border-zinc-200 text-xs font-medium h-8"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCode ? "Copied" : "Copy Script"}
              </Button>
            </div>
            <pre className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/70 font-mono text-xs text-zinc-800 overflow-x-auto leading-relaxed max-h-96">
              {pythonScript}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
