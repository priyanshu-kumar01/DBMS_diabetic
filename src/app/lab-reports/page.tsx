"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Loading, PageHeader, PatientLink, SqlPanel, StatCard } from "@/components/ui";
import { TrendLine } from "@/components/charts";
import { api, type ExecutedSql, fmtDate, hba1cTone, num, today, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;

export default function LabReportsPage() {
  const [pid, setPid] = useState("");
  const { data, loading, error, refresh } = useFetch<{ rows: Row[]; stats: Row }>(`/api/lab-reports?patient_id=${pid}`);
  const [form, setForm] = useState({ patient_id: "", hba1c: "", blood_pressure: "", report_date: today() });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ executedSql: ExecutedSql }>("/api/lab-reports", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: "Lab report inserted." });
      setForm((f) => ({ ...f, hba1c: "", blood_pressure: "" }));
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }
  async function remove(id: unknown) {
    if (!confirm("Delete this lab report?")) return;
    const r = await api<{ executedSql: ExecutedSql }>(`/api/lab-reports/${id}`, { method: "DELETE" });
    setLastSql(r.executedSql);
    refresh();
  }
  const s = data?.stats;
  const trend = pid ? [...(data?.rows ?? [])].reverse().map((r) => ({ day: String(r.report_date), hba1c: r.hba1c, systolic: r.bp_systolic, diastolic: r.bp_diastolic })) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Lab Reports – HbA1c & Blood Pressure" description="lab_report holds HbA1c (CHECK 3–20 %) and blood pressure stored atomically as bp_systolic / bp_diastolic (1NF). The 'previous' and 'change' columns come from the LAG() window function partitioned by patient." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Add HbA1c report" subtitle="INSERT INTO lab_report (patient_id, hba1c, bp_systolic, bp_diastolic, report_date)">
            <form onSubmit={submit} className="space-y-3">
              <Field label="Patient"><PatientSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="HbA1c (%)"><Input required type="number" step="0.01" min={3} max={20} value={form.hba1c} onChange={(e) => setForm({ ...form, hba1c: e.target.value })} /></Field>
                <Field label="Blood pressure" hint="systolic/diastolic"><Input required pattern="\d{2,3}/\d{2,3}" placeholder="120/80" value={form.blood_pressure} onChange={(e) => setForm({ ...form, blood_pressure: e.target.value })} /></Field>
              </div>
              <Field label="Report date"><Input type="date" required value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} /></Field>
              <Button type="submit">Insert report</Button>
            </form>
            {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Filter" subtitle="WHERE patient_id = ?"><PatientSelect value={pid} onChange={setPid} allowAll /></Card>
          {error && <Alert tone="error">{error}</Alert>}
          {s && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Reports" value={String(s.total)} tone="slate" sql="COUNT(*)" />
              <StatCard label="Avg HbA1c" value={`${num(s.avg_hba1c, 2)} %`} tone="violet" sql="AVG(hba1c)" />
              <StatCard label="Max HbA1c" value={`${num(s.max_hba1c, 2)} %`} tone="rose" sql="MAX(hba1c)" />
              <StatCard label="Min HbA1c" value={`${num(s.min_hba1c, 2)} %`} tone="emerald" sql="MIN(hba1c)" />
              <StatCard label="Avg BP" value={`${num(s.avg_systolic, 0)}/${num(s.avg_diastolic, 0)}`} tone="blue" sql="AVG(bp_systolic), AVG(bp_diastolic)" />
            </div>
          )}
          {pid && trend.length > 0 && (
            <Card title="HbA1c trend" subtitle="Reports of the selected patient ordered by report_date">
              <TrendLine data={trend} x="day" series={[{ key: "hba1c", label: "HbA1c %", color: "#8b5cf6" }]} height={220} refLines={[{ y: 6.5, label: "6.5 (diabetes)", color: "#e11d48" }, { y: 5.7, label: "5.7 (pre-diabetes)", color: "#f59e0b" }]} />
            </Card>
          )}
          <Card title="Previous reports & comparison" subtitle="LAG(hba1c) OVER (PARTITION BY patient_id ORDER BY report_date) AS previous_hba1c" actions={<span className="text-xs text-slate-500">{data?.rows.length ?? 0} row(s)</span>}>
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows ?? []} rowKey={(r) => String(r.lab_id)} columns={[
                { key: "lab_id", label: "ID" },
                { key: "report_date", label: "Date", render: (r) => fmtDate(r.report_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "hba1c", label: "HbA1c %", render: (r) => <Badge tone={hba1cTone(r.hba1c)}>{num(r.hba1c, 2)}</Badge> },
                { key: "previous_hba1c", label: "Previous", render: (r) => (r.previous_hba1c == null ? <span className="text-slate-400">first report</span> : num(r.previous_hba1c, 2)) },
                { key: "change", label: "Change", render: (r) => (r.change == null ? "—" : <span className={Number(r.change) > 0 ? "font-semibold text-rose-600" : Number(r.change) < 0 ? "font-semibold text-emerald-600" : ""}>{Number(r.change) > 0 ? "▲ +" : Number(r.change) < 0 ? "▼ " : ""}{num(r.change, 2)}</span>) },
                { key: "blood_pressure", label: "BP" },
                { key: "actions", label: "", render: (r) => <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => remove(r.lab_id)}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
