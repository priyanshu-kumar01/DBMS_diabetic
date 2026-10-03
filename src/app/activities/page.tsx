"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { ACTIVITY_TYPES, Alert, Badge, Button, Card, DataTable, Field, Input, Loading, PageHeader, PatientLink, Select, SqlPanel, StatCard, Textarea } from "@/components/ui";
import { SimpleBars } from "@/components/charts";
import { api, type ExecutedSql, fmtDate, num, today, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
const emptyAct = { activity_name: "", activity_type: "Aerobic", recommended_duration: "", description: "" };

export default function ActivitiesPage() {
  const [type, setType] = useState("");
  const acts = useFetch<{ rows: Row[] }>(`/api/activities?type=${type}`);
  const [rpid, setRpid] = useState("");
  const recs = useFetch<{ rows: Row[]; weekly: Row[]; totals: Row; byType: Row[] }>(`/api/activity-records?patient_id=${rpid}`);

  const [actForm, setActForm] = useState(emptyAct);
  const [editId, setEditId] = useState<number | null>(null);
  const [recForm, setRecForm] = useState({ patient_id: "", activity_id: "", duration: "", steps: "", activity_date: today() });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);

  const run = async (fn: () => Promise<{ executedSql: ExecutedSql }>, success: string) => {
    try {
      const r = await fn();
      setLastSql(r.executedSql);
      setMsg({ tone: "success", text: success });
      acts.refresh();
      recs.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  };
  const t = recs.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Management" description="activity is a master table; activity_record links patients to activities and tracks duration (minutes) and steps with CHECK constraints. Weekly statistics use GROUP BY DATE_TRUNC('week', activity_date)." />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title={editId ? `Update activity #${editId}` : "Add activity"} subtitle={editId ? "UPDATE activity SET … WHERE activity_id = ?" : "INSERT INTO activity (…)"}>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api(editId ? `/api/activities/${editId}` : "/api/activities", { method: editId ? "PUT" : "POST", body: JSON.stringify(actForm) }), editId ? "Activity updated." : "Activity inserted.").then(() => { setActForm(emptyAct); setEditId(null); }); }}>
              <Field label="Activity name (UNIQUE)"><Input required value={actForm.activity_name} onChange={(e) => setActForm({ ...actForm, activity_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type"><Select value={actForm.activity_type} onChange={(e) => setActForm({ ...actForm, activity_type: e.target.value })}>{ACTIVITY_TYPES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
                <Field label="Recommended min"><Input required type="number" min={1} value={actForm.recommended_duration} onChange={(e) => setActForm({ ...actForm, recommended_duration: e.target.value })} /></Field>
              </div>
              <Field label="Description"><Textarea rows={2} value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} /></Field>
              <div className="flex gap-2">
                <Button type="submit">{editId ? "Save" : "Insert activity"}</Button>
                {editId && <Button type="button" variant="secondary" onClick={() => { setEditId(null); setActForm(emptyAct); }}>Cancel</Button>}
              </div>
            </form>
          </Card>
          <Card title="Record patient activity" subtitle="INSERT INTO activity_record (patient_id, activity_id, duration, steps, activity_date)">
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api("/api/activity-records", { method: "POST", body: JSON.stringify(recForm) }), "Activity record inserted."); }}>
              <Field label="Patient"><PatientSelect value={recForm.patient_id} onChange={(v) => setRecForm({ ...recForm, patient_id: v })} required /></Field>
              <Field label="Activity"><Select required value={recForm.activity_id} onChange={(e) => setRecForm({ ...recForm, activity_id: e.target.value })}><option value="">Select activity…</option>{(acts.data?.rows ?? []).map((a) => <option key={String(a.activity_id)} value={String(a.activity_id)}>{String(a.activity_name)} ({String(a.activity_type)}, rec. {String(a.recommended_duration)} min)</option>)}</Select></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Duration (min)"><Input required type="number" min={1} value={recForm.duration} onChange={(e) => setRecForm({ ...recForm, duration: e.target.value })} /></Field>
                <Field label="Steps"><Input type="number" min={0} value={recForm.steps} onChange={(e) => setRecForm({ ...recForm, steps: e.target.value })} /></Field>
                <Field label="Date"><Input type="date" value={recForm.activity_date} onChange={(e) => setRecForm({ ...recForm, activity_date: e.target.value })} /></Field>
              </div>
              <Button type="submit">Insert activity record</Button>
            </form>
          </Card>
          <SqlPanel executed={lastSql} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Weekly activity statistics" subtitle="SELECT DATE_TRUNC('week', activity_date), COUNT(*), SUM(duration), SUM(steps) … GROUP BY 1" actions={<div className="w-56"><PatientSelect value={rpid} onChange={setRpid} allowAll /></div>}>
            {t && (
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatCard label="Sessions" value={String(t.sessions)} tone="slate" sql="COUNT(*)" />
                <StatCard label="Total minutes" value={String(t.total_minutes)} tone="blue" sql="SUM(duration)" />
                <StatCard label="Total steps" value={Number(t.total_steps).toLocaleString()} tone="teal" sql="SUM(steps)" />
                <StatCard label="Avg duration" value={num(t.avg_duration)} hint="min / session" tone="violet" sql="AVG(duration)" />
                <StatCard label="Last 7 days" value={`${t.minutes_last_7d} min`} hint={Number(t.minutes_last_7d) >= (rpid ? 150 : 0) ? "meets 150 min target" : "target: 150 min/week"} tone={Number(t.minutes_last_7d) >= 150 || !rpid ? "emerald" : "amber"} />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2"><SimpleBars data={recs.data?.weekly ?? []} x="week_start" series={[{ key: "total_minutes", label: "Minutes", color: "#0ea5e9" }, { key: "sessions", label: "Sessions", color: "#8b5cf6" }]} height={220} /></div>
              <div><SimpleBars data={recs.data?.byType ?? []} x="activity_type" series={[{ key: "total_minutes", label: "Minutes by type", color: "#0d9488" }]} height={220} /></div>
            </div>
          </Card>
          <Card title="Activity catalog" subtitle="activity LEFT JOIN activity_record … GROUP BY activity_id" actions={<Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[10rem]"><option value="">All types</option>{ACTIVITY_TYPES.map((x) => <option key={x}>{x}</option>)}</Select>}>
            {acts.loading && !acts.data ? <Loading /> : (
              <DataTable rows={acts.data?.rows ?? []} rowKey={(r) => String(r.activity_id)} columns={[
                { key: "activity_id", label: "ID" },
                { key: "activity_name", label: "Activity" },
                { key: "activity_type", label: "Type", render: (r) => <Badge tone="info">{String(r.activity_type)}</Badge> },
                { key: "recommended_duration", label: "Rec. min" },
                { key: "times_performed", label: "Performed" },
                { key: "total_minutes", label: "Total min" },
                { key: "avg_duration", label: "Avg min", render: (r) => num(r.avg_duration) },
                { key: "a", label: "", render: (r) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" className="!px-2 !py-1" onClick={() => { setEditId(Number(r.activity_id)); setActForm({ activity_name: String(r.activity_name), activity_type: String(r.activity_type), recommended_duration: String(r.recommended_duration), description: String(r.description ?? "") }); }}>Edit</Button>
                    <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => confirm("Delete activity? Fails if activity_record rows reference it (ON DELETE RESTRICT).") && run(() => api(`/api/activities/${r.activity_id}`, { method: "DELETE" }), "Activity deleted.")}>Delete</Button>
                  </div>
                ) },
              ]} />
            )}
          </Card>
          <Card title="Activity records" subtitle="activity_record ⋈ patient ⋈ activity" actions={<span className="text-xs text-slate-500">{recs.data?.rows.length ?? 0} row(s)</span>}>
            {recs.loading && !recs.data ? <Loading /> : (
              <DataTable rows={(recs.data?.rows ?? []).slice(0, 60)} rowKey={(r) => String(r.activity_record_id)} columns={[
                { key: "activity_date", label: "Date", render: (r) => fmtDate(r.activity_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "activity_name", label: "Activity" },
                { key: "activity_type", label: "Type" },
                { key: "duration", label: "Duration", render: (r) => <span className={Number(r.duration) >= Number(r.recommended_duration) ? "text-emerald-700" : "text-amber-700"}>{String(r.duration)} min</span> },
                { key: "steps", label: "Steps", render: (r) => Number(r.steps).toLocaleString() },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => confirm("Delete activity record?") && run(() => api(`/api/activity-records/${r.activity_record_id}`, { method: "DELETE" }), "Activity record deleted.")}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
