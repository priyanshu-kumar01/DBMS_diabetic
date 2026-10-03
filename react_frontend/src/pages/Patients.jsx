import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, DataTable, Field, GENDERS, Input, Loading, PageHeader, PatientLink, RiskBadge, Select, SqlPanel } from "../components/ui.jsx";
import { api, num, useFetch } from "../api.js";

const EMPTY = { name: "", age: "", gender: "Male", phone: "", email: "", height: "", weight: "" };

export default function Patients() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [search, setSearch] = useState("");
  const { data, loading, error, refresh } = useFetch(`/api/patients?q=${encodeURIComponent(search)}&gender=${encodeURIComponent(gender)}`);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [lastSql, setLastSql] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const bmiPreview = form.height && form.weight ? (Number(form.weight) / Math.pow(Number(form.height) / 100, 2)).toFixed(2) : "—";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = editId
        ? await api(`/api/patients/${editId}`, { method: "PUT", body: JSON.stringify(form) })
        : await api("/api/patients", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: editId ? `Patient #${editId} updated.` : `Patient #${r.row.patient_id} inserted (BMI ${r.row.bmi}).` });
      setForm(EMPTY);
      setEditId(null);
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p) {
    setEditId(p.patient_id);
    setForm({ name: p.name, age: String(p.age), gender: p.gender, phone: p.phone, email: p.email || "", height: String(p.height), weight: String(p.weight) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(p) {
    if (!window.confirm(`Delete patient "${p.name}"?\nAll child rows (records, readings, reports, meals, activities, predictions, recommendations) will be removed by ON DELETE CASCADE.`)) return;
    try {
      const r = await api(`/api/patients/${p.patient_id}`, { method: "DELETE" });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: `Patient #${p.patient_id} deleted with cascading child rows.` });
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: err.message });
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Patient Management" description="CRUD operations on the PATIENT table. Phone and e-mail are UNIQUE; age, gender, height and weight are protected by CHECK constraints. BMI is a derived attribute computed on insert/update." />
      <div className="grid cols-3">
        <Card title={editId ? `Update patient #${editId}` : "Add patient"} subtitle={editId ? "UPDATE patient SET … WHERE patient_id = ?" : "INSERT INTO patient (…) VALUES (…)"}>
          <form onSubmit={submit} className="form">
            <Field label="Full name"><Input required value={form.name} onChange={set("name")} placeholder="e.g. Ravi Kumar" /></Field>
            <div className="row">
              <Field label="Age"><Input required type="number" min={1} max={120} value={form.age} onChange={set("age")} /></Field>
              <Field label="Gender"><Select value={form.gender} onChange={set("gender")}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
            </div>
            <div className="row">
              <Field label="Phone (UNIQUE)"><Input required value={form.phone} onChange={set("phone")} placeholder="10 digits" /></Field>
              <Field label="E-mail (UNIQUE)"><Input type="email" value={form.email} onChange={set("email")} /></Field>
            </div>
            <div className="row">
              <Field label="Height (cm)"><Input required type="number" step="0.1" min={50} value={form.height} onChange={set("height")} /></Field>
              <Field label="Weight (kg)"><Input required type="number" step="0.1" min={10} value={form.weight} onChange={set("weight")} /></Field>
            </div>
            <div className="note">Derived BMI = weight / (height m)² = <b>{bmiPreview}</b></div>
            <div className="row auto">
              <Button type="submit" disabled={busy}>{editId ? "Save changes" : "Insert patient"}</Button>
              {editId && <Button variant="secondary" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</Button>}
            </div>
          </form>
          {msg && <div className="mt"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        </Card>

        <div className="span-2 stack">
          <Card title="Search patients" subtitle="WHERE name LIKE '%q%' OR phone LIKE '%q%' OR email LIKE '%q%' – uses idx_patient_name" actions={<span className="muted xs">{data?.rows.length ?? 0} row(s)</span>}>
            <form className="row auto" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or e-mail" style={{ width: 260 }} />
              <Select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: 150 }}><option value="">All genders</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</Select>
              <Button type="submit" variant="secondary">Search</Button>
              {(search || gender) && <Button variant="ghost" onClick={() => { setQ(""); setSearch(""); setGender(""); }}>Clear</Button>}
            </form>
            <div className="mt">
              {error && <Alert tone="error">{error}</Alert>}
              {loading && !data ? <Loading /> : (
                <DataTable
                  rows={data?.rows || []}
                  rowKey={(r) => r.patient_id}
                  columns={[
                    { key: "patient_id", label: "ID" },
                    { key: "name", label: "Name", render: (r) => <PatientLink id={r.patient_id} name={r.name} /> },
                    { key: "age", label: "Age" },
                    { key: "gender", label: "Gender" },
                    { key: "phone", label: "Phone" },
                    { key: "email", label: "E-mail" },
                    { key: "bmi", label: "BMI", render: (r) => num(r.bmi, 1) },
                    { key: "glucose_count", label: "Readings" },
                    { key: "latest_risk", label: "Risk", render: (r) => <RiskBadge level={r.latest_risk} /> },
                    { key: "actions", label: "Actions", render: (r) => (
                      <span className="inline">
                        <Button variant="ghost" onClick={() => navigate(`/patients/${r.patient_id}`)}>History</Button>
                        <Button variant="ghost" onClick={() => startEdit(r)}>Edit</Button>
                        <Button variant="ghost" className="red" onClick={() => remove(r)}>Delete</Button>
                      </span>
                    ) },
                  ]}
                />
              )}
            </div>
          </Card>
          <SqlPanel executed={lastSql || data?.executedSql || null} />
        </div>
      </div>
    </div>
  );
}
