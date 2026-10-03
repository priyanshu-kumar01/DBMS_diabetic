"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, DataTable, Field, GENDERS, Input, Loading, PageHeader, PatientLink, RiskBadge, Select, SqlPanel } from "@/components/ui";
import { api, type ExecutedSql, num, useFetch } from "@/lib/client";

interface PatientRow extends Record<string, unknown> {
  patientId: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string | null;
  height: string;
  weight: string;
  bmi: string;
  glucoseCount: number;
  latestRisk: string | null;
}

const empty = { name: "", age: "", gender: "Male", phone: "", email: "", height: "", weight: "" };

export default function PatientsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [search, setSearch] = useState("");
  const url = `/api/patients?q=${encodeURIComponent(search)}&gender=${encodeURIComponent(gender)}`;
  const { data, loading, error, refresh } = useFetch<{ rows: PatientRow[]; executedSql: ExecutedSql }>(url);

  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const bmiPreview = form.height && form.weight ? (Number(form.weight) / Math.pow(Number(form.height) / 100, 2)).toFixed(2) : "—";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = editId
        ? await api<{ row: PatientRow; executedSql: ExecutedSql }>(`/api/patients/${editId}`, { method: "PUT", body: JSON.stringify(form) })
        : await api<{ row: PatientRow; executedSql: ExecutedSql }>("/api/patients", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: editId ? `Patient #${editId} updated.` : `Patient #${r.row.patientId} inserted (BMI ${r.row.bmi}).` });
      setForm(empty);
      setEditId(null);
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: PatientRow) {
    setEditId(p.patientId);
    setForm({ name: p.name, age: String(p.age), gender: p.gender, phone: p.phone, email: p.email ?? "", height: p.height, weight: p.weight });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(p: PatientRow) {
    if (!confirm(`Delete patient "${p.name}"?\nAll child rows (records, readings, reports, meals, activities, predictions, recommendations) will be removed by ON DELETE CASCADE.`)) return;
    try {
      const r = await api<{ executedSql: ExecutedSql }>(`/api/patients/${p.patientId}`, { method: "DELETE" });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: `Patient #${p.patientId} deleted with cascading child rows.` });
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Patient Management" description="CRUD operations on the PATIENT table. Phone and e-mail are UNIQUE; age, gender, height and weight are protected by CHECK constraints. BMI is a derived attribute computed on insert/update." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={editId ? `Update patient #${editId}` : "Add patient"} subtitle={editId ? "UPDATE patient SET … WHERE patient_id = ?" : "INSERT INTO patient (…) VALUES (…)"} className="lg:col-span-1">
          <form onSubmit={submit} className="grid grid-cols-2 gap-3">
            <Field label="Full name" className="col-span-2"><Input required value={form.name} onChange={set("name")} placeholder="e.g. Ravi Kumar" /></Field>
            <Field label="Age"><Input required type="number" min={1} max={120} value={form.age} onChange={set("age")} /></Field>
            <Field label="Gender"><Select value={form.gender} onChange={set("gender")}>{GENDERS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
            <Field label="Phone (UNIQUE)"><Input required value={form.phone} onChange={set("phone")} placeholder="10 digits" /></Field>
            <Field label="E-mail (UNIQUE)"><Input type="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="Height (cm)"><Input required type="number" step="0.1" min={50} value={form.height} onChange={set("height")} /></Field>
            <Field label="Weight (kg)"><Input required type="number" step="0.1" min={10} value={form.weight} onChange={set("weight")} /></Field>
            <div className="col-span-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">Derived BMI = weight / (height m)² = <b>{bmiPreview}</b></div>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" disabled={busy}>{editId ? "Save changes" : "Insert patient"}</Button>
              {editId && <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</Button>}
            </div>
          </form>
          {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Search patients"
            subtitle="WHERE name ILIKE '%q%' OR phone ILIKE '%q%' OR email ILIKE '%q%' – uses idx_patient_name"
            actions={<span className="text-xs text-slate-500">{data?.rows.length ?? 0} row(s)</span>}
          >
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(q);
              }}
            >
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone or e-mail" className="max-w-xs" />
              <Select value={gender} onChange={(e) => setGender(e.target.value)} className="max-w-[10rem]"><option value="">All genders</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</Select>
              <Button type="submit" variant="secondary">Search</Button>
              {(search || gender) && <Button type="button" variant="ghost" onClick={() => { setQ(""); setSearch(""); setGender(""); }}>Clear</Button>}
            </form>
            <div className="mt-4">
              {error && <Alert tone="error">{error}</Alert>}
              {loading && !data ? (
                <Loading />
              ) : (
                <DataTable
                  rows={data?.rows ?? []}
                  rowKey={(r) => r.patientId}
                  columns={[
                    { key: "patientId", label: "ID" },
                    { key: "name", label: "Name", render: (r) => <PatientLink id={r.patientId} name={r.name} /> },
                    { key: "age", label: "Age" },
                    { key: "gender", label: "Gender" },
                    { key: "phone", label: "Phone" },
                    { key: "email", label: "E-mail" },
                    { key: "bmi", label: "BMI", render: (r) => num(r.bmi, 1) },
                    { key: "glucoseCount", label: "Readings" },
                    { key: "latestRisk", label: "Risk", render: (r) => <RiskBadge level={r.latestRisk} /> },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (r) => (
                        <div className="flex gap-1">
                          <Button variant="ghost" className="!px-2 !py-1" onClick={() => router.push(`/patients/${r.patientId}`)}>History</Button>
                          <Button variant="ghost" className="!px-2 !py-1" onClick={() => startEdit(r)}>Edit</Button>
                          <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => remove(r)}>Delete</Button>
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </Card>
          <SqlPanel executed={lastSql ?? data?.executedSql ?? null} />
        </div>
      </div>
    </div>
  );
}
