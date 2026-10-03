import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, DataTable, Loading, PageHeader, RiskBadge, SqlBlock, StatCard } from "../components/ui.jsx";
import { SimpleBars, TrendLine } from "../components/charts.jsx";
import { api, fmtDate, fmtDateTime, glucoseTone, hba1cTone, num, useFetch } from "../api.js";

export default function PatientHistory() {
  const { id } = useParams();
  const { data, loading, error, refresh } = useFetch(`/api/patients/${id}/history`);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function runPrediction() {
    setBusy(true);
    try {
      const r = await api("/api/predictions", { method: "POST", body: JSON.stringify({ patient_id: Number(id), generate_recommendations: true }) });
      setMsg(`Prediction stored: ${r.row.risk_level} (score ${r.row.risk_score}). ${r.recommendations.length} recommendations inserted.`);
      refresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Loading label="Joining all patient tables…" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;
  const p = data.patient;
  const s = data.glucoseStats;
  const trend = [...data.glucose].reverse().map((g) => ({ day: String(g.record_date).slice(0, 16).replace("T", " "), [g.measurement_type]: g.glucose_level }));
  const labTrend = [...data.labReports].reverse().map((l) => ({ day: String(l.report_date), hba1c: l.hba1c, systolic: l.bp_systolic, diastolic: l.bp_diastolic }));
  const statusTone = (st) => (st === "Consumed" ? "ok" : st === "Skipped" ? "warn" : "info");

  return (
    <div className="stack">
      <PageHeader
        title={`${p.name} — complete history`}
        description={`Patient #${p.patient_id} · ${p.age} yrs · ${p.gender} · ${p.phone} · ${p.email || "no e-mail"} · Height ${num(p.height, 0)} cm · Weight ${num(p.weight, 1)} kg · BMI ${num(p.bmi, 1)}`}
        actions={<><Link className="btn secondary" to="/patients">← Patients</Link><Button onClick={runPrediction} disabled={busy}>Run risk prediction &amp; store</Button></>}
      />
      {msg && <Alert tone="info">{msg}</Alert>}
      <div className="grid cols-6 tight">
        <StatCard label="Readings" value={s.total} tone="slate" />
        <StatCard label="Avg glucose" value={num(s.avg)} hint="mg/dL" tone="teal" />
        <StatCard label="Highest" value={num(s.max)} hint="MAX(glucose_level)" tone="rose" />
        <StatCard label="Lowest" value={num(s.min)} hint="MIN(glucose_level)" tone="emerald" />
        <StatCard label="Avg fasting" value={num(s.avg_fasting)} tone="blue" />
        <StatCard label="Avg post-meal" value={num(s.avg_post_meal)} tone="amber" />
      </div>
      <div className="grid cols-2">
        <Card title="Glucose readings" subtitle="SELECT * FROM blood_sugar_record WHERE patient_id = ? ORDER BY record_date">
          <TrendLine data={trend} x="day" series={[{ key: "Fasting", label: "Fasting" }, { key: "Post-Meal", label: "Post-Meal", color: "#f59e0b" }, { key: "Random", label: "Random", color: "#8b5cf6" }, { key: "Bedtime", label: "Bedtime", color: "#64748b" }]} refLines={[{ y: 180, label: "180", color: "#e11d48" }, { y: 70, label: "70", color: "#0ea5e9" }]} />
        </Card>
        <Card title="HbA1c & blood pressure" subtitle="SELECT * FROM lab_report WHERE patient_id = ? ORDER BY report_date">
          <TrendLine data={labTrend} x="day" series={[{ key: "hba1c", label: "HbA1c %", color: "#8b5cf6" }]} height={130} refLines={[{ y: 6.5, label: "6.5", color: "#e11d48" }]} />
          <TrendLine data={labTrend} x="day" series={[{ key: "systolic", label: "Systolic", color: "#e11d48" }, { key: "diastolic", label: "Diastolic", color: "#0ea5e9" }]} height={130} />
        </Card>
      </div>
      <div className="grid cols-2">
        <Card title="Predictions (history)" subtitle="Each run is INSERTed into prediction – older rows are retained" actions={<Link className="xs" to="/predictions">All predictions</Link>}>
          <DataTable rows={data.predictions} rowKey={(r) => r.prediction_id} columns={[
            { key: "prediction_date", label: "Date", render: (r) => fmtDateTime(r.prediction_date) },
            { key: "risk_level", label: "Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
            { key: "risk_score", label: "Score" },
            { key: "remarks", label: "Remarks", className: "xs wrap" },
          ]} />
        </Card>
        <Card title="Recommendations" subtitle="SELECT * FROM recommendation WHERE patient_id = ?">
          {data.recommendations.length === 0 && <p className="muted small">None stored yet.</p>}
          {data.recommendations.map((r) => (
            <div key={r.recommendation_id} className="reco">
              <div className="meta"><Badge tone={r.recommendation_type === "Meal" ? "ok" : r.recommendation_type === "Activity" ? "info" : "neutral"}>{r.recommendation_type}</Badge><span className="muted xs">{fmtDate(r.recommendation_date)}</span></div>
              {r.recommendation_text}
            </div>
          ))}
        </Card>
      </div>
      <Card title="Medical records" subtitle="SELECT * FROM medical_record WHERE patient_id = ? ORDER BY record_date DESC">
        <DataTable rows={data.medicalRecords} rowKey={(r) => r.record_id} columns={[
          { key: "record_id", label: "ID" },
          { key: "record_date", label: "Date", render: (r) => fmtDate(r.record_date) },
          { key: "existing_conditions", label: "Conditions" },
          { key: "medications", label: "Medications" },
          { key: "medical_history", label: "History", className: "xs wrap" },
        ]} />
      </Card>
      <div className="grid cols-2">
        <Card title="Weekly activity statistics" subtitle="GROUP BY week_start (Monday of each week)">
          <SimpleBars data={data.weeklyActivity} x="week_start" series={[{ key: "total_minutes", label: "Minutes", color: "#0ea5e9" }, { key: "sessions", label: "Sessions", color: "#8b5cf6" }]} height={200} />
          <div className="mt">
            <DataTable rows={data.activityRecords.slice(0, 10)} rowKey={(r) => r.activity_record_id} columns={[
              { key: "activity_date", label: "Date", render: (r) => fmtDate(r.activity_date) },
              { key: "activity_name", label: "Activity" },
              { key: "activity_type", label: "Type" },
              { key: "duration", label: "Min" },
              { key: "steps", label: "Steps" },
            ]} />
          </div>
        </Card>
        <Card title="Meal records" subtitle="meal_record INNER JOIN meal – latest 10">
          <DataTable rows={data.mealRecords.slice(0, 10)} rowKey={(r) => r.meal_record_id} columns={[
            { key: "meal_date", label: "Date", render: (r) => fmtDate(r.meal_date) },
            { key: "meal_name", label: "Meal" },
            { key: "meal_type", label: "Type" },
            { key: "calories", label: "kcal" },
            { key: "carbohydrates", label: "Carbs g", render: (r) => num(r.carbohydrates, 0) },
            { key: "status", label: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
          ]} />
        </Card>
      </div>
      <Card title="Recent glucose readings" subtitle="Latest 15 rows">
        <DataTable rows={data.glucose.slice(0, 15)} rowKey={(r) => r.sugar_record_id} columns={[
          { key: "record_date", label: "Recorded at", render: (r) => fmtDateTime(r.record_date) },
          { key: "measurement_type", label: "Type" },
          { key: "glucose_level", label: "mg/dL", render: (r) => <Badge tone={glucoseTone(r.glucose_level, r.measurement_type)}>{num(r.glucose_level)}</Badge> },
        ]} />
      </Card>
      <Card title="Lab reports" subtitle="HbA1c tone: <5.7 normal, 5.7–6.4 elevated, ≥6.5 high">
        <DataTable rows={data.labReports} rowKey={(r) => r.lab_id} columns={[
          { key: "report_date", label: "Date", render: (r) => fmtDate(r.report_date) },
          { key: "hba1c", label: "HbA1c %", render: (r) => <Badge tone={hba1cTone(r.hba1c)}>{num(r.hba1c, 2)}</Badge> },
          { key: "blood_pressure", label: "Blood pressure" },
        ]} />
      </Card>
      <SqlBlock title="Queries behind this page" sql={`SELECT * FROM patient WHERE patient_id = ${id};\nSELECT * FROM medical_record WHERE patient_id = ${id} ORDER BY record_date DESC;\nSELECT COUNT(*), AVG(glucose_level), MAX(glucose_level), MIN(glucose_level) FROM blood_sugar_record WHERE patient_id = ${id};\nSELECT mr.*, m.meal_name FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id WHERE mr.patient_id = ${id};\nSELECT DATE_SUB(activity_date, INTERVAL WEEKDAY(activity_date) DAY) AS week_start, SUM(duration), SUM(steps)\n  FROM activity_record WHERE patient_id = ${id} GROUP BY week_start;`} />
    </div>
  );
}
