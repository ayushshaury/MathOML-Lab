import type { Data, Layout } from "plotly.js-dist-min";
import {
  exportDatasetToCsv,
  parseNumericToken,
  sampleRowsForCharts,
  type DataInsight,
  type DataRow,
  type DatasetProfile,
} from "./eda-engine";
import type { PlotlyChartConfig } from "@/components/tools/PlotlyEDAChart";

export interface PdfReportParams {
  profile: DatasetProfile;
  insights: DataInsight[];
  rows: DataRow[];
  headers: string[];
  config: PlotlyChartConfig;
  historyLog: { timestamp: string; action: string }[];
  activeChartImage?: string | null;
}

export function triggerCsvDownload(headers: string[], rows: DataRow[], datasetName: string): void {
  const csvContent = exportDatasetToCsv(headers, rows);
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = datasetName.replace(/[^a-z0-9_-]/gi, "_") || "processed_dataset";
  link.href = url;
  link.download = `${safeName}_cleaned.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function renderOffscreenChartPng(
  Plotly: typeof import("plotly.js-dist-min"),
  data: Data[],
  layout: Partial<Layout>,
  width = 860,
  height = 440
): Promise<string | null> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  try {
    await Plotly.newPlot(container, data, {
      ...layout,
      width,
      height,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#f8fafc",
      font: { family: "Inter, Arial, sans-serif", size: 12, color: "#0f172a" },
    });
    await new Promise((r) => setTimeout(r, 150));
    return await Plotly.toImage(container, { format: "png", width, height });
  } catch {
    return null;
  } finally {
    try {
      Plotly.purge(container);
    } catch {}
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

export async function generateEdaPdfReport(params: PdfReportParams): Promise<void> {
  const { profile, insights, rows, config, historyLog, activeChartImage } = params;
  const [{ jsPDF }, { default: autoTable }, Plotly] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("plotly.js-dist-min"),
  ]);

  const { sampledRows } = sampleRowsForCharts(rows, 2500);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 44;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 45) {
      doc.addPage();
      y = 44;
    }
  };

  const addSectionHeader = (num: number, title: string) => {
    ensureSpace(45);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(6, 95, 70);
    doc.text(`${num}. ${title}`, margin + 10, y + 16);
    doc.setTextColor(15, 23, 42);
    y += 32;
  };

  const addWrappedText = (text: string, fontSize = 9.5, color: [number, number, number] = [51, 65, 85]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    ensureSpace(lines.length * (fontSize + 3) + 8);
    doc.text(lines, margin, y);
    y += lines.length * (fontSize + 3) + 6;
  };

  const getTableFinalY = () => ((doc as any).lastAutoTable?.finalY ?? y) + 14;

  // Title Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 82, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("MathOML Automated EDA & Data Insights Report", margin, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(167, 243, 208);
  doc.text(`Dataset: ${profile.name}   |   Generated: ${new Date().toLocaleString()}`, margin, 58);
  y = 104;

  // 1. Dataset Overview
  addSectionHeader(1, "Dataset Overview");
  addWrappedText(`Inferred Domain: ${profile.inferredDomain}`);
  addWrappedText(profile.domainExplanation);

  // 2. Dataset Dimensions
  addSectionHeader(2, "Dataset Dimensions & Resource Footprint");
  autoTable(doc, {
    startY: y,
    head: [["Rows", "Columns", "Memory Usage", "Missing Cells", "Missing %", "Duplicate Rows", "Duplicate %"]],
    body: [
      [
        profile.rowCount.toLocaleString(),
        profile.columnCount,
        profile.memoryFormatted,
        profile.totalMissingCells.toLocaleString(),
        `${profile.totalMissingPct}%`,
        profile.duplicateRowCount.toLocaleString(),
        `${profile.duplicateRowPct}%`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [5, 150, 105], fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });
  y = getTableFinalY();

  // 3. Column Information & 4. Data Types Breakdown
  addSectionHeader(3, "Column Information & Schema");
  autoTable(doc, {
    startY: y,
    head: [["Column", "Semantic Type", "Raw Storage", "Non-Null", "Unique", "Flags"]],
    body: profile.columns.map((c) => {
      const flags = [c.isConstant ? "Constant" : "", c.isPotentialId ? "ID Candidate" : ""].filter(Boolean).join(", ") || "Valid Feature";
      return [c.name, c.type, c.rawTypeInfo, c.count, `${c.uniqueCount} (${c.uniquePct}%)`, flags];
    }),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
    styles: { fontSize: 7.8, cellPadding: 3.5 },
    margin: { left: margin, right: margin },
  });
  y = getTableFinalY();

  addSectionHeader(4, "Data Types Distribution");
  autoTable(doc, {
    startY: y,
    head: [["Numerical", "Categorical", "Boolean", "Datetime", "Constant", "ID Candidates"]],
    body: [
      [
        profile.numericalColumns.length,
        profile.categoricalColumns.length,
        profile.booleanColumns.length,
        profile.datetimeColumns.length,
        profile.constantColumns.length,
        profile.potentialIdColumns.length,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [2, 132, 199], fontSize: 8.5 },
    styles: { fontSize: 8.5, halign: "center" },
    margin: { left: margin, right: margin },
  });
  y = getTableFinalY();

  // 5. Missing-Value Analysis & 6. Duplicate Analysis
  addSectionHeader(5, "Missing-Value Analysis");
  const missingCols = profile.columns.filter((c) => c.missingCount > 0);
  if (missingCols.length === 0) {
    addWrappedText("Dataset has 100% completeness (zero missing/null entries detected in any column).");
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Column", "Missing Count", "Missing %", "Recommended Imputation"]],
      body: missingCols.map((c) => [
        c.name,
        c.missingCount,
        `${c.missingPct}%`,
        c.type === "numerical"
          ? c.numStats && Math.abs(c.numStats.skewness) >= 0.8
            ? "Median (Skewed)"
            : "Mean / Median"
          : "Mode / Missing Token",
      ]),
      theme: "grid",
      headStyles: { fillColor: [217, 119, 6], fontSize: 8.5 },
      styles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
    y = getTableFinalY();
  }

  addSectionHeader(6, "Duplicate Analysis");
  addWrappedText(
    profile.duplicateRowCount > 0
      ? `Detected ${profile.duplicateRowCount} exact duplicate rows (${profile.duplicateRowPct}% of total rows). Deduplication is available in the Data Cleaning panel.`
      : "No exact duplicate records detected across the working dataset (0% duplication)."
  );

  // 7. Statistical Summaries (Numerical)
  addSectionHeader(7, "Statistical Summaries (Numerical Columns)");
  const numCols = profile.columns.filter((c) => c.type === "numerical" && c.numStats);
  if (numCols.length === 0) {
    addWrappedText("No numerical columns present in this dataset.");
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Feature", "Mean", "Median", "StdDev", "Min", "Q1", "Q3", "Max", "IQR", "Skew", "Kurtosis"]],
      body: numCols.map((c) => {
        const s = c.numStats!;
        return [c.name, s.mean, s.median, s.stdDev, s.min, s.q1, s.q3, s.max, s.iqr, s.skewness, s.kurtosis];
      }),
      theme: "striped",
      headStyles: { fillColor: [5, 150, 105], fontSize: 7.5 },
      styles: { fontSize: 7, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });
    y = getTableFinalY();
  }

  // 8. Numerical Distributions (Rendered Plotly Chart)
  addSectionHeader(8, "Numerical Distributions");
  const primaryNum = numCols.find((c) => !c.isPotentialId)?.name || profile.numericalColumns[0];
  if (primaryNum) {
    const vals = sampledRows.map((r) => parseNumericToken(r[primaryNum])).filter((v): v is number => v !== null);
    const numImg = await renderOffscreenChartPng(
      Plotly,
      [
        { type: "histogram", x: vals, nbinsx: config.bins || 15, name: primaryNum, marker: { color: "#059669" } },
      ],
      {
        title: { text: `Distribution Histogram: ${primaryNum}` },
        xaxis: { title: { text: primaryNum } },
        yaxis: { title: { text: "Frequency" } },
        margin: { l: 55, r: 25, t: 45, b: 45 },
      }
    );
    if (numImg) {
      ensureSpace(235);
      doc.addImage(numImg, "PNG", margin, y, pageWidth - margin * 2, 220);
      y += 230;
    }
  } else {
    addWrappedText("No numerical features available for distribution histogram.");
  }

  // 9. Categorical Distributions
  addSectionHeader(9, "Categorical Distributions");
  const catCols = profile.columns.filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats && !c.isPotentialId);
  if (catCols.length === 0) {
    addWrappedText("No non-ID categorical columns present in this dataset.");
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Column", "Unique Classes", "Top Value", "Top Count", "Top %", "Top Breakdown"]],
      body: catCols.map((c) => [
        c.name,
        c.uniqueCount,
        c.catStats!.topValue ?? "-",
        c.catStats!.topCount,
        `${c.catStats!.topPct}%`,
        c.catStats!.frequencies
          .slice(0, 3)
          .map((f) => `${f.value} (${f.pct}%)`)
          .join(", "),
      ]),
      theme: "grid",
      headStyles: { fillColor: [124, 58, 237], fontSize: 8 },
      styles: { fontSize: 7.5 },
      margin: { left: margin, right: margin },
    });
    y = getTableFinalY();

    const firstCat = catCols[0];
    if (firstCat.catStats && firstCat.catStats.frequencies.length > 0) {
      const freqs = firstCat.catStats.frequencies.slice(0, 10);
      const catImg = await renderOffscreenChartPng(
        Plotly,
        [
          {
            type: "bar",
            x: freqs.map((f) => f.value),
            y: freqs.map((f) => f.count),
            marker: { color: "#7c3aed" },
          },
        ],
        {
          title: { text: `Top Categories: ${firstCat.name}` },
          xaxis: { title: { text: firstCat.name } },
          yaxis: { title: { text: "Count" } },
          margin: { l: 55, r: 25, t: 45, b: 60 },
        }
      );
      if (catImg) {
        ensureSpace(225);
        doc.addImage(catImg, "PNG", margin, y, pageWidth - margin * 2, 210);
        y += 220;
      }
    }
  }

  // 10. Correlation Analysis
  addSectionHeader(10, "Correlation Analysis (Pearson & Spearman)");
  if (profile.correlations.strongestPairs.length === 0) {
    addWrappedText("At least 2 numerical columns are required for bivariate correlation matrices.");
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Feature A", "Feature B", "Pearson r", "Spearman rho", "Valid Pairs (n)"]],
      body: profile.correlations.strongestPairs.slice(0, 10).map((p) => [p.colA, p.colB, p.pearson, p.spearman, p.n]),
      theme: "striped",
      headStyles: { fillColor: [2, 132, 199], fontSize: 8 },
      styles: { fontSize: 7.8 },
      margin: { left: margin, right: margin },
    });
    y = getTableFinalY();

    const mat = config.corrMethod === "spearman" ? profile.correlations.spearmanMatrix : profile.correlations.pearsonMatrix;
    const cols = profile.correlations.columns;
    if (cols.length >= 2) {
      const heatImg = await renderOffscreenChartPng(
        Plotly,
        [
          {
            type: "heatmap",
            z: mat,
            x: cols,
            y: cols,
            zmin: -1,
            zmax: 1,
            colorscale: "RdBu",
            reversescale: true,
          },
        ],
        {
          title: { text: `${config.corrMethod === "spearman" ? "Spearman" : "Pearson"} Correlation Heatmap` },
          margin: { l: 95, r: 30, t: 45, b: 85 },
          yaxis: { autorange: "reversed" },
        }
      );
      if (heatImg) {
        ensureSpace(235);
        doc.addImage(heatImg, "PNG", margin, y, pageWidth - margin * 2, 220);
        y += 230;
      }
    }
  }

  // 11. Outlier Analysis
  addSectionHeader(11, "Outlier Analysis (Tukey 1.5×IQR & Z-Score)");
  if (numCols.length === 0) {
    addWrappedText("No numerical columns available for outlier boundary checks.");
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Feature", "Lower Fence", "Upper Fence", "IQR Outliers", "|Z| > 3 Outliers", "Min / Max"]],
      body: numCols.map((c) => {
        const s = c.numStats!;
        return [c.name, s.lowerFence, s.upperFence, s.iqrOutlierCount, s.zScoreOutlierCount, `${s.min} / ${s.max}`];
      }),
      theme: "grid",
      headStyles: { fillColor: [225, 29, 72], fontSize: 8 },
      styles: { fontSize: 7.8 },
      margin: { left: margin, right: margin },
    });
    y = getTableFinalY();
  }

  // 12. Automatically Generated Insights
  addSectionHeader(12, "Automatically Generated Data Insights");
  autoTable(doc, {
    startY: y,
    head: [["Severity", "Insight", "Statistical Evidence & Explanation"]],
    body: insights.map((ins) => [ins.severity.toUpperCase(), ins.title, `${ins.explanation}\nEvidence: ${ins.evidence}`]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
    styles: { fontSize: 7.6, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 145 } },
    margin: { left: margin, right: margin },
  });
  y = getTableFinalY();

  // 13. Relevant 2D Visualizations
  addSectionHeader(13, "Relevant 2D Visualizations (Current Configuration)");
  if (activeChartImage) {
    addWrappedText(
      `Active Workspace Chart: ${config.chartType.toUpperCase()} (X: ${config.xCol || "-"}, Y: ${config.yCol || "-"}, Color: ${config.colorCol || "None"})`
    );
    ensureSpace(240);
    doc.addImage(activeChartImage, "PNG", margin, y, pageWidth - margin * 2, 225);
    y += 235;
  } else {
    addWrappedText("Refer to numerical/categorical distributions and correlation heatmap captured above.");
  }

  // 14. Relevant 3D Visualizations where suitable
  addSectionHeader(14, "Relevant 3D Visualizations");
  if (!profile.chartEligibility.has3DScatter) {
    addWrappedText(
      "3D visualization omitted: dataset has fewer than 3 numerical columns. No synthetic 3D dimensions were fabricated."
    );
  } else {
    const nonIdNums = profile.numericalColumns.filter((c) => !profile.potentialIdColumns.includes(c));
    const axes = nonIdNums.length >= 3 ? nonIdNums : profile.numericalColumns;
    const xC = config.xCol && axes.includes(config.xCol) ? config.xCol : axes[0];
    const yC = config.yCol && axes.includes(config.yCol) && config.yCol !== xC ? config.yCol : axes[1];
    const zC = config.zCol && axes.includes(config.zCol) && config.zCol !== xC && config.zCol !== yC ? config.zCol : axes[2];

    const valid3d = sampledRows.filter(
      (r) => parseNumericToken(r[xC]) !== null && parseNumericToken(r[yC]) !== null && parseNumericToken(r[zC]) !== null
    );
    if (valid3d.length > 0) {
      const img3d = await renderOffscreenChartPng(
        Plotly,
        [
          {
            type: "scatter3d",
            mode: "markers",
            x: valid3d.map((r) => parseNumericToken(r[xC])!),
            y: valid3d.map((r) => parseNumericToken(r[yC])!),
            z: valid3d.map((r) => parseNumericToken(r[zC])!),
            marker: {
              size: 4.5,
              color: valid3d.map((r) => parseNumericToken(r[zC])!),
              colorscale: config.colorScale || "Viridis",
              opacity: 0.85,
            },
          },
        ],
        {
          title: { text: `3D Feature Space: ${xC} × ${yC} × ${zC}` },
          scene: {
            xaxis: { title: { text: xC } },
            yaxis: { title: { text: yC } },
            zaxis: { title: { text: zC } },
          },
          margin: { l: 10, r: 10, t: 45, b: 10 },
        }
      );
      if (img3d) {
        ensureSpace(240);
        doc.addImage(img3d, "PNG", margin, y, pageWidth - margin * 2, 225);
        y += 235;
      }
    }
  }

  // 15. Applied Transformations
  addSectionHeader(15, "Applied Data Cleaning & Transformation History");
  if (historyLog.length === 0) {
    addWrappedText("No transformations applied; report reflects the original loaded dataset.");
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Step", "Timestamp", "Operation Description"]],
      body: historyLog.map((h, i) => [i + 1, new Date(h.timestamp).toLocaleTimeString(), h.action]),
      theme: "grid",
      headStyles: { fillColor: [5, 150, 105], fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    });
    y = getTableFinalY();
  }

  // 16. Final Analysis Summary
  addSectionHeader(16, "Final Analysis Summary & Recommendations");
  const totalOutliers = numCols.reduce((s, c) => s + (c.numStats?.iqrOutlierCount || 0), 0);
  const summaryLines = [
    `• Final Working Dimensions: ${profile.rowCount.toLocaleString()} rows × ${profile.columnCount} columns (${profile.memoryFormatted}).`,
    `• Overall Completeness: ${(100 - profile.totalMissingPct).toFixed(2)}% (${profile.totalMissingCells} missing values remaining; ${profile.duplicateRowCount} duplicate rows).`,
    `• Total IQR Outliers across numerical features: ${totalOutliers}.`,
    `• 3D EDA Capabilities: ${
      profile.chartEligibility.has3DVector
        ? "Full Vector/Volume/Scatter 3D enabled"
        : profile.chartEligibility.has3DScatter
        ? "3D Scatter, Bubble, Mesh & Surface enabled"
        : "2D EDA active (<3 numeric columns)"
    }.`,
    `• Transformations Logged: ${historyLog.length} operation(s) recorded in working history.`,
  ];
  addWrappedText(summaryLines.join("\n"), 9.5, [15, 23, 42]);

  const safeName = profile.name.replace(/[^a-z0-9_-]/gi, "_") || "eda_report";
  doc.save(`${safeName}_MathOML_EDA_Report.pdf`);
}
