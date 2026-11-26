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
import { cn } from "@/lib/utils";

const SELECT_CLS =
  "w-full h-9 rounded-xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 px-3 text-xs font-medium text-zinc-800 transition-colors";

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

  const [colToDrop, setColToDrop] = useState<string>(allCols[0] || "");
  const [colToRename, setColToRename] = useState<string>(allCols[0] || "");
  const [newColName, setNewColName] = useState<string>("");

  const [filterCol, setFilterCol] = useState<string>(allCols[0] || "");
  const [filterOp, setFilterOp] = useState<
    "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "is_null" | "not_null"
  >("not_null");
  const [filterVal, setFilterVal] = useState<string>("");

  const [sortCol, setSortCol] = useState<string>(numCols[0] || allCols[0] || "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [missingCol, setMissingCol] = useState<string>("__ALL__");
  const [missingStrat, setMissingStrat] = useState<"mean" | "median" | "mode" | "custom" | "drop_rows">("median");
  const [customImputeVal, setCustomImputeVal] = useState<string>("0");

  const [outlierCol, setOutlierCol] = useState<string>(numCols[0] || "");
  const [outlierMethod, setOutlierMethod] = useState<"iqr" | "zscore">("iqr");
  const [outlierThreshold, setOutlierThreshold] = useState<string>("1.5");
  const [outlierTreatment, setOutlierTreatment] = useState<"winsorize" | "remove_rows">("winsorize");

  const [scaleCol, setScaleCol] = useState<string>(numCols[0] || "");

  const effectiveOutlierCol = numCols.includes(outlierCol) ? outlierCol : numCols[0] || "";
  const effectiveScaleCol = numCols.includes(scaleCol) ? scaleCol : numCols[0] || "";
  const selectedOutlierStats = profile.columns.find((c) => c.name === effectiveOutlierCol)?.numStats;

  return (
    <div className="space-y-6">
      {/* Clean Notion/Apple History Toolbar */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-semibold text-base text-zinc-900">Data Cleaning Workspace</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
                isModified
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-zinc-100 text-zinc-700 border-zinc-200"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", isModified ? "bg-amber-500" : "bg-emerald-500")} />
              {isModified ? `Modified (${historyLog.length} steps)` : "Original Dataset"}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Transformations modify a working copy only. Undo any step or restore the original file anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onUndo} disabled={!canUndo} className="gap-1.5 rounded-xl border-zinc-200 text-xs font-medium h-8">
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </Button>
          <Button size="sm" variant="outline" onClick={onRedo} disabled={!canRedo} className="gap-1.5 rounded-xl border-zinc-200 text-xs font-medium h-8">
            <Redo2 className="h-3.5 w-3.5" /> Redo
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReset}
            disabled={!isModified}
            className="gap-1.5 rounded-xl border-zinc-200 text-xs font-medium h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore Original
          </Button>
        </div>
      </div>

      {/* Cleaning Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Missing Values */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                Missing Values
              </h4>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">
                {profile.totalMissingCells} missing
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Column</label>
                <select value={missingCol} onChange={(e) => setMissingCol(e.target.value)} className={SELECT_CLS}>
                  <option value="__ALL__">All columns</option>
                  {profile.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.missingCount} missing)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Method</label>
                <select value={missingStrat} onChange={(e) => setMissingStrat(e.target.value as any)} className={SELECT_CLS}>
                  <option value="median">Fill with Median (Numeric)</option>
                  <option value="mean">Fill with Mean (Numeric)</option>
                  <option value="mode">Fill with Most Frequent</option>
                  <option value="custom">Fill with Custom Value</option>
                  <option value="drop_rows">Drop Rows with Missing Values</option>
                </select>
              </div>
              {missingStrat === "custom" && (
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Replacement Value</label>
                  <Input
                    value={customImputeVal}
                    onChange={(e) => setCustomImputeVal(e.target.value)}
                    className="h-9 text-xs rounded-xl border-zinc-200 bg-zinc-50/70"
                    placeholder="Enter value..."
                  />
                </div>
              )}
            </div>
          </div>

          <Button
            size="sm"
            className="w-full rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white h-9"
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

        {/* Card 2: Outlier Detection & Treatment */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                Outliers
              </h4>
              {selectedOutlierStats && (
                <span className="text-xs font-mono text-zinc-500 tabular-nums">
                  {selectedOutlierStats.iqrOutlierCount} detected
                </span>
              )}
            </div>

            {numCols.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4">No numerical columns available.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Column</label>
                  <select value={effectiveOutlierCol} onChange={(e) => setOutlierCol(e.target.value)} className={SELECT_CLS}>
                    {numCols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Detection</label>
                    <select
                      value={outlierMethod}
                      onChange={(e) => {
                        const m = e.target.value as "iqr" | "zscore";
                        setOutlierMethod(m);
                        setOutlierThreshold(m === "iqr" ? "1.5" : "3.0");
                      }}
                      className={SELECT_CLS}
                    >
                      <option value="iqr">IQR Bounds</option>
                      <option value="zscore">Z-Score</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1">Multiplier</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={outlierThreshold}
                      onChange={(e) => setOutlierThreshold(e.target.value)}
                      className="h-9 text-xs rounded-xl border-zinc-200 bg-zinc-50/70"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Action</label>
                  <select value={outlierTreatment} onChange={(e) => setOutlierTreatment(e.target.value as any)} className={SELECT_CLS}>
                    <option value="winsorize">Cap at Boundary Values</option>
                    <option value="remove_rows">Remove Outlier Rows</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {numCols.length > 0 && (
            <Button
              size="sm"
              className="w-full rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white h-9"
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
              Apply Outlier Action
            </Button>
          )}
        </div>

        {/* Card 3: Scaling & Math Transforms */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <Scissors className="h-3.5 w-3.5" />
              </span>
              Scaling &amp; Normalization
            </h4>
            {numCols.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4">No numerical columns available.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500 block mb-1">Column</label>
                  <select value={effectiveScaleCol} onChange={(e) => setScaleCol(e.target.value)} className={SELECT_CLS}>
                    {numCols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl border-zinc-200 text-xs font-medium justify-start h-9 hover:bg-zinc-100 text-zinc-700"
                    onClick={() => onApply({ type: "standardize", column: effectiveScaleCol })}
                  >
                    Standardize (Z-Score: μ=0, σ=1)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl border-zinc-200 text-xs font-medium justify-start h-9 hover:bg-zinc-100 text-zinc-700"
                    onClick={() => onApply({ type: "normalize_minmax", column: effectiveScaleCol })}
                  >
                    Normalize to [0, 1] Range
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl border-zinc-200 text-xs font-medium justify-start h-9 hover:bg-zinc-100 text-zinc-700"
                    onClick={() => onApply({ type: "log_transform", column: effectiveScaleCol })}
                  >
                    Log Transform ln(1 + x)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Filter Rows */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <Filter className="h-3.5 w-3.5" />
              </span>
              Filter Rows
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Column</label>
                <select value={allCols.includes(filterCol) ? filterCol : allCols[0] || ""} onChange={(e) => setFilterCol(e.target.value)} className={SELECT_CLS}>
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={filterOp} onChange={(e) => setFilterOp(e.target.value as any)} className={SELECT_CLS}>
                  <option value="not_null">Is Not Empty</option>
                  <option value="is_null">Is Empty</option>
                  <option value="eq">Equals</option>
                  <option value="neq">Not Equal</option>
                  <option value="gt">Greater (&gt;)</option>
                  <option value="gte">Greater/Eq (&gt;=)</option>
                  <option value="lt">Less (&lt;)</option>
                  <option value="lte">Less/Eq (&lt;=)</option>
                  <option value="contains">Contains</option>
                </select>
                {filterOp !== "is_null" && filterOp !== "not_null" && (
                  <Input
                    value={filterVal}
                    onChange={(e) => setFilterVal(e.target.value)}
                    placeholder="Value..."
                    className="h-9 text-xs rounded-xl border-zinc-200 bg-zinc-50/70"
                  />
                )}
              </div>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white h-9"
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

        {/* Card 5: Sort & Deduplicate */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <ArrowDownUp className="h-3.5 w-3.5" />
              </span>
              Sort &amp; Deduplicate
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={allCols.includes(sortCol) ? sortCol : allCols[0] || ""}
                  onChange={(e) => setSortCol(e.target.value)}
                  className={cn(SELECT_CLS, "col-span-2")}
                >
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")} className={SELECT_CLS}>
                  <option value="asc">A → Z</option>
                  <option value="desc">Z → A</option>
                </select>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-xl border-zinc-200 text-xs font-medium h-9 hover:bg-zinc-100"
                onClick={() =>
                  onApply({
                    type: "sort_data",
                    column: allCols.includes(sortCol) ? sortCol : allCols[0],
                    direction: sortDir,
                  })
                }
              >
                Sort Rows
              </Button>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              Duplicates: <strong className="text-zinc-900 tabular-nums">{profile.duplicateRowCount}</strong>
            </span>
            <Button
              size="sm"
              variant={profile.duplicateRowCount > 0 ? "default" : "outline"}
              className={cn(
                "rounded-xl text-xs font-medium gap-1.5 h-8",
                profile.duplicateRowCount > 0 ? "bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600"
              )}
              onClick={() => onApply({ type: "remove_duplicates" })}
            >
              <CopyCheck className="h-3.5 w-3.5" /> Deduplicate
            </Button>
          </div>
        </div>

        {/* Card 6: Remove / Rename Columns */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <Edit3 className="h-3.5 w-3.5" />
              </span>
              Manage Columns
            </h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={allCols.includes(colToDrop) ? colToDrop : allCols[0] || ""}
                  onChange={(e) => setColToDrop(e.target.value)}
                  className={cn(SELECT_CLS, "flex-1")}
                >
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-zinc-200 text-rose-600 hover:bg-rose-50 text-xs font-medium gap-1 h-9 px-3 shrink-0"
                  disabled={allCols.length <= 1}
                  onClick={() =>
                    onApply({
                      type: "remove_columns",
                      columns: [allCols.includes(colToDrop) ? colToDrop : allCols[0]],
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>

              <div className="pt-2 border-t border-zinc-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={allCols.includes(colToRename) ? colToRename : allCols[0] || ""}
                    onChange={(e) => setColToRename(e.target.value)}
                    className={SELECT_CLS}
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
                    className="h-9 text-xs rounded-xl border-zinc-200 bg-zinc-50/70"
                  />
                </div>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-xl border-zinc-200 text-xs font-medium h-9 hover:bg-zinc-100"
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

      {/* Operation History Audit Log */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" /> Change Log
          </h4>
          <span className="text-xs text-zinc-400 tabular-nums">{historyLog.length} steps recorded</span>
        </div>
        {historyLog.length === 0 ? (
          <p className="text-xs text-zinc-400 py-1">
            No transformations applied yet. All cleaning steps are logged here and included in exported reports.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {historyLog.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl border border-zinc-200/60 bg-zinc-50/70 px-3 py-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono text-[11px] text-zinc-400 shrink-0 tabular-nums">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-medium text-zinc-800">{item.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
