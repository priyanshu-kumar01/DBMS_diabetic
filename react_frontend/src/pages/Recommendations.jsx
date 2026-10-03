import { useState } from "react";
import PatientSelect from "../components/PatientSelect.jsx";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Loading, PageHeader, PatientLink, RECO_TYPES, Select, SqlPanel, Textarea } from "../components/ui.jsx";
import { api, fmtDate, today, useFetch } from "../api.js";

const TEMPLATES = {
  Meal: ["Prefer low-glycaemic meals such as oats, millets and legumes; limit carbohydrates to 45 g per meal.", "Replace sugary drinks with water or unsweetened buttermilk; add a salad before lunch and dinner."],
  Activity: ["Walk briskly for 30 minutes on at least 5 days a week (150 min/week target).", "Add two light strength sessions per week using resistance bands or bodyweight exercises."],
  General: ["Monitor fasting glucose three times a week and record it in the system.", "Sleep 7–8 hours, stay hydrated and repeat HbA1c test in 3 months."],
};
const tone = (t) => (t === "Meal" ? "ok" : t === "Activity" ? "info" : "neutral");

export default function Recommendations() {
  const [pid, setPid] = useState("");
  const [type, setType] = useState("");
  const { data, loading, error, refresh } = useFetch(`/api/recommendations?patient_id=${pid}&type=${type}`);
  const [form, setForm] = useState({ patient_id: "", recommendation_type: "Meal", recommendation_text: "", recommendation_date: today() });
  const [msg, setMsg] = useState(null);
  const [lastSql, setLastSql] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      const r = await api("/api/recommendations", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: "Recommendation inserted." });
      setForm((f) => ({ ...f, recommendation_text: "" }));
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err.message });
    }
  }
  async function remove(id) {
    if (!window.confirm("Delete this recommendation?")) return;
    try {
      const r = await api(`/api/recommendations/${id}`, { method: "DELETE" });
      setLastSql(r.executedSql);
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err.message });
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Recommendation Management" description="Lifestyle recommendations (Meal / Activity / General – CHECK constraint on recommendation_type) stored per patient in the recommendation table. Rows are created manually here or automatically by the risk-prediction module." />
      <div className="grid cols-3">
        <div className="stack">
          <Card title="Add recommendation" subtitle="INSERT INTO recommendation (patient_id, recommendation_type, recommendation_text, recommendation_date)">
            <form onSubmit={submit} className="form">
              <Field label="Patient"><PatientSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required /></Field>
              <div className="row">
                <Field label="Type"><Select value={form.recommendation_type} onChange={(e) => setForm({ ...form, recommendation_type: e.target.value })}>{RECO_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="Date"><Input type="date" value={form.recommendation_date} onChange={(e) => setForm({ ...form, recommendation_date: e.target.value })} /></Field>
              </div>
              <Field label="Recommendation text"><Textarea rows={4} required value={form.recommendation_text} onChange={(e) => setForm({ ...form, recommendation_text: e.target.value })} /></Field>
              <div className="chips">
                {(TEMPLATES[form.recommendation_type] || []).map((t) => <button type="button" key={t} className="chip" onClick={() => setForm({ ...form, recommendation_text: t })}>{t.slice(0, 60)}…</button>)}
              </div>
              <div><Button type="submit">Insert recommendation</Button></div>
            </form>
            {msg && <div className="mt"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
          </Card>
          <Card title="Count by type" subtitle="SELECT recommendation_type, COUNT(*) FROM recommendation GROUP BY recommendation_type">
            <ul className="list">{(data?.byType || []).map((b) => <li key={b.recommendation_type}><Badge tone={tone(b.recommendation_type)}>{b.recommendation_type}</Badge><b>{b.cnt}</b></li>)}</ul>
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="span-2 stack">
          <Card title="Recommendations" subtitle="recommendation INNER JOIN patient – filter by patient and type (idx_reco_patient_type)" actions={<span className="muted xs">{data?.rows.length ?? 0} row(s)</span>}>
            <div className="row mb">
              <PatientSelect value={pid} onChange={setPid} allowAll />
              <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{RECO_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
              <Button variant="secondary" onClick={() => { setPid(""); setType(""); }}>Clear</Button>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows || []} rowKey={(r) => r.recommendation_id} columns={[
                { key: "recommendation_id", label: "ID" },
                { key: "recommendation_date", label: "Date", render: (r) => fmtDate(r.recommendation_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "recommendation_type", label: "Type", render: (r) => <Badge tone={tone(r.recommendation_type)}>{r.recommendation_type}</Badge> },
                { key: "recommendation_text", label: "Recommendation", className: "xs wrap" },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="red" onClick={() => remove(r.recommendation_id)}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
