"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { Alert, Button, Card, DataTable, Field, Input, Loading, PageHeader, PatientLink, SqlPanel, Textarea } from "@/components/ui";
import { api, type ExecutedSql, fmtDate, today, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
const empty = { patient_id: "", record_date: today(), existing_conditions: "", medications: "", medical_history: "" };

export default function MedicalRecordsPage() {
  const [pid, setPid] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const url = `/api/medical-records?patient_id=${pid}&from=${from}&to=${to}`;
  const { data, loading, error, refresh } = useFetch<{ rows: Row[] }>(url);

  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);
  const upd = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = editId
        ? await api<{ executedSql: ExecutedSql }>(`/api/medical-records/${editId}`, { method: "PUT", body: JSON.stringify(form) })
        : await api<{ executedSql: ExecutedSql }>("/api/medical-records", { method: "POST", body: JSON.stringify(form) });
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: editId ? "Medical record updated." : "Medical record inserted." });
      setForm({ ...empty, patient_id: form.patient_id });
      setEditId(null);
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }
  async function remove(id: unknown) {
    if (!confirm("Delete this medical record?")) return;
    try {
      const r = await api<{ executedSql: ExecutedSql }>(`/api/medical-records/${id}`, { method: "DELETE" });
      setLastSql(r.executedSql);
      refresh();
    } catch (err) {
      setMsg({ tone: "error", text: (err as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Medical Records" description="One patient → many medical_record rows (1:N via FOREIGN KEY patient_id). Records can be filtered by patient and by date range using the composite index (patient_id, record_date)." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={editId ? `Update record #${editId}` : "Add medical record"} subtitle={editId ? "UPDATE medical_record SET … WHERE record_id = ?" : "INSERT INTO medical_record (…)"}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Patient"><PatientSelect value={form.patient_id} onChange={(v) => upd("patient_id", v)} required /></Field>
            <Field label="Record date"><Input type="date" value={form.record_date} onChange={(e) => upd("record_date", e.target.value)} required /></Field>
            <Field label="Existing conditions"><Input value={form.existing_conditions} onChange={(e) => upd("existing_conditions", e.target.value)} placeholder="Type 2 Diabetes, Hypertension" /></Field>
            <Field label="Medications"><Input value={form.medications} onChange={(e) => upd("medications", e.target.value)} placeholder="Metformin 500mg BD" /></Field>
            <Field label="Medical history / notes"><Textarea rows={4} value={form.medical_history} onChange={(e) => upd("medical_history", e.target.value)} /></Field>
            <div className="flex gap-2">
              <Button type="submit">{editId ? "Save changes" : "Insert record"}</Button>
              {editId && <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</Button>}
            </div>
          </form>
          {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Medical history" subtitle="SELECT … FROM medical_record m INNER JOIN patient p … WHERE patient_id = ? AND record_date BETWEEN ? AND ?" actions={<span className="text-xs text-slate-500">{data?.rows.length ?? 0} row(s)</span>}>
            <div className="mb-4 grid gap-2 md:grid-cols-4">
              <PatientSelect value={pid} onChange={setPid} allowAll />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <Button variant="secondary" onClick={() => { setPid(""); setFrom(""); setTo(""); }}>Clear filters</Button>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows ?? []} rowKey={(r) => String(r.record_id)} columns={[
                { key: "record_id", label: "ID" },
                { key: "record_date", label: "Date", render: (r) => fmtDate(r.record_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "existing_conditions", label: "Conditions" },
                { key: "medications", label: "Medications" },
                { key: "medical_history", label: "History", className: "max-w-sm text-xs" },
                { key: "actions", label: "", render: (r) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => { setEditId(Number(r.record_id)); setForm({ patient_id: String(r.patient_id), record_date: String(r.record_date).slice(0, 10), existing_conditions: String(r.existing_conditions ?? ""), medications: String(r.medications ?? ""), medical_history: String(r.medical_history ?? "") }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
                    <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => remove(r.record_id)}>Delete</Button>
                  </div>
                ) },
              ]} />
            )}
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
      </div>
    </div>
  );
}
