"use client";

import Link from "next/link";
import { Alert, Badge, Card, DataTable, Loading, PageHeader, PatientLink, RiskBadge, StatCard } from "@/components/ui";
import { Donut, SimpleBars, TrendLine, RISK_COLORS } from "@/components/charts";
import { fmtDateTime, glucoseTone, hba1cTone, num, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
interface Dashboard {
  seeded: boolean;
  kpi: Row;
  mostCommonMeal: Row | null;
  riskDistribution: Row[];
  glucoseTrend: Row[];
  mealTypes: Row[];
  weeklyActivity: Row[];
  recentPatients: Row[];
  tableCounts: Row[];
}

export default function DashboardPage() {
  const { data, loading, error } = useFetch<Dashboard>("/api/dashboard");

  if (loading && !data) return <Loading label="Running dashboard queries…" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;
  const k = data.kpi;

  return (
    <div className="space-y-6">
      <PageHeader
        title="DBMS Dashboard"
        description="Every figure on this page is the result of an SQL aggregate (COUNT, AVG, GROUP BY, sub-queries) executed against the live database."
        actions={
          <Link href="/reports" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Open SQL Reports →
          </Link>
        }
      />
      {data.seeded && <Alert tone="success">Database was empty – sample dataset loaded automatically (see Admin → Sample data).</Alert>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total patients" value={String(k.total_patients)} tone="teal" sql="SELECT COUNT(*) FROM patient" />
        <StatCard label="Medical records" value={String(k.total_medical_records)} tone="blue" sql="SELECT COUNT(*) FROM medical_record" />
        <StatCard label="Average glucose" value={`${num(k.avg_glucose)} mg/dL`} tone="amber" sql="SELECT AVG(glucose_level) FROM blood_sugar_record" hint={`${k.total_glucose_readings} readings`} />
        <StatCard label="Average HbA1c" value={`${num(k.avg_hba1c, 2)} %`} tone="violet" sql="SELECT AVG(hba1c) FROM lab_report" />
        <StatCard label="High-risk patients" value={String(k.high_risk_patients)} tone="rose" sql="… WHERE risk_level='High Risk' AND prediction_id IN (SELECT MAX(prediction_id) … GROUP BY patient_id)" />
        <StatCard label="Most common meal" value={<span className="text-lg">{data.mostCommonMeal ? String(data.mostCommonMeal.meal_name) : "—"}</span>} hint={data.mostCommonMeal ? `${data.mostCommonMeal.meal_type} · consumed ${data.mostCommonMeal.times} times` : undefined} tone="emerald" sql="GROUP BY meal_id ORDER BY COUNT(*) DESC LIMIT 1" />
        <StatCard label="Total activities" value={String(k.total_activities)} tone="slate" sql="SELECT COUNT(*) FROM activity_record" />
        <StatCard label="Recommendations" value={String(k.total_recommendations)} tone="blue" sql="SELECT COUNT(*) FROM recommendation" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Glucose trend – last 14 days" subtitle="AVG(glucose_level) GROUP BY day, split by measurement_type" className="lg:col-span-2">
          <TrendLine
            data={data.glucoseTrend}
            x="day"
            series={[
              { key: "fasting", label: "Fasting avg", color: "#0d9488" },
              { key: "post_meal", label: "Post-meal avg", color: "#f59e0b" },
            ]}
            refLines={[{ y: 126, label: "Fasting 126", color: "#e11d48" }]}
          />
        </Card>
        <Card title="Risk distribution" subtitle="Latest prediction per patient (sub-query) grouped by risk_level">
          {data.riskDistribution.length ? <Donut data={data.riskDistribution} nameKey="risk_level" valueKey="patient_count" colors={RISK_COLORS} /> : <p className="text-sm text-slate-500">No predictions stored yet.</p>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Weekly activity" subtitle="SUM(duration), SUM(steps) GROUP BY DATE_TRUNC('week', activity_date)">
          <SimpleBars data={data.weeklyActivity} x="week_start" series={[{ key: "total_minutes", label: "Minutes", color: "#0ea5e9" }, { key: "sessions", label: "Sessions", color: "#8b5cf6" }]} />
        </Card>
        <Card title="Meal records by type" subtitle="COUNT(*) GROUP BY meal_type (meal_record ⋈ meal)">
          <SimpleBars data={data.mealTypes} x="meal_type" series={[{ key: "records", label: "Records", color: "#10b981" }, { key: "avg_calories", label: "Avg calories", color: "#f59e0b" }]} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Recent patient records" subtitle="Latest glucose / HbA1c / risk fetched with scalar sub-queries" className="lg:col-span-2">
          <DataTable
            rows={data.recentPatients}
            rowKey={(r) => String(r.patient_id)}
            columns={[
              { key: "name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.name} /> },
              { key: "age", label: "Age / Sex", render: (r) => `${r.age} / ${String(r.gender)[0]}` },
              { key: "bmi", label: "BMI", render: (r) => num(r.bmi, 1) },
              { key: "latest_glucose", label: "Latest glucose", render: (r) => <Badge tone={glucoseTone(r.latest_glucose)}>{num(r.latest_glucose)} mg/dL</Badge> },
              { key: "latest_reading_at", label: "Reading at", render: (r) => fmtDateTime(r.latest_reading_at) },
              { key: "latest_hba1c", label: "HbA1c", render: (r) => <Badge tone={hba1cTone(r.latest_hba1c)}>{num(r.latest_hba1c, 2)} %</Badge> },
              { key: "risk_level", label: "Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
            ]}
          />
        </Card>
        <Card title="Table row counts" subtitle="UNION ALL of COUNT(*) over all 10 tables">
          <ul className="divide-y divide-slate-100 text-sm">
            {data.tableCounts.map((t) => (
              <li key={String(t.table_name)} className="flex items-center justify-between py-1.5">
                <code className="text-xs text-slate-700">{String(t.table_name)}</code>
                <span className="font-semibold text-slate-900">{String(t.rows)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
