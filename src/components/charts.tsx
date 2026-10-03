"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = ["#0d9488", "#0ea5e9", "#f59e0b", "#e11d48", "#8b5cf6", "#10b981", "#64748b"];
export const RISK_COLORS: Record<string, string> = { "Low Risk": "#10b981", "Moderate Risk": "#f59e0b", "High Risk": "#e11d48" };

type Row = Record<string, unknown>;
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export function TrendLine({ data, x, series, height = 260, refLines = [] }: { data: Row[]; x: string; series: { key: string; label: string; color?: string }[]; height?: number; refLines?: { y: number; label: string; color?: string }[] }) {
  const rows = data.map((d) => ({ ...d, ...Object.fromEntries(series.map((s) => [s.key, n(d[s.key])])) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
        <Tooltip />
        <Legend />
        {refLines.map((r) => (
          <ReferenceLine key={r.label} y={r.y} stroke={r.color ?? "#e11d48"} strokeDasharray="4 4" label={{ value: r.label, fontSize: 10, position: "insideTopRight" }} />
        ))}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, x, series, height = 260, stacked = false }: { data: Row[]; x: string; series: { key: string; label: string; color?: string }[]; height?: number; stacked?: boolean }) {
  const rows = data.map((d) => ({ ...d, ...Object.fromEntries(series.map((s) => [s.key, n(d[s.key]) ?? 0])) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i % PALETTE.length]} stackId={stacked ? "a" : undefined} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, nameKey, valueKey, height = 260, colors }: { data: Row[]; nameKey: string; valueKey: string; height?: number; colors?: Record<string, string> }) {
  const rows = data.map((d) => ({ name: String(d[nameKey]), value: n(d[valueKey]) ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label={(p) => `${p.name}: ${p.value}`}>
          {rows.map((r, i) => (
            <Cell key={r.name} fill={colors?.[r.name] ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
