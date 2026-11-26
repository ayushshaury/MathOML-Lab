import Papa from "papaparse";
import { SAMPLE_DATASETS } from "./eda";

export const EDA_LIMITS = {
  MAX_FILE_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_ROWS: 100_000,
  MAX_COLS: 100,
  CHART_SAMPLE_LIMIT: 4000,
};

export type ColumnSemanticType = "numerical" | "categorical" | "boolean" | "datetime";
export type PrimitiveCell = string | number | boolean | null;
export type DataRow = Record<string, PrimitiveCell>;

export interface NumericalStats {
  mean: number;
  median: number;
  mode: number | null;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  iqrOutlierCount: number;
  zScoreOutlierCount: number;
  skewness: number;
  kurtosis: number;
}

export interface CategoricalFrequency {
  value: string;
  count: number;
  pct: number;
}

export interface CategoricalStats {
  topValue: string | null;
  topCount: number;
  topPct: number;
  frequencies: CategoricalFrequency[];
}

export interface ColumnProfile {
  name: string;
  type: ColumnSemanticType;
  rawTypeInfo: string;
  isConstant: boolean;
  isPotentialId: boolean;
  count: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  uniquePct: number;
  memoryBytes: number;
  numStats?: NumericalStats;
  catStats?: CategoricalStats;
}

export interface CorrelationPair {
  colA: string;
  colB: string;
  pearson: number;
  spearman: number;
  n: number;
}

export interface CorrelationSummary {
  columns: string[];
  pearsonMatrix: number[][];
  spearmanMatrix: number[][];
  strongestPairs: CorrelationPair[];
}

export interface DataInsight {
  id: string;
  category:
    | "distribution"
    | "correlation"
    | "missing"
    | "outliers"
    | "imbalance"
    | "quality"
    | "comparison"
    | "structure";
  severity: "info" | "warning" | "critical" | "positive";
  title: string;
  explanation: string;
  evidence: string;
  columns?: string[];
}

export interface DatasetProfile {
  name: string;
  rowCount: number;
  columnCount: number;
  memoryBytes: number;
  memoryFormatted: string;
  totalMissingCells: number;
  totalMissingPct: number;
  duplicateRowCount: number;
  duplicateRowPct: number;
  numericalColumns: string[];
  categoricalColumns: string[];
  booleanColumns: string[];
  datetimeColumns: string[];
  constantColumns: string[];
  potentialIdColumns: string[];
  inferredDomain: string;
  domainExplanation: string;
  columns: ColumnProfile[];
  correlations: CorrelationSummary;
  chartEligibility: {
    has2DNumeric: boolean;
    has3DScatter: boolean;
    has3DBubble: boolean;
    has3DSurface: boolean;
    has3DVolume: boolean;
    has3DVector: boolean;
    hasCategorical: boolean;
    hasDatetime: boolean;
    hasHierarchical: boolean;
  };
}

export interface ParsedDataset {
  id: string;
  name: string;
  description?: string;
  headers: string[];
  rows: DataRow[];
  warnings: string[];
  source: "sample" | "csv";
}

// ============================================================================
// Constants & Helpers
// ============================================================================

const MISSING_TOKENS = new Set(["", "na", "n/a", "null", "none", "nan", "undefined", "-", "?"]);
const BOOLEAN_TRUE = new Set(["true", "yes", "y", "t"]);
const BOOLEAN_FALSE = new Set(["false", "no", "n", "f"]);

export function roundNum(val: number, decimals = 4): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isMissingRaw(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "number") return !Number.isFinite(val);
  if (typeof val === "string") return MISSING_TOKENS.has(val.trim().toLowerCase());
  return false;
}

export function parseNumericToken(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s || MISSING_TOKENS.has(s.toLowerCase())) return null;
  const stripped = s.replace(/^[$€£¥]/, "").replace(/%$/, "").replace(/,(?=\d{3}(\D|$))/g, "").trim();
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(stripped)) return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

function isLikelyDateString(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 6 || trimmed.length > 40) return false;
  if (!/[-/:]/.test(trimmed)) return false;
  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(trimmed)) {
    return false;
  }
  return !Number.isNaN(Date.parse(trimmed));
}

function looksLikeDataValueNotHeader(token: string): boolean {
  const t = token.trim();
  if (!t) return true;
  if (parseNumericToken(t) !== null) return true;
  if (isLikelyDateString(t)) return true;
  return false;
}

function inferColumnTypeFromStrings(values: string[]): ColumnSemanticType {
  const nonEmpty = values.filter((v) => !isMissingRaw(v));
  if (nonEmpty.length === 0) return "categorical";

  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;

  for (const val of nonEmpty) {
    const low = val.toLowerCase();
    if (BOOLEAN_TRUE.has(low) || BOOLEAN_FALSE.has(low)) {
      boolCount++;
      continue;
    }
    if (parseNumericToken(val) !== null) {
      numCount++;
      continue;
    }
    if (isLikelyDateString(val)) {
      dateCount++;
    }
  }

  const n = nonEmpty.length;
  if (boolCount / n >= 0.9) return "boolean";
  if (numCount / n >= 0.85) return "numerical";
  if (dateCount / n >= 0.85) return "datetime";
  return "categorical";
}

// ============================================================================
// Sample Datasets Conversion & 3D Physics Field Sample
// ============================================================================

function buildScientificFieldDataset(): ParsedDataset {
  const headers = ["X", "Y", "Z", "U_vel", "V_vel", "W_vel", "FieldPotential", "Zone"];
  const rows: DataRow[] = [];
  const coords = [-2, -1, 0, 1, 2];
  for (const x of coords) {
    for (const y of coords) {
      for (const z of [-1, 0, 1]) {
        const r2 = x * x + y * y + z * z + 0.5;
        const u = roundNum(-y / r2 + 0.25 * x, 3);
        const v = roundNum(x / r2 + 0.25 * y, 3);
        const w = roundNum(0.4 * Math.sin(x) * Math.cos(y) + 0.15 * z, 3);
        const potential = roundNum(Math.exp(-0.25 * (x * x + y * y)) * (2 - z * 0.5), 4);
        const zone = z > 0 ? "UpperLayer" : z === 0 ? "MidPlane" : "LowerLayer";
        rows.push({
          X: x,
          Y: y,
          Z: z,
          U_vel: u,
          V_vel: v,
          W_vel: w,
          FieldPotential: potential,
          Zone: zone,
        });
      }
    }
  }
  return {
    id: "fluid-field-3d",
    name: "3D Vortex & Potential Field",
    description:
      "Structured 3D spatial lattice (X, Y, Z) with scalar potential and 3D velocity vector components (U, V, W) enabling Volume, Isosurface, Cone, and Streamtube plots.",
    headers,
    rows,
    warnings: [],
    source: "sample",
  };
}

export function getTabularSampleDatasets(): ParsedDataset[] {
  const converted: ParsedDataset[] = SAMPLE_DATASETS.map((ds) => {
    const headers = ds.columns.map((c) => c.name);
    const rows: DataRow[] = [];
    for (let i = 0; i < ds.rowCount; i++) {
      const r: DataRow = {};
      ds.columns.forEach((col) => {
        r[col.name] = i < col.rawValues.length ? col.rawValues[i] : null;
      });
      rows.push(r);
    }
    return {
      id: ds.id,
      name: ds.name,
      description: ds.description,
      headers,
      rows,
      warnings: [],
      source: "sample",
    };
  });
  converted.push(buildScientificFieldDataset());
  return converted;
}

// ============================================================================
// CSV Parser
// ============================================================================

export function parseCsvText(rawInput: string, fileName = "uploaded_dataset.csv"): ParsedDataset {
  if (!rawInput || typeof rawInput !== "string") {
    throw new Error("Empty or unreadable CSV content.");
  }

  let content = rawInput;
  const warnings: string[] = [];

  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const replacementMatches = content.match(/\uFFFD/g);
  if (replacementMatches && replacementMatches.length > 10) {
    warnings.push(
      `Detected ${replacementMatches.length} encoding replacement characters; check whether the file uses UTF-8 encoding.`
    );
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("The uploaded CSV file is empty.");
  }

  const result = Papa.parse<string[]>(trimmed, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  if (result.errors && result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type === "Delimiter" || e.type === "Quotes");
    if (fatal && result.data.length === 0) {
      throw new Error(`Invalid CSV format near row ${fatal.row ?? 0}: ${fatal.message}`);
    }
    warnings.push(`Parser noticed ${result.errors.length} formatting irregularity(ies): ${result.errors[0].message}`);
  }

  const rawMatrix = result.data.filter((row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim() !== ""));
  if (rawMatrix.length === 0) {
    throw new Error("No valid rows found in CSV file.");
  }

  const maxColsInRows = rawMatrix.reduce((mx, r) => Math.max(mx, r.length), 0);
  if (maxColsInRows === 0) {
    throw new Error("CSV contains zero columns.");
  }
  if (maxColsInRows > EDA_LIMITS.MAX_COLS) {
    throw new Error(`CSV has ${maxColsInRows} columns, exceeding maximum allowed limit of ${EDA_LIMITS.MAX_COLS}.`);
  }
  if (rawMatrix.length - 1 > EDA_LIMITS.MAX_ROWS) {
    throw new Error(`CSV exceeds the maximum limit of ${EDA_LIMITS.MAX_ROWS.toLocaleString()} rows.`);
  }

  const firstRow = rawMatrix[0].map((c) => String(c ?? "").trim());
  const nonEmptyHeaderCount = firstRow.filter((h) => h.length > 0).length;
  const numericHeaderCount = firstRow.filter((h) => looksLikeDataValueNotHeader(h)).length;

  let headers: string[];
  let dataStartRow = 1;

  if (nonEmptyHeaderCount === 0 || (firstRow.length > 1 && numericHeaderCount >= Math.ceil(firstRow.length * 0.7))) {
    headers = Array.from({ length: maxColsInRows }, (_, i) => `Column_${i + 1}`);
    dataStartRow = 0;
    warnings.push("Missing header row detected; generated Column_1..Column_N headers automatically.");
  } else {
    const seen = new Map<string, number>();
    headers = Array.from({ length: maxColsInRows }, (_, i) => {
      let base = (firstRow[i] || `Column_${i + 1}`).replace(/[\r\n]+/g, " ").trim();
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      if (count > 0) {
        base = `${base}_${count + 1}`;
        warnings.push(`Duplicate header renamed to "${base}".`);
      }
      return base;
    });
  }

  const dataRowsRaw = rawMatrix.slice(dataStartRow);
  if (dataRowsRaw.length === 0) {
    throw new Error("CSV contains headers only and zero data records.");
  }

  const colRawValues: string[][] = headers.map((_, colIdx) =>
    dataRowsRaw.map((r) => (colIdx < r.length && r[colIdx] !== undefined ? String(r[colIdx]).trim() : ""))
  );
  const colKinds: ColumnSemanticType[] = colRawValues.map((vals) => inferColumnTypeFromStrings(vals));

  const rows: DataRow[] = dataRowsRaw.map((rawRow) => {
    const rowObj: DataRow = {};
    headers.forEach((h, idx) => {
      const cellStr = idx < rawRow.length && rawRow[idx] !== undefined ? String(rawRow[idx]).trim() : "";
      if (isMissingRaw(cellStr)) {
        rowObj[h] = null;
        return;
      }
      const kind = colKinds[idx];
      if (kind === "numerical") {
        const parsed = parseNumericToken(cellStr);
        rowObj[h] = parsed !== null ? parsed : null;
      } else if (kind === "boolean") {
        const low = cellStr.toLowerCase();
        if (BOOLEAN_TRUE.has(low) || low === "1") rowObj[h] = true;
        else if (BOOLEAN_FALSE.has(low) || low === "0") rowObj[h] = false;
        else rowObj[h] = cellStr;
      } else {
        rowObj[h] = cellStr;
      }
    });
    return rowObj;
  });

  return {
    id: `csv_${Date.now()}`,
    name: fileName.replace(/\.(csv|tsv|txt)$/i, "") || "Uploaded Dataset",
    headers,
    rows,
    warnings,
    source: "csv",
  };
}

// ============================================================================
// Statistical Computations
// ============================================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  const weight = index - lo;
  return lo === hi ? sorted[lo] : sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function computeNumericalStats(values: PrimitiveCell[]): NumericalStats | undefined {
  const nums = values
    .map((v) => (typeof v === "number" ? v : parseNumericToken(v)))
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);

  const n = nums.length;
  if (n === 0) return undefined;

  const min = nums[0];
  const max = nums[n - 1];
  const mean = nums.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 === 0 ? (nums[n / 2 - 1] + nums[n / 2]) / 2 : nums[Math.floor(n / 2)];
  const q1 = percentile(nums, 0.25);
  const q3 = percentile(nums, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const varSum = nums.reduce((s, x) => s + Math.pow(x - mean, 2), 0);
  const variance = n > 1 ? varSum / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  const iqrOutlierCount = nums.filter((v) => v < lowerFence || v > upperFence).length;
  const zScoreOutlierCount = stdDev > 0 ? nums.filter((v) => Math.abs((v - mean) / stdDev) > 3).length : 0;

  let skewness = 0;
  if (n > 2 && stdDev > 0) {
    const m3 = nums.reduce((s, x) => s + Math.pow((x - mean) / stdDev, 3), 0);
    skewness = (n / ((n - 1) * (n - 2))) * m3;
  }

  let kurtosis = 0;
  if (n > 3 && stdDev > 0) {
    const m4 = nums.reduce((s, x) => s + Math.pow((x - mean) / stdDev, 4), 0);
    const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const term2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    kurtosis = term1 * m4 - term2;
  }

  const freq = new Map<number, number>();
  let modeVal: number | null = nums[0];
  let maxFreq = 0;
  for (const x of nums) {
    const c = (freq.get(x) || 0) + 1;
    freq.set(x, c);
    if (c > maxFreq) {
      maxFreq = c;
      modeVal = x;
    }
  }

  return {
    mean: roundNum(mean, 4),
    median: roundNum(median, 4),
    mode: modeVal !== null ? roundNum(modeVal, 4) : null,
    variance: roundNum(variance, 4),
    stdDev: roundNum(stdDev, 4),
    min: roundNum(min, 4),
    max: roundNum(max, 4),
    q1: roundNum(q1, 4),
    q3: roundNum(q3, 4),
    iqr: roundNum(iqr, 4),
    lowerFence: roundNum(lowerFence, 4),
    upperFence: roundNum(upperFence, 4),
    iqrOutlierCount,
    zScoreOutlierCount,
    skewness: roundNum(skewness, 3),
    kurtosis: roundNum(kurtosis, 3),
  };
}

function rankArray(vals: number[]): number[] {
  const indexed = vals.map((v, idx) => ({ v, idx })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(vals.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) {
      j++;
    }
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

export function computePairMetrics(
  xArr: PrimitiveCell[],
  yArr: PrimitiveCell[]
): { pearson: number; spearman: number; slope: number; intercept: number; r2: number; sse: number; n: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  const len = Math.min(xArr.length, yArr.length);
  for (let i = 0; i < len; i++) {
    const xv = typeof xArr[i] === "number" ? (xArr[i] as number) : parseNumericToken(xArr[i]);
    const yv = typeof yArr[i] === "number" ? (yArr[i] as number) : parseNumericToken(yArr[i]);
    if (xv !== null && yv !== null && Number.isFinite(xv) && Number.isFinite(yv)) {
      xs.push(xv);
      ys.push(yv);
    }
  }
  const n = xs.length;
  if (n < 2) return { pearson: 0, spearman: 0, slope: 0, intercept: 0, r2: 0, sse: 0, n: 0 };

  const calc = (a: number[], b: number[]) => {
    const ma = a.reduce((s, v) => s + v, 0) / n;
    const mb = b.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      const xa = a[i] - ma;
      const yb = b[i] - mb;
      num += xa * yb;
      da += xa * xa;
      db += yb * yb;
    }
    const den = Math.sqrt(da * db);
    const r = den === 0 ? 0 : num / den;
    const slope = da === 0 ? 0 : num / da;
    const intercept = mb - slope * ma;
    return { r, slope, intercept };
  };

  const pRes = calc(xs, ys);
  const sRes = calc(rankArray(xs), rankArray(ys));
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = pRes.slope * xs[i] + pRes.intercept;
    sse += Math.pow(ys[i] - pred, 2);
  }

  return {
    pearson: roundNum(pRes.r, 4),
    spearman: roundNum(sRes.r, 4),
    slope: roundNum(pRes.slope, 4),
    intercept: roundNum(pRes.intercept, 4),
    r2: roundNum(pRes.r * pRes.r, 4),
    sse: roundNum(sse, 3),
    n,
  };
}

// ============================================================================
// Profiling & Insights
// ============================================================================

function inferDatasetDomain(name: string, columns: ColumnProfile[]): { domain: string; explanation: string } {
  const joinedNames = `${name} ${columns.map((c) => c.name).join(" ")}`.toLowerCase();
  const numCount = columns.filter((c) => c.type === "numerical").length;
  const catCount = columns.filter((c) => c.type === "categorical" || c.type === "boolean").length;
  const dateCount = columns.filter((c) => c.type === "datetime").length;

  let domain = "Tabular Dataset";
  if (/titanic|passenger|fare|survived|pclass|age|sex|embarked/.test(joinedNames)) {
    domain = "Demographic & Passenger Data";
  } else if (/price|housing|sqft|bedroom|lot|neighborhood|mortgage|rent|estate/.test(joinedNames)) {
    domain = "Real Estate & Housing Data";
  } else if (/cholesterol|bp|heart|patient|glucose|bmi|diagnosis|disease|symptom|medical|clinical/.test(joinedNames)) {
    domain = "Clinical & Health Records";
  } else if (/sales|revenue|profit|order|customer|product|discount|quantity|retail|invoice/.test(joinedNames)) {
    domain = "Sales & Retail Transactions";
  } else if (/vortex|u_vel|v_vel|w_vel|potential|flux|velocity/.test(joinedNames) && numCount >= 4) {
    domain = "3D Physics & Vector Field";
  } else if (/iris|sepal|petal|species|wine|alcohol|ph|density|sensor|x|y|z/.test(joinedNames) && numCount >= 3) {
    domain = "Scientific Measurements";
  } else if (/stock|open|close|volume|high|low|ticker|market|return|forex/.test(joinedNames)) {
    domain = "Financial Time Series";
  } else if (/salary|employee|department|attrition|experience|hr|tenure|performance/.test(joinedNames)) {
    domain = "Workforce & HR Records";
  } else if (dateCount > 0 && numCount > 0) {
    domain = "Time-Series Dataset";
  } else if (numCount > catCount * 2 && numCount >= 3) {
    domain = "Numerical Dataset";
  } else if (catCount > numCount) {
    domain = "Categorical Dataset";
  }

  const explanation = `${domain} with ${numCount} numeric, ${catCount} categorical, and ${dateCount} date ${
    numCount + catCount + dateCount === 1 ? "column" : "columns"
  }.`;

  return { domain, explanation };
}

export function profileDataset(name: string, headers: string[], rows: DataRow[]): DatasetProfile {
  const rowCount = rows.length;
  const columnCount = headers.length;
  let totalMemoryBytes = headers.reduce((acc, h) => acc + h.length * 2 + 16, 0);
  let totalMissingCells = 0;

  const seenRowHashes = new Set<string>();
  let duplicateRowCount = 0;
  for (const r of rows) {
    const sig = headers.map((h) => String(r[h] ?? "__NULL__")).join("\u0001");
    if (seenRowHashes.has(sig)) duplicateRowCount++;
    else seenRowHashes.add(sig);
  }

  const columns: ColumnProfile[] = headers.map((colName) => {
    const colValues = rows.map((r) => r[colName] ?? null);
    let missingCount = 0;
    let colMemBytes = 0;
    const uniqueSet = new Set<string>();

    let numMatches = 0;
    let intMatches = 0;
    let boolMatches = 0;
    let dateMatches = 0;

    for (const v of colValues) {
      if (v === null || v === undefined || (typeof v === "string" && isMissingRaw(v))) {
        missingCount++;
        colMemBytes += 4;
        continue;
      }
      if (typeof v === "boolean") {
        boolMatches++;
        colMemBytes += 4;
        uniqueSet.add(v ? "true" : "false");
      } else if (typeof v === "number") {
        numMatches++;
        if (Number.isInteger(v)) intMatches++;
        colMemBytes += 8;
        uniqueSet.add(String(v));
      } else {
        const s = String(v);
        colMemBytes += s.length * 2 + 12;
        uniqueSet.add(s);
        if (BOOLEAN_TRUE.has(s.toLowerCase()) || BOOLEAN_FALSE.has(s.toLowerCase())) {
          boolMatches++;
        } else if (parseNumericToken(s) !== null) {
          numMatches++;
          if (Number.isInteger(parseNumericToken(s)!)) intMatches++;
        } else if (isLikelyDateString(s)) {
          dateMatches++;
        }
      }
    }

    totalMemoryBytes += colMemBytes;
    totalMissingCells += missingCount;

    const validCount = rowCount - missingCount;
    let type: ColumnSemanticType = "categorical";
    let rawTypeInfo = "string";

    if (validCount > 0) {
      if (boolMatches / validCount >= 0.9) {
        type = "boolean";
        rawTypeInfo = "bool";
      } else if (numMatches / validCount >= 0.85) {
        type = "numerical";
        rawTypeInfo = intMatches === numMatches ? "int64" : "float64";
      } else if (dateMatches / validCount >= 0.85) {
        type = "datetime";
        rawTypeInfo = "datetime64";
      }
    }

    const uniqueCount = uniqueSet.size;
    const uniquePct = rowCount > 0 ? roundNum((uniqueCount / rowCount) * 100, 2) : 0;
    const missingPct = rowCount > 0 ? roundNum((missingCount / rowCount) * 100, 2) : 0;
    const isConstant = validCount > 0 && uniqueCount <= 1;

    const nameLooksLikeId = /(?:^id$|_id$|uuid|index|key|code|serial|^no$|^sr_?no$)/i.test(colName.trim());
    const isPotentialId =
      validCount >= 8 &&
      uniqueCount === validCount &&
      (nameLooksLikeId || (type === "categorical" && uniquePct === 100) || (type === "numerical" && rawTypeInfo === "int64" && nameLooksLikeId));

    const colProf: ColumnProfile = {
      name: colName,
      type,
      rawTypeInfo,
      isConstant,
      isPotentialId,
      count: validCount,
      missingCount,
      missingPct,
      uniqueCount,
      uniquePct,
      memoryBytes: colMemBytes,
    };

    if (type === "numerical") {
      colProf.numStats = computeNumericalStats(colValues);
    } else {
      const freqMap = new Map<string, number>();
      for (const v of colValues) {
        if (v === null || v === undefined || (typeof v === "string" && isMissingRaw(v))) continue;
        const k = String(v);
        freqMap.set(k, (freqMap.get(k) || 0) + 1);
      }
      const frequencies = [...freqMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([value, count]) => ({
          value,
          count,
          pct: validCount > 0 ? roundNum((count / validCount) * 100, 2) : 0,
        }));
      colProf.catStats = {
        topValue: frequencies[0]?.value ?? null,
        topCount: frequencies[0]?.count ?? 0,
        topPct: frequencies[0]?.pct ?? 0,
        frequencies,
      };
    }
    return colProf;
  });

  const numericalColumns = columns.filter((c) => c.type === "numerical").map((c) => c.name);
  const categoricalColumns = columns.filter((c) => c.type === "categorical").map((c) => c.name);
  const booleanColumns = columns.filter((c) => c.type === "boolean").map((c) => c.name);
  const datetimeColumns = columns.filter((c) => c.type === "datetime").map((c) => c.name);
  const constantColumns = columns.filter((c) => c.isConstant).map((c) => c.name);
  const potentialIdColumns = columns.filter((c) => c.isPotentialId).map((c) => c.name);

  const corrCols = numericalColumns.slice(0, 25);
  const pearsonMatrix: number[][] = corrCols.map(() => new Array(corrCols.length).fill(1));
  const spearmanMatrix: number[][] = corrCols.map(() => new Array(corrCols.length).fill(1));
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < corrCols.length; i++) {
    const colA = corrCols[i];
    const arrA = rows.map((r) => r[colA]);
    for (let j = i + 1; j < corrCols.length; j++) {
      const colB = corrCols[j];
      const arrB = rows.map((r) => r[colB]);
      const { pearson, spearman, n } = computePairMetrics(arrA, arrB);
      pearsonMatrix[i][j] = pearson;
      pearsonMatrix[j][i] = pearson;
      spearmanMatrix[i][j] = spearman;
      spearmanMatrix[j][i] = spearman;
      pairs.push({ colA, colB, pearson, spearman, n });
    }
  }
  pairs.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));

  const { domain, explanation } = inferDatasetDomain(name, columns);

  const nonIdNumeric = numericalColumns.filter((c) => !potentialIdColumns.includes(c));
  const effNum = nonIdNumeric.length >= 3 ? nonIdNumeric : numericalColumns;

  const has3DScatter = effNum.length >= 3 && rowCount >= 3;
  const has3DBubble = effNum.length >= 4 && rowCount >= 3;
  const has3DVolume = effNum.length >= 4 && rowCount >= 27;
  const has3DVector = effNum.length >= 6 && rowCount >= 8;

  const totalCells = rowCount * Math.max(columnCount, 1);

  return {
    name,
    rowCount,
    columnCount,
    memoryBytes: totalMemoryBytes,
    memoryFormatted: formatBytes(totalMemoryBytes),
    totalMissingCells,
    totalMissingPct: totalCells > 0 ? roundNum((totalMissingCells / totalCells) * 100, 2) : 0,
    duplicateRowCount,
    duplicateRowPct: rowCount > 0 ? roundNum((duplicateRowCount / rowCount) * 100, 2) : 0,
    numericalColumns,
    categoricalColumns,
    booleanColumns,
    datetimeColumns,
    constantColumns,
    potentialIdColumns,
    inferredDomain: domain,
    domainExplanation: explanation,
    columns,
    correlations: {
      columns: corrCols,
      pearsonMatrix,
      spearmanMatrix,
      strongestPairs: pairs.slice(0, 15),
    },
    chartEligibility: {
      has2DNumeric: numericalColumns.length >= 2,
      has3DScatter,
      has3DBubble,
      has3DSurface: has3DScatter && rowCount >= 12,
      has3DVolume,
      has3DVector,
      hasCategorical: categoricalColumns.length + booleanColumns.length >= 1,
      hasDatetime: datetimeColumns.length >= 1,
      hasHierarchical: categoricalColumns.length >= 1 && numericalColumns.length >= 1,
    },
  };
}

export function generateAutomatedInsights(profile: DatasetProfile): DataInsight[] {
  const insights: DataInsight[] = [];

  insights.push({
    id: "structure_overview",
    category: "structure",
    severity: "info",
    title: profile.inferredDomain,
    explanation: profile.domainExplanation,
    evidence: `${profile.rowCount.toLocaleString()} rows × ${profile.columnCount} columns`,
  });

  const validNumericCols = profile.columns.filter((c) => c.type === "numerical" && c.numStats && !c.isPotentialId);
  if (validNumericCols.length >= 2) {
    const sortedByMean = [...validNumericCols].sort((a, b) => (b.numStats!.mean ?? 0) - (a.numStats!.mean ?? 0));
    const highest = sortedByMean[0];
    const lowest = sortedByMean[sortedByMean.length - 1];
    insights.push({
      id: "highest_lowest_averages",
      category: "comparison",
      severity: "info",
      title: `Highest vs. Lowest Mean: "${highest.name}" & "${lowest.name}"`,
      explanation: `Numeric features have different scales. Standardize or normalize values before clustering or gradient-based models.`,
      evidence: `${highest.name} mean = ${highest.numStats!.mean} (SD = ${highest.numStats!.stdDev}) vs. ${lowest.name} mean = ${lowest.numStats!.mean} (SD = ${lowest.numStats!.stdDev})`,
      columns: [highest.name, lowest.name],
    });
  }

  const pairs = profile.correlations.strongestPairs;
  if (pairs.length > 0) {
    const top = pairs[0];
    if (Math.abs(top.pearson) >= 0.7 || Math.abs(top.spearman) >= 0.7) {
      const dir = top.pearson >= 0 ? "positive" : "negative";
      insights.push({
        id: `corr_strong_${top.colA}_${top.colB}`,
        category: "correlation",
        severity: "positive",
        title: `Strong ${dir} correlation: "${top.colA}" & "${top.colB}"`,
        explanation: `These columns change together closely, indicating collinearity or strong shared variation.`,
        evidence: `Pearson r = ${top.pearson}, Spearman rho = ${top.spearman} (n = ${top.n} pairs)`,
        columns: [top.colA, top.colB],
      });
    } else if (Math.abs(top.pearson) >= 0.4) {
      insights.push({
        id: `corr_mod_${top.colA}_${top.colB}`,
        category: "correlation",
        severity: "info",
        title: `Moderate linear trend: "${top.colA}" & "${top.colB}"`,
        explanation: `Moderate association between columns. Inspect scatter plots for non-linear patterns or subgroups.`,
        evidence: `Pearson r = ${top.pearson}, Spearman rho = ${top.spearman} (n = ${top.n})`,
        columns: [top.colA, top.colB],
      });
    }
    const weakest = pairs[pairs.length - 1];
    if (weakest && pairs.length > 1 && Math.abs(weakest.pearson) < 0.1) {
      insights.push({
        id: `corr_weak_${weakest.colA}_${weakest.colB}`,
        category: "correlation",
        severity: "info",
        title: `Weak correlation: "${weakest.colA}" & "${weakest.colB}"`,
        explanation: `Minimal linear relationship observed between these columns.`,
        evidence: `Pearson r = ${weakest.pearson}, Spearman rho = ${weakest.spearman}`,
        columns: [weakest.colA, weakest.colB],
      });
    }
  }

  const colsWithMissing = profile.columns.filter((c) => c.missingCount > 0).sort((a, b) => b.missingPct - a.missingPct);
  if (colsWithMissing.length > 0) {
    const worst = colsWithMissing[0];
    insights.push({
      id: "missing_data_pattern",
      category: "missing",
      severity: worst.missingPct > 25 ? "critical" : "warning",
      title: `Missing data in ${colsWithMissing.length} column(s)`,
      explanation: `${(100 - profile.totalMissingPct).toFixed(2)}% of cells contain values. Impute missing entries or remove incomplete rows in Clean Data.`,
      evidence: `Highest missing: "${worst.name}" (${worst.missingCount} nulls, ${worst.missingPct}%) • Total missing cells: ${profile.totalMissingCells}`,
      columns: colsWithMissing.slice(0, 4).map((c) => c.name),
    });
  } else {
    insights.push({
      id: "no_missing_data",
      category: "missing",
      severity: "positive",
      title: "No Missing Values",
      explanation: "All rows and columns contain complete, non-null values.",
      evidence: `0 missing cells out of ${(profile.rowCount * profile.columnCount).toLocaleString()} total fields`,
    });
  }

  const outlierCols = validNumericCols
    .filter((c) => c.numStats!.iqrOutlierCount > 0)
    .sort((a, b) => b.numStats!.iqrOutlierCount - a.numStats!.iqrOutlierCount);
  if (outlierCols.length > 0) {
    const topOut = outlierCols[0];
    const s = topOut.numStats!;
    insights.push({
      id: `outliers_${topOut.name}`,
      category: "outliers",
      severity: "warning",
      title: `Outliers detected in ${outlierCols.length} numerical column(s)`,
      explanation: `Values fall outside the 1.5×IQR bounds. Review in Box Plot or trim outliers in Clean Data.`,
      evidence: `"${topOut.name}": ${s.iqrOutlierCount} IQR outliers (fences [${s.lowerFence}, ${s.upperFence}]), ${s.zScoreOutlierCount} |Z|>3 points, max = ${s.max}`,
      columns: outlierCols.slice(0, 3).map((c) => c.name),
    });
  }

  const skewedCols = validNumericCols
    .filter((c) => Math.abs(c.numStats!.skewness) >= 0.85)
    .sort((a, b) => Math.abs(b.numStats!.skewness) - Math.abs(a.numStats!.skewness));
  if (skewedCols.length > 0) {
    const topSkew = skewedCols[0];
    const s = topSkew.numStats!;
    const dir = s.skewness > 0 ? "right-skewed" : "left-skewed";
    insights.push({
      id: `skew_${topSkew.name}`,
      category: "distribution",
      severity: "warning",
      title: `Skewed distribution: "${topSkew.name}" (${dir})`,
      explanation: `Mean (${s.mean}) diverges from median (${s.median}). ${
        s.min >= 0 ? "A log(1+x) transform can reduce skewness." : "Robust median/IQR scaling is recommended."
      }`,
      evidence: `Skewness = ${s.skewness}, Excess Kurtosis = ${s.kurtosis}`,
      columns: skewedCols.slice(0, 3).map((c) => c.name),
    });
  }

  const catCols = profile.columns.filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats && !c.isPotentialId);
  for (const cc of catCols.slice(0, 4)) {
    const topPct = cc.catStats!.topPct;
    if (topPct >= 75 && cc.uniqueCount >= 2) {
      insights.push({
        id: `imbalance_${cc.name}`,
        category: "imbalance",
        severity: "warning",
        title: `Imbalanced categories in "${cc.name}"`,
        explanation: `"${cc.catStats!.topValue}" accounts for ${topPct}% of observations in this column.`,
        evidence: `"${cc.catStats!.topValue}" = ${cc.catStats!.topCount}/${cc.count} (${topPct}%) across ${cc.uniqueCount} labels`,
        columns: [cc.name],
      });
      break;
    }
  }

  if (profile.duplicateRowCount > 0) {
    insights.push({
      id: "duplicate_records",
      category: "quality",
      severity: "warning",
      title: `${profile.duplicateRowCount} duplicate rows found`,
      explanation: "Repeated rows can skew averages and model evaluation.",
      evidence: `${profile.duplicateRowCount} duplicates (${profile.duplicateRowPct}% of rows)`,
    });
  }
  if (profile.constantColumns.length > 0) {
    insights.push({
      id: "constant_columns",
      category: "quality",
      severity: "critical",
      title: `Constant column(s): ${profile.constantColumns.join(", ")}`,
      explanation: "Contains only a single unique value and adds no information.",
      evidence: `Only 1 unique value in: ${profile.constantColumns.join(", ")}`,
      columns: profile.constantColumns,
    });
  }
  if (profile.potentialIdColumns.length > 0) {
    insights.push({
      id: "potential_id_cols",
      category: "quality",
      severity: "info",
      title: `Identifier column(s): ${profile.potentialIdColumns.join(", ")}`,
      explanation: "Every value is unique; treat as a row ID rather than a predictive feature.",
      evidence: `100% uniqueness in ${profile.potentialIdColumns.join(", ")}`,
      columns: profile.potentialIdColumns,
    });
  }

  return insights;
}

// ============================================================================
// Charting Math: Sampling, QQ Quantiles, Grouped Stats, Binned 3D Surface
// ============================================================================

export function sampleRowsForCharts(rows: DataRow[], maxPoints = EDA_LIMITS.CHART_SAMPLE_LIMIT): {
  sampledRows: DataRow[];
  isSampled: boolean;
  originalCount: number;
} {
  const originalCount = rows.length;
  if (originalCount <= maxPoints) {
    return { sampledRows: rows, isSampled: false, originalCount };
  }
  const sampledRows: DataRow[] = [];
  const step = originalCount / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(originalCount - 1, Math.floor(i * step));
    sampledRows.push(rows[idx]);
  }
  return { sampledRows, isSampled: true, originalCount };
}

/** Inverse Standard Normal CDF (Acklam's approximation) for Q-Q plots */
export function normInvCDF(p: number): number {
  if (p <= 0) return -4;
  if (p >= 1) return 4;
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239;
  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;
  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;
  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996;
  const d4 = 3.754408661907416;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
}

export function computeQQPlotData(values: PrimitiveCell[]): {
  theoretical: number[];
  observed: number[];
  lineX: number[];
  lineY: number[];
} {
  const nums = values
    .map((v) => (typeof v === "number" ? v : parseNumericToken(v)))
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);

  if (nums.length < 3) return { theoretical: [], observed: [], lineX: [], lineY: [] };

  const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
  const std = Math.sqrt(nums.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, nums.length - 1)) || 1;

  const theoretical: number[] = [];
  const observed: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    const p = (i + 0.5) / nums.length;
    theoretical.push(roundNum(normInvCDF(p), 4));
    observed.push(roundNum((nums[i] - mean) / std, 4));
  }

  const minQ = theoretical[0];
  const maxQ = theoretical[theoretical.length - 1];
  return {
    theoretical,
    observed,
    lineX: [minQ, maxQ],
    lineY: [minQ, maxQ],
  };
}

export interface GroupedStatRow {
  group: string;
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  sum: number;
  stdDev: number;
}

export function computeGroupedStats(
  rows: DataRow[],
  groupCol: string,
  valCol: string,
  aggMethod: "mean" | "median" | "sum" | "count" | "min" | "max" = "mean"
): { groups: GroupedStatRow[]; aggregatedValues: number[]; labels: string[] } {
  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    const gRaw = r[groupCol];
    const vRaw = r[valCol];
    const groupKey = gRaw === null || gRaw === undefined ? "Missing" : String(gRaw);
    const numVal = typeof vRaw === "number" ? vRaw : parseNumericToken(vRaw);
    if (!buckets.has(groupKey)) buckets.set(groupKey, []);
    if (numVal !== null && Number.isFinite(numVal)) {
      buckets.get(groupKey)!.push(numVal);
    }
  }

  const groups: GroupedStatRow[] = [];
  for (const [group, vals] of buckets.entries()) {
    const sorted = [...vals].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((s, v) => s + v, 0);
    const mean = n > 0 ? sum / n : 0;
    const median = n === 0 ? 0 : n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const variance = n > 1 ? sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
    groups.push({
      group,
      count: n,
      mean: roundNum(mean, 3),
      median: roundNum(median, 3),
      min: n > 0 ? roundNum(sorted[0], 3) : 0,
      max: n > 0 ? roundNum(sorted[n - 1], 3) : 0,
      sum: roundNum(sum, 3),
      stdDev: roundNum(Math.sqrt(variance), 3),
    });
  }

  groups.sort((a, b) => b.count - a.count);
  const topGroups = groups.slice(0, 25);
  const labels = topGroups.map((g) => g.group);
  const aggregatedValues = topGroups.map((g) => g[aggMethod]);
  return { groups: topGroups, aggregatedValues, labels };
}

/** Aggregate genuine observed (X, Y, Z) points into a 2D surface grid without inventing nonexistent data */
export function buildObservedSurfaceGrid(
  rows: DataRow[],
  xCol: string,
  yCol: string,
  zCol: string,
  maxBins = 14
): { xCenters: number[]; yCenters: number[]; zMatrix: (number | null)[][]; coveragePct: number } {
  const triples: [number, number, number][] = [];
  for (const r of rows) {
    const x = typeof r[xCol] === "number" ? (r[xCol] as number) : parseNumericToken(r[xCol]);
    const y = typeof r[yCol] === "number" ? (r[yCol] as number) : parseNumericToken(r[yCol]);
    const z = typeof r[zCol] === "number" ? (r[zCol] as number) : parseNumericToken(r[zCol]);
    if (x !== null && y !== null && z !== null) triples.push([x, y, z]);
  }
  if (triples.length === 0) return { xCenters: [], yCenters: [], zMatrix: [], coveragePct: 0 };

  const uniqueX = [...new Set(triples.map((t) => t[0]))].sort((a, b) => a - b);
  const uniqueY = [...new Set(triples.map((t) => t[1]))].sort((a, b) => a - b);

  // If data naturally forms a clean lattice (<= 25 unique X and Y coordinates), use exact coordinates
  if (uniqueX.length >= 3 && uniqueX.length <= 25 && uniqueY.length >= 3 && uniqueY.length <= 25) {
    const xIdxMap = new Map(uniqueX.map((v, idx) => [v, idx]));
    const yIdxMap = new Map(uniqueY.map((v, idx) => [v, idx]));
    const sumGrid: number[][] = uniqueY.map(() => new Array(uniqueX.length).fill(0));
    const cntGrid: number[][] = uniqueY.map(() => new Array(uniqueX.length).fill(0));
    for (const [x, y, z] of triples) {
      const xi = xIdxMap.get(x)!;
      const yi = yIdxMap.get(y)!;
      sumGrid[yi][xi] += z;
      cntGrid[yi][xi] += 1;
    }
    let populated = 0;
    const zMatrix = sumGrid.map((row, yi) =>
      row.map((s, xi) => {
        if (cntGrid[yi][xi] > 0) {
          populated++;
          return roundNum(s / cntGrid[yi][xi], 4);
        }
        return null;
      })
    );
    return {
      xCenters: uniqueX,
      yCenters: uniqueY,
      zMatrix,
      coveragePct: roundNum((populated / (uniqueX.length * uniqueY.length)) * 100, 1),
    };
  }

  // Otherwise aggregate into clean spatial bins of size `bins`
  const bins = Math.min(maxBins, Math.max(5, Math.floor(Math.sqrt(triples.length))));
  const minX = uniqueX[0];
  const maxX = uniqueX[uniqueX.length - 1];
  const minY = uniqueY[0];
  const maxY = uniqueY[uniqueY.length - 1];
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const xCenters = Array.from({ length: bins }, (_, i) => roundNum(minX + ((i + 0.5) / bins) * spanX, 3));
  const yCenters = Array.from({ length: bins }, (_, i) => roundNum(minY + ((i + 0.5) / bins) * spanY, 3));
  const sumGrid: number[][] = Array.from({ length: bins }, () => new Array(bins).fill(0));
  const cntGrid: number[][] = Array.from({ length: bins }, () => new Array(bins).fill(0));

  for (const [x, y, z] of triples) {
    const xi = Math.min(bins - 1, Math.max(0, Math.floor(((x - minX) / spanX) * bins)));
    const yi = Math.min(bins - 1, Math.max(0, Math.floor(((y - minY) / spanY) * bins)));
    sumGrid[yi][xi] += z;
    cntGrid[yi][xi] += 1;
  }

  let populated = 0;
  const zMatrix = sumGrid.map((row, yi) =>
    row.map((s, xi) => {
      if (cntGrid[yi][xi] > 0) {
        populated++;
        return roundNum(s / cntGrid[yi][xi], 4);
      }
      return null;
    })
  );
  return {
    xCenters,
    yCenters,
    zMatrix,
    coveragePct: roundNum((populated / (bins * bins)) * 100, 1),
  };
}

// ============================================================================
// Working Copy Cleaning Transformations & CSV Export
// ============================================================================

export type TransformationAction =
  | { type: "remove_columns"; columns: string[] }
  | { type: "rename_column"; oldName: string; newName: string }
  | {
      type: "filter_rows";
      column: string;
      operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "is_null" | "not_null";
      value?: string;
    }
  | { type: "sort_data"; column: string; direction: "asc" | "desc" }
  | { type: "remove_duplicates" }
  | {
      type: "handle_missing";
      column: string;
      strategy: "mean" | "median" | "mode" | "custom" | "drop_rows";
      customValue?: string;
    }
  | {
      type: "outliers";
      column: string;
      method: "iqr" | "zscore";
      threshold?: number;
      treatment: "winsorize" | "remove_rows";
    }
  | { type: "standardize"; column: string }
  | { type: "normalize_minmax"; column: string }
  | { type: "log_transform"; column: string };

export function applyTransformation(
  currentHeaders: string[],
  currentRows: DataRow[],
  action: TransformationAction
): { headers: string[]; rows: DataRow[]; description: string } {
  const headers = [...currentHeaders];
  let rows: DataRow[] = currentRows.map((r) => ({ ...r }));

  switch (action.type) {
    case "remove_columns": {
      const removeSet = new Set(action.columns);
      const nextHeaders = headers.filter((h) => !removeSet.has(h));
      if (nextHeaders.length === 0) throw new Error("Cannot drop every column.");
      const nextRows = rows.map((r) => {
        const clean: DataRow = {};
        nextHeaders.forEach((h) => {
          clean[h] = r[h] ?? null;
        });
        return clean;
      });
      return {
        headers: nextHeaders,
        rows: nextRows,
        description: `Removed column(s): ${action.columns.join(", ")}`,
      };
    }

    case "rename_column": {
      const trimmedNew = action.newName.trim();
      if (!trimmedNew) throw new Error("New column name cannot be empty.");
      if (trimmedNew !== action.oldName && headers.includes(trimmedNew)) {
        throw new Error(`Column "${trimmedNew}" already exists.`);
      }
      const nextHeaders = headers.map((h) => (h === action.oldName ? trimmedNew : h));
      const nextRows = rows.map((r) => {
        const updated: DataRow = {};
        headers.forEach((h) => {
          updated[h === action.oldName ? trimmedNew : h] = r[h] ?? null;
        });
        return updated;
      });
      return {
        headers: nextHeaders,
        rows: nextRows,
        description: `Renamed "${action.oldName}" -> "${trimmedNew}"`,
      };
    }

    case "filter_rows": {
      const { column, operator, value } = action;
      const before = rows.length;
      const numTarget = parseNumericToken(value ?? "");
      const strTarget = (value ?? "").trim().toLowerCase();

      rows = rows.filter((r) => {
        const cell = r[column] ?? null;
        if (operator === "is_null") return cell === null;
        if (operator === "not_null") return cell !== null;
        if (cell === null) return false;
        const cellNum = typeof cell === "number" ? cell : parseNumericToken(cell);
        if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
          if (cellNum === null || numTarget === null) return false;
          if (operator === "gt") return cellNum > numTarget;
          if (operator === "gte") return cellNum >= numTarget;
          if (operator === "lt") return cellNum < numTarget;
          return cellNum <= numTarget;
        }
        const cellStr = String(cell).toLowerCase();
        if (operator === "eq") {
          return cellNum !== null && numTarget !== null ? cellNum === numTarget : cellStr === strTarget;
        }
        if (operator === "neq") {
          return cellNum !== null && numTarget !== null ? cellNum !== numTarget : cellStr !== strTarget;
        }
        if (operator === "contains") return cellStr.includes(strTarget);
        return true;
      });
      if (rows.length === 0) throw new Error("Filter matched 0 rows. Cancelled to preserve dataset.");
      return {
        headers,
        rows,
        description: `Filtered "${column}" (${operator} ${value ?? ""}): ${rows.length}/${before} rows kept`,
      };
    }

    case "sort_data": {
      const dir = action.direction === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        const va = a[action.column] ?? null;
        const vb = b[action.column] ?? null;
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
      });
      return {
        headers,
        rows,
        description: `Sorted by "${action.column}" (${action.direction.toUpperCase()})`,
      };
    }

    case "remove_duplicates": {
      const seen = new Set<string>();
      const uniqueRows: DataRow[] = [];
      for (const r of rows) {
        const sig = headers.map((h) => String(r[h] ?? "__NULL__")).join("\u0001");
        if (!seen.has(sig)) {
          seen.add(sig);
          uniqueRows.push(r);
        }
      }
      return {
        headers,
        rows: uniqueRows,
        description: `Deduplicated dataset: removed ${rows.length - uniqueRows.length} row(s)`,
      };
    }

    case "handle_missing": {
      const targets = action.column === "__ALL__" ? headers : [action.column];
      if (action.strategy === "drop_rows") {
        const before = rows.length;
        const kept = rows.filter((r) => targets.every((col) => r[col] !== null && r[col] !== undefined));
        if (kept.length === 0) throw new Error("Dropping missing rows leaves 0 rows.");
        return {
          headers,
          rows: kept,
          description: `Dropped ${before - kept.length} row(s) with nulls in ${action.column === "__ALL__" ? "any column" : `"${action.column}"`}`,
        };
      }

      let filled = 0;
      for (const col of targets) {
        const colVals = rows.map((r) => r[col]);
        const nums = colVals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        const nonNulls = colVals.filter((v) => v !== null && v !== undefined);
        if (nonNulls.length === 0) continue;

        let fillVal: PrimitiveCell = null;
        if (action.strategy === "custom") {
          const rawCustom = action.customValue ?? "";
          const parsed = nums.length > nonNulls.length * 0.5 ? parseNumericToken(rawCustom) : null;
          fillVal = parsed !== null ? parsed : rawCustom;
        } else if (action.strategy === "mean" || action.strategy === "median") {
          if (nums.length === 0) {
            if (action.column !== "__ALL__") throw new Error(`"${col}" must be numerical for mean/median imputation.`);
            continue;
          }
          const st = computeNumericalStats(colVals)!;
          fillVal = action.strategy === "mean" ? st.mean : st.median;
        } else if (action.strategy === "mode") {
          const freq = new Map<string, { raw: PrimitiveCell; count: number }>();
          for (const v of nonNulls) {
            const k = String(v);
            freq.set(k, { raw: v, count: (freq.get(k)?.count ?? 0) + 1 });
          }
          fillVal = [...freq.values()].sort((a, b) => b.count - a.count)[0]?.raw ?? null;
        }

        if (fillVal !== null) {
          for (const r of rows) {
            if (r[col] === null || r[col] === undefined) {
              r[col] = fillVal;
              filled++;
            }
          }
        }
      }
      return {
        headers,
        rows,
        description: `Imputed ${filled} missing cell(s) via ${action.strategy} (${action.column === "__ALL__" ? "all columns" : `"${action.column}"`})`,
      };
    }

    case "outliers": {
      const col = action.column;
      const stats = computeNumericalStats(rows.map((r) => r[col]));
      if (!stats) throw new Error(`"${col}" is not a numerical column.`);

      const lower =
        action.method === "iqr"
          ? roundNum(stats.q1 - (action.threshold ?? 1.5) * stats.iqr, 4)
          : roundNum(stats.mean - (action.threshold ?? 3.0) * stats.stdDev, 4);
      const upper =
        action.method === "iqr"
          ? roundNum(stats.q3 + (action.threshold ?? 1.5) * stats.iqr, 4)
          : roundNum(stats.mean + (action.threshold ?? 3.0) * stats.stdDev, 4);

      if (action.treatment === "winsorize") {
        let count = 0;
        for (const r of rows) {
          const v = r[col];
          if (typeof v === "number") {
            if (v < lower) {
              r[col] = lower;
              count++;
            } else if (v > upper) {
              r[col] = upper;
              count++;
            }
          }
        }
        return {
          headers,
          rows,
          description: `Winsorized ${count} outlier(s) in "${col}" (${action.method.toUpperCase()} [${lower}, ${upper}])`,
        };
      }
      const before = rows.length;
      const kept = rows.filter((r) => typeof r[col] !== "number" || ((r[col] as number) >= lower && (r[col] as number) <= upper));
      if (kept.length === 0) throw new Error("Outlier filter would leave 0 rows.");
      return {
        headers,
        rows: kept,
        description: `Removed ${before - kept.length} outlier row(s) in "${col}" (${action.method.toUpperCase()} [${lower}, ${upper}])`,
      };
    }

    case "standardize": {
      const col = action.column;
      const stats = computeNumericalStats(rows.map((r) => r[col]));
      if (!stats || stats.stdDev === 0) throw new Error(`Cannot standardize "${col}" (zero standard deviation).`);
      for (const r of rows) {
        if (typeof r[col] === "number") {
          r[col] = roundNum(((r[col] as number) - stats.mean) / stats.stdDev, 4);
        }
      }
      return {
        headers,
        rows,
        description: `Standardized "${col}" (Z-score: mean=0, std=1)`,
      };
    }

    case "normalize_minmax": {
      const col = action.column;
      const stats = computeNumericalStats(rows.map((r) => r[col]));
      if (!stats || stats.max === stats.min) throw new Error(`Cannot Min-Max normalize "${col}" (zero range).`);
      const range = stats.max - stats.min;
      for (const r of rows) {
        if (typeof r[col] === "number") {
          r[col] = roundNum(((r[col] as number) - stats.min) / range, 4);
        }
      }
      return {
        headers,
        rows,
        description: `Min-Max scaled "${col}" to [0, 1]`,
      };
    }

    case "log_transform": {
      const col = action.column;
      const nums = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
      if (nums.length === 0) throw new Error(`"${col}" has no numeric data.`);
      const minVal = Math.min(...nums);
      if (minVal < 0) {
        throw new Error(`Log(1+x) transform requires non-negative values (min in "${col}" is ${minVal}).`);
      }
      for (const r of rows) {
        if (typeof r[col] === "number") {
          r[col] = roundNum(Math.log1p(r[col] as number), 4);
        }
      }
      return {
        headers,
        rows,
        description: `Applied Log(1+x) transform to "${col}"`,
      };
    }
  }
}

export function exportDatasetToCsv(headers: string[], rows: DataRow[]): string {
  const matrix = rows.map((row) =>
    headers.map((h) => {
      const val = row[h];
      return val === null || val === undefined ? "" : val;
    })
  );
  return Papa.unparse({ fields: headers, data: matrix });
}
