import { useState } from "react";
import PatientSelect from "../components/PatientSelect.jsx";
import { Alert, Button, Card, DataTable, Field, Loading, PageHeader, PatientLink, RISK_LEVELS, RiskBadge, Select, SqlPanel } from "../components/ui.jsx";
import { Donut, RISK_COLORS } from "../components/charts.jsx";
import { api, fmtDateTime, num, useFetch } from "../api.js";

export default function Predictions() {
  const [pid, setPid] = useState("");
  const [risk, setRisk] = useState("");
  const { data, loading, error, refresh } = useFetch(`/api/predictions?patient_id=${pid}&risk=${encodeURIComponent(risk)}`);
  const [target, setTarget] = useState("");
  const [withReco, setWithReco] = useState(true);
  const [result, setResult] = useState(null);
  const [lastSql, setLastSql] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function predict(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api("/api/predictions", { method: "POST", body: JSON.stringify({ patient_id: target, generate_recommendations: withReco }) });
      setResult(r);
      setLastSql(r.executedSql);
      refresh();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!window.confirm("Delete this prediction row?")) return;
    try {
      const r = await api(`/api/predictions/${id}`, { method: "DELETE" });
      setLastSql(r.executedSql);
      refresh();
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Risk Prediction (basic, rule-based)" description="Academic feature – NOT a medical diagnosis. A simple points system reads the patient's stored data (fasting glucose average, latest HbA1c, BMI, age, weekly activity, hypertension history) with SQL sub-queries and classifies Low / Moderate / High risk. Every run is INSERTed into the prediction table with patient_id and prediction_date so history can be queried." />
      <Alert tone="warn">Disclaimer: the classification is a teaching example of storing derived results in a relational database. It must not be used for clinical decisions.</Alert>
      <div className="grid cols-3">
        <div className="stack">
          <Card title="Run prediction" subtitle="SELECT inputs via sub-queries → INSERT INTO prediction">
            <form onSubmit={predict} className="form">
              <Field label="Patient"><PatientSelect value={target} onChange={setTarget} required /></Field>
              <label className="checkbox"><input type="checkbox" checked={withReco} onChange={(e) => setWithReco(e.target.checked)} /> Also INSERT lifestyle recommendations</label>
              <div><Button type="submit" disabled={busy || !target}>{busy ? "Computing…" : "Predict & store"}</Button></div>
            </form>
            {msg && <div className="mt"><Alert tone="error">{msg}</Alert></div>}
            <div className="note mt">
              <b>Scoring rules (max 100)</b>
              <ul>
                <li>Avg fasting glucose 30d: &lt;100 → 0, 100–125 → 20, ≥126 → 35</li>
                <li>Latest HbA1c: &lt;5.7 → 0, 5.7–6.4 → 20, ≥6.5 → 35</li>
                <li>BMI: &lt;25 → 0, 25–29.9 → 10, ≥30 → 15</li>
                <li>Age ≥45 → 5 · Activity &lt;150 min/wk → 3–5 · Hypertension → 5</li>
                <li>Low &lt;30 · Moderate 30–59 · High ≥60</li>
              </ul>
            </div>
          </Card>
          {result && (
            <Card title="Latest result" subtitle={`Stored as prediction_id ${result.row.prediction_id}`}>
              <div className="row auto mb"><RiskBadge level={result.assessment.riskLevel} /><span className="score">{result.assessment.riskScore}<small> / 100</small></span></div>
              <table className="factors">
                <tbody>
                  {result.assessment.factors.map((f) => (
                    <tr key={f.factor}><td><b>{f.factor}</b></td><td>{f.value}</td><td className="muted">{f.note}</td><td>+{f.points}</td></tr>
                  ))}
                </tbody>
              </table>
              {result.recommendations.length > 0 && <p className="xs down mt">{result.recommendations.length} recommendation rows inserted → see Recommendations.</p>}
            </Card>
          )}
          <SqlPanel executed={lastSql} />
        </div>
        <div className="span-2 stack">
          <div className="grid cols-2">
            <Card title="Patients per risk category" subtitle="Latest prediction per patient: WHERE prediction_id IN (SELECT MAX(prediction_id) … GROUP BY patient_id)">
              {data?.distribution.length ? <Donut data={data.distribution} nameKey="risk_level" valueKey="patient_count" colors={RISK_COLORS} height={220} /> : <p className="muted small">No predictions yet.</p>}
            </Card>
            <Card title="Filter history" subtitle="WHERE patient_id = ? AND risk_level = ?">
              <div className="form">
                <PatientSelect value={pid} onChange={setPid} allowAll />
                <Select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">All risk levels</option>{RISK_LEVELS.map((r) => <option key={r}>{r}</option>)}</Select>
                <div><Button variant="secondary" onClick={() => { setPid(""); setRisk(""); }}>Clear</Button></div>
              </div>
            </Card>
          </div>
          <Card title="Prediction history" subtitle="prediction INNER JOIN patient ORDER BY prediction_date DESC" actions={<span className="muted xs">{data?.rows.length ?? 0} row(s)</span>}>
            {error && <Alert tone="error">{error}</Alert>}
            {loading && !data ? <Loading /> : (
              <DataTable rows={data?.rows || []} rowKey={(r) => r.prediction_id} columns={[
                { key: "prediction_id", label: "ID" },
                { key: "prediction_date", label: "Date", render: (r) => fmtDateTime(r.prediction_date) },
                { key: "patient_name", label: "Patient", render: (r) => <PatientLink id={r.patient_id} name={r.patient_name} /> },
                { key: "age", label: "Age" },
                { key: "bmi", label: "BMI", render: (r) => num(r.bmi, 1) },
                { key: "risk_level", label: "Risk", render: (r) => <RiskBadge level={r.risk_level} /> },
                { key: "risk_score", label: "Score" },
                { key: "remarks", label: "Remarks", className: "xs wrap" },
                { key: "a", label: "", render: (r) => <Button variant="ghost" className="red" onClick={() => remove(r.prediction_id)}>Delete</Button> },
              ]} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
