"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Loading, MEASUREMENT_TYPES, PageHeader, PatientLink, Select, SqlPanel, StatCard } from "@/components/ui";
import { TrendLine } from "@/components/charts";
import { api, type ExecutedSql, fmtDateTime, glucoseTone, num, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
interface Resp { rows: Row[]; stats: Row; highest: Row | null; lowest: Row | null; trend: Row[] }

export default function GlucosePage() {
  const [pid, setPid] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, loading, error, refresh } = useFetch<Resp>(`/api/glucose?patient_id=${pid}&type=${type}&from=${from}&to=${to}`);

  const [form, setForm] = useState({ patient_id: "", glucose_level: "", measurement_type: "Fasting", record_date: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ executedSql: ExecutedSql }>("/api/glucose", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: "Glucose reading inserted." });
      setForm((f) => ({ ...f, glucose_level: "" }));
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }
  async function remove(id: unknown) {
    if (!confirm("Delete this reading?")) return;
    const r = await api<{ executedSql: ExecutedSql }>(`/api/glucose/${id}`, { method: "DELETE" });
    setLastSql(r.executedSql);
    refresh();
  }
  const s = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader title="Blood Sugar Management" description="blood_sugar_record stores each glucose measurement (CHECK 20–600 mg/dL, measurement_type domain). Aggregates below are computed by SQL: COUNT, AVG, MAX, MIN, conditional AVG with CASE and GROUP BY day for the trend." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Add glucose reading" subtitle="INSERT INTO blood_sugar_record (patient_id, glucose_level, measurement_type, record_date)">
            <form onSubmit={submit} className="space-y-3">
              <Field label="Patient"><PatientSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Glucose (mg/dL)"><Input required type="number" step="0.1" min={20} max={600} value={form.glucose_level} onChange={(e) => setForm({ ...form, glucose_level: e.target.value })} /></Field>
                <Field label="Measurement type"><Select value={form.measurement_type} onChange={(e) => setForm({ ...form, measurement_type: e.target.value })}>{MEASUREMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              </div>
              <Field label="Date & time (blank = now)"><Input type="datetime-local" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} /></Field>
              <Button type="submit">Insert reading</Button>
            </form>
            {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Filters" subtitle="WHERE patient_id = ? AND measurement_type = ? AND record_date BETWEEN ? AND ?">
            <div className="grid gap-2 md:grid-cols-5">
              <PatientSelect value={pid} onChange={setPid} allowAll />
              <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{MEASUREMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <Button variant="secondary" onClick={() => { setPid(""); setType(""); setFrom(""); setTo(""); }}>Clear</Button>
            </div>
          </Card>
          {error && <Alert tone="error">{error}</Alert>}
          {s && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Readings" value={String(s.total)} tone="slate" sql="COUNT(*)" />
              <StatCard label="Average" value={num(s.avg)} hint="mg/dL" tone="teal" sql="AVG(glucose_level)" />
              <StatCard label="Highest" value={num(s.max)} hint={data?.highest ? `${data.highest.patient_name} · ${data.highest.measurement_type} · ${fmtDateTime(data.highest.record_date)}` : undefined} tone="rose" sql="MAX(glucose_level)" />
              <StatCard label="Lowest" value={num(s.min)} hint={data?.lowest ? `${data.lowest.patient_name} · ${data.lowest.measurement_type} · ${fmtDateTime(data.lowest.record_date)}` : undefined} tone="emerald" sql="MIN(glucose_level)" />
              <StatCard label="Avg fasting" value={num(s.avg_fasting)} tone="blue" sql="AVG(CASE WHEN measurement_type='Fasting' THEN glucose_level END)" />
              <StatCard label="Avg post-meal" value={num(s.avg_post_meal)} tone="amber" sql="AVG(CASE WHEN measurement_type='Post-Meal' …)" />
              <StatCard label="High (>180)" value={String(s.high_count)} tone="rose" sql="SUM(CASE WHEN glucose_level > 180 THEN 1 ELSE 0 END)" />
              <StatCard label="Low (<70)" value={String(s.low_count)} tone="violet" sql="SUM(CASE WHEN glucose_level < 70 THEN 1 ELSE 0 END)" />
            </div>
          )}
          <Card title="Glucose trend – daily averages (last 30 days)" subtitle="GROUP BY record_date::date">
            {data?.trend?.length ? (
              <TrendLine data={data.trend} x="day" series={[{ key: "fasting", label: "Fasting" }, { key: "post_meal", label: "Post-meal", color: "#f59e0b" }, { key: "overall", label: "Overall", color: "#64748b" }]} refLines={[{ y: 126, label: "126 fasting", color: "#e11d48" }, { y: 180, label: "180", color: "#f97316" }]} />
            ) : <p className="text-sm text-slate-500">No readings in the last 30 days for this filter.</p>}
          </Card>
          <Card title="Glucose history" subtitle="ORDER BY record_date DESC LIMIT 300" actions={<span className="text-xs text-slate-500">{data?.rows.length ?? 0} row(s)</span>}>
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows ?? []} rowKey={(r) => String(r.sugar_record_id)} columns={[
                { key: "sugar_record_id", label: "ID" },
                { key: "record_date", label: "Recorded at", render: (r) => fmtDateTime(r.record_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "measurement_type", label: "Type" },
                { key: "glucose_level", label: "mg/dL", render: (r) => <Badge tone={glucoseTone(r.glucose_level, String(r.measurement_type))}>{num(r.glucose_level)}</Badge> },
                { key: "actions", label: "", render: (r) => <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => remove(r.sugar_record_id)}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
