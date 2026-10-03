import { useState } from "react";
import PatientSelect from "../components/PatientSelect.jsx";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Loading, MEAL_STATUS, MEAL_TYPES, PageHeader, PatientLink, Select, SqlPanel, Textarea } from "../components/ui.jsx";
import { api, fmtDate, num, today, useFetch } from "../api.js";

const EMPTY_MEAL = { meal_name: "", meal_type: "Breakfast", calories: "", carbohydrates: "", description: "" };
const statusTone = (st) => (st === "Consumed" ? "ok" : st === "Skipped" ? "warn" : "info");

export default function Meals() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const meals = useFetch(`/api/meals?q=${encodeURIComponent(search)}&type=${type}`);
  const [rpid, setRpid] = useState("");
  const [rstatus, setRstatus] = useState("");
  const records = useFetch(`/api/meal-records?patient_id=${rpid}&status=${rstatus}`);

  const [mealForm, setMealForm] = useState(EMPTY_MEAL);
  const [editId, setEditId] = useState(null);
  const [recForm, setRecForm] = useState({ patient_id: "", meal_id: "", meal_date: today(), status: "Consumed" });
  const [msg, setMsg] = useState(null);
  const [lastSql, setLastSql] = useState(null);

  async function run(fn, success) {
    try {
      const r = await fn();
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: success });
      meals.refresh();
      records.refresh();
      return true;
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
      return false;
    }
  }
  async function submitMeal(e) {
    e.preventDefault();
    const ok = await run(() => api(editId ? `/api/meals/${editId}` : "/api/meals", { method: editId ? "PUT" : "POST", body: JSON.stringify(mealForm) }), editId ? "Meal updated." : "Meal inserted.");
    if (ok) { setMealForm(EMPTY_MEAL); setEditId(null); }
  }
  async function submitRecord(e) {
    e.preventDefault();
    await run(() => api("/api/meal-records", { method: "POST", body: JSON.stringify(recForm) }), "Meal record inserted.");
  }

  return (
    <div className="stack">
      <PageHeader title="Meal Management" description="meal is a master table (meal_name UNIQUE, meal_type CHECK). Patients are linked to meals only through meal_record (patient_id FK, meal_id FK ON DELETE RESTRICT) – a resolved many-to-many relationship." />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid cols-3">
        <div className="stack">
          <Card title={editId ? `Update meal #${editId}` : "Add meal"} subtitle={editId ? "UPDATE meal SET … WHERE meal_id = ?" : "INSERT INTO meal (…)"}>
            <form className="form" onSubmit={submitMeal}>
              <Field label="Meal name (UNIQUE)"><Input required value={mealForm.meal_name} onChange={(e) => setMealForm({ ...mealForm, meal_name: e.target.value })} /></Field>
              <div className="row">
                <Field label="Type"><Select value={mealForm.meal_type} onChange={(e) => setMealForm({ ...mealForm, meal_type: e.target.value })}>{MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="Calories"><Input required type="number" min={0} value={mealForm.calories} onChange={(e) => setMealForm({ ...mealForm, calories: e.target.value })} /></Field>
                <Field label="Carbs (g)"><Input required type="number" min={0} step="0.1" value={mealForm.carbohydrates} onChange={(e) => setMealForm({ ...mealForm, carbohydrates: e.target.value })} /></Field>
              </div>
              <Field label="Description"><Textarea rows={2} value={mealForm.description} onChange={(e) => setMealForm({ ...mealForm, description: e.target.value })} /></Field>
              <div className="row auto">
                <Button type="submit">{editId ? "Save" : "Insert meal"}</Button>
                {editId && <Button variant="secondary" onClick={() => { setEditId(null); setMealForm(EMPTY_MEAL); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Record meal for patient" subtitle="INSERT INTO meal_record (patient_id, meal_id, meal_date, status)">
            <form className="form" onSubmit={submitRecord}>
              <Field label="Patient"><PatientSelect value={recForm.patient_id} onChange={(v) => setRecForm({ ...recForm, patient_id: v })} required /></Field>
              <Field label="Meal">
                <Select required value={recForm.meal_id} onChange={(e) => setRecForm({ ...recForm, meal_id: e.target.value })}>
                  <option value="">Select meal…</option>
                  {(meals.data?.rows || []).map((m) => <option key={m.meal_id} value={m.meal_id}>{m.meal_name} ({m.meal_type}, {m.calories} kcal)</option>)}
                </Select>
              </Field>
              <div className="row">
                <Field label="Date"><Input type="date" value={recForm.meal_date} onChange={(e) => setRecForm({ ...recForm, meal_date: e.target.value })} /></Field>
                <Field label="Status"><Select value={recForm.status} onChange={(e) => setRecForm({ ...recForm, status: e.target.value })}>{MEAL_STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              </div>
              <div><Button type="submit">Insert meal record</Button></div>
            </form>
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="span-2 stack">
          <Card title="Meal catalogue" subtitle="SELECT m.*, COUNT(mr.meal_record_id) FROM meal m LEFT JOIN meal_record mr … GROUP BY m.meal_id" actions={<span className="muted xs">{meals.data?.rows.length ?? 0} meal(s)</span>}>
            <form className="row auto mb" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meal name / description" style={{ width: 260 }} />
              <Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 150 }}><option value="">All types</option>{MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            {meals.loading && !meals.data ? <Loading /> : (
              <DataTable rows={meals.data?.rows || []} rowKey={(r) => r.meal_id} columns={[
                { key: "meal_id", label: "ID" },
                { key: "meal_name", label: "Meal" },
                { key: "meal_type", label: "Type", render: (r) => <Badge tone="info">{r.meal_type}</Badge> },
                { key: "calories", label: "kcal" },
                { key: "carbohydrates", label: "Carbs g", render: (r) => num(r.carbohydrates, 0) },
                { key: "times_recorded", label: "Recorded" },
                { key: "description", label: "Description", className: "xs wrap" },
                { key: "a", label: "", render: (r) => (
                  <span className="inline">
                    <Button variant="ghost" onClick={() => { setEditId(r.meal_id); setMealForm({ meal_name: r.meal_name, meal_type: r.meal_type, calories: String(r.calories), carbohydrates: String(r.carbohydrates), description: r.description || "" }); }}>Edit</Button>
                    <Button variant="ghost" className="red" onClick={() => window.confirm("Delete meal? Fails if meal_record rows reference it (ON DELETE RESTRICT).") && run(() => api(`/api/meals/${r.meal_id}`, { method: "DELETE" }), "Meal deleted.")}>Delete</Button>
                  </span>
                ) },
              ]} />
            )}
          </Card>
          <Card title="Meals consumed by patients" subtitle="meal_record ⋈ patient ⋈ meal (INNER JOIN)" actions={<span className="muted xs">{records.data?.rows.length ?? 0} row(s)</span>}>
            <div className="row mb">
              <PatientSelect value={rpid} onChange={setRpid} allowAll />
              <Select value={rstatus} onChange={(e) => setRstatus(e.target.value)}><option value="">All statuses</option>{MEAL_STATUS.map((s) => <option key={s}>{s}</option>)}</Select>
              <div className="chips">{(records.data?.summary || []).map((s) => <span key={s.status} className="chip">{s.status}: <b>{s.cnt}</b> · {s.calories} kcal</span>)}</div>
            </div>
            {records.loading && !records.data ? <Loading /> : (
              <DataTable rows={(records.data?.rows || []).slice(0, 60)} rowKey={(r) => r.meal_record_id} columns={[
                { key: "meal_date", label: "Date", render: (r) => fmtDate(r.meal_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "meal_name", label: "Meal" },
                { key: "meal_type", label: "Type" },
                { key: "calories", label: "kcal" },
                { key: "status", label: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="red" onClick={() => window.confirm("Delete meal record?") && run(() => api(`/api/meal-records/${r.meal_record_id}`, { method: "DELETE" }), "Meal record deleted.")}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
