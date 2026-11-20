"use client";

import { useState } from "react";
import { ToolShell, SolveButton, ExampleChips } from "@/components/math/ToolShell";
import { StepsView } from "@/components/math/Steps";
import { ResultArea, useSolver } from "./algebra-tools";
import {
  descriptiveStats, distributionSteps, combinatoricsSteps, regressionSteps, hypothesisTestSteps,
  type StatsResult,
} from "@/lib/math/stats";
import { EXAMPLES } from "@/lib/tools";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from "recharts";

/* ------------------------------------------------------------------ */
/* Chart blocks                                                        */
/* ------------------------------------------------------------------ */

function HistogramChart({ result }: { result: StatsResult }) {
  if (!result.histogram) return null;
  const data = result.histogram.bins.map((b) => ({
    name: `${b.from.toFixed(1)}–${b.to.toFixed(1)}`,
    count: b.count,
  }));
  return (
    <div className="h-64 w-full">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Histogram</p>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip formatter={(v) => [v, "count"]} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#059669" fillOpacity={0.35 + 0.65 * (i / Math.max(1, data.length - 1))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScatterChartBlock({ result }: { result: StatsResult }) {
  if (!result.scatter) return null;
  const pts = result.scatter.points;
  const isCurve = pts.length > 12 && Math.abs(pts[1].x - pts[0].x) < 0.5; // pmf/pdf curves
  const lineFit = result.scatter.fit?.[0];
  const fitLine = lineFit && lineFit.m !== 0 ? [{ x: Math.min(...pts.map((p) => p.x)), y: lineFit.m * Math.min(...pts.map((p) => p.x)) + lineFit.b }, { x: Math.max(...pts.map((p) => p.x)), y: lineFit.m * Math.max(...pts.map((p) => p.x)) + lineFit.b }] : null;
  return (
    <div className="h-64 w-full">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{isCurve ? "Distribution" : "Scatter & fit"}</p>
      <ResponsiveContainer width="100%" height="90%">
        {isCurve ? (
          <LineChart data={pts} margin={{ top: 5, right: 5, bottom: 5, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} type="number" domain={["dataMin", "dataMax"]} />
            <YAxis dataKey="y" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [Number(v).toFixed(5), "P"]} contentStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="y" stroke="#059669" dot={pts.length < 30} strokeWidth={2} />
          </LineChart>
        ) : (
          <ScatterChart margin={{ top: 5, right: 5, bottom: 5, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="x" tick={{ fontSize: 11 }} type="number" domain={["dataMin", "dataMax"]} />
            <YAxis dataKey="y" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip formatter={(v) => Number(v).toFixed(3)} contentStyle={{ fontSize: 12 }} />
            <ZAxis range={[36, 36]} />
            <Scatter data={pts} fill="#059669" />
            {fitLine && (
              <Line data={fitLine} dataKey="y" stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="6 3" isAnimationActive={false} />
            )}
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function BoxPlotBlock({ result }: { result: StatsResult }) {
  if (!result.boxplot) return null;
  const b = result.boxplot;
  const data = [{ name: "data", min: b.min, q1: b.q1, median: b.median, q3: b.q3, max: b.max }];
  return (
    <div className="h-40 w-full">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Box plot (five-number summary)</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 60, bottom: 5, left: -18 }} barSize={40}>
          <XAxis type="number" domain={[b.min - 1, b.max + 1]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="q1" stackId="a" fill="transparent" />
          <Bar dataKey="median" stackId="a" fill="#d97706" radius={[2, 2, 2, 2]} />
          <Bar dataKey="q3" stackId="a" fill="#059669" opacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center font-mono">
        min {b.min} · Q1 {Number(b.q1.toFixed(3))} · median {Number(b.median.toFixed(3))} · Q3 {Number(b.q3.toFixed(3))} · max {b.max}
        {b.outliers.length ? ` · outliers: ${b.outliers.join(", ")}` : ""}
      </p>
    </div>
  );
}

function StatsResultArea({ result, loading }: { result: StatsResult | null; loading: boolean }) {
  if (loading || !result) return <ResultArea solution={result} loading={loading} />;
  return (
    <div className="space-y-5">
      <StepsView solution={result} />
      <HistogramChart result={result} />
      <BoxPlotBlock result={result} />
      <ScatterChartBlock result={result} />
    </div>
  );
}

/* ================================================================== */
/* Descriptive statistics                                              */
/* ================================================================== */

export function StatisticsTool() {
  const [data, setData] = useState("12 15 11 20 17 14 12 19 16 13");
  const [result, setResult] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const solve = () => {
    if (!data.trim()) return;
    setLoading(true);
    window.setTimeout(() => {
      try {
        setResult(descriptiveStats(data));
      } finally {
        setLoading(false);
      }
    }, 30);
  };

  return (
    <ToolShell
      toolId="statistics"
      inputPanel={
        <div>
          <Label htmlFor="stats-data" className="mb-2 block">Data values (space or comma separated)</Label>
          <textarea
            id="stats-data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={4}
            spellCheck={false}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="12 15 11 20 17 …"
          />
          <ExampleChips examples={EXAMPLES.statistics} onPick={setData} />
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label="Analyse data" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Mean, median, mode, quartiles, IQR, variance, standard deviation, skewness, kurtosis,
            outlier detection, histogram and box plot.
          </p>
        </div>
      }
      resultPanel={<StatsResultArea result={result} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Probability & distributions                                         */
/* ================================================================== */

export function ProbabilityTool() {
  const [dist, setDist] = useState<"binomial" | "normal" | "poisson" | "combinatorics">("binomial");
  const [n, setN] = useState("10");
  const [p, setP] = useState("0.5");
  const [mu, setMu] = useState("0");
  const [sigma, setSigma] = useState("1");
  const [lambda, setLambda] = useState("3");
  const [nC, setNC] = useState("10");
  const [kC, setKC] = useState("3");
  const [kindC, setKindC] = useState<"comb" | "perm" | "combRep" | "permRep">("comb");
  const [query, setQuery] = useState("exactly");
  const [kValue, setKValue] = useState("5");
  const [kValue2, setKValue2] = useState("7");
  const [result, setResult] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const solve = () => {
    setLoading(true);
    window.setTimeout(() => {
      try {
        if (dist === "combinatorics") {
          setResult(combinatoricsSteps(Number(nC), Number(kC), kindC));
        } else if (dist === "binomial") {
          setResult(distributionSteps("binomial", { n: Number(n), p: Number(p) }, { type: query as "exactly", value: Number(kValue), value2: Number(kValue2) }));
        } else if (dist === "normal") {
          setResult(distributionSteps("normal", { mu: Number(mu), sigma: Number(sigma) }, { type: query as "less", value: Number(kValue), value2: Number(kValue2) }));
        } else {
          setResult(distributionSteps("poisson", { lambda: Number(lambda) }, { type: query as "exactly", value: Number(kValue) }));
        }
      } finally {
        setLoading(false);
      }
    }, 30);
  };

  const queries =
    dist === "binomial" || dist === "poisson"
      ? [["exactly", "P(X = k)"], ["atMost", "P(X ≤ k)"], ["atLeast", "P(X ≥ k)"], ["between", "P(k ≤ X ≤ k₂)"]]
      : [["less", "P(X < x)"], ["greater", "P(X > x)"], ["between", "P(x₁ < X < x₂)"]];

  return (
    <ToolShell
      toolId="probability"
      inputPanel={
        <div className="space-y-4">
          <Tabs value={dist} onValueChange={(v) => setDist(v as typeof dist)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="binomial">Binomial</TabsTrigger>
              <TabsTrigger value="normal">Normal</TabsTrigger>
              <TabsTrigger value="poisson">Poisson</TabsTrigger>
              <TabsTrigger value="combinatorics">nCk / nPk</TabsTrigger>
            </TabsList>
          </Tabs>

          {dist === "binomial" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bin-n">Trials n</Label>
                <Input id="bin-n" value={n} onChange={(e) => setN(e.target.value)} className="mt-1.5 font-mono" inputMode="numeric" />
              </div>
              <div>
                <Label htmlFor="bin-p">Success prob p</Label>
                <Input id="bin-p" value={p} onChange={(e) => setP(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
              </div>
            </div>
          )}
          {dist === "normal" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nor-mu">Mean μ</Label>
                <Input id="nor-mu" value={mu} onChange={(e) => setMu(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="nor-sigma">Std dev σ</Label>
                <Input id="nor-sigma" value={sigma} onChange={(e) => setSigma(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
              </div>
            </div>
          )}
          {dist === "poisson" && (
            <div>
              <Label htmlFor="poi-l">Rate λ</Label>
              <Input id="poi-l" value={lambda} onChange={(e) => setLambda(e.target.value)} className="mt-1.5 font-mono w-28" inputMode="decimal" />
            </div>
          )}
          {dist === "combinatorics" ? (
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label htmlFor="cb-n">n</Label>
                <Input id="cb-n" value={nC} onChange={(e) => setNC(e.target.value)} className="mt-1.5 font-mono" inputMode="numeric" />
              </div>
              <div>
                <Label htmlFor="cb-k">k</Label>
                <Input id="cb-k" value={kC} onChange={(e) => setKC(e.target.value)} className="mt-1.5 font-mono" inputMode="numeric" />
              </div>
              <div>
                <Label className="mb-2 block">Type</Label>
                <Select value={kindC} onValueChange={(v) => setKindC(v as typeof kindC)}>
                  <SelectTrigger aria-label="combination type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comb">C(n,k) order off</SelectItem>
                    <SelectItem value="perm">P(n,k) order on</SelectItem>
                    <SelectItem value="combRep">⊕ C rep.</SelectItem>
                    <SelectItem value="permRep">⊕ P rep.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="mb-2 block">Probability query</Label>
                <Select value={query} onValueChange={setQuery}>
                  <SelectTrigger aria-label="Query type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {queries.map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dist-k">k / x value</Label>
                <Input id="dist-k" value={kValue} onChange={(e) => setKValue(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
              </div>
              {query === "between" && (
                <div>
                  <Label htmlFor="dist-k2">second value</Label>
                  <Input id="dist-k2" value={kValue2} onChange={(e) => setKValue2(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
                </div>
              )}
            </div>
          )}
          <SolveButton onClick={solve} loading={loading} label="Compute probability" />
        </div>
      }
      resultPanel={<StatsResultArea result={result} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Regression & correlation                                            */
/* ================================================================== */

export function RegressionTool() {
  const [pairs, setPairs] = useState("1 2\n2 4.1\n3 5.8\n4 8.2\n5 10.1");
  const [degree, setDegree] = useState("1");
  const [result, setResult] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const solve = () => {
    if (!pairs.trim()) return;
    setLoading(true);
    window.setTimeout(() => {
      try {
        setResult(regressionSteps(pairs, Number(degree)));
      } finally {
        setLoading(false);
      }
    }, 30);
  };

  return (
    <ToolShell
      toolId="regression"
      inputPanel={
        <div>
          <Label htmlFor="reg-data" className="mb-2 block">Data points — one (x, y) pair per line</Label>
          <textarea
            id="reg-data"
            value={pairs}
            onChange={(e) => setPairs(e.target.value)}
            rows={6}
            spellCheck={false}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={"1 2\n2 4.1\n3 5.8"}
          />
          <ExampleChips examples={EXAMPLES.regression} onPick={setPairs} />
          <div className="mt-4">
            <Label className="mb-2 block">Model</Label>
            <Select value={degree} onValueChange={setDegree}>
              <SelectTrigger aria-label="Regression model" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Linear (least squares)</SelectItem>
                <SelectItem value="2">Quadratic</SelectItem>
                <SelectItem value="3">Cubic</SelectItem>
                <SelectItem value="4">Degree 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label="Fit model" />
          </div>
        </div>
      }
      resultPanel={<StatsResultArea result={result} loading={loading} />}
    />
  );
}

/* ================================================================== */
/* Hypothesis testing                                                  */
/* ================================================================== */

export function HypothesisTool() {
  const [data, setData] = useState("102 98 101 99 103 97 100 104 98 100");
  const [mu0, setMu0] = useState("100");
  const [sigma, setSigma] = useState("");
  const [alpha, setAlpha] = useState("0.05");
  const [tails, setTails] = useState<"1" | "2">("2");
  const [result, setResult] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const solve = () => {
    if (!data.trim()) return;
    setLoading(true);
    window.setTimeout(() => {
      try {
        const s = sigma.trim() && Number(sigma) > 0 ? Number(sigma) : null;
        setResult(hypothesisTestSteps(data, Number(mu0) || 0, s, Number(alpha) || 0.05, Number(tails) as 1 | 2));
      } finally {
        setLoading(false);
      }
    }, 30);
  };

  return (
    <ToolShell
      toolId="hypothesis"
      inputPanel={
        <div>
          <Label htmlFor="hyp-data" className="mb-2 block">Sample data (numbers)</Label>
          <textarea
            id="hyp-data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={3}
            spellCheck={false}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <ExampleChips examples={EXAMPLES.hypothesis} onPick={setData} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="hyp-mu">Null mean μ₀</Label>
              <Input id="hyp-mu" value={mu0} onChange={(e) => setMu0(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="hyp-sigma">σ (blank = t-test)</Label>
              <Input id="hyp-sigma" value={sigma} onChange={(e) => setSigma(e.target.value)} className="mt-1.5 font-mono" inputMode="decimal" placeholder="estimated from data" />
            </div>
            <div>
              <Label htmlFor="hyp-alpha">Significance α</Label>
              <Select value={alpha} onValueChange={setAlpha}>
                <SelectTrigger id="hyp-alpha"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["0.10", "0.05", "0.02", "0.01", "0.001"].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Alternative</Label>
              <Select value={tails} onValueChange={(v) => setTails(v as "1" | "2")}>
                <SelectTrigger aria-label="tails"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">μ ≠ μ₀ (two-sided)</SelectItem>
                  <SelectItem value="1">μ &gt; μ₀ (one-sided)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <SolveButton onClick={solve} loading={loading} label="Run test" />
          </div>
        </div>
      }
      resultPanel={<StatsResultArea result={result} loading={loading} />}
    />
  );
}
