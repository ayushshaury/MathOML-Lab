"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Data, Layout, Config } from "plotly.js-dist-min";
import {
  Camera,
  Download,
  Maximize2,
  Minimize2,
  RotateCcw,
  AlertCircle,
  TableProperties,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { computeKDE } from "@/lib/math/eda";
import {
  buildObservedSurfaceGrid,
  computeGroupedStats,
  computePairMetrics,
  computeQQPlotData,
  parseNumericToken,
  roundNum,
  sampleRowsForCharts,
  type DataRow,
  type DatasetProfile,
} from "@/lib/math/eda-engine";

export type PlotlyChartType =
  // 3D Charts
  | "scatter3d"
  | "bubble3d"
  | "line3d"
  | "surface"
  | "mesh3d"
  | "volume"
  | "isosurface"
  | "cone"
  | "streamtube"
  // 2D & Hierarchical Charts
  | "histogram"
  | "box"
  | "violin"
  | "kde"
  | "scatter"
  | "bubble"
  | "bar"
  | "line"
  | "pie"
  | "donut"
  | "heatmap"
  | "correlation_heatmap"
  | "pairplot"
  | "density_contour"
  | "parcoords"
  | "treemap"
  | "sunburst"
  | "qq"
  | "missing";

export const PLOTLY_3D_CHARTS: { id: PlotlyChartType; label: string; requirement: string }[] = [
  { id: "scatter3d", label: "3D Scatter", requirement: "3+ numeric columns" },
  { id: "bubble3d", label: "3D Bubble", requirement: "4+ numeric columns (X,Y,Z,Size)" },
  { id: "line3d", label: "3D Line", requirement: "3+ numeric columns" },
  { id: "surface", label: "3D Surface", requirement: "3+ numeric columns (X,Y,Z grid)" },
  { id: "mesh3d", label: "3D Mesh", requirement: "3+ numeric columns (3D points)" },
  { id: "volume", label: "3D Volume", requirement: "4+ numeric cols, >=27 points" },
  { id: "isosurface", label: "3D Isosurface", requirement: "4+ numeric cols, >=27 points" },
  { id: "cone", label: "3D Cone", requirement: "6+ numeric cols (X,Y,Z,U,V,W)" },
  { id: "streamtube", label: "3D Streamtube", requirement: "6+ numeric cols on 3D lattice" },
];

export const PLOTLY_2D_CHARTS: { id: PlotlyChartType; label: string; group: string }[] = [
  { id: "histogram", label: "Histogram", group: "Distribution" },
  { id: "box", label: "Box Plot", group: "Distribution" },
  { id: "violin", label: "Violin Plot", group: "Distribution" },
  { id: "kde", label: "Density Curve (KDE)", group: "Distribution" },
  { id: "qq", label: "Normality Q-Q Plot", group: "Distribution" },
  { id: "scatter", label: "Scatter & Trend", group: "Relationship" },
  { id: "bubble", label: "Bubble Chart", group: "Relationship" },
  { id: "density_contour", label: "Contour Density", group: "Relationship" },
  { id: "correlation_heatmap", label: "Correlation Matrix", group: "Relationship" },
  { id: "pairplot", label: "Pair Plot", group: "Multivariate" },
  { id: "parcoords", label: "Parallel Coordinates", group: "Multivariate" },
  { id: "heatmap", label: "2D Heatmap", group: "Multivariate" },
  { id: "bar", label: "Bar Chart", group: "Categorical" },
  { id: "line", label: "Line Chart", group: "Trend" },
  { id: "pie", label: "Pie Chart", group: "Categorical" },
  { id: "donut", label: "Donut Chart", group: "Categorical" },
  { id: "treemap", label: "Treemap", group: "Hierarchy" },
  { id: "sunburst", label: "Sunburst", group: "Hierarchy" },
  { id: "missing", label: "Missing Values", group: "Quality" },
];

export interface PlotlyChartConfig {
  chartType: PlotlyChartType;
  xCol: string;
  yCol: string;
  zCol: string;
  sizeCol: string;
  colorCol: string; // "" for none
  uCol: string;
  vCol: string;
  wCol: string;
  multiCols: string[];
  aggMethod: "mean" | "median" | "sum" | "count" | "min" | "max";
  bins: number;
  kdeBandwidth: number;
  corrMethod: "pearson" | "spearman";
  colorScale: string;
  markerSize: number;
  customTitle: string;
  customXLabel: string;
  customYLabel: string;
  customZLabel: string;
}

export function isChartTypeEligible(chartType: PlotlyChartType, profile: DatasetProfile): { eligible: boolean; reason?: string } {
  const numCount = profile.numericalColumns.length;
  const catCount = profile.categoricalColumns.length + profile.booleanColumns.length;
  const rows = profile.rowCount;

  switch (chartType) {
    case "scatter3d":
    case "line3d":
    case "mesh3d":
      return numCount >= 3 && rows >= 3
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 3 numerical columns and 3 rows." };
    case "surface":
      return numCount >= 3 && rows >= 9
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 3 numerical columns and >=9 records." };
    case "bubble3d":
      return numCount >= 4 && rows >= 3
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 4 numerical columns (X, Y, Z, Size)." };
    case "volume":
    case "isosurface":
      return numCount >= 4 && rows >= 27
        ? { eligible: true }
        : { eligible: false, reason: "Requires 3 coordinate columns + 1 scalar intensity column (4+ numeric cols, >=27 rows)." };
    case "cone":
    case "streamtube":
      return numCount >= 6 && rows >= 8
        ? { eligible: true }
        : { eligible: false, reason: "Requires 3 coordinate axes (X,Y,Z) + 3 vector components (U,V,W)." };
    case "histogram":
    case "box":
    case "violin":
    case "kde":
    case "qq":
      return numCount >= 1
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 1 numerical column." };
    case "scatter":
    case "density_contour":
      return numCount >= 2 && rows >= 2
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 2 numerical columns." };
    case "bubble":
      return numCount >= 3 && rows >= 2
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 3 numerical columns (X, Y, Size)." };
    case "correlation_heatmap":
    case "pairplot":
    case "parcoords":
      return numCount >= 2
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 2 numerical columns." };
    case "pie":
    case "donut":
      return catCount >= 1 || profile.columnCount >= 1
        ? { eligible: true }
        : { eligible: false, reason: "Requires categorical or discrete columns." };
    case "treemap":
    case "sunburst":
      return catCount >= 1
        ? { eligible: true }
        : { eligible: false, reason: "Requires at least 1 categorical column for hierarchy." };
    default:
      return { eligible: true };
  }
}

function getNumericVal(row: DataRow, col: string): number | null {
  const v = row[col];
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return parseNumericToken(v);
}

const DEFAULT_CAMERA = {
  eye: { x: 1.55, y: 1.55, z: 1.25 },
  center: { x: 0, y: 0, z: 0 },
  up: { x: 0, y: 0, z: 1 },
};

const CATEGORICAL_PALETTE = [
  "#059669",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#e11d48",
  "#0d9488",
  "#4f46e5",
  "#ea580c",
  "#db2777",
  "#65a30d",
];

function buildPlotlySpec(
  rows: DataRow[],
  profile: DatasetProfile,
  cfg: PlotlyChartConfig
): { data: Data[]; layout: Partial<Layout>; warning?: string; is3D: boolean } {
  const { sampledRows, isSampled, originalCount } = sampleRowsForCharts(rows, 4000);
  const sampleNote = isSampled ? ` (showing ${sampledRows.length.toLocaleString()} sampled of ${originalCount.toLocaleString()} rows)` : "";

  const xLabel = cfg.customXLabel || cfg.xCol || "X";
  const yLabel = cfg.customYLabel || cfg.yCol || "Y";
  const zLabel = cfg.customZLabel || cfg.zCol || "Z";
  const colorScale = cfg.colorScale || "Viridis";
  const markerSize = cfg.markerSize || 6;

  const is3D = PLOTLY_3D_CHARTS.some((c) => c.id === cfg.chartType);

  const baseLayout: Partial<Layout> = {
    paper_bgcolor: "rgba(255,255,255,0)",
    plot_bgcolor: "rgba(248,250,252,0.7)",
    font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#0f172a" },
    margin: is3D ? { l: 10, r: 10, t: 48, b: 10 } : { l: 60, r: 28, t: 52, b: 56 },
    hovermode: is3D ? "closest" : "closest",
    autosize: true,
    showlegend: true,
    legend: { orientation: "h", y: -0.18, x: 0 },
  };

  // Helper to attach actual record index so clicking shows original record
  const rowPairs = sampledRows.map((r, idx) => ({ row: r, idx }));

  const colorColType = profile.columns.find((c) => c.name === cfg.colorCol)?.type;
  const hasColor = Boolean(cfg.colorCol && cfg.colorCol !== "__NONE__");

  switch (cfg.chartType) {
    // =========================================================================
    // 3D VISUALIZATIONS
    // =========================================================================
    case "scatter3d":
    case "bubble3d":
    case "line3d": {
      const valid = rowPairs.filter(
        ({ row }) =>
          getNumericVal(row, cfg.xCol) !== null &&
          getNumericVal(row, cfg.yCol) !== null &&
          getNumericVal(row, cfg.zCol) !== null
      );
      if (valid.length === 0) {
        return { data: [], layout: baseLayout, is3D: true, warning: "No valid complete (X, Y, Z) rows found." };
      }

      const mode = cfg.chartType === "line3d" ? "lines+markers" : "markers";
      let ordered = valid;
      if (cfg.chartType === "line3d") {
        ordered = [...valid].sort((a, b) => getNumericVal(a.row, cfg.xCol)! - getNumericVal(b.row, cfg.xCol)!);
      }

      // Marker size normalization for 3D bubble
      let sizes: number | number[] = markerSize;
      if (cfg.chartType === "bubble3d") {
        const sVals = ordered.map(({ row }) => getNumericVal(row, cfg.sizeCol) ?? 0);
        const sMin = Math.min(...sVals);
        const sMax = Math.max(...sVals);
        const span = sMax - sMin || 1;
        sizes = sVals.map((s) => 5 + ((s - sMin) / span) * (Math.max(18, markerSize * 3)));
      }

      // Categorical grouping vs numerical colorbar
      let traces: Data[] = [];
      if (hasColor && (colorColType === "categorical" || colorColType === "boolean")) {
        const groups = new Map<string, typeof ordered>();
        for (const item of ordered) {
          const g = String(item.row[cfg.colorCol] ?? "Missing");
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g)!.push(item);
        }
        let gIdx = 0;
        for (const [grp, items] of groups.entries()) {
          let grpSizes: number | number[] = markerSize;
          if (cfg.chartType === "bubble3d" && Array.isArray(sizes)) {
            const allS = items.map(({ row }) => getNumericVal(row, cfg.sizeCol) ?? 0);
            const allAll = ordered.map(({ row }) => getNumericVal(row, cfg.sizeCol) ?? 0);
            const sMin = Math.min(...allAll);
            const span = Math.max(...allAll) - sMin || 1;
            grpSizes = allS.map((s) => 5 + ((s - sMin) / span) * Math.max(18, markerSize * 3));
          }
          traces.push({
            type: "scatter3d",
            mode,
            name: grp,
            x: items.map((i) => getNumericVal(i.row, cfg.xCol)!),
            y: items.map((i) => getNumericVal(i.row, cfg.yCol)!),
            z: items.map((i) => getNumericVal(i.row, cfg.zCol)!),
            customdata: items.map((i) => i.idx),
            text: items.map((i) => `Record #${i.idx + 1} (${cfg.colorCol}: ${grp})`),
            marker: {
              size: grpSizes,
              color: CATEGORICAL_PALETTE[gIdx % CATEGORICAL_PALETTE.length],
              opacity: 0.86,
              line: { width: 0.6, color: "#ffffff" },
            },
            line: { width: 2.5, color: CATEGORICAL_PALETTE[gIdx % CATEGORICAL_PALETTE.length] },
          } as Data);
          gIdx++;
        }
      } else {
        const cArr = hasColor
          ? ordered.map(({ row }) => getNumericVal(row, cfg.colorCol) ?? 0)
          : ordered.map(({ row }) => getNumericVal(row, cfg.zCol)!);
        traces = [
          {
            type: "scatter3d",
            mode,
            name: `${cfg.zCol}`,
            x: ordered.map((i) => getNumericVal(i.row, cfg.xCol)!),
            y: ordered.map((i) => getNumericVal(i.row, cfg.yCol)!),
            z: ordered.map((i) => getNumericVal(i.row, cfg.zCol)!),
            customdata: ordered.map((i) => i.idx),
            text: ordered.map(
              (i) =>
                `Record #${i.idx + 1}<br>${xLabel}: ${i.row[cfg.xCol]}<br>${yLabel}: ${i.row[cfg.yCol]}<br>${zLabel}: ${i.row[cfg.zCol]}`
            ),
            hoverinfo: "text",
            marker: {
              size: sizes,
              color: cArr,
              colorscale: colorScale,
              showscale: true,
              colorbar: { title: { text: hasColor ? cfg.colorCol : zLabel }, thickness: 14 },
              opacity: 0.88,
              line: { width: 0.5, color: "#ffffff" },
            },
            line: { width: 3, color: "#0284c7" },
          } as Data,
        ];
      }

      const defaultTitle =
        cfg.chartType === "bubble3d"
          ? `3D Bubble: ${xLabel} × ${yLabel} × ${zLabel} (Size: ${cfg.sizeCol})${sampleNote}`
          : cfg.chartType === "line3d"
          ? `3D Trajectory: ${xLabel} → ${yLabel} → ${zLabel}${sampleNote}`
          : `3D Scatter: ${xLabel} × ${yLabel} × ${zLabel}${sampleNote}`;

      return {
        data: traces,
        is3D: true,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || defaultTitle, font: { size: 14, weight: 700 } },
          scene: {
            xaxis: { title: { text: xLabel }, gridcolor: "#cbd5e1", backgroundcolor: "#f8fafc" },
            yaxis: { title: { text: yLabel }, gridcolor: "#cbd5e1", backgroundcolor: "#f8fafc" },
            zaxis: { title: { text: zLabel }, gridcolor: "#cbd5e1", backgroundcolor: "#f8fafc" },
            camera: DEFAULT_CAMERA,
          },
        },
      };
    }

    case "surface": {
      const grid = buildObservedSurfaceGrid(sampledRows, cfg.xCol, cfg.yCol, cfg.zCol);
      if (grid.xCenters.length < 3 || grid.yCenters.length < 3) {
        return {
          data: [],
          is3D: true,
          layout: baseLayout,
          warning: "Insufficient distinct (X, Y) coordinates to form a genuine observed 3D surface lattice.",
        };
      }
      const warning =
        grid.coveragePct < 35
          ? `Observed (X, Y) coverage is ${grid.coveragePct}%. Empty lattice bins remain blank (no values fabricated). Switch to 3D Scatter or 3D Mesh for sparse tabular data.`
          : undefined;

      return {
        data: [
          {
            type: "surface",
            x: grid.xCenters,
            y: grid.yCenters,
            z: grid.zMatrix,
            colorscale: colorScale,
            connectgaps: false,
            colorbar: { title: { text: zLabel }, thickness: 14 },
            contours: {
              z: { show: true, usecolormap: true, highlightcolor: "#0f172a", project: { z: true } },
            },
          } as Data,
        ],
        is3D: true,
        warning,
        layout: {
          ...baseLayout,
          title: {
            text: cfg.customTitle || `3D Observed Mean Surface: ${zLabel} over (${xLabel}, ${yLabel})`,
            font: { size: 14, weight: 700 },
          },
          scene: {
            xaxis: { title: { text: xLabel } },
            yaxis: { title: { text: yLabel } },
            zaxis: { title: { text: zLabel } },
            camera: DEFAULT_CAMERA,
          },
        },
      };
    }

    case "mesh3d": {
      const valid = rowPairs.filter(
        ({ row }) =>
          getNumericVal(row, cfg.xCol) !== null &&
          getNumericVal(row, cfg.yCol) !== null &&
          getNumericVal(row, cfg.zCol) !== null
      );
      if (valid.length < 4) {
        return { data: [], is3D: true, layout: baseLayout, warning: "Requires at least 4 valid 3D points for mesh triangulation." };
      }
      const x = valid.map((i) => getNumericVal(i.row, cfg.xCol)!);
      const y = valid.map((i) => getNumericVal(i.row, cfg.yCol)!);
      const z = valid.map((i) => getNumericVal(i.row, cfg.zCol)!);
      const intensity =
        hasColor && colorColType === "numerical"
          ? valid.map((i) => getNumericVal(i.row, cfg.colorCol) ?? 0)
          : z;

      return {
        data: [
          {
            type: "mesh3d",
            x,
            y,
            z,
            intensity,
            colorscale: colorScale,
            showscale: true,
            colorbar: { title: { text: hasColor && colorColType === "numerical" ? cfg.colorCol : zLabel }, thickness: 14 },
            opacity: 0.72,
            alphahull: 0,
            flatshading: false,
          } as Data,
          {
            type: "scatter3d",
            mode: "markers",
            name: "Observations",
            x,
            y,
            z,
            customdata: valid.map((i) => i.idx),
            marker: { size: Math.max(3, markerSize - 2), color: "#0f172a", opacity: 0.65 },
          } as Data,
        ],
        is3D: true,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `3D Delaunay Mesh: ${xLabel} × ${yLabel} × ${zLabel}${sampleNote}`, font: { size: 14, weight: 700 } },
          scene: {
            xaxis: { title: { text: xLabel } },
            yaxis: { title: { text: yLabel } },
            zaxis: { title: { text: zLabel } },
            camera: DEFAULT_CAMERA,
          },
        },
      };
    }

    case "volume":
    case "isosurface": {
      const valCol = cfg.sizeCol && cfg.sizeCol !== cfg.zCol ? cfg.sizeCol : cfg.colorCol && colorColType === "numerical" ? cfg.colorCol : profile.numericalColumns[3] || cfg.zCol;
      const valid = rowPairs
        .filter(
          ({ row }) =>
            getNumericVal(row, cfg.xCol) !== null &&
            getNumericVal(row, cfg.yCol) !== null &&
            getNumericVal(row, cfg.zCol) !== null &&
            getNumericVal(row, valCol) !== null
        )
        .map(({ row }) => ({
          x: getNumericVal(row, cfg.xCol)!,
          y: getNumericVal(row, cfg.yCol)!,
          z: getNumericVal(row, cfg.zCol)!,
          v: getNumericVal(row, valCol)!,
        }));

      if (valid.length < 27) {
        return {
          data: [],
          is3D: true,
          layout: baseLayout,
          warning: "Requires at least 27 volumetric coordinate observations across X, Y, Z, and scalar field V.",
        };
      }

      // Check if data forms a clean 3D Cartesian lattice (like fluid-field-3d) or binned spatial voxel lattice
      const ux = [...new Set(valid.map((p) => p.x))].sort((a, b) => a - b);
      const uy = [...new Set(valid.map((p) => p.y))].sort((a, b) => a - b);
      const uz = [...new Set(valid.map((p) => p.z))].sort((a, b) => a - b);

      let px: number[] = [];
      let py: number[] = [];
      let pz: number[] = [];
      let pv: number[] = [];
      let gridNotice: string | undefined;

      if (ux.length >= 3 && uy.length >= 3 && uz.length >= 2 && ux.length * uy.length * uz.length <= 8000 && valid.length >= ux.length * uy.length * uz.length * 0.7) {
        const map = new Map<string, number[]>();
        for (const p of valid) {
          const k = `${p.x}|${p.y}|${p.z}`;
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push(p.v);
        }
        for (const xv of ux) {
          for (const yv of uy) {
            for (const zv of uz) {
              const arr = map.get(`${xv}|${yv}|${zv}`);
              px.push(xv);
              py.push(yv);
              pz.push(zv);
              pv.push(arr && arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
            }
          }
        }
      } else {
        // Aggregate genuinely into 6x6x5 spatial voxels from observed points (empty bins remain NaN, never fabricated)
        const nBins = 6;
        const nZBins = 5;
        const minX = ux[0], maxX = ux[ux.length - 1], spanX = maxX - minX || 1;
        const minY = uy[0], maxY = uy[uy.length - 1], spanY = maxY - minY || 1;
        const minZ = uz[0], maxZ = uz[uz.length - 1], spanZ = maxZ - minZ || 1;
        const buckets = new Map<string, number[]>();
        for (const p of valid) {
          const xi = Math.min(nBins - 1, Math.max(0, Math.floor(((p.x - minX) / spanX) * nBins)));
          const yi = Math.min(nBins - 1, Math.max(0, Math.floor(((p.y - minY) / spanY) * nBins)));
          const zi = Math.min(nZBins - 1, Math.max(0, Math.floor(((p.z - minZ) / spanZ) * nZBins)));
          const k = `${xi}|${yi}|${zi}`;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k)!.push(p.v);
        }
        for (let xi = 0; xi < nBins; xi++) {
          for (let yi = 0; yi < nBins; yi++) {
            for (let zi = 0; zi < nZBins; zi++) {
              const cx = roundNum(minX + ((xi + 0.5) / nBins) * spanX, 3);
              const cy = roundNum(minY + ((yi + 0.5) / nBins) * spanY, 3);
              const cz = roundNum(minZ + ((zi + 0.5) / nZBins) * spanZ, 3);
              const vals = buckets.get(`${xi}|${yi}|${zi}`);
              px.push(cx);
              py.push(cy);
              pz.push(cz);
              pv.push(vals && vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN);
            }
          }
        }
        gridNotice = `Aggregated irregular points into ${nBins}×${nBins}×${nZBins} observed spatial voxels for scalar "${valCol}". Unpopulated voxels remain transparent.`;
      }

      const validVals = pv.filter((v) => !Number.isNaN(v));
      if (validVals.length === 0) {
        return { data: [], is3D: true, layout: baseLayout, warning: "No valid scalar intensities in voxel grid." };
      }
      const vMin = Math.min(...validVals);
      const vMax = Math.max(...validVals);

      return {
        data: [
          {
            type: cfg.chartType,
            x: px,
            y: py,
            z: pz,
            value: pv,
            isomin: vMin + (vMax - vMin) * 0.15,
            isomax: vMax - (vMax - vMin) * 0.05,
            opacity: cfg.chartType === "volume" ? 0.28 : 0.72,
            surface: { count: cfg.chartType === "volume" ? 10 : 5, show: true },
            colorscale: colorScale,
            colorbar: { title: { text: valCol }, thickness: 14 },
            caps: { x: { show: false }, y: { show: false }, z: { show: false } },
          } as Data,
        ],
        is3D: true,
        warning: gridNotice,
        layout: {
          ...baseLayout,
          title: {
            text: cfg.customTitle || `${cfg.chartType === "volume" ? "3D Volume" : "3D Isosurface"}: Scalar "${valCol}" over (${xLabel}, ${yLabel}, ${zLabel})`,
            font: { size: 14, weight: 700 },
          },
          scene: {
            xaxis: { title: { text: xLabel } },
            yaxis: { title: { text: yLabel } },
            zaxis: { title: { text: zLabel } },
            camera: DEFAULT_CAMERA,
          },
        },
      };
    }

    case "cone":
    case "streamtube": {
      const valid = rowPairs
        .filter(
          ({ row }) =>
            getNumericVal(row, cfg.xCol) !== null &&
            getNumericVal(row, cfg.yCol) !== null &&
            getNumericVal(row, cfg.zCol) !== null &&
            getNumericVal(row, cfg.uCol) !== null &&
            getNumericVal(row, cfg.vCol) !== null &&
            getNumericVal(row, cfg.wCol) !== null
        )
        .map(({ row }) => ({
          x: getNumericVal(row, cfg.xCol)!,
          y: getNumericVal(row, cfg.yCol)!,
          z: getNumericVal(row, cfg.zCol)!,
          u: getNumericVal(row, cfg.uCol)!,
          v: getNumericVal(row, cfg.vCol)!,
          w: getNumericVal(row, cfg.wCol)!,
        }));

      if (valid.length < 8) {
        return {
          data: [],
          is3D: true,
          layout: baseLayout,
          warning: "Requires valid 6D tuples (X, Y, Z coordinates + U, V, W vector components).",
        };
      }

      if (cfg.chartType === "cone") {
        return {
          data: [
            {
              type: "cone",
              x: valid.map((p) => p.x),
              y: valid.map((p) => p.y),
              z: valid.map((p) => p.z),
              u: valid.map((p) => p.u),
              v: valid.map((p) => p.v),
              w: valid.map((p) => p.w),
              sizemode: "absolute",
              sizeref: 0.65,
              anchor: "tail",
              colorscale: colorScale,
              colorbar: { title: { text: "|Vector|" }, thickness: 14 },
            } as Data,
          ],
          is3D: true,
          layout: {
            ...baseLayout,
            title: {
              text: cfg.customTitle || `3D Vector Cone Field: (${cfg.uCol}, ${cfg.vCol}, ${cfg.wCol}) at (${xLabel}, ${yLabel}, ${zLabel})`,
              font: { size: 14, weight: 700 },
            },
            scene: {
              xaxis: { title: { text: xLabel } },
              yaxis: { title: { text: yLabel } },
              zaxis: { title: { text: zLabel } },
              camera: DEFAULT_CAMERA,
            },
          },
        };
      }

      // Streamtube requires a structured grid or seeded starts
      const ux = [...new Set(valid.map((p) => p.x))].sort((a, b) => a - b);
      const uy = [...new Set(valid.map((p) => p.y))].sort((a, b) => a - b);
      const uz = [...new Set(valid.map((p) => p.z))].sort((a, b) => a - b);
      if (ux.length < 3 || uy.length < 3 || uz.length < 2) {
        return {
          data: [],
          is3D: true,
          layout: baseLayout,
          warning: "Streamtube integration requires a structured 3D spatial grid (>= 3×3×2 coordinates). Try 3D Cone for scattered vector points.",
        };
      }

      const startSeeds = valid.filter((_, idx) => idx % Math.max(1, Math.floor(valid.length / 8)) === 0).slice(0, 8);
      return {
        data: [
          {
            type: "streamtube",
            x: valid.map((p) => p.x),
            y: valid.map((p) => p.y),
            z: valid.map((p) => p.z),
            u: valid.map((p) => p.u),
            v: valid.map((p) => p.v),
            w: valid.map((p) => p.w),
            starts: {
              x: startSeeds.map((s) => s.x),
              y: startSeeds.map((s) => s.y),
              z: startSeeds.map((s) => s.z),
            },
            sizeref: 0.35,
            colorscale: colorScale,
            colorbar: { title: { text: "|Flow|" }, thickness: 14 },
          } as Data,
        ],
        is3D: true,
        layout: {
          ...baseLayout,
          title: {
            text: cfg.customTitle || `3D Vector Streamtubes: (${cfg.uCol}, ${cfg.vCol}, ${cfg.wCol})`,
            font: { size: 14, weight: 700 },
          },
          scene: {
            xaxis: { title: { text: xLabel } },
            yaxis: { title: { text: yLabel } },
            zaxis: { title: { text: zLabel } },
            camera: DEFAULT_CAMERA,
          },
        },
      };
    }

    // =========================================================================
    // 2D DISTRIBUTIONS
    // =========================================================================
    case "histogram": {
      if (hasColor && (colorColType === "categorical" || colorColType === "boolean")) {
        const groups = new Map<string, number[]>();
        for (const r of sampledRows) {
          const val = getNumericVal(r, cfg.xCol);
          if (val === null) continue;
          const grp = String(r[cfg.colorCol] ?? "Missing");
          if (!groups.has(grp)) groups.set(grp, []);
          groups.get(grp)!.push(val);
        }
        const traces: Data[] = [...groups.entries()].map(([grp, vals], idx) => ({
          type: "histogram",
          name: grp,
          x: vals,
          nbinsx: cfg.bins,
          opacity: 0.65,
          marker: { color: CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length] },
        }));
        return {
          data: traces,
          is3D: false,
          layout: {
            ...baseLayout,
            barmode: "overlay",
            title: { text: cfg.customTitle || `Histogram of ${xLabel} grouped by ${cfg.colorCol}${sampleNote}`, font: { size: 14, weight: 700 } },
            xaxis: { title: { text: xLabel } },
            yaxis: { title: { text: "Frequency Count" } },
          },
        };
      }

      const vals = sampledRows.map((r) => getNumericVal(r, cfg.xCol)).filter((v): v is number => v !== null);
      return {
        data: [
          {
            type: "histogram",
            name: xLabel,
            x: vals,
            nbinsx: cfg.bins,
            marker: { color: "#059669", line: { color: "#ffffff", width: 1 } },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `Histogram: ${xLabel} (${cfg.bins} bins)${sampleNote}`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: "Count" } },
        },
      };
    }

    case "box":
    case "violin": {
      const traceType = cfg.chartType === "box" ? "box" : "violin";
      if (hasColor && (colorColType === "categorical" || colorColType === "boolean")) {
        const groups = new Map<string, number[]>();
        for (const r of sampledRows) {
          const val = getNumericVal(r, cfg.xCol);
          if (val === null) continue;
          const grp = String(r[cfg.colorCol] ?? "Missing");
          if (!groups.has(grp)) groups.set(grp, []);
          groups.get(grp)!.push(val);
        }
        const traces: Data[] = [...groups.entries()].map(([grp, vals], idx) => ({
          type: traceType,
          name: grp,
          y: vals,
          box: traceType === "violin" ? { visible: true } : undefined,
          meanline: traceType === "violin" ? { visible: true } : undefined,
          boxpoints: "outliers",
          marker: { color: CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length] },
        } as Data));
        return {
          data: traces,
          is3D: false,
          layout: {
            ...baseLayout,
            title: { text: cfg.customTitle || `${traceType === "box" ? "Box" : "Violin"} Plot of ${xLabel} by ${cfg.colorCol}${sampleNote}`, font: { size: 14, weight: 700 } },
            yaxis: { title: { text: xLabel } },
            xaxis: { title: { text: cfg.colorCol } },
          },
        };
      }

      const vals = sampledRows.map((r) => getNumericVal(r, cfg.xCol)).filter((v): v is number => v !== null);
      return {
        data: [
          {
            type: traceType,
            name: xLabel,
            y: vals,
            box: traceType === "violin" ? { visible: true } : undefined,
            meanline: traceType === "violin" ? { visible: true } : undefined,
            boxpoints: "all",
            jitter: 0.28,
            pointpos: -1.6,
            marker: { color: "#0284c7", size: 5, opacity: 0.65 },
            line: { color: "#0369a1" },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `${traceType === "box" ? "Box Plot & Outliers" : "Violin Distribution"}: ${xLabel}${sampleNote}`, font: { size: 14, weight: 700 } },
          yaxis: { title: { text: xLabel } },
        },
      };
    }

    case "kde": {
      const vals = sampledRows.map((r) => getNumericVal(r, cfg.xCol)).filter((v): v is number => v !== null);
      const pts = computeKDE(vals, cfg.kdeBandwidth, 100);
      return {
        data: [
          {
            type: "scatter",
            mode: "lines",
            name: `KDE (h×${cfg.kdeBandwidth})`,
            x: pts.map((p) => p.x),
            y: pts.map((p) => p.density),
            fill: "tozeroy",
            fillcolor: "rgba(16, 185, 129, 0.22)",
            line: { color: "#059669", width: 3 },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `Gaussian KDE Density: ${xLabel} (bw=${cfg.kdeBandwidth}×)${sampleNote}`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: "Probability Density f(x)" } },
        },
      };
    }

    case "qq": {
      const vals = rows.map((r) => getNumericVal(r, cfg.xCol));
      const qq = computeQQPlotData(vals);
      if (qq.theoretical.length === 0) {
        return { data: [], is3D: false, layout: baseLayout, warning: "Requires at least 3 valid numbers for Q-Q normality check." };
      }
      return {
        data: [
          {
            type: "scatter",
            mode: "markers",
            name: "Standardized Observations",
            x: qq.theoretical,
            y: qq.observed,
            marker: { color: "#0284c7", size: markerSize, opacity: 0.78 },
          } as Data,
          {
            type: "scatter",
            mode: "lines",
            name: "Theoretical Normal Reference",
            x: qq.lineX,
            y: qq.lineY,
            line: { color: "#e11d48", width: 2, dash: "dash" },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `Q-Q Normality Check: ${xLabel}`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: "Theoretical Normal Quantiles (Z)" } },
          yaxis: { title: { text: "Observed Standardized Quantiles" } },
        },
      };
    }

    // =========================================================================
    // 2D RELATIONSHIPS & CORRELATION
    // =========================================================================
    case "scatter":
    case "bubble": {
      const valid = rowPairs.filter(
        ({ row }) => getNumericVal(row, cfg.xCol) !== null && getNumericVal(row, cfg.yCol) !== null
      );
      if (valid.length === 0) return { data: [], is3D: false, layout: baseLayout, warning: "No valid numeric pairs found." };

      const xsAll = valid.map((i) => getNumericVal(i.row, cfg.xCol)!);
      const ysAll = valid.map((i) => getNumericVal(i.row, cfg.yCol)!);
      const ols = computePairMetrics(xsAll, ysAll);

      let bubbleSizes: number | number[] = markerSize + 2;
      if (cfg.chartType === "bubble") {
        const sArr = valid.map((i) => getNumericVal(i.row, cfg.sizeCol) ?? 0);
        const sMin = Math.min(...sArr);
        const span = Math.max(...sArr) - sMin || 1;
        bubbleSizes = sArr.map((s) => 6 + ((s - sMin) / span) * 28);
      }

      const traces: Data[] = [];
      if (hasColor && (colorColType === "categorical" || colorColType === "boolean")) {
        const groups = new Map<string, typeof valid>();
        for (const item of valid) {
          const g = String(item.row[cfg.colorCol] ?? "Missing");
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g)!.push(item);
        }
        let gIdx = 0;
        for (const [grp, items] of groups.entries()) {
          traces.push({
            type: "scatter",
            mode: "markers",
            name: grp,
            x: items.map((i) => getNumericVal(i.row, cfg.xCol)!),
            y: items.map((i) => getNumericVal(i.row, cfg.yCol)!),
            customdata: items.map((i) => i.idx),
            marker: {
              size: cfg.chartType === "bubble" ? 10 : markerSize + 1,
              color: CATEGORICAL_PALETTE[gIdx % CATEGORICAL_PALETTE.length],
              opacity: 0.8,
              line: { width: 0.7, color: "#ffffff" },
            },
          } as Data);
          gIdx++;
        }
      } else {
        traces.push({
          type: "scatter",
          mode: "markers",
          name: "Records",
          x: xsAll,
          y: ysAll,
          customdata: valid.map((i) => i.idx),
          marker: {
            size: bubbleSizes,
            color: hasColor && colorColType === "numerical" ? valid.map((i) => getNumericVal(i.row, cfg.colorCol) ?? 0) : "#059669",
            colorscale: colorScale,
            showscale: hasColor && colorColType === "numerical",
            colorbar: hasColor && colorColType === "numerical" ? { title: { text: cfg.colorCol }, thickness: 14 } : undefined,
            opacity: 0.8,
            line: { width: 0.8, color: "#ffffff" },
          },
        } as Data);
      }

      // OLS regression trendline
      const minX = Math.min(...xsAll);
      const maxX = Math.max(...xsAll);
      traces.push({
        type: "scatter",
        mode: "lines",
        name: `OLS Fit (R²=${ols.r2}, r=${ols.pearson})`,
        x: [minX, maxX],
        y: [ols.slope * minX + ols.intercept, ols.slope * maxX + ols.intercept],
        line: { color: "#e11d48", width: 2.5, dash: "dash" },
      } as Data);

      return {
        data: traces,
        is3D: false,
        layout: {
          ...baseLayout,
          title: {
            text:
              cfg.customTitle ||
              `${cfg.chartType === "bubble" ? `Bubble (${cfg.sizeCol})` : "Scatter & OLS"}: ${yLabel} vs ${xLabel} (r=${ols.pearson})${sampleNote}`,
            font: { size: 14, weight: 700 },
          },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: yLabel } },
        },
      };
    }

    case "density_contour": {
      const valid = sampledRows.filter((r) => getNumericVal(r, cfg.xCol) !== null && getNumericVal(r, cfg.yCol) !== null);
      return {
        data: [
          {
            type: "histogram2dcontour",
            x: valid.map((r) => getNumericVal(r, cfg.xCol)!),
            y: valid.map((r) => getNumericVal(r, cfg.yCol)!),
            colorscale: colorScale,
            contours: { coloring: "heatmap", showlabels: true },
            colorbar: { title: { text: "Density" }, thickness: 14 },
          } as Data,
          {
            type: "scatter",
            mode: "markers",
            name: "Points",
            x: valid.map((r) => getNumericVal(r, cfg.xCol)!),
            y: valid.map((r) => getNumericVal(r, cfg.yCol)!),
            marker: { color: "#ffffff", size: 3.5, opacity: 0.55 },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `2D Density Contour: ${xLabel} vs ${yLabel}${sampleNote}`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: yLabel } },
        },
      };
    }

    case "correlation_heatmap": {
      const cols = profile.correlations.columns;
      const matrix = cfg.corrMethod === "spearman" ? profile.correlations.spearmanMatrix : profile.correlations.pearsonMatrix;
      if (cols.length < 2) return { data: [], is3D: false, layout: baseLayout, warning: "Requires >= 2 numerical columns." };

      return {
        data: [
          {
            type: "heatmap",
            z: matrix,
            x: cols,
            y: cols,
            zmin: -1,
            zmax: 1,
            colorscale: "RdBu",
            reversescale: true,
            text: matrix.map((row) => row.map((v) => v.toFixed(2))) as any,
            texttemplate: "%{text}",
            hovertemplate: "%{x} vs %{y}: r = %{z:.3f}<extra></extra>",
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          margin: { l: 100, r: 30, t: 54, b: 90 },
          title: {
            text: cfg.customTitle || `${cfg.corrMethod === "spearman" ? "Spearman Rank" : "Pearson Linear"} Correlation Heatmap`,
            font: { size: 14, weight: 700 },
          },
          yaxis: { autorange: "reversed" },
        },
      };
    }

    case "heatmap": {
      const grid = buildObservedSurfaceGrid(sampledRows, cfg.xCol, cfg.yCol, cfg.zCol);
      return {
        data: [
          {
            type: "heatmap",
            x: grid.xCenters,
            y: grid.yCenters,
            z: grid.zMatrix,
            colorscale: colorScale,
            colorbar: { title: { text: zLabel }, thickness: 14 },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `2D Matrix Heatmap: Mean ${zLabel} across (${xLabel}, ${yLabel})`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: yLabel } },
        },
      };
    }

    case "pairplot": {
      const selCols = cfg.multiCols.length >= 2 ? cfg.multiCols.slice(0, 5) : profile.numericalColumns.slice(0, 4);
      if (selCols.length < 2) return { data: [], is3D: false, layout: baseLayout, warning: "Select at least 2 numerical columns." };

      const colorVals =
        hasColor && colorColType === "numerical"
          ? sampledRows.map((r) => getNumericVal(r, cfg.colorCol) ?? 0)
          : undefined;

      return {
        data: [
          {
            type: "splom",
            dimensions: selCols.map((c) => ({
              label: c,
              values: sampledRows.map((r) => getNumericVal(r, c) ?? NaN),
            })),
            diagonal: { visible: true },
            showupperhalf: false,
            marker: {
              size: Math.max(4, markerSize - 1),
              color: colorVals ?? "#0284c7",
              colorscale: colorScale,
              opacity: 0.72,
              line: { width: 0.4, color: "#ffffff" },
            },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          margin: { l: 70, r: 30, t: 54, b: 60 },
          dragmode: "select",
          title: { text: cfg.customTitle || `Pair Plot (SPLOM): ${selCols.join(", ")}${sampleNote}`, font: { size: 14, weight: 700 } },
        },
      };
    }

    case "parcoords": {
      const selCols = cfg.multiCols.length >= 2 ? cfg.multiCols.slice(0, 6) : profile.numericalColumns.slice(0, 5);
      if (selCols.length < 2) return { data: [], is3D: false, layout: baseLayout, warning: "Select at least 2 numerical columns." };

      const colorCol = cfg.colorCol && colorColType === "numerical" ? cfg.colorCol : selCols[0];
      return {
        data: [
          {
            type: "parcoords",
            line: {
              color: sampledRows.map((r) => getNumericVal(r, colorCol) ?? 0),
              colorscale: colorScale,
              showscale: true,
              colorbar: { title: { text: colorCol }, thickness: 14 },
            },
            dimensions: selCols.map((col) => ({
              label: col,
              values: sampledRows.map((r) => getNumericVal(r, col) ?? 0),
            })),
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          margin: { l: 60, r: 60, t: 65, b: 35 },
          title: { text: cfg.customTitle || `Parallel Coordinates (${selCols.join(", ")})`, font: { size: 14, weight: 700 } },
        },
      };
    }

    // =========================================================================
    // CATEGORICAL / HIERARCHICAL / TREND / QUALITY
    // =========================================================================
    case "bar": {
      const catCol = profile.categoricalColumns.includes(cfg.xCol) || profile.booleanColumns.includes(cfg.xCol)
        ? cfg.xCol
        : profile.categoricalColumns[0] || cfg.xCol;
      const numCol = profile.numericalColumns.includes(cfg.yCol) ? cfg.yCol : profile.numericalColumns[0] || "";

      if (numCol && cfg.aggMethod !== "count") {
        const grouped = computeGroupedStats(rows, catCol, numCol, cfg.aggMethod);
        return {
          data: [
            {
              type: "bar",
              x: grouped.labels,
              y: grouped.aggregatedValues,
              text: grouped.aggregatedValues.map((v) => String(v)),
              textposition: "auto",
              marker: { color: "#0284c7" },
            } as Data,
          ],
          is3D: false,
          layout: {
            ...baseLayout,
            title: { text: cfg.customTitle || `${cfg.aggMethod.toUpperCase()} of ${numCol} by ${catCol}`, font: { size: 14, weight: 700 } },
            xaxis: { title: { text: catCol } },
            yaxis: { title: { text: `${cfg.aggMethod}(${numCol})` } },
          },
        };
      }

      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = r[catCol] === null || r[catCol] === undefined ? "Missing" : String(r[catCol]);
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
      return {
        data: [
          {
            type: "bar",
            x: sorted.map((s) => s[0]),
            y: sorted.map((s) => s[1]),
            text: sorted.map((s) => String(s[1])),
            textposition: "auto",
            marker: { color: sorted.map((_, i) => CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]) },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `Category Frequency Bar Chart: ${catCol}`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: catCol } },
          yaxis: { title: { text: "Record Count" } },
        },
      };
    }

    case "pie":
    case "donut": {
      const catCol = profile.categoricalColumns.includes(cfg.xCol) || profile.booleanColumns.includes(cfg.xCol)
        ? cfg.xCol
        : profile.categoricalColumns[0] || profile.booleanColumns[0] || cfg.xCol;
      const counts = new Map<string, number>();
      for (const r of rows) {
        const v = r[catCol] === null || r[catCol] === undefined ? "Missing" : String(r[catCol]);
        counts.set(v, (counts.get(v) || 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const top10 = sorted.slice(0, 10);
      if (sorted.length > 10) {
        const otherSum = sorted.slice(10).reduce((s, item) => s + item[1], 0);
        top10.push(["Other", otherSum]);
      }

      return {
        data: [
          {
            type: "pie",
            labels: top10.map((i) => i[0]),
            values: top10.map((i) => i[1]),
            hole: cfg.chartType === "donut" ? 0.48 : 0,
            textinfo: "label+percent",
            marker: { colors: top10.map((_, i) => CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]) },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `${cfg.chartType === "donut" ? "Donut" : "Pie"} Share Breakdown: ${catCol}`, font: { size: 14, weight: 700 } },
        },
      };
    }

    case "line": {
      const ordered = [...rowPairs].sort((a, b) => {
        const va = a.row[cfg.xCol];
        const vb = b.row[cfg.xCol];
        if (typeof va === "number" && typeof vb === "number") return va - vb;
        return String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true });
      });
      return {
        data: [
          {
            type: "scatter",
            mode: "lines+markers",
            name: yLabel,
            x: ordered.map((i) => i.row[cfg.xCol]),
            y: ordered.map((i) => getNumericVal(i.row, cfg.yCol)),
            customdata: ordered.map((i) => i.idx),
            marker: { size: Math.max(4, markerSize - 1), color: "#0284c7" },
            line: { width: 2.5, color: "#0284c7" },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          title: { text: cfg.customTitle || `Line Trend: ${yLabel} across ${xLabel}${sampleNote}`, font: { size: 14, weight: 700 } },
          xaxis: { title: { text: xLabel } },
          yaxis: { title: { text: yLabel } },
        },
      };
    }

    case "treemap":
    case "sunburst": {
      const catCol = profile.categoricalColumns.includes(cfg.xCol) || profile.booleanColumns.includes(cfg.xCol)
        ? cfg.xCol
        : profile.categoricalColumns[0] || profile.booleanColumns[0] || cfg.xCol;
      const metricCol = profile.numericalColumns.includes(cfg.yCol) ? cfg.yCol : profile.numericalColumns[0] || "";
      const grouped = metricCol
        ? computeGroupedStats(rows, catCol, metricCol, cfg.aggMethod === "count" ? "count" : "sum")
        : null;

      const counts = new Map<string, number>();
      if (!grouped) {
        for (const r of rows) {
          const v = r[catCol] === null || r[catCol] === undefined ? "Missing" : String(r[catCol]);
          counts.set(v, (counts.get(v) || 0) + 1);
        }
      }

      const items = grouped
        ? grouped.labels.map((l, i) => ({ label: l, val: Math.max(0.01, Math.abs(grouped.aggregatedValues[i])) }))
        : [...counts.entries()].slice(0, 20).map(([l, c]) => ({ label: l, val: c }));

      const labels = [catCol, ...items.map((i) => i.label)];
      const parents = ["", ...items.map(() => catCol)];
      const values = [0, ...items.map((i) => i.val)];

      return {
        data: [
          {
            type: cfg.chartType,
            labels,
            parents,
            values,
            textinfo: "label+value+percent parent",
            marker: { colors: ["rgba(241,245,249,0)", ...items.map((_, i) => CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length])] },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          margin: { l: 15, r: 15, t: 50, b: 15 },
          title: {
            text:
              cfg.customTitle ||
              `${cfg.chartType === "treemap" ? "Treemap" : "Sunburst"} Hierarchy: ${catCol}${metricCol ? ` (${cfg.aggMethod} of ${metricCol})` : ""}`,
            font: { size: 14, weight: 700 },
          },
        },
      };
    }

    case "missing": {
      const sorted = [...profile.columns].sort((a, b) => b.missingPct - a.missingPct);
      return {
        data: [
          {
            type: "bar",
            orientation: "h",
            x: sorted.map((c) => c.missingPct),
            y: sorted.map((c) => c.name),
            text: sorted.map((c) => `${c.missingCount} (${c.missingPct}%)`),
            textposition: "auto",
            marker: {
              color: sorted.map((c) => (c.missingPct > 20 ? "#e11d48" : c.missingPct > 0 ? "#d97706" : "#10b981")),
            },
          } as Data,
        ],
        is3D: false,
        layout: {
          ...baseLayout,
          margin: { l: 120, r: 30, t: 50, b: 50 },
          title: { text: cfg.customTitle || "Dataset Missingness Breakdown (% Missing by Column)", font: { size: 14, weight: 700 } },
          xaxis: { title: { text: "Missing Percentage (%)" }, range: [0, Math.max(15, Math.max(...sorted.map((c) => c.missingPct)) * 1.15)] },
          yaxis: { autorange: "reversed" },
        },
      };
    }
  }
}

export function PlotlyEDAChart({
  rows,
  profile,
  config,
  height = 470,
  onImageCaptureReady,
}: {
  rows: DataRow[];
  profile: DatasetProfile;
  config: PlotlyChartConfig;
  height?: number;
  onImageCaptureReady?: (captureFn: () => Promise<string | null>) => void;
}) {
  const plotDivRef = useRef<HTMLDivElement | null>(null);
  const fullDivRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<typeof import("plotly.js-dist-min") | null>(null);
  const [plotlyReady, setPlotlyReady] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [clickedRecord, setClickedRecord] = useState<{ index: number; row: DataRow } | null>(null);

  const eligibility = useMemo(() => isChartTypeEligible(config.chartType, profile), [config.chartType, profile]);

  const spec = useMemo(() => {
    if (!eligibility.eligible) return null;
    return buildPlotlySpec(rows, profile, config);
  }, [rows, profile, config, eligibility.eligible]);

  useEffect(() => {
    setClickedRecord(null);
  }, [config.chartType, rows]);

  useEffect(() => {
    let mounted = true;
    import("plotly.js-dist-min").then((mod) => {
      if (!mounted) return;
      plotlyRef.current = mod;
      setPlotlyReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Expose image capture helper for PDF report generation
  useEffect(() => {
    if (!onImageCaptureReady) return;
    onImageCaptureReady(async () => {
      if (!plotlyRef.current || !plotDivRef.current) return null;
      try {
        return await plotlyRef.current.toImage(plotDivRef.current, {
          format: "png",
          width: 900,
          height: 520,
        });
      } catch {
        return null;
      }
    });
  }, [onImageCaptureReady, plotlyReady, spec]);

  // Render normal view
  useEffect(() => {
    const el = plotDivRef.current;
    const Plotly = plotlyRef.current;
    if (!plotlyReady || !Plotly || !el || !spec || spec.data.length === 0) return;

    const plotConfig: Partial<Config> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["sendChartToCloud"],
    };

    Plotly.react(el, spec.data, { ...spec.layout, height }, plotConfig);

    const handleClick = (ev: any) => {
      const pt = ev?.points?.[0];
      if (!pt) return;
      const idx = typeof pt.customdata === "number" ? pt.customdata : null;
      if (idx !== null && rows[idx]) {
        setClickedRecord({ index: idx, row: rows[idx] });
      }
    };

    const gd = el as any;
    if (gd.removeAllListeners) gd.removeAllListeners("plotly_click");
    if (gd.on) gd.on("plotly_click", handleClick);

    return () => {
      if (gd.removeAllListeners) gd.removeAllListeners("plotly_click");
    };
  }, [plotlyReady, spec, height, rows]);

  // Render fullscreen modal view when open
  useEffect(() => {
    const el = fullDivRef.current;
    const Plotly = plotlyRef.current;
    if (!fullscreenOpen || !plotlyReady || !Plotly || !el || !spec || spec.data.length === 0) return;

    const timer = setTimeout(() => {
      Plotly.react(
        el,
        spec.data,
        { ...spec.layout, height: Math.max(540, window.innerHeight - 170) },
        { responsive: true, displaylogo: false }
      );
    }, 80);
    return () => clearTimeout(timer);
  }, [fullscreenOpen, plotlyReady, spec]);

  const handleResetCamera = () => {
    const Plotly = plotlyRef.current;
    if (Plotly && plotDivRef.current && spec?.is3D) {
      Plotly.relayout(plotDivRef.current, { "scene.camera": DEFAULT_CAMERA } as any);
    }
    if (Plotly && fullDivRef.current && fullscreenOpen && spec?.is3D) {
      Plotly.relayout(fullDivRef.current, { "scene.camera": DEFAULT_CAMERA } as any);
    }
  };

  const handleDownloadPng = async () => {
    const Plotly = plotlyRef.current;
    if (!Plotly || !plotDivRef.current) return;
    await Plotly.downloadImage(plotDivRef.current, {
      format: "png",
      width: 1280,
      height: 760,
      filename: `mathoml_eda_${config.chartType}`,
    });
  };

  if (!eligibility.eligible) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-10 text-center space-y-2">
        <AlertCircle className="h-7 w-7 text-zinc-400 mx-auto" />
        <p className="font-semibold text-sm text-zinc-900">Chart unavailable for this dataset</p>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">{eligibility.reason}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Clean Apple Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {spec?.is3D ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-0.5 font-medium border border-zinc-200/70">
              Interactive 3D · Drag to rotate · Scroll to zoom
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-0.5 font-medium border border-zinc-200/70">
              Hover to inspect · Click any point to view record
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {spec?.is3D && (
            <Button size="sm" variant="outline" onClick={handleResetCamera} className="h-8 gap-1.5 rounded-lg border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
              <RotateCcw className="h-3.5 w-3.5" /> Reset Camera
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleDownloadPng} className="h-8 gap-1.5 rounded-lg border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
            <Download className="h-3.5 w-3.5" /> Export PNG
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFullscreenOpen(true)} className="h-8 gap-1.5 rounded-lg border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
            <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
          </Button>
        </div>
      </div>

      {spec?.warning && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{spec.warning}</span>
        </div>
      )}

      {/* Clean White Plot Surface */}
      <div className="rounded-xl border border-zinc-200/70 bg-white overflow-hidden relative" style={{ minHeight: height }}>
        {!plotlyReady && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
            Preparing chart…
          </div>
        )}
        <div ref={plotDivRef} className="w-full" />
      </div>

      {/* Clicked Record Inspector (Notion Card) */}
      {clickedRecord && (
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
              <TableProperties className="h-3.5 w-3.5 text-zinc-500" /> Row #{clickedRecord.index + 1}
            </span>
            <button
              type="button"
              onClick={() => setClickedRecord(null)}
              className="text-zinc-400 hover:text-zinc-800"
              aria-label="Close record preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Object.entries(clickedRecord.row).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-zinc-200/70 bg-white px-2.5 py-1.5 text-xs">
                <span className="block text-[10px] text-zinc-500 truncate">{k}</span>
                <span className="font-mono font-medium text-zinc-900 truncate block">
                  {v === null || v === undefined ? "—" : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-4 sm:p-6 bg-white">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-zinc-200">
            <DialogTitle className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Camera className="h-4 w-4 text-zinc-500" /> Chart Explorer
            </DialogTitle>
            <div className="flex items-center gap-2 pr-6">
              {spec?.is3D && (
                <Button size="sm" variant="outline" onClick={handleResetCamera} className="h-8 gap-1 text-xs rounded-lg border-zinc-200">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset Camera
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setFullscreenOpen(false)} className="h-8 gap-1 text-xs rounded-lg border-zinc-200">
                <Minimize2 className="h-3.5 w-3.5" /> Close
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 w-full bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div ref={fullDivRef} className="w-full h-full" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
