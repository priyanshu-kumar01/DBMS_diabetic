"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Loading, PageHeader, PatientLink, RECO_TYPES, Select, SqlPanel, Textarea } from "@/components/ui";
import { api, type ExecutedSql, fmtDate, today, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
const TEMPLATES: Record<string, string[]> = {
  Meal: ["Prefer low-glycaemic meals such as oats, millets and legumes; limit carbohydrates to 45 g per meal.", "Replace sugary drinks with water or unsweetened buttermilk; add a salad before lunch and dinner."],
  Activity: ["Walk briskly for 30 minutes on at least 5 days a week (150 min/week target).", "Add two light strength sessions per week using resistance bands or bodyweight exercises."],
  General: ["Monitor fasting glucose three times a week and record it in the system.", "Sleep 7–8 hours, stay hydrated and repeat HbA1c test in 3 months."],
};

export default function RecommendationsPage() {
  const [pid, setPid] = useState("");
  const [type, setType] = useState("");
  const { data, loading, error, refresh } = useFetch<{ rows: Row[]; byType: Row[] }>(`/api/recommendations?patient_id=${pid}&type=${type}`);
  const [form, setForm] = useState({ patient_id: "", recommendation_type: "Meal", recommendation_text: "", recommendation_date: today() });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ executedSql: ExecutedSql }>("/api/recommendations", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: "Recommendation inserted." });
      setForm((f) => ({ ...f, recommendation_text: "" }));
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }
  async function remove(id: unknown) {
    if (!confirm("Delete this recommendation?")) return;
    const r = await api<{ executedSql: ExecutedSql }>(`/api/recommendations/${id}`, { method: "DELETE" });
    setLastSql(r.executedSql);
    refresh();
  }
  const tone = (t: unknown) => (t === "Meal" ? "ok" : t === "Activity" ? "info" : "neutral");

  return (
    <div className="space-y-6">
      <PageHeader title="Recommendation Management" description="Lifestyle recommendations (Meal / Activity / General – CHECK constraint on recommendation_type) stored per patient in the recommendation table. Rows are created manually here or automatically by the risk-prediction module." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Add recommendation" subtitle="INSERT INTO recommendation (patient_id, recommendation_type, recommendation_text, recommendation_date)">
            <form onSubmit={submit} className="space-y-3">
              <Field label="Patient"><PatientSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type"><Select value={form.recommendation_type} onChange={(e) => setForm({ ...form, recommendation_type: e.target.value })}>{RECO_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="Date"><Input type="date" value={form.recommendation_date} onChange={(e) => setForm({ ...form, recommendation_date: e.target.value })} /></Field>
              </div>
              <Field label="Recommendation text"><Textarea rows={4} required value={form.recommendation_text} onChange={(e) => setForm({ ...form, recommendation_text: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-1">
                {(TEMPLATES[form.recommendation_type] ?? []).map((t) => <button type="button" key={t} onClick={() => setForm({ ...form, recommendation_text: t })} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-left text-[11px] text-slate-600 hover:bg-teal-50">{t.slice(0, 60)}…</button>)}
              </div>
              <Button type="submit">Insert recommendation</Button>
            </form>
            {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          </Card>
          <Card title="Count by type" subtitle="SELECT recommendation_type, COUNT(*) FROM recommendation GROUP BY recommendation_type">
            <ul className="space-y-1 text-sm">{(data?.byType ?? []).map((b) => <li key={String(b.recommendation_type)} className="flex justify-between"><Badge tone={tone(b.recommendation_type)}>{String(b.recommendation_type)}</Badge><b>{String(b.cnt)}</b></li>)}</ul>
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Recommendations" subtitle="recommendation INNER JOIN patient – filter by patient and type (idx_reco_patient_type)" actions={<span className="text-xs text-slate-500">{data?.rows.length ?? 0} row(s)</span>}>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <PatientSelect value={pid} onChange={setPid} allowAll />
              <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{RECO_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
              <Button variant="secondary" onClick={() => { setPid(""); setType(""); }}>Clear</Button>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows ?? []} rowKey={(r) => String(r.recommendation_id)} columns={[
                { key: "recommendation_id", label: "ID" },
                { key: "recommendation_date", label: "Date", render: (r) => fmtDate(r.recommendation_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "recommendation_type", label: "Type", render: (r) => <Badge tone={tone(r.recommendation_type)}>{String(r.recommendation_type)}</Badge> },
                { key: "recommendation_text", label: "Recommendation", className: "max-w-xl text-xs" },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => remove(r.recommendation_id)}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
