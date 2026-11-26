"use client";

import { useState } from "react";
import {
  ArrowDownUp,
  CheckCircle2,
  Filter,
  History,
  Redo2,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  Edit3,
  CopyCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatasetProfile, TransformationAction } from "@/lib/math/eda-engine";

export function EDACleanerPanel({
  profile,
  canUndo,
  canRedo,
  isModified,
  historyLog,
  onApply,
  onUndo,
  onRedo,
  onReset,
}: {
  profile: DatasetProfile;
  canUndo: boolean;
  canRedo: boolean;
  isModified: boolean;
  historyLog: { timestamp: string; action: string }[];
  onApply: (action: TransformationAction) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  const allCols = profile.columns.map((c) => c.name);
  const numCols = profile.numericalColumns;

  // 1. Column Actions
  const [colToDrop, setColToDrop] = useState<string>(allCols[0] || "");
  const [colToRename, setColToRename] = useState<string>(allCols[0] || "");
  const [newColName, setNewColName] = useState<string>("");

  // 2. Filter Rows
  const [filterCol, setFilterCol] = useState<string>(allCols[0] || "");
  const [filterOp, setFilterOp] = useState<
    "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "is_null" | "not_null"
  >("not_null");
  const [filterVal, setFilterVal] = useState<string>("");

  // 3. Sort
  const [sortCol, setSortCol] = useState<string>(numCols[0] || allCols[0] || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // 4. Missing values
  const [missingCol, setMissingCol] = useState<string>("__ALL__");
  const [missingStrat, setMissingStrat] = useState<"mean" | "median" | "mode" | "custom" | "drop_rows">("median");
  const [customImputeVal, setCustomImputeVal] = useState<string>("0");

  // 5. Outliers
  const [outlierCol, setOutlierCol] = useState<string>(numCols[0] || "");
  const [outlierMethod, setOutlierMethod] = useState<"iqr" | "zscore">("iqr");
  const [outlierThreshold, setOutlierThreshold] = useState<string>("1.5");
  const [outlierTreatment, setOutlierTreatment] = useState<"winsorize" | "remove_rows">("winsorize");

  // 6. Scaling & Math Transforms
  const [scaleCol, setScaleCol] = useState<string>(numCols[0] || "");

  const effectiveOutlierCol = numCols.includes(outlierCol) ? outlierCol : numCols[0] || "";
  const effectiveScaleCol = numCols.includes(scaleCol) ? scaleCol : numCols[0] || "";
  const selectedOutlierStats = profile.columns.find((c) => c.name === effectiveOutlierCol)?.numStats;

  return (
    <div className="space-y-6">
      {/* History Toolbar */}
      <div className="rounded-3xl border bg-card p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-foreground">Working Copy Transformation Workspace</h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                isModified
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
              }`}
            >
              {isModified ? `Modified (${historyLog.length} steps)` : "Original Untouched"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            All operations run safely on a separate working copy. Your original uploaded dataset remains preserved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onUndo} disabled={!canUndo} className="gap-1.5 rounded-xl text-xs font-bold">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button size="sm" variant="outline" onClick={onRedo} disabled={!canRedo} className="gap-1.5 rounded-xl text-xs font-bold">
            <Redo2 className="h-3.5 w-3.5" /> Redo
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onReset}
            disabled={!isModified}
            className="gap-1.5 rounded-xl text-xs font-bold"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore Original
          </Button>
        </div>
      </div>

      {/* Cleaning Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Missing Values */}
        <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" /> Handle Missing Values
            </h4>
            <span className="text-[11px] font-mono font-bold text-muted-foreground">
              {profile.totalMissingCells} nulls
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Column</label>
              <select
                value={missingCol}
                onChange={(e) => setMissingCol(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
              >
                <option value="__ALL__">All Eligible Columns</option>
                {profile.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.missingCount} missing)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Strategy</label>
              <select
                value={missingStrat}
                onChange={(e) => setMissingStrat(e.target.value as any)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
              >
                <option value="median">Median Imputation (Numeric Robust)</option>
                <option value="mean">Mean Imputation (Numeric Normal)</option>
                <option value="mode">Mode Imputation (Most Frequent)</option>
                <option value="custom">Custom Value Fill</option>
                <option value="drop_rows">Remove Rows with Missing Values</option>
              </select>
            </div>
            {missingStrat === "custom" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Custom Fill Value</label>
                <Input
                  value={customImputeVal}
                  onChange={(e) => setCustomImputeVal(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                  placeholder="Enter replacement value..."
                />
              </div>
            )}
            <Button
              size="sm"
              className="w-full rounded-xl font-bold"
              onClick={() =>
                onApply({
                  type: "handle_missing",
                  column: missingCol,
                  strategy: missingStrat,
                  customValue: customImputeVal,
                })
              }
            >
              Apply Missing Value Fix
            </Button>
          </div>
        </div>

        {/* Card 2: Outlier Detection & Treatment */}
        <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Outlier Detection &amp; Fix
            </h4>
            {selectedOutlierStats && (
              <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded">
                IQR: {selectedOutlierStats.iqrOutlierCount} | Z&gt;3: {selectedOutlierStats.zScoreOutlierCount}
              </span>
            )}
          </div>
          {numCols.length === 0 ? (
            <p className="text-xs text-muted-foreground">No numerical columns available for outlier handling.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Numerical Column</label>
                <select
                  value={effectiveOutlierCol}
                  onChange={(e) => setOutlierCol(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
                >
                  {numCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Method</label>
                  <select
                    value={outlierMethod}
                    onChange={(e) => {
                      const m = e.target.value as "iqr" | "zscore";
                      setOutlierMethod(m);
                      setOutlierThreshold(m === "iqr" ? "1.5" : "3.0");
                    }}
                    className="w-full rounded-xl border bg-background px-2 py-2 text-xs font-semibold"
                  >
                    <option value="iqr">IQR Fences</option>
                    <option value="zscore">Z-Score (|Z|)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Threshold</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={outlierThreshold}
                    onChange={(e) => setOutlierThreshold(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Treatment</label>
                <select
                  value={outlierTreatment}
                  onChange={(e) => setOutlierTreatment(e.target.value as any)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
                >
                  <option value="winsorize">Winsorize (Clamp to Fences)</option>
                  <option value="remove_rows">Remove Outlier Rows</option>
                </select>
              </div>
              <Button
                size="sm"
                className="w-full rounded-xl font-bold"
                onClick={() =>
                  onApply({
                    type: "outliers",
                    column: effectiveOutlierCol,
                    method: outlierMethod,
                    threshold: Number(outlierThreshold) || (outlierMethod === "iqr" ? 1.5 : 3.0),
                    treatment: outlierTreatment,
                  })
                }
              >
                Apply Outlier Treatment
              </Button>
            </div>
          )}
        </div>

        {/* Card 3: Feature Scaling & Transforms */}
        <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Scissors className="h-4 w-4 text-sky-600" /> Scaling &amp; Transformations
          </h4>
          {numCols.length === 0 ? (
            <p className="text-xs text-muted-foreground">No numerical columns available.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Numerical Column</label>
                <select
                  value={effectiveScaleCol}
                  onChange={(e) => setScaleCol(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
                >
                  {numCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold justify-start"
                  onClick={() => onApply({ type: "standardize", column: effectiveScaleCol })}
                >
                  Z-Score Standardization (mean=0, std=1)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold justify-start"
                  onClick={() => onApply({ type: "normalize_minmax", column: effectiveScaleCol })}
                >
                  Min-Max Normalization ([0, 1] scale)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold justify-start"
                  onClick={() => onApply({ type: "log_transform", column: effectiveScaleCol })}
                >
                  Log Transform ln(1 + x) (x &ge; 0 only)
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Filter Rows */}
        <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-600" /> Filter Rows
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Column</label>
              <select
                value={allCols.includes(filterCol) ? filterCol : allCols[0] || ""}
                onChange={(e) => setFilterCol(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
              >
                {allCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterOp}
                onChange={(e) => setFilterOp(e.target.value as any)}
                className="rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
              >
                <option value="not_null">Is Not Null</option>
                <option value="is_null">Is Null</option>
                <option value="eq">Equals (==)</option>
                <option value="neq">Not Equal (!=)</option>
                <option value="gt">Greater (&gt;)</option>
                <option value="gte">Greater/Eq (&gt;=)</option>
                <option value="lt">Less (&lt;)</option>
                <option value="lte">Less/Eq (&lt;=)</option>
                <option value="contains">Contains text</option>
              </select>
              {filterOp !== "is_null" && filterOp !== "not_null" && (
                <Input
                  value={filterVal}
                  onChange={(e) => setFilterVal(e.target.value)}
                  placeholder="Value..."
                  className="h-9 text-xs rounded-xl"
                />
              )}
            </div>
            <Button
              size="sm"
              className="w-full rounded-xl font-bold"
              onClick={() =>
                onApply({
                  type: "filter_rows",
                  column: allCols.includes(filterCol) ? filterCol : allCols[0],
                  operator: filterOp,
                  value: filterVal,
                })
              }
            >
              Apply Row Filter
            </Button>
          </div>
        </div>

        {/* Card 5: Sort & Remove Duplicates */}
        <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <ArrowDownUp className="h-4 w-4 text-teal-600" /> Sort &amp; Deduplicate
          </h4>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <select
                value={allCols.includes(sortCol) ? sortCol : allCols[0] || ""}
                onChange={(e) => setSortCol(e.target.value)}
                className="col-span-2 rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
              >
                {allCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                className="rounded-xl border bg-background px-2 py-2 text-xs font-semibold"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl text-xs font-bold"
              onClick={() =>
                onApply({
                  type: "sort_data",
                  column: allCols.includes(sortCol) ? sortCol : allCols[0],
                  direction: sortDir,
                })
              }
            >
              Sort Dataset
            </Button>

            <div className="pt-2 border-t flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Duplicates: <strong className="text-foreground">{profile.duplicateRowCount}</strong>
              </span>
              <Button
                size="sm"
                variant={profile.duplicateRowCount > 0 ? "default" : "outline"}
                className="rounded-xl text-xs font-bold gap-1.5"
                onClick={() => onApply({ type: "remove_duplicates" })}
              >
                <CopyCheck className="h-3.5 w-3.5" /> Remove Duplicates
              </Button>
            </div>
          </div>
        </div>

        {/* Card 6: Remove / Rename Columns */}
        <div className="rounded-3xl border bg-card p-5 shadow-xs space-y-4">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-rose-600" /> Remove or Rename Column
          </h4>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={allCols.includes(colToDrop) ? colToDrop : allCols[0] || ""}
                onChange={(e) => setColToDrop(e.target.value)}
                className="flex-1 rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
              >
                {allCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl text-xs font-bold gap-1"
                disabled={allCols.length <= 1}
                onClick={() =>
                  onApply({
                    type: "remove_columns",
                    columns: [allCols.includes(colToDrop) ? colToDrop : allCols[0]],
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" /> Drop
              </Button>
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={allCols.includes(colToRename) ? colToRename : allCols[0] || ""}
                  onChange={(e) => setColToRename(e.target.value)}
                  className="rounded-xl border bg-background px-2 py-2 text-xs font-semibold"
                >
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="New name..."
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-xl text-xs font-bold"
                disabled={!newColName.trim()}
                onClick={() => {
                  onApply({
                    type: "rename_column",
                    oldName: allCols.includes(colToRename) ? colToRename : allCols[0],
                    newName: newColName.trim(),
                  });
                  setNewColName("");
                }}
              >
                Rename Column
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Operation Audit Log */}
      <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-600" /> Transformation Operation History
          </h4>
          <span className="text-xs text-muted-foreground">{historyLog.length} recorded step(s)</span>
        </div>
        {historyLog.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No modifications performed yet. Actions taken above are tracked here and included in your PDF report.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {historyLog.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-semibold text-foreground">{item.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
