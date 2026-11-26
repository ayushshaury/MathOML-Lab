import Papa from "papaparse";

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
  name: string;
  headers: string[];
  rows: DataRow[];
  warnings: string[];
}

// ============================================================================
// Utilities
// ============================================================================

const MISSING_TOKENS = new Set(["", "na", "n/a", "null", "none", "nan", "undefined", "-", "?"]);
const BOOLEAN_TRUE = new Set(["true", "yes", "y", "t"]);
const BOOLEAN_FALSE = new Set(["false", "no", "n", "f"]);

function roundNum(val: number, decimals = 4): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isMissingRaw(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "number") return !Number.isFinite(val);
  if (typeof val === "string") return MISSING_TOKENS.has(val.trim().toLowerCase());
  return false;
}

function parseNumericToken(val: unknown): number | null {
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s || MISSING_TOKENS.has(s.toLowerCase())) return null;
  // Clean common numeric formatting like "$1,250.50" or "42.5%" only when strictly valid
  const stripped = s.replace(/^[$€£¥]/, "").replace(/%$/, "").replace(/,(?=\d{3}(\D|$))/g, "").trim();
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(stripped)) return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

function isLikelyDateString(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 6 || trimmed.length > 40) return false;
  // Must contain a separator like -, /, or : so plain numbers aren't parsed as dates
  if (!/[-/:]/.test(trimmed)) return false;
  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(trimmed)) {
    return false;
  }
  const ts = Date.parse(trimmed);
  return !Number.isNaN(ts);
}

function looksLikeDataValueNotHeader(token: string): boolean {
  const t = token.trim();
  if (!t) return true;
  if (parseNumericToken(t) !== null) return true;
  if (isLikelyDateString(t)) return true;
  return false;
}

// ============================================================================
// CSV Parser & Validation
// ============================================================================

export function parseCsvText(rawInput: string, fileName = "uploaded_dataset.csv"): ParsedDataset {
  if (!rawInput || typeof rawInput !== "string") {
    throw new Error("Empty or unreadable CSV payload.");
  }

  let content = rawInput;
  const warnings: string[] = [];

  // Handle UTF-8 BOM
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  // Detect severe encoding corruption
  const replacementMatches = content.match(/\uFFFD/g);
  if (replacementMatches && replacementMatches.length > 10) {
    warnings.push(
      `Detected ${replacementMatches.length} invalid UTF-8 replacement characters; file may have non-UTF-8 encoding (e.g. Latin-1).`
    );
  }

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("The uploaded CSV file is empty.");
  }

  // Parse as array of rows first so we can inspect headers reliably
  const result = Papa.parse<string[]>(trimmed, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  if (result.errors && result.errors.length > 0) {
    const fatal = result.errors.find((e) => e.type === "Delimiter" || e.type === "Quotes");
    if (fatal && result.data.length === 0) {
      throw new Error(`Invalid CSV structure at row ${fatal.row ?? 0}: ${fatal.message}`);
    }
    if (result.errors.length > 0) {
      warnings.push(`CSV parser reported ${result.errors.length} formatting notice(s) (e.g. ${result.errors[0].message}).`);
    }
  }

  const rawMatrix = result.data.filter((row) => Array.isArray(row) && row.some((c) => String(c ?? "").trim() !== ""));
  if (rawMatrix.length === 0) {
    throw new Error("No valid rows found in CSV.");
  }

  const maxColsInRows = rawMatrix.reduce((mx, r) => Math.max(mx, r.length), 0);
  if (maxColsInRows === 0) {
    throw new Error("CSV contains zero columns.");
  }
  if (maxColsInRows > EDA_LIMITS.MAX_COLS) {
    throw new Error(`Dataset has ${maxColsInRows} columns, exceeding limit of ${EDA_LIMITS.MAX_COLS}.`);
  }
  if (rawMatrix.length - 1 > EDA_LIMITS.MAX_ROWS) {
    throw new Error(`Dataset exceeds the maximum limit of ${EDA_LIMITS.MAX_ROWS.toLocaleString()} rows.`);
  }

  const firstRow = rawMatrix[0].map((c) => String(c ?? "").trim());
  const nonEmptyHeaderCount = firstRow.filter((h) => h.length > 0).length;
  const numericHeaderCount = firstRow.filter((h) => looksLikeDataValueNotHeader(h)).length;

  let headers: string[];
  let dataStartRow = 1;

  // Missing header heuristic: all cells empty OR majority of first row values look like numbers/dates
  if (nonEmptyHeaderCount === 0 || (firstRow.length > 1 && numericHeaderCount >= Math.ceil(firstRow.length * 0.7))) {
    headers = Array.from({ length: maxColsInRows }, (_, i) => `Column_${i + 1}`);
    dataStartRow = 0;
    warnings.push("Missing or purely numeric header row detected; auto-generated Column_1..Column_N headers.");
  } else {
    const seen = new Map<string, number>();
    headers = Array.from({ length: maxColsInRows }, (_, i) => {
      let base = (firstRow[i] || `Column_${i + 1}`).replace(/[\r\n]+/g, " ").trim();
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      if (count > 0) {
        base = `${base}_${count + 1}`;
        warnings.push(`Duplicate column header renamed to "${base}".`);
      }
      return base;
    });
  }

  const dataRowsRaw = rawMatrix.slice(dataStartRow);
  if (dataRowsRaw.length === 0) {
    throw new Error("CSV contains headers only and zero data records.");
  }

  // Infer raw column types from column scan so cell values are cast cleanly
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
    name: fileName.replace(/\.(csv|tsv|txt)$/i, "") || "Uploaded Dataset",
    headers,
    rows,
    warnings,
  };
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

function computePairCorrelation(xArr: PrimitiveCell[], yArr: PrimitiveCell[]): { pearson: number; spearman: number; n: number } {
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
  if (n < 2) return { pearson: 0, spearman: 0, n };

  const calcPearson = (a: number[], b: number[]): number => {
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
    return den === 0 ? 0 : roundNum(num / den, 4);
  };

  const pearson = calcPearson(xs, ys);
  const spearman = calcPearson(rankArray(xs), rankArray(ys));
  return { pearson, spearman, n };
}

// ============================================================================
// Profiling & Dataset Understanding
// ============================================================================

function inferDatasetDomain(name: string, columns: ColumnProfile[]): { domain: string; explanation: string } {
  const joinedNames = `${name} ${columns.map((c) => c.name).join(" ")}`.toLowerCase();
  const numCount = columns.filter((c) => c.type === "numerical").length;
  const catCount = columns.filter((c) => c.type === "categorical" || c.type === "boolean").length;
  const dateCount = columns.filter((c) => c.type === "datetime").length;

  let domain = "General Structured Tabular Dataset";
  if (/titanic|passenger|fare|survived|pclass|age|sex|embarked/.test(joinedNames)) {
    domain = "Demographic & Survival Analytics";
  } else if (/price|housing|sqft|bedroom|lot|neighborhood|mortgage|rent|estate/.test(joinedNames)) {
    domain = "Real Estate & Property Valuation";
  } else if (/cholesterol|bp|heart|patient|glucose|bmi|diagnosis|disease|symptom|medical|clinical/.test(joinedNames)) {
    domain = "Clinical & Healthcare Diagnostics";
  } else if (/sales|revenue|profit|order|customer|product|discount|quantity|retail|invoice/.test(joinedNames)) {
    domain = "Commercial Sales & Retail Telemetry";
  } else if (/iris|sepal|petal|species|wine|alcohol|ph|density|sensor|velocity|flux|x|y|z/.test(joinedNames) && numCount >= 3) {
    domain = "Scientific Measurement & Experimental Telemetry";
  } else if (/stock|open|close|volume|high|low|ticker|market|return|forex/.test(joinedNames)) {
    domain = "Financial Time-Series & Market Metrics";
  } else if (/salary|employee|department|attrition|experience|hr|tenure|performance/.test(joinedNames)) {
    domain = "Workforce & Human Resources Analytics";
  } else if (dateCount > 0 && numCount > 0) {
    domain = "Temporal & Time-Indexed Metric Series";
  } else if (numCount > catCount * 2 && numCount >= 3) {
    domain = "Continuous Multivariate Numerical Dataset";
  } else if (catCount > numCount) {
    domain = "Categorical & Survey Classification Dataset";
  }

  const explanation = `Detected a ${domain} containing ${numCount} numerical, ${catCount} categorical/boolean, and ${dateCount} temporal column(s). ${
    numCount >= 3
      ? "With 3+ numerical dimensions, the dataset supports full interactive 3D spatial exploration (Scatter, Mesh, and Surface views) alongside 2D univariate/bivariate distributions."
      : numCount >= 1
      ? "The variable balance prioritizes univariate distributions, categorical breakdowns, and 2D relational checks."
      : "Purely categorical composition favors frequency distributions, contingency analysis, and hierarchical proportion charts."
  }`;

  return { domain, explanation };
}

export function profileDataset(name: string, headers: string[], rows: DataRow[]): DatasetProfile {
  const rowCount = rows.length;
  const columnCount = headers.length;
  let totalMemoryBytes = headers.reduce((acc, h) => acc + h.length * 2 + 16, 0);
  let totalMissingCells = 0;

  // Duplicate detection across full rows
  const seenRowHashes = new Set<string>();
  let duplicateRowCount = 0;
  for (const r of rows) {
    const sig = headers.map((h) => String(r[h] ?? "__NULL__")).join("\u0001");
    if (seenRowHashes.has(sig)) {
      duplicateRowCount++;
    } else {
      seenRowHashes.add(sig);
    }
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
          const nVal = parseNumericToken(s)!;
          if (Number.isInteger(nVal)) intMatches++;
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

    // Potential ID heuristic
    const nameLooksLikeId = /(?:^id$|_id$|uuid|index|key|code|serial|^no$|^sr_?no$)/i.test(colName.trim());
    const isPotentialId =
      validCount >= 8 &&
      uniqueCount === validCount &&
      (nameLooksLikeId || (type === "categorical" && uniquePct === 100) || (type === "numerical" && rawTypeInfo === "int64" && nameLooksLikeId));

    const profile: ColumnProfile = {
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
      profile.numStats = computeNumericalStats(colValues);
    } else {
      const freqMap = new Map<string, number>();
      for (const v of colValues) {
        if (v === null || v === undefined || (typeof v === "string" && isMissingRaw(v))) continue;
        const key = String(v);
        freqMap.set(key, (freqMap.get(key) || 0) + 1);
      }
      const frequencies = [...freqMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([value, count]) => ({
          value,
          count,
          pct: validCount > 0 ? roundNum((count / validCount) * 100, 2) : 0,
        }));
      profile.catStats = {
        topValue: frequencies[0]?.value ?? null,
        topCount: frequencies[0]?.count ?? 0,
        topPct: frequencies[0]?.pct ?? 0,
        frequencies,
      };
    }

    return profile;
  });

  const numericalColumns = columns.filter((c) => c.type === "numerical").map((c) => c.name);
  const categoricalColumns = columns.filter((c) => c.type === "categorical").map((c) => c.name);
  const booleanColumns = columns.filter((c) => c.type === "boolean").map((c) => c.name);
  const datetimeColumns = columns.filter((c) => c.type === "datetime").map((c) => c.name);
  const constantColumns = columns.filter((c) => c.isConstant).map((c) => c.name);
  const potentialIdColumns = columns.filter((c) => c.isPotentialId).map((c) => c.name);

  // Correlation matrices across up to 25 numerical columns to keep computation fast
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
      const { pearson, spearman, n } = computePairCorrelation(arrA, arrB);
      pearsonMatrix[i][j] = pearson;
      pearsonMatrix[j][i] = pearson;
      spearmanMatrix[i][j] = spearman;
      spearmanMatrix[j][i] = spearman;
      pairs.push({ colA, colB, pearson, spearman, n });
    }
  }

  pairs.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));

  const { domain, explanation } = inferDatasetDomain(name, columns);

  // 3D structure eligibility check (strictly without fabricating dimensions)
  const nonIdNumericCols = numericalColumns.filter((c) => !potentialIdColumns.includes(c));
  const effectiveNumFor3D = nonIdNumericCols.length >= 3 ? nonIdNumericCols : numericalColumns;

  const has3DScatter = effectiveNumFor3D.length >= 3 && rowCount >= 3;
  const has3DBubble = effectiveNumFor3D.length >= 4 && rowCount >= 3;
  // Volumetric / Isosurface requires at least 4 numeric columns (X, Y, Z coordinates + Value) and 27+ samples
  const has3DVolume = effectiveNumFor3D.length >= 4 && rowCount >= 27;
  // Vector field (Cone / Streamtube) requires at least 6 numeric columns (x, y, z, u, v, w)
  const has3DVector = effectiveNumFor3D.length >= 6 && rowCount >= 8;

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

// ============================================================================
// Automated Statistical Insights Engine (Zero Fabrication)
// ============================================================================

export function generateAutomatedInsights(profile: DatasetProfile): DataInsight[] {
  const insights: DataInsight[] = [];

  // 1. Structural Overview
  insights.push({
    id: "structure_overview",
    category: "structure",
    severity: "info",
    title: `Dataset Composition: ${profile.inferredDomain}`,
    explanation: profile.domainExplanation,
    evidence: `${profile.rowCount.toLocaleString()} rows × ${profile.columnCount} columns • ${profile.memoryFormatted} estimated memory`,
  });

  // 2. Highest & Lowest Averages among Numerical Features (non-ID)
  const validNumericCols = profile.columns.filter((c) => c.type === "numerical" && c.numStats && !c.isPotentialId);
  if (validNumericCols.length >= 2) {
    const sortedByMean = [...validNumericCols].sort((a, b) => (b.numStats!.mean ?? 0) - (a.numStats!.mean ?? 0));
    const highest = sortedByMean[0];
    const lowest = sortedByMean[sortedByMean.length - 1];
    insights.push({
      id: "highest_lowest_averages",
      category: "comparison",
      severity: "info",
      title: `Extreme Scale Spread Between "${highest.name}" and "${lowest.name}"`,
      explanation: `Across numerical attributes, "${highest.name}" exhibits the highest arithmetic average while "${lowest.name}" has the lowest average. Consider feature scaling (Standardization or Min-Max) before distance-based modeling.`,
      evidence: `${highest.name} mean = ${highest.numStats!.mean} (SD = ${highest.numStats!.stdDev}) vs. ${lowest.name} mean = ${lowest.numStats!.mean} (SD = ${lowest.numStats!.stdDev})`,
      columns: [highest.name, lowest.name],
    });
  }

  // 3. Strong & Weak Correlations
  const pairs = profile.correlations.strongestPairs;
  if (pairs.length > 0) {
    const top = pairs[0];
    if (Math.abs(top.pearson) >= 0.7 || Math.abs(top.spearman) >= 0.7) {
      const direction = top.pearson >= 0 ? "positive" : "negative";
      insights.push({
        id: `corr_strong_${top.colA}_${top.colB}`,
        category: "correlation",
        severity: "positive",
        title: `Strong ${direction} association: "${top.colA}" & "${top.colB}"`,
        explanation: `These two variables move closely together. High correlation indicates predictive potential or potential multicollinearity if both are fed into linear regression.`,
        evidence: `Pearson r = ${top.pearson}, Spearman rho = ${top.spearman} (n = ${top.n} valid pairs)`,
        columns: [top.colA, top.colB],
      });
    } else if (Math.abs(top.pearson) >= 0.4) {
      insights.push({
        id: `corr_mod_${top.colA}_${top.colB}`,
        category: "correlation",
        severity: "info",
        title: `Moderate relationship: "${top.colA}" & "${top.colB}"`,
        explanation: `The strongest bivariate link in this dataset is moderate, suggesting multi-feature or non-linear interactions likely explain variance.`,
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
        title: `Near-zero linear correlation: "${weakest.colA}" vs "${weakest.colB}"`,
        explanation: `"${weakest.colA}" and "${weakest.colB}" behave linearly independently. Verify via Scatter/KDE plots whether non-linear curves exist.`,
        evidence: `Pearson r = ${weakest.pearson}, Spearman rho = ${weakest.spearman}`,
        columns: [weakest.colA, weakest.colB],
      });
    }
  }

  // 4. Missing-Data Patterns
  const colsWithMissing = profile.columns
    .filter((c) => c.missingCount > 0)
    .sort((a, b) => b.missingPct - a.missingPct);
  if (colsWithMissing.length > 0) {
    const worst = colsWithMissing[0];
    insights.push({
      id: "missing_data_pattern",
      category: "missing",
      severity: worst.missingPct > 25 ? "critical" : "warning",
      title: `Missing values detected in ${colsWithMissing.length} column(s)`,
      explanation: `Dataset completeness is ${(100 - profile.totalMissingPct).toFixed(2)}%. "${worst.name}" has the highest missing rate. Impute numerical columns with Median when skewed, or Mode for categorical features.`,
      evidence: `Top missing: "${worst.name}" (${worst.missingCount} nulls, ${worst.missingPct}%) • Total dataset null cells: ${profile.totalMissingCells}`,
      columns: colsWithMissing.slice(0, 4).map((c) => c.name),
    });
  } else {
    insights.push({
      id: "no_missing_data",
      category: "missing",
      severity: "positive",
      title: "100% Data Completeness (Zero Missing Values)",
      explanation: "No null, NaN, or empty cells were detected across any column.",
      evidence: `0 missing cells out of ${(profile.rowCount * profile.columnCount).toLocaleString()} total fields`,
    });
  }

  // 5. Outliers (IQR & Z-score)
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
      explanation: `"${topOut.name}" contains extreme values outside Tukey's 1.5×IQR fences. Outliers inflate mean and standard deviation; consider Winsorization or Median statistics.`,
      evidence: `"${topOut.name}": ${s.iqrOutlierCount} IQR outliers (fences [${s.lowerFence}, ${s.upperFence}]), ${s.zScoreOutlierCount} extreme |Z|>3 points, max = ${s.max}`,
      columns: outlierCols.slice(0, 3).map((c) => c.name),
    });
  }

  // 6. Skewed Distributions
  const skewedCols = validNumericCols
    .filter((c) => Math.abs(c.numStats!.skewness) >= 0.85)
    .sort((a, b) => Math.abs(b.numStats!.skewness) - Math.abs(a.numStats!.skewness));
  if (skewedCols.length > 0) {
    const topSkew = skewedCols[0];
    const s = topSkew.numStats!;
    const tailDir = s.skewness > 0 ? "right-skewed (positively skewed)" : "left-skewed (negatively skewed)";
    insights.push({
      id: `skew_${topSkew.name}`,
      category: "distribution",
      severity: "warning",
      title: `Heavy asymmetry in "${topSkew.name}" (${tailDir})`,
      explanation: `Mean (${s.mean}) diverges from Median (${s.median}) due to heavy tail extension. ${
        s.min >= 0 ? "Applying a Log(1+x) transform can improve normality." : "Use Robust/Quantile scaling or Yeo-Johnson transformation."
      }`,
      evidence: `Skewness = ${s.skewness}, Excess Kurtosis = ${s.kurtosis}, Mean = ${s.mean} vs Median = ${s.median}`,
      columns: skewedCols.slice(0, 3).map((c) => c.name),
    });
  }

  // 7. Categorical Imbalances
  const catCols = profile.columns.filter((c) => (c.type === "categorical" || c.type === "boolean") && c.catStats && !c.isPotentialId);
  for (const cc of catCols.slice(0, 4)) {
    const topPct = cc.catStats!.topPct;
    if (topPct >= 75 && cc.uniqueCount >= 2) {
      insights.push({
        id: `imbalance_${cc.name}`,
        category: "imbalance",
        severity: "warning",
        title: `Class imbalance in "${cc.name}"`,
        explanation: `The majority class "${cc.catStats!.topValue}" dominates this feature, which may bias tree/classification splits unless stratified sampling or class weighting is applied.`,
        evidence: `"${cc.catStats!.topValue}" = ${cc.catStats!.topCount}/${cc.count} records (${topPct}%) across ${cc.uniqueCount} classes`,
        columns: [cc.name],
      });
      break;
    }
  }

  // 8. Data Quality Issues (Duplicates, Constant columns, IDs)
  if (profile.duplicateRowCount > 0) {
    insights.push({
      id: "duplicate_records",
      category: "quality",
      severity: "warning",
      title: `${profile.duplicateRowCount} exact duplicate row(s) found`,
      explanation: "Duplicate rows distort summary frequencies and cause train/test leakage. Deduplicating in the Data Cleaning panel is recommended.",
      evidence: `${profile.duplicateRowCount} duplicate records (${profile.duplicateRowPct}% of dataset)`,
    });
  }
  if (profile.constantColumns.length > 0) {
    insights.push({
      id: "constant_columns",
      category: "quality",
      severity: "critical",
      title: `Zero-variance constant column(s): ${profile.constantColumns.join(", ")}`,
      explanation: "Constant features carry zero informational entropy and cannot contribute predictive signal. Drop them to simplify the dataset.",
      evidence: `1 unique value across valid observations in [${profile.constantColumns.join(", ")}]`,
      columns: profile.constantColumns,
    });
  }
  if (profile.potentialIdColumns.length > 0) {
    insights.push({
      id: "potential_id_cols",
      category: "quality",
      severity: "info",
      title: `Identifier candidate column(s): ${profile.potentialIdColumns.join(", ")}`,
      explanation: "100% unique identifiers index records but should be excluded from correlation heatmaps and predictive features.",
      evidence: `100% uniqueness detected in: ${profile.potentialIdColumns.join(", ")}`,
      columns: profile.potentialIdColumns,
    });
  }

  return insights;
}

// ============================================================================
// Sampling & Export Helpers
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
  // Deterministic stride + slight spread so distribution shape is faithfully preserved without mutating rows
  const sampledRows: DataRow[] = [];
  const step = originalCount / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(originalCount - 1, Math.floor(i * step));
    sampledRows.push(rows[idx]);
  }
  return { sampledRows, isSampled: true, originalCount };
}

export function exportDatasetToCsv(headers: string[], rows: DataRow[]): string {
  const matrix = rows.map((row) =>
    headers.map((h) => {
      const val = row[h];
      return val === null || val === undefined ? "" : val;
    })
  );
  return Papa.unparse({
    fields: headers,
    data: matrix,
  });
}

// ============================================================================
// Working Copy Data Transformations
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
      column: string; // "__ALL__" or column name
      strategy: "mean" | "median" | "mode" | "custom" | "drop_rows";
      customValue?: string;
    }
  | {
      type: "outliers";
      column: string;
      method: "iqr" | "zscore";
      threshold?: number; // default 1.5 for IQR, 3.0 for Z-score
      treatment: "winsorize" | "remove_rows";
    }
  | { type: "standardize"; column: string }
  | { type: "normalize_minmax"; column: string }
  | { type: "log_transform"; column: string };

export interface TransformationResult {
  headers: string[];
  rows: DataRow[];
  description: string;
}

export function applyTransformation(
  currentHeaders: string[],
  currentRows: DataRow[],
  action: TransformationAction
): TransformationResult {
  // Deep clone row objects to ensure immutability for undo/redo
  const headers = [...currentHeaders];
  let rows: DataRow[] = currentRows.map((r) => ({ ...r }));

  switch (action.type) {
    case "remove_columns": {
      const removeSet = new Set(action.columns);
      const nextHeaders = headers.filter((h) => !removeSet.has(h));
      if (nextHeaders.length === 0) {
        throw new Error("Cannot remove every column from the dataset.");
      }
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
        description: `Removed ${action.columns.length} column(s): ${action.columns.join(", ")}`,
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
          const targetKey = h === action.oldName ? trimmedNew : h;
          updated[targetKey] = r[h] ?? null;
        });
        return updated;
      });
      return {
        headers: nextHeaders,
        rows: nextRows,
        description: `Renamed column "${action.oldName}" -> "${trimmedNew}"`,
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
        if (operator === "contains") {
          return cellStr.includes(strTarget);
        }
        return true;
      });
      if (rows.length === 0) {
        throw new Error("Filter matched 0 rows. Cancelled to prevent an empty dataset.");
      }
      return {
        headers,
        rows,
        description: `Filtered "${column}" (${operator} ${value ?? ""}): kept ${rows.length} of ${before} rows`,
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
        description: `Sorted dataset by "${action.column}" (${action.direction.toUpperCase()})`,
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
      const removed = rows.length - uniqueRows.length;
      return {
        headers,
        rows: uniqueRows,
        description: `Removed ${removed} duplicate row(s) (${uniqueRows.length} rows remaining)`,
      };
    }

    case "handle_missing": {
      const targets = action.column === "__ALL__" ? headers : [action.column];
      if (action.strategy === "drop_rows") {
        const before = rows.length;
        const kept = rows.filter((r) => targets.every((col) => r[col] !== null && r[col] !== undefined));
        if (kept.length === 0) {
          throw new Error("Dropping missing rows would leave zero records.");
        }
        return {
          headers,
          rows: kept,
          description: `Dropped ${before - kept.length} row(s) containing missing values in ${action.column === "__ALL__" ? "any column" : `"${action.column}"`}`,
        };
      }

      let filledCount = 0;
      for (const col of targets) {
        const colVals = rows.map((r) => r[col]);
        const nums = colVals.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        const nonNulls = colVals.filter((v) => v !== null && v !== undefined);
        if (nonNulls.length === 0) continue;

        let fillValue: PrimitiveCell = null;
        if (action.strategy === "custom") {
          const rawCustom = action.customValue ?? "";
          const parsedNum = nums.length > nonNulls.length * 0.5 ? parseNumericToken(rawCustom) : null;
          fillValue = parsedNum !== null ? parsedNum : rawCustom;
        } else if (action.strategy === "mean" || action.strategy === "median") {
          if (nums.length === 0) {
            if (action.column !== "__ALL__") {
              throw new Error(`Mean/Median imputation requires numerical data in "${col}".`);
            }
            continue;
          }
          const stats = computeNumericalStats(colVals);
          fillValue = action.strategy === "mean" ? stats!.mean : stats!.median;
        } else if (action.strategy === "mode") {
          const freq = new Map<string, { raw: PrimitiveCell; count: number }>();
          for (const v of nonNulls) {
            const k = String(v);
            const cur = freq.get(k);
            freq.set(k, { raw: v, count: (cur?.count ?? 0) + 1 });
          }
          const top = [...freq.values()].sort((a, b) => b.count - a.count)[0];
          fillValue = top?.raw ?? null;
        }

        if (fillValue !== null) {
          for (const r of rows) {
            if (r[col] === null || r[col] === undefined) {
              r[col] = fillValue;
              filledCount++;
            }
          }
        }
      }

      return {
        headers,
        rows,
        description: `Imputed ${filledCount} missing cell(s) using "${action.strategy}" on ${action.column === "__ALL__" ? "all eligible columns" : `"${action.column}"`}`,
      };
    }

    case "outliers": {
      const col = action.column;
      const stats = computeNumericalStats(rows.map((r) => r[col]));
      if (!stats) throw new Error(`"${col}" is not numerical or has no valid numbers.`);

      let lower = stats.lowerFence;
      let upper = stats.upperFence;
      if (action.method === "iqr") {
        const k = action.threshold ?? 1.5;
        lower = roundNum(stats.q1 - k * stats.iqr, 4);
        upper = roundNum(stats.q3 + k * stats.iqr, 4);
      } else {
        const z = action.threshold ?? 3.0;
        lower = roundNum(stats.mean - z * stats.stdDev, 4);
        upper = roundNum(stats.mean + z * stats.stdDev, 4);
      }

      if (action.treatment === "winsorize") {
        let capped = 0;
        for (const r of rows) {
          const v = r[col];
          if (typeof v === "number") {
            if (v < lower) {
              r[col] = lower;
              capped++;
            } else if (v > upper) {
              r[col] = upper;
              capped++;
            }
          }
        }
        return {
          headers,
          rows,
          description: `Winsorized ${capped} outlier(s) in "${col}" (${action.method.toUpperCase()} bounds [${lower}, ${upper}])`,
        };
      } else {
        const before = rows.length;
        const kept = rows.filter((r) => {
          const v = r[col];
          if (typeof v !== "number") return true;
          return v >= lower && v <= upper;
        });
        if (kept.length === 0) throw new Error("Removing outliers would remove all rows.");
        return {
          headers,
          rows: kept,
          description: `Removed ${before - kept.length} outlier row(s) from "${col}" (${action.method.toUpperCase()} bounds [${lower}, ${upper}])`,
        };
      }
    }

    case "standardize": {
      const col = action.column;
      const stats = computeNumericalStats(rows.map((r) => r[col]));
      if (!stats || stats.stdDev === 0) {
        throw new Error(`Cannot standardize "${col}": requires non-zero standard deviation.`);
      }
      for (const r of rows) {
        const v = r[col];
        if (typeof v === "number") {
          r[col] = roundNum((v - stats.mean) / stats.stdDev, 4);
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
      if (!stats || stats.max === stats.min) {
        throw new Error(`Cannot Min-Max normalize "${col}": range is zero.`);
      }
      const range = stats.max - stats.min;
      for (const r of rows) {
        const v = r[col];
        if (typeof v === "number") {
          r[col] = roundNum((v - stats.min) / range, 4);
        }
      }
      return {
        headers,
        rows,
        description: `Min-Max normalized "${col}" into [0, 1] range`,
      };
    }

    case "log_transform": {
      const col = action.column;
      const nums = rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
      if (nums.length === 0) throw new Error(`"${col}" contains no numerical values.`);
      const minVal = Math.min(...nums);
      if (minVal < 0) {
        throw new Error(
          `Log transformation ln(1+x) requires non-negative values (minimum in "${col}" is ${minVal}). Filter negative values first.`
        );
      }
      for (const r of rows) {
        const v = r[col];
        if (typeof v === "number") {
          r[col] = roundNum(Math.log1p(v), 4);
        }
      }
      return {
        headers,
        rows,
        description: `Applied Log(1+x) transformation to "${col}"`,
      };
    }
  }
}
