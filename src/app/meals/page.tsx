"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Loading, MEAL_STATUS, MEAL_TYPES, PageHeader, PatientLink, Select, SqlPanel, Textarea } from "@/components/ui";
import { api, type ExecutedSql, fmtDate, num, today, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
const emptyMeal = { meal_name: "", meal_type: "Breakfast", calories: "", carbohydrates: "", description: "" };

export default function MealsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const meals = useFetch<{ rows: Row[] }>(`/api/meals?q=${encodeURIComponent(search)}&type=${type}`);

  const [rpid, setRpid] = useState("");
  const [rstatus, setRstatus] = useState("");
  const records = useFetch<{ rows: Row[]; summary: Row[] }>(`/api/meal-records?patient_id=${rpid}&status=${rstatus}`);

  const [mealForm, setMealForm] = useState(emptyMeal);
  const [editId, setEditId] = useState<number | null>(null);
  const [recForm, setRecForm] = useState({ patient_id: "", meal_id: "", meal_date: today(), status: "Consumed" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);

  const run = async (fn: () => Promise<{ executedSql: ExecutedSql }>, success: string) => {
    try {
      const r = await fn();
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: success });
      meals.refresh();
      records.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Meal Management" description="meal is a master table (meal_name UNIQUE, meal_type CHECK). Patients are linked to meals only through meal_record (patient_id FK, meal_id FK ON DELETE RESTRICT) – a resolved many-to-many relationship." />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title={editId ? `Update meal #${editId}` : "Add meal"} subtitle={editId ? "UPDATE meal SET … WHERE meal_id = ?" : "INSERT INTO meal (…)"}>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api(editId ? `/api/meals/${editId}` : "/api/meals", { method: editId ? "PUT" : "POST", body: JSON.stringify(mealForm) }), editId ? "Meal updated." : "Meal inserted.").then(() => { setMealForm(emptyMeal); setEditId(null); });
              }}
            >
              <Field label="Meal name (UNIQUE)"><Input required value={mealForm.meal_name} onChange={(e) => setMealForm({ ...mealForm, meal_name: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Type"><Select value={mealForm.meal_type} onChange={(e) => setMealForm({ ...mealForm, meal_type: e.target.value })}>{MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="Calories"><Input required type="number" min={0} value={mealForm.calories} onChange={(e) => setMealForm({ ...mealForm, calories: e.target.value })} /></Field>
                <Field label="Carbs (g)"><Input required type="number" min={0} step="0.1" value={mealForm.carbohydrates} onChange={(e) => setMealForm({ ...mealForm, carbohydrates: e.target.value })} /></Field>
              </div>
              <Field label="Description"><Textarea rows={2} value={mealForm.description} onChange={(e) => setMealForm({ ...mealForm, description: e.target.value })} /></Field>
              <div className="flex gap-2">
                <Button type="submit">{editId ? "Save" : "Insert meal"}</Button>
                {editId && <Button type="button" variant="secondary" onClick={() => { setEditId(null); setMealForm(emptyMeal); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Record meal for patient" subtitle="INSERT INTO meal_record (patient_id, meal_id, meal_date, status)">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api("/api/meal-records", { method: "POST", body: JSON.stringify(recForm) }), "Meal record inserted.");
              }}
            >
              <Field label="Patient"><PatientSelect value={recForm.patient_id} onChange={(v) => setRecForm({ ...recForm, patient_id: v })} required /></Field>
              <Field label="Meal"><Select required value={recForm.meal_id} onChange={(e) => setRecForm({ ...recForm, meal_id: e.target.value })}><option value="">Select meal…</option>{(meals.data?.rows ?? []).map((m) => <option key={String(m.meal_id)} value={String(m.meal_id)}>{String(m.meal_name)} ({String(m.meal_type)}, {String(m.calories)} kcal)</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date"><Input type="date" value={recForm.meal_date} onChange={(e) => setRecForm({ ...recForm, meal_date: e.target.value })} /></Field>
                <Field label="Status"><Select value={recForm.status} onChange={(e) => setRecForm({ ...recForm, status: e.target.value })}>{MEAL_STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              </div>
              <Button type="submit">Insert meal record</Button>
            </form>
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Meal catalog" subtitle="SELECT m.*, COUNT(mr.meal_record_id) FROM meal m LEFT JOIN meal_record mr … GROUP BY m.meal_id" actions={<span className="text-xs text-slate-500">{meals.data?.rows.length ?? 0} meal(s)</span>}>
            <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meal name / description" className="max-w-xs" />
              <Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[10rem]"><option value="">All types</option>{MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            {meals.loading && !meals.data ? <Loading /> : (
              <DataTable rows={meals.data?.rows ?? []} rowKey={(r) => String(r.meal_id)} columns={[
                { key: "meal_id", label: "ID" },
                { key: "meal_name", label: "Meal" },
                { key: "meal_type", label: "Type", render: (r) => <Badge tone="info">{String(r.meal_type)}</Badge> },
                { key: "calories", label: "kcal" },
                { key: "carbohydrates", label: "Carbs g", render: (r) => num(r.carbohydrates, 0) },
                { key: "times_recorded", label: "Recorded" },
                { key: "description", label: "Description", className: "max-w-xs text-xs" },
                { key: "a", label: "", render: (r) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => { setEditId(Number(r.meal_id)); setMealForm({ meal_name: String(r.meal_name), meal_type: String(r.meal_type), calories: String(r.calories), carbohydrates: String(r.carbohydrates), description: String(r.description ?? "") }); }}>Edit</Button>
                    <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => confirm("Delete meal? Fails if meal_record rows reference it (ON DELETE RESTRICT).") && run(() => api(`/api/meals/${r.meal_id}`, { method: "DELETE" }), "Meal deleted.")}>Delete</Button>
                  </div>
                ) },
              ]} />
            )}
          </Card>
          <Card title="Meals consumed by patients" subtitle="meal_record ⋈ patient ⋈ meal (INNER JOIN)" actions={<span className="text-xs text-slate-500">{records.data?.rows.length ?? 0} row(s)</span>}>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <PatientSelect value={rpid} onChange={setRpid} allowAll />
              <Select value={rstatus} onChange={(e) => setRstatus(e.target.value)}><option value="">All statuses</option>{MEAL_STATUS.map((s) => <option key={s}>{s}</option>)}</Select>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {(records.data?.summary ?? []).map((s) => <span key={String(s.status)} className="rounded bg-slate-100 px-2 py-1">{String(s.status)}: <b>{String(s.cnt)}</b> · {String(s.calories)} kcal</span>)}
              </div>
            </div>
            {records.loading && !records.data ? <Loading /> : (
              <DataTable rows={(records.data?.rows ?? []).slice(0, 60)} rowKey={(r) => String(r.meal_record_id)} columns={[
                { key: "meal_date", label: "Date", render: (r) => fmtDate(r.meal_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "meal_name", label: "Meal" },
                { key: "meal_type", label: "Type" },
                { key: "calories", label: "kcal" },
                { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Consumed" ? "ok" : r.status === "Skipped" ? "warn" : "info"}>{String(r.status)}</Badge> },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => confirm("Delete meal record?") && run(() => api(`/api/meal-records/${r.meal_record_id}`, { method: "DELETE" }), "Meal record deleted.")}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
