"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, DataTable, Loading, PageHeader, RiskBadge, SqlBlock, StatCard } from "@/components/ui";
import { SimpleBars, TrendLine } from "@/components/charts";
import { api, fmtDate, fmtDateTime, glucoseTone, hba1cTone, num, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
interface History {
  patient: Row;
  medicalRecords: Row[];
  glucose: Row[];
  glucoseStats: Row;
  labReports: Row[];
  mealRecords: Row[];
  activityRecords: Row[];
  weeklyActivity: Row[];
  predictions: Row[];
  recommendations: Row[];
}

export default function PatientHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, refresh } = useFetch<History>(`/api/patients/${id}/history`);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runPrediction() {
    setBusy(true);
    try {
      const r = await api<{ row: Row; recommendations: unknown[] }>("/api/predictions", { method: "POST", body: JSON.stringify({ patient_id: Number(id), generate_recommendations: true }) });
      setMsg(`Prediction stored: ${r.row.risk_level} (score ${r.row.risk_score}). ${r.recommendations.length} recommendations inserted.`);
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading label="Joining all patient tables…" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;
  const p = data.patient;
  const s = data.glucoseStats;
  const trend = [...data.glucose].reverse().map((g) => ({ day: String(g.record_date).slice(0, 16).replace("T", " "), [String(g.measurement_type)]: g.glucose_level }));
  const labTrend = [...data.labReports].reverse().map((l) => ({ day: String(l.report_date), hba1c: l.hba1c, systolic: l.bp_systolic, diastolic: l.bp_diastolic }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${String(p.name)} — complete history`}
        description={`Patient #${String(p.patient_id)} · ${String(p.age)} yrs · ${String(p.gender)} · ${String(p.phone)} · ${p.email ? String(p.email) : "no e-mail"} · Height ${num(p.height, 0)} cm · Weight ${num(p.weight, 1)} kg · BMI ${num(p.bmi, 1)}`}
        actions={
          <>
            <Link href="/patients" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Patients</Link>
            <Button onClick={runPrediction} disabled={busy}>Run risk prediction & store</Button>
          </>
        }
      />
      {msg && <Alert tone="info">{msg}</Alert>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Readings" value={String(s.total)} tone="slate" />
        <StatCard label="Avg glucose" value={num(s.avg)} hint="mg/dL" tone="teal" />
        <StatCard label="Highest" value={num(s.max)} hint="MAX(glucose_level)" tone="rose" />
        <StatCard label="Lowest" value={num(s.min)} hint="MIN(glucose_level)" tone="emerald" />
        <StatCard label="Avg fasting" value={num(s.avg_fasting)} tone="blue" />
        <StatCard label="Avg post-meal" value={num(s.avg_post_meal)} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Glucose readings" subtitle="SELECT * FROM blood_sugar_record WHERE patient_id = ? ORDER BY record_date">
          <TrendLine data={trend} x="day" series={[{ key: "Fasting", label: "Fasting" }, { key: "Post-Meal", label: "Post-Meal", color: "#f59e0b" }, { key: "Random", label: "Random", color: "#8b5cf6" }, { key: "Bedtime", label: "Bedtime", color: "#64748b" }]} refLines={[{ y: 180, label: "180", color: "#e11d48" }, { y: 70, label: "70", color: "#0ea5e9" }]} />
        </Card>
        <Card title="HbA1c & blood pressure" subtitle="SELECT * FROM lab_report WHERE patient_id = ? ORDER BY report_date">
          <TrendLine data={labTrend} x="day" series={[{ key: "hba1c", label: "HbA1c %", color: "#8b5cf6" }]} height={130} refLines={[{ y: 6.5, label: "6.5", color: "#e11d48" }]} />
          <TrendLine data={labTrend} x="day" series={[{ key: "systolic", label: "Systolic", color: "#e11d48" }, { key: "diastolic", label: "Diastolic", color: "#0ea5e9" }]} height={130} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Predictions (history)" subtitle="Each run is INSERTed into prediction – older rows are retained" actions={<Link href="/predictions" className="text-xs text-teal-700 hover:underline">All predictions</Link>}>
          <DataTable rows={data.predictions} rowKey={(r) => String(r.prediction_id)} columns={[
            { key: "prediction_date", label: "Date", render: (r) => fmtDateTime(r.prediction_date) },
            { key: "risk_level", label: "Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
            { key: "risk_score", label: "Score" },
            { key: "remarks", label: "Remarks", className: "text-xs" },
          ]} />
        </Card>
        <Card title="Recommendations" subtitle="SELECT * FROM recommendation WHERE patient_id = ?">
          <ul className="space-y-2">
            {data.recommendations.length === 0 && <li className="text-sm text-slate-500">None stored yet.</li>}
            {data.recommendations.map((r) => (
              <li key={String(r.recommendation_id)} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2"><Badge tone={r.recommendation_type === "Meal" ? "ok" : r.recommendation_type === "Activity" ? "info" : "neutral"}>{String(r.recommendation_type)}</Badge><span className="text-xs text-slate-500">{fmtDate(r.recommendation_date)}</span></div>
                {String(r.recommendation_text)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Medical records" subtitle="SELECT * FROM medical_record WHERE patient_id = ? ORDER BY record_date DESC">
        <DataTable rows={data.medicalRecords} rowKey={(r) => String(r.record_id)} columns={[
          { key: "record_id", label: "ID" },
          { key: "record_date", label: "Date", render: (r) => fmtDate(r.record_date) },
          { key: "existing_conditions", label: "Conditions" },
          { key: "medications", label: "Medications" },
          { key: "medical_history", label: "History", className: "max-w-md text-xs" },
        ]} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Weekly activity statistics" subtitle="GROUP BY DATE_TRUNC('week', activity_date)">
          <SimpleBars data={data.weeklyActivity} x="week_start" series={[{ key: "total_minutes", label: "Minutes", color: "#0ea5e9" }, { key: "sessions", label: "Sessions", color: "#8b5cf6" }]} height={200} />
          <div className="mt-3">
            <DataTable rows={data.activityRecords.slice(0, 10)} rowKey={(r) => String(r.activity_record_id)} columns={[
              { key: "activity_date", label: "Date", render: (r) => fmtDate(r.activity_date) },
              { key: "activity_name", label: "Activity" },
              { key: "activity_type", label: "Type" },
              { key: "duration", label: "Min" },
              { key: "steps", label: "Steps" },
            ]} />
          </div>
        </Card>
        <Card title="Meal records" subtitle="meal_record INNER JOIN meal – latest 10">
          <DataTable rows={data.mealRecords.slice(0, 10)} rowKey={(r) => String(r.meal_record_id)} columns={[
            { key: "meal_date", label: "Date", render: (r) => fmtDate(r.meal_date) },
            { key: "meal_name", label: "Meal" },
            { key: "meal_type", label: "Type" },
            { key: "calories", label: "kcal" },
            { key: "carbohydrates", label: "Carbs g", render: (r) => num(r.carbohydrates, 0) },
            { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Consumed" ? "ok" : r.status === "Skipped" ? "warn" : "info"}>{String(r.status)}</Badge> },
          ]} />
        </Card>
      </div>

      <Card title="Recent glucose readings" subtitle="Latest 15 rows">
        <DataTable rows={data.glucose.slice(0, 15)} rowKey={(r) => String(r.sugar_record_id)} columns={[
          { key: "record_date", label: "Recorded at", render: (r) => fmtDateTime(r.record_date) },
          { key: "measurement_type", label: "Type" },
          { key: "glucose_level", label: "mg/dL", render: (r) => <Badge tone={glucoseTone(r.glucose_level, String(r.measurement_type))}>{num(r.glucose_level)}</Badge> },
        ]} />
      </Card>

      <Card title="Lab reports" subtitle="HbA1c with tone: <5.7 normal, 5.7–6.4 elevated, ≥6.5 high">
        <DataTable rows={data.labReports} rowKey={(r) => String(r.lab_id)} columns={[
          { key: "report_date", label: "Date", render: (r) => fmtDate(r.report_date) },
          { key: "hba1c", label: "HbA1c %", render: (r) => <Badge tone={hba1cTone(r.hba1c)}>{num(r.hba1c, 2)}</Badge> },
          { key: "blood_pressure", label: "Blood pressure" },
        ]} />
      </Card>

      <SqlBlock title="Queries behind this page" sql={`SELECT * FROM patient WHERE patient_id = ${id};\nSELECT * FROM medical_record WHERE patient_id = ${id} ORDER BY record_date DESC;\nSELECT COUNT(*), AVG(glucose_level), MAX(glucose_level), MIN(glucose_level) FROM blood_sugar_record WHERE patient_id = ${id};\nSELECT mr.*, m.meal_name FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id WHERE mr.patient_id = ${id};\nSELECT DATE_TRUNC('week', activity_date) AS week, SUM(duration), SUM(steps) FROM activity_record WHERE patient_id = ${id} GROUP BY 1;`} />
    </div>
  );
}
