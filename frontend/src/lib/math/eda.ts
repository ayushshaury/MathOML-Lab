/**
 * Exploratory Data Analysis (EDA) Math & Statistics Engine
 * Computes descriptive statistics, distributions, kernel density estimations (KDE),
 * quartiles, IQR outliers, correlations, and data cleaning transformations.
 */

export interface DataColumn {
  name: string;
  type: "numerical" | "categorical";
  rawValues: (number | string | null)[];
  unit?: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  rowCount: number;
  columns: DataColumn[];
}

export interface SummaryStats {
  count: number;
  missingCount: number;
  missingPct: number;
  mean: number;
  median: number;
  mode: number | string;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
  outlierCount: number;
  outlierIndices: number[];
  skewness: number;
  kurtosis: number;
}

export interface KDEPoint {
  x: number;
  density: number;
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  density: number;
}

// ------------------------------------------------------------------
// Realistic Datasets (with real-world messiness: nulls, outliers, skew)
// ------------------------------------------------------------------

export const SAMPLE_DATASETS: Dataset[] = [
  {
    id: "titanic",
    name: "Titanic Passenger Demographics",
    description: "Classic tabular dataset with missing values in Age, heavy right-skewed Fare with extreme outliers, and binary Survival.",
    rowCount: 30,
    columns: [
      {
        name: "Age",
        type: "numerical",
        unit: "years",
        rawValues: [
          22, 38, 26, 35, null, 54, 2, 27, 14, 4, null, 58, 20, 39, 14,
          55, 2, null, 31, null, 35, 34, 15, 28, 8, 38, null, 19, 40, 66
        ],
      },
      {
        name: "Fare",
        type: "numerical",
        unit: "$",
        rawValues: [
          7.25, 71.28, 7.92, 53.1, 8.05, 51.86, 21.07, 11.13, 30.07, 16.7,
          8.05, 26.55, 8.05, 31.27, 7.85, 16.0, 29.12, 13.0, 18.0, 7.22,
          26.0, 13.0, 8.02, 35.5, 31.38, 313.75, 7.89, 263.0, 27.72, 10.5
        ],
      },
      {
        name: "SibSp (Family)",
        type: "numerical",
        unit: "relatives",
        rawValues: [
          1, 1, 0, 1, 0, 0, 3, 0, 0, 1, 0, 0, 0, 1, 0,
          0, 4, 0, 1, 0, 0, 0, 0, 1, 3, 1, 0, 3, 1, 0
        ],
      },
      {
        name: "Pclass (Ticket Class)",
        type: "categorical",
        rawValues: [
          "3rd", "1st", "3rd", "1st", "3rd", "1st", "3rd", "3rd", "2nd", "3rd",
          "3rd", "1st", "3rd", "3rd", "3rd", "2nd", "3rd", "2nd", "3rd", "3rd",
          "2nd", "2nd", "3rd", "1st", "3rd", "1st", "3rd", "1st", "2nd", "3rd"
        ],
      },
      {
        name: "Survived",
        type: "categorical",
        rawValues: [
          "No", "Yes", "Yes", "Yes", "No", "No", "No", "Yes", "Yes", "Yes",
          "No", "Yes", "No", "No", "Yes", "Yes", "No", "Yes", "No", "Yes",
          "No", "Yes", "Yes", "Yes", "No", "Yes", "No", "Yes", "No", "No"
        ],
      },
    ],
  },
  {
    id: "housing",
    name: "Real Estate & Housing Valuation",
    description: "Property appraisal data featuring right-skewed Sale Price with multi-million luxury outliers, missing Lot Frontage, and Over-All Quality scores.",
    rowCount: 28,
    columns: [
      {
        name: "SalePrice",
        type: "numerical",
        unit: "$k",
        rawValues: [
          208, 181, 223, 140, 250, 143, 307, 200, 129, 118,
          129, 345, 144, 279, 157, 132, 149, 90, 159, 139,
          325, 139, 230, 750, 130, 256, 820, 115
        ],
      },
      {
        name: "LotFrontage",
        type: "numerical",
        unit: "ft",
        rawValues: [
          65, 80, 68, 60, 84, 85, null, null, 51, 50,
          70, 85, null, 91, null, 51, 69, 72, 66, 70,
          101, 57, 75, 160, null, 74, 185, 60
        ],
      },
      {
        name: "LivingArea",
        type: "numerical",
        unit: "sq ft",
        rawValues: [
          1710, 1262, 1786, 1717, 2198, 1362, 1694, 2090, 1774, 1077,
          1040, 2324, 912, 1494, 1253, 854, 1004, 1296, 1114, 1339,
          2376, 1108, 1795, 4476, 900, 1600, 4800, 1060
        ],
      },
      {
        name: "OverallQual",
        type: "numerical",
        unit: "/10",
        rawValues: [
          7, 6, 7, 7, 8, 5, 8, 7, 7, 5,
          5, 9, 5, 7, 6, 7, 6, 4, 5, 5,
          8, 6, 8, 10, 5, 8, 10, 5
        ],
      },
      {
        name: "Neighborhood",
        type: "categorical",
        rawValues: [
          "CollgCr", "Veenker", "CollgCr", "Crawfor", "NoRidge", "Mitchel", "Somerst", "NWAmes", "OldTown", "BrkSide",
          "Sawyer", "NridgHt", "Sawyer", "CollgCr", "NAmes", "BrkSide", "CollgCr", "Edwards", "SawyerW", "NAmes",
          "NridgHt", "Edwards", "CollgCr", "NoRidge", "NAmes", "Somerst", "NoRidge", "Edwards"
        ],
      },
    ],
  },
  {
    id: "health",
    name: "Cardiovascular Clinical Diagnostics",
    description: "Medical research sample containing cholesterol outliers, blood pressure readings, age demographics, and heart disease stages.",
    rowCount: 26,
    columns: [
      {
        name: "Cholesterol",
        type: "numerical",
        unit: "mg/dL",
        rawValues: [
          233, 250, 204, 236, 354, 192, 294, 263, 199, 168,
          239, 275, 266, 211, 175, 564, 246, 229, 269, 286,
          220, 258, 282, 610, 212, 180
        ],
      },
      {
        name: "RestingBP",
        type: "numerical",
        unit: "mmHg",
        rawValues: [
          145, 160, 130, 120, 140, 140, 140, 120, 172, 150,
          140, 130, 130, 138, 120, 150, 110, 140, 152, 178,
          125, 140, 130, 200, null, 122
        ],
      },
      {
        name: "MaxHeartRate",
        type: "numerical",
        unit: "bpm",
        rawValues: [
          150, 108, 172, 178, 163, 148, 153, 173, 162, 174,
          180, 139, 171, 144, 158, 160, 157, 178, 158, 112,
          152, 155, 174, 115, 140, 165
        ],
      },
      {
        name: "ChestPainType",
        type: "categorical",
        rawValues: [
          "Typical", "Atypical", "Non-Anginal", "Typical", "Asymptomatic", "Non-Anginal", "Typical", "Atypical", "Typical", "Asymptomatic",
          "Non-Anginal", "Atypical", "Typical", "Asymptomatic", "Non-Anginal", "Typical", "Atypical", "Typical", "Non-Anginal", "Typical",
          "Typical", "Non-Anginal", "Atypical", "Typical", "Asymptomatic", "Typical"
        ],
      },
    ],
  },
];

// ------------------------------------------------------------------
// Statistics & Outliers Computation
// ------------------------------------------------------------------

export function computeSummaryStats(values: (number | null)[]): SummaryStats {
  const missingCount = values.filter((v) => v === null || v === undefined || isNaN(v)).length;
  const valid = values.filter((v): v is number => v !== null && v !== undefined && !isNaN(v)).sort((a, b) => a - b);
  const n = valid.length;

  if (n === 0) {
    return {
      count: 0,
      missingCount,
      missingPct: 100,
      mean: 0,
      median: 0,
      mode: 0,
      stdDev: 0,
      variance: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      lowerBound: 0,
      upperBound: 0,
      outlierCount: 0,
      outlierIndices: [],
      skewness: 0,
      kurtosis: 0,
    };
  }

  const sum = valid.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  // Median (Q2)
  const median = n % 2 === 0 ? (valid[n / 2 - 1] + valid[n / 2]) / 2 : valid[Math.floor(n / 2)];

  // Q1 (25th percentile) and Q3 (75th percentile)
  const q1 = percentile(valid, 0.25);
  const q3 = percentile(valid, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Outlier detection
  const outlierIndices: number[] = [];
  values.forEach((v, idx) => {
    if (v !== null && (v < lowerBound || v > upperBound)) {
      outlierIndices.push(idx);
    }
  });

  // Variance & Standard Deviation (Sample, n - 1)
  const varSum = valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const variance = n > 1 ? varSum / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  // Skewness: Fisher-Pearson standardized moment
  let skewness = 0;
  if (n > 2 && stdDev > 0) {
    const m3 = valid.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 3), 0);
    skewness = (n / ((n - 1) * (n - 2))) * m3;
  }

  // Kurtosis: Excess Kurtosis (Normal distribution = 0)
  let kurtosis = 0;
  if (n > 3 && stdDev > 0) {
    const m4 = valid.reduce((acc, v) => acc + Math.pow((v - mean) / stdDev, 4), 0);
    const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    kurtosis = term1 * m4 - term2;
  }

  // Mode
  const freqMap: Record<number, number> = {};
  let maxFreq = 0;
  let modeVal = valid[0];
  valid.forEach((v) => {
    freqMap[v] = (freqMap[v] || 0) + 1;
    if (freqMap[v] > maxFreq) {
      maxFreq = freqMap[v];
      modeVal = v;
    }
  });

  return {
    count: n,
    missingCount,
    missingPct: (missingCount / values.length) * 100,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    mode: Number(modeVal.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    variance: Number(variance.toFixed(2)),
    min: valid[0],
    max: valid[n - 1],
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number(iqr.toFixed(2)),
    lowerBound: Number(lowerBound.toFixed(2)),
    upperBound: Number(upperBound.toFixed(2)),
    outlierCount: outlierIndices.length,
    outlierIndices,
    skewness: Number(skewness.toFixed(3)),
    kurtosis: Number(kurtosis.toFixed(3)),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];

  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// ------------------------------------------------------------------
// Kernel Density Estimation (KDE) Engine
// ------------------------------------------------------------------

export function computeKDE(
  data: number[],
  bandwidthMultiplier = 1.0,
  resolution = 80
): KDEPoint[] {
  if (data.length === 0) return [];
  const valid = data.filter((v) => !isNaN(v)).sort((a, b) => a - b);
  const n = valid.length;
  if (n === 0) return [];

  const min = valid[0];
  const max = valid[n - 1];

  // Silverman's Rule of Thumb for Gaussian KDE bandwidth
  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n);
  const q1 = percentile(valid, 0.25);
  const q3 = percentile(valid, 0.75);
  const iqr = q3 - q1;
  const sigmaEst = Math.min(std, iqr > 0 ? iqr / 1.34 : std) || std || 1.0;
  const baseBandwidth = 0.9 * sigmaEst * Math.pow(n, -0.2);
  const h = Math.max(0.1, baseBandwidth * bandwidthMultiplier);

  const rangePadding = (max - min) * 0.15 || h * 2;
  const xStart = min - rangePadding;
  const xEnd = max + rangePadding;
  const step = (xEnd - xStart) / (resolution - 1);

  const points: KDEPoint[] = [];
  const invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);

  for (let i = 0; i < resolution; i++) {
    const x = xStart + i * step;
    let sumDensity = 0;

    for (let j = 0; j < n; j++) {
      const u = (x - valid[j]) / h;
      // Gaussian kernel: (1 / sqrt(2pi)) * exp(-0.5 * u^2)
      const kernel = invSqrt2Pi * Math.exp(-0.5 * u * u);
      sumDensity += kernel;
    }

    const density = sumDensity / (n * h);
    points.push({ x: Number(x.toFixed(2)), density: Number(density.toFixed(5)) });
  }

  return points;
}

export interface IndividualKernel {
  center: number;
  points: KDEPoint[];
}

export function computeIndividualKernels(
  data: number[],
  bandwidthMultiplier = 1.0,
  resolution = 60
): {
  h: number;
  kernels: IndividualKernel[];
  aggregate: KDEPoint[];
  maxKernelDensity: number;
} {
  const valid = data.filter((v) => !isNaN(v)).sort((a, b) => a - b);
  const n = valid.length;
  if (n === 0) return { h: 1, kernels: [], aggregate: [], maxKernelDensity: 1 };

  const min = valid[0];
  const max = valid[n - 1];

  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n);
  const q1 = percentile(valid, 0.25);
  const q3 = percentile(valid, 0.75);
  const iqr = q3 - q1;
  const sigmaEst = Math.min(std, iqr > 0 ? iqr / 1.34 : std) || std || 1.0;
  const baseBandwidth = 0.9 * sigmaEst * Math.pow(n, -0.2);
  const h = Math.max(0.1, baseBandwidth * bandwidthMultiplier);

  const rangePadding = (max - min) * 0.15 || h * 2;
  const xStart = min - rangePadding;
  const xEnd = max + rangePadding;
  const step = (xEnd - xStart) / (resolution - 1);

  const invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);
  let maxKernelDensity = 0;

  // Individual Gaussian kernels for each point
  const kernels: IndividualKernel[] = valid.map((center) => {
    const kPoints: KDEPoint[] = [];
    for (let i = 0; i < resolution; i++) {
      const x = xStart + i * step;
      const u = (x - center) / h;
      const k = (invSqrt2Pi * Math.exp(-0.5 * u * u)) / (n * h);
      if (k > maxKernelDensity) maxKernelDensity = k;
      kPoints.push({ x: Number(x.toFixed(2)), density: Number(k.toFixed(5)) });
    }
    return { center, points: kPoints };
  });

  // Aggregate sum curve
  const aggregate: KDEPoint[] = [];
  for (let i = 0; i < resolution; i++) {
    const x = xStart + i * step;
    let sumDensity = 0;
    for (let j = 0; j < n; j++) {
      const u = (x - valid[j]) / h;
      sumDensity += invSqrt2Pi * Math.exp(-0.5 * u * u);
    }
    aggregate.push({ x: Number(x.toFixed(2)), density: Number((sumDensity / (n * h)).toFixed(5)) });
  }

  return { h, kernels, aggregate, maxKernelDensity };
}

// ------------------------------------------------------------------
// Histogram Generator
// ------------------------------------------------------------------

export function computeHistogram(data: number[], numBins = 10): HistogramBin[] {
  const valid = data.filter((v) => !isNaN(v));
  if (valid.length === 0) return [];

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const binWidth = range / numBins;

  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    from: min + i * binWidth,
    to: min + (i + 1) * binWidth,
    count: 0,
    density: 0,
  }));

  valid.forEach((val) => {
    let idx = Math.floor((val - min) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  });

  const total = valid.length;
  bins.forEach((b) => {
    b.density = Number((b.count / (total * binWidth)).toFixed(4));
  });

  return bins;
}

// ------------------------------------------------------------------
// Pearson & Spearman Correlation Engine
// ------------------------------------------------------------------

export function computeCorrelation(
  xVals: (number | null)[],
  yVals: (number | null)[]
): { r: number; r2: number; slope: number; intercept: number; n: number } {
  const paired: [number, number][] = [];
  for (let i = 0; i < Math.min(xVals.length, yVals.length); i++) {
    const x = xVals[i];
    const y = yVals[i];
    if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
      paired.push([x, y]);
    }
  }

  const n = paired.length;
  if (n < 2) return { r: 0, r2: 0, slope: 0, intercept: 0, n: 0 };

  const xMean = paired.reduce((s, p) => s + p[0], 0) / n;
  const yMean = paired.reduce((s, p) => s + p[1], 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  paired.forEach(([x, y]) => {
    const dx = x - xMean;
    const dy = y - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  });

  const denom = Math.sqrt(denX * denY);
  const r = denom === 0 ? 0 : num / denom;
  const r2 = r * r;
  const slope = denX === 0 ? 0 : num / denX;
  const intercept = yMean - slope * xMean;

  return {
    r: Number(r.toFixed(3)),
    r2: Number(r2.toFixed(3)),
    slope: Number(slope.toFixed(3)),
    intercept: Number(intercept.toFixed(3)),
    n,
  };
}

// ------------------------------------------------------------------
// Interactive Data Cleaner / Transformer
// ------------------------------------------------------------------

export type ImputeMethod = "none" | "mean" | "median" | "mode" | "drop";
export type OutlierTreatment = "none" | "cap_iqr" | "trim" | "log";
export type ScalingMethod = "none" | "standard" | "minmax" | "robust";

export function cleanDataColumn(
  raw: (number | null)[],
  impute: ImputeMethod,
  outlier: OutlierTreatment,
  scale: ScalingMethod
): {
  cleaned: number[];
  stats: SummaryStats;
  imputedCount: number;
  outliersTreatedCount: number;
} {
  const originalStats = computeSummaryStats(raw);
  let values: number[] = [];
  let imputedCount = 0;

  // 1. Missing Value Imputation
  if (impute === "drop") {
    values = raw.filter((v): v is number => v !== null && !isNaN(v));
  } else if (impute === "mean") {
    values = raw.map((v) => {
      if (v === null || isNaN(v)) {
        imputedCount++;
        return originalStats.mean;
      }
      return v;
    });
  } else if (impute === "median") {
    values = raw.map((v) => {
      if (v === null || isNaN(v)) {
        imputedCount++;
        return originalStats.median;
      }
      return v;
    });
  } else if (impute === "mode") {
    const modeNum = Number(originalStats.mode);
    values = raw.map((v) => {
      if (v === null || isNaN(v)) {
        imputedCount++;
        return modeNum;
      }
      return v;
    });
  } else {
    // None: keep valid numbers only for downstream math
    values = raw.filter((v): v is number => v !== null && !isNaN(v));
  }

  // 2. Outlier Treatment
  let outliersTreatedCount = 0;
  const lowerBound = originalStats.lowerBound;
  const upperBound = originalStats.upperBound;

  if (outlier === "cap_iqr") {
    values = values.map((v) => {
      if (v < lowerBound) {
        outliersTreatedCount++;
        return lowerBound;
      }
      if (v > upperBound) {
        outliersTreatedCount++;
        return upperBound;
      }
      return v;
    });
  } else if (outlier === "trim") {
    const beforeLen = values.length;
    values = values.filter((v) => v >= lowerBound && v <= upperBound);
    outliersTreatedCount = beforeLen - values.length;
  } else if (outlier === "log") {
    // Log transform: log(1 + x) (requires x >= 0)
    const minVal = Math.min(...values);
    const shift = minVal < 0 ? Math.abs(minVal) + 1 : 1;
    values = values.map((v) => Number(Math.log(v + shift).toFixed(3)));
  }

  // 3. Scaling
  if (scale === "standard") {
    const s = computeSummaryStats(values);
    if (s.stdDev > 0) {
      values = values.map((v) => Number(((v - s.mean) / s.stdDev).toFixed(3)));
    }
  } else if (scale === "minmax") {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    values = values.map((v) => Number(((v - min) / range).toFixed(3)));
  } else if (scale === "robust") {
    const s = computeSummaryStats(values);
    const iqr = s.iqr || 1;
    values = values.map((v) => Number(((v - s.median) / iqr).toFixed(3)));
  }

  const finalStats = computeSummaryStats(values);
  return {
    cleaned: values,
    stats: finalStats,
    imputedCount,
    outliersTreatedCount,
  };
}
