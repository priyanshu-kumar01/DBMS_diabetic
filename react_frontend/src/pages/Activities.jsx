import { useState } from "react";
import PatientSelect from "../components/PatientSelect.jsx";
import { ACTIVITY_TYPES, Alert, Badge, Button, Card, DataTable, Field, Input, Loading, PageHeader, PatientLink, Select, SqlPanel, StatCard, Textarea } from "../components/ui.jsx";
import { SimpleBars } from "../components/charts.jsx";
import { api, fmtDate, num, today, useFetch } from "../api.js";

const EMPTY_ACT = { activity_name: "", activity_type: "Aerobic", recommended_duration: "", description: "" };

export default function Activities() {
  const [type, setType] = useState("");
  const acts = useFetch(`/api/activities?type=${type}`);
  const [rpid, setRpid] = useState("");
  const recs = useFetch(`/api/activity-records?patient_id=${rpid}`);
  const [actForm, setActForm] = useState(EMPTY_ACT);
  const [editId, setEditId] = useState(null);
  const [recForm, setRecForm] = useState({ patient_id: "", activity_id: "", duration: "", steps: "", activity_date: today() });
  const [msg, setMsg] = useState(null);
  const [lastSql, setLastSql] = useState(null);

  async function run(fn, success) {
    try {
      const r = await fn();
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: success });
      acts.refresh();
      recs.refresh();
      return true;
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
      return false;
    }
  }
  async function submitActivity(e) {
    e.preventDefault();
    const ok = await run(() => api(editId ? `/api/activities/${editId}` : "/api/activities", { method: editId ? "PUT" : "POST", body: JSON.stringify(actForm) }), editId ? "Activity updated." : "Activity inserted.");
    if (ok) { setActForm(EMPTY_ACT); setEditId(null); }
  }
  async function submitRecord(e) {
    e.preventDefault();
    await run(() => api("/api/activity-records", { method: "POST", body: JSON.stringify(recForm) }), "Activity record inserted.");
  }
  const t = recs.data?.totals;
  const meets = t && Number(t.minutes_last_7d) >= 150;

  return (
    <div className="stack">
      <PageHeader title="Activity Management" description="activity is a master table; activity_record links patients to activities and tracks duration (minutes) and steps with CHECK constraints. Weekly statistics use GROUP BY week (Monday of each week)." />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid cols-3">
        <div className="stack">
          <Card title={editId ? `Update activity #${editId}` : "Add activity"} subtitle={editId ? "UPDATE activity SET … WHERE activity_id = ?" : "INSERT INTO activity (…)"}>
            <form className="form" onSubmit={submitActivity}>
              <Field label="Activity name (UNIQUE)"><Input required value={actForm.activity_name} onChange={(e) => setActForm({ ...actForm, activity_name: e.target.value })} /></Field>
              <div className="row">
                <Field label="Type"><Select value={actForm.activity_type} onChange={(e) => setActForm({ ...actForm, activity_type: e.target.value })}>{ACTIVITY_TYPES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
                <Field label="Recommended min"><Input required type="number" min={1} value={actForm.recommended_duration} onChange={(e) => setActForm({ ...actForm, recommended_duration: e.target.value })} /></Field>
              </div>
              <Field label="Description"><Textarea rows={2} value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} /></Field>
              <div className="row auto">
                <Button type="submit">{editId ? "Save" : "Insert activity"}</Button>
                {editId && <Button variant="secondary" onClick={() => { setEditId(null); setActForm(EMPTY_ACT); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Record patient activity" subtitle="INSERT INTO activity_record (patient_id, activity_id, duration, steps, activity_date)">
            <form className="form" onSubmit={submitRecord}>
              <Field label="Patient"><PatientSelect value={recForm.patient_id} onChange={(v) => setRecForm({ ...recForm, patient_id: v })} required /></Field>
              <Field label="Activity">
                <Select required value={recForm.activity_id} onChange={(e) => setRecForm({ ...recForm, activity_id: e.target.value })}>
                  <option value="">Select activity…</option>
                  {(acts.data?.rows || []).map((a) => <option key={a.activity_id} value={a.activity_id}>{a.activity_name} ({a.activity_type}, rec. {a.recommended_duration} min)</option>)}
                </Select>
              </Field>
              <div className="row">
                <Field label="Duration (min)"><Input required type="number" min={1} value={recForm.duration} onChange={(e) => setRecForm({ ...recForm, duration: e.target.value })} /></Field>
                <Field label="Steps"><Input type="number" min={0} value={recForm.steps} onChange={(e) => setRecForm({ ...recForm, steps: e.target.value })} /></Field>
                <Field label="Date"><Input type="date" value={recForm.activity_date} onChange={(e) => setRecForm({ ...recForm, activity_date: e.target.value })} /></Field>
              </div>
              <div><Button type="submit">Insert activity record</Button></div>
            </form>
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="span-2 stack">
          <Card title="Weekly activity statistics" subtitle="SELECT week_start, COUNT(*), SUM(duration), SUM(steps) … GROUP BY week_start" actions={<div style={{ width: 230 }}><PatientSelect value={rpid} onChange={setRpid} allowAll /></div>}>
            {t && (
              <div className="grid cols-5 tight mb">
                <StatCard label="Sessions" value={t.sessions} tone="slate" sql="COUNT(*)" />
                <StatCard label="Total minutes" value={t.total_minutes} tone="blue" sql="SUM(duration)" />
                <StatCard label="Total steps" value={Number(t.total_steps).toLocaleString()} tone="teal" sql="SUM(steps)" />
                <StatCard label="Avg duration" value={num(t.avg_duration)} hint="min / session" tone="violet" sql="AVG(duration)" />
                <StatCard label="Last 7 days" value={`${t.minutes_last_7d} min`} hint={rpid ? (meets ? "meets 150 min target" : "target: 150 min/week") : "all patients"} tone={!rpid || meets ? "emerald" : "amber"} />
              </div>
            )}
            <div className="grid cols-3">
              <div className="span-2"><SimpleBars data={recs.data?.weekly || []} x="week_start" series={[{ key: "total_minutes", label: "Minutes", color: "#0ea5e9" }, { key: "sessions", label: "Sessions", color: "#8b5cf6" }]} height={220} /></div>
              <div><SimpleBars data={recs.data?.byType || []} x="activity_type" series={[{ key: "total_minutes", label: "Minutes by type", color: "#0d9488" }]} height={220} /></div>
            </div>
          </Card>
          <Card title="Activity catalogue" subtitle="activity LEFT JOIN activity_record … GROUP BY activity_id" actions={<Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 150 }}><option value="">All types</option>{ACTIVITY_TYPES.map((x) => <option key={x}>{x}</option>)}</Select>}>
            {acts.loading && !acts.data ? <Loading /> : (
              <DataTable rows={acts.data?.rows || []} rowKey={(r) => r.activity_id} columns={[
                { key: "activity_id", label: "ID" },
                { key: "activity_name", label: "Activity" },
                { key: "activity_type", label: "Type", render: (r) => <Badge tone="info">{r.activity_type}</Badge> },
                { key: "recommended_duration", label: "Rec. min" },
                { key: "times_performed", label: "Performed" },
                { key: "total_minutes", label: "Total min" },
                { key: "avg_duration", label: "Avg min", render: (r) => num(r.avg_duration) },
                { key: "a", label: "", render: (r) => (
                  <span className="inline">
                    <Button variant="ghost" onClick={() => { setEditId(r.activity_id); setActForm({ activity_name: r.activity_name, activity_type: r.activity_type, recommended_duration: String(r.recommended_duration), description: r.description || "" }); }}>Edit</Button>
                    <Button variant="ghost" className="red" onClick={() => window.confirm("Delete activity? Fails if activity_record rows reference it (ON DELETE RESTRICT).") && run(() => api(`/api/activities/${r.activity_id}`, { method: "DELETE" }), "Activity deleted.")}>Delete</Button>
                  </span>
                ) },
              ]} />
            )}
          </Card>
          <Card title="Activity records" subtitle="activity_record ⋈ patient ⋈ activity" actions={<span className="muted xs">{recs.data?.rows.length ?? 0} row(s)</span>}>
            {recs.loading && !recs.data ? <Loading /> : (
              <DataTable rows={(recs.data?.rows || []).slice(0, 60)} rowKey={(r) => r.activity_record_id} columns={[
                { key: "activity_date", label: "Date", render: (r) => fmtDate(r.activity_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "activity_name", label: "Activity" },
                { key: "activity_type", label: "Type" },
                { key: "duration", label: "Duration", render: (r) => <span className={Number(r.duration) >= Number(r.recommended_duration) ? "down" : "up"}>{r.duration} min</span> },
                { key: "steps", label: "Steps", render: (r) => Number(r.steps).toLocaleString() },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="red" onClick={() => window.confirm("Delete activity record?") && run(() => api(`/api/activity-records/${r.activity_record_id}`, { method: "DELETE" }), "Activity record deleted.")}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
