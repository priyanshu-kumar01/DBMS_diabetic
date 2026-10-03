"use client";

import { useState } from "react";
import PatientSelect from "@/components/PatientSelect";
import { Alert, Button, Card, DataTable, Field, Loading, PageHeader, PatientLink, RISK_LEVELS, RiskBadge, Select, SqlPanel } from "@/components/ui";
import { Donut, RISK_COLORS } from "@/components/charts";
import { api, type ExecutedSql, fmtDateTime, num, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
interface Factor { factor: string; value: string; points: number; note: string }
interface Assessment { riskLevel: string; riskScore: number; factors: Factor[]; remarks: string }

export default function PredictionsPage() {
  const [pid, setPid] = useState("");
  const [risk, setRisk] = useState("");
  const { data, loading, error, refresh } = useFetch<{ rows: Row[]; distribution: Row[] }>(`/api/predictions?patient_id=${pid}&risk=${encodeURIComponent(risk)}`);
  const [target, setTarget] = useState("");
  const [withReco, setWithReco] = useState(true);
  const [result, setResult] = useState<{ assessment: Assessment; row: Row; recommendations: unknown[] } | null>(null);
  const [lastSql, setLastSql] = useState<ExecutedSql | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function predict(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ assessment: Assessment; row: Row; recommendations: unknown[]; executedSql: ExecutedSql }>("/api/predictions", { method: "POST", body: JSON.stringify({ patient_id: target, generate_recommendations: withReco }) });
      setResult(r);
      setLastSql(r.executedSql);
      refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: unknown) {
    if (!confirm("Delete this prediction row?")) return;
    const r = await api<{ executedSql: ExecutedSql }>(`/api/predictions/${id}`, { method: "DELETE" });
    setLastSql(r.executedSql);
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Risk Prediction (basic, rule-based)" description="Academic feature – NOT a medical diagnosis. A simple points system reads the patient's stored data (fasting glucose average, latest HbA1c, BMI, age, weekly activity, hypertension history) with SQL sub-queries and classifies Low / Moderate / High risk. Every run is INSERTed into the prediction table with patient_id and prediction_date so history can be queried." />
      <Alert tone="warn">Disclaimer: the classification is a teaching example of storing derived results in a relational database. It must not be used for clinical decisions.</Alert>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Run prediction" subtitle="SELECT inputs via sub-queries → INSERT INTO prediction">
            <form onSubmit={predict} className="space-y-3">
              <Field label="Patient"><PatientSelect value={target} onChange={setTarget} required /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={withReco} onChange={(e) => setWithReco(e.target.checked)} className="h-4 w-4 accent-teal-600" /> Also INSERT lifestyle recommendations</label>
              <Button type="submit" disabled={busy || !target}>{busy ? "Computing…" : "Predict & store"}</Button>
            </form>
            {msg && <div className="mt-3"><Alert tone="error">{msg}</Alert></div>}
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <div className="mb-1 font-semibold text-slate-700">Scoring rules (max 100)</div>
              <ul className="list-inside list-disc space-y-0.5">
                <li>Avg fasting glucose 30d: &lt;100 → 0, 100–125 → 20, ≥126 → 35</li>
                <li>Latest HbA1c: &lt;5.7 → 0, 5.7–6.4 → 20, ≥6.5 → 35</li>
                <li>BMI: &lt;25 → 0, 25–29.9 → 10, ≥30 → 15</li>
                <li>Age ≥45 → 5 · Activity &lt;150 min/wk → 3–5 · Hypertension → 5</li>
                <li>Low &lt;30 · Moderate 30–59 · High ≥60</li>
              </ul>
            </div>
          </Card>
          {result && (
            <Card title="Latest result" subtitle={`Stored as prediction_id ${String(result.row.prediction_id)}`}>
              <div className="mb-3 flex items-center gap-3"><RiskBadge level={result.assessment.riskLevel} /><span className="text-2xl font-bold">{result.assessment.riskScore}<span className="text-sm text-slate-500"> / 100</span></span></div>
              <table className="w-full text-xs">
                <tbody>
                  {result.assessment.factors.map((f) => (
                    <tr key={f.factor} className="border-t border-slate-100">
                      <td className="py-1 pr-2 font-medium text-slate-700">{f.factor}</td>
                      <td className="py-1 pr-2">{f.value}</td>
                      <td className="py-1 pr-2 text-slate-500">{f.note}</td>
                      <td className="py-1 text-right font-semibold">+{f.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.recommendations.length > 0 && <p className="mt-2 text-xs text-emerald-700">{result.recommendations.length} recommendation rows inserted → see Recommendations.</p>}
            </Card>
          )}
          <SqlPanel executed={lastSql} />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Patients per risk category" subtitle="Latest prediction per patient: WHERE prediction_id IN (SELECT MAX(prediction_id) … GROUP BY patient_id)">
              {data?.distribution.length ? <Donut data={data.distribution} nameKey="risk_level" valueKey="patient_count" colors={RISK_COLORS} height={220} /> : <p className="text-sm text-slate-500">No predictions yet.</p>}
            </Card>
            <Card title="Filter history" subtitle="WHERE patient_id = ? AND risk_level = ?">
              <div className="space-y-2">
                <PatientSelect value={pid} onChange={setPid} allowAll />
                <Select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">All risk levels</option>{RISK_LEVELS.map((r) => <option key={r}>{r}</option>)}</Select>
                <Button variant="secondary" onClick={() => { setPid(""); setRisk(""); }}>Clear</Button>
              </div>
            </Card>
          </div>
          <Card title="Prediction history" subtitle="prediction INNER JOIN patient ORDER BY prediction_date DESC" actions={<span className="text-xs text-slate-500">{data?.rows.length ?? 0} row(s)</span>}>
            {error && <Alert tone="error">{error}</Alert>}
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows ?? []} rowKey={(r) => String(r.prediction_id)} columns={[
                { key: "prediction_id", label: "ID" },
                { key: "prediction_date", label: "Date", render: (r) => fmtDateTime(r.prediction_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "age", label: "Age" },
                { key: "bmi", label: "BMI", render: (r) => num(r.bmi, 1) },
                { key: "risk_level", label: "Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
                { key: "risk_score", label: "Score" },
                { key: "remarks", label: "Remarks", className: "max-w-sm text-xs" },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="!px-2 !py-1 !text-rose-600" onClick={() => remove(r.prediction_id)}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
