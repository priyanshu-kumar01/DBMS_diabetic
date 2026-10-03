import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, DataTable, Loading, PageHeader, SqlBlock, Textarea } from "../components/ui.jsx";
import { api, useFetch } from "../api.js";

const CONCEPTS = ["SELECT", "INSERT", "UPDATE", "DELETE", "INNER JOIN", "LEFT JOIN", "GROUP BY", "HAVING", "ORDER BY", "COUNT()", "AVG()", "SUM()", "MAX()", "MIN()", "Subqueries"];
const EXAMPLES = [
  { label: "Female patients over 40", sql: "SELECT patient_id, name, age, bmi FROM patient\nWHERE gender = 'Female' AND age > 40\nORDER BY age DESC;" },
  { label: "HAVING – patients with > 40 readings", sql: "SELECT p.name, COUNT(*) AS readings\nFROM patient p INNER JOIN blood_sugar_record b ON b.patient_id = p.patient_id\nGROUP BY p.patient_id, p.name\nHAVING COUNT(*) > 40\nORDER BY readings DESC;" },
  { label: "Subquery – patients never predicted High Risk", sql: "SELECT patient_id, name FROM patient\nWHERE patient_id NOT IN (SELECT patient_id FROM prediction WHERE risk_level = 'High Risk')\nORDER BY patient_id;" },
  { label: "Carbs per patient (SUM, JOIN)", sql: "SELECT p.name, SUM(m.carbohydrates) AS total_carbs_g, SUM(m.calories) AS total_kcal\nFROM meal_record mr\nINNER JOIN patient p ON p.patient_id = mr.patient_id\nINNER JOIN meal m ON m.meal_id = mr.meal_id\nWHERE mr.status = 'Consumed'\nGROUP BY p.patient_id, p.name\nORDER BY total_carbs_g DESC;" },
];

export default function Reports() {
  const { data: catalog, error: catErr } = useFetch("/api/reports");
  const [selected, setSelected] = useState("high-glucose");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState(EXAMPLES[0].sql);
  const [cres, setCres] = useState(null);
  const [cerr, setCerr] = useState(null);
  const [cbusy, setCbusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setRunning(true);
    setErr(null);
    api(`/api/reports/${selected}`)
      .then((r) => alive && setResult(r))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setRunning(false));
    return () => { alive = false; };
  }, [selected]);

  async function runConsole() {
    setCbusy(true);
    setCerr(null);
    try {
      setCres(await api("/api/sql", { method: "POST", body: JSON.stringify({ query }) }));
    } catch (e) {
      setCerr(e.message);
      setCres(null);
    } finally {
      setCbusy(false);
    }
  }

  const reports = catalog?.reports || [];
  const covered = new Set(reports.flatMap((r) => r.concepts).concat(["INSERT", "UPDATE", "DELETE", "SELECT"]));
  const has = (c) => covered.has(c) || (c === "Subqueries" && [...covered].some((x) => x.toLowerCase().includes("subquer")));

  return (
    <div className="stack">
      <PageHeader title="SQL Reports – DBMS Query Demonstration" description="Each report below is a hand-written SQL statement executed exactly as shown against MySQL. Results are fetched live; nothing is pre-computed in application code." />
      {catErr && <Alert tone="error">{catErr}</Alert>}
      <Card title="Concept coverage" subtitle="Operations required by the project brief and where they are demonstrated">
        <div className="chips">{CONCEPTS.map((c) => <Badge key={c} tone={has(c) ? "ok" : "neutral"}>{has(c) ? "✓ " : ""}{c}</Badge>)}</div>
        <p className="muted xs mt">INSERT / UPDATE / DELETE are executed by the module pages (each shows the exact statement in the "Last executed SQL" panel) and are listed in the DML section below.</p>
      </Card>
      <div className="grid cols-4">
        <Card title="Reports">
          <ul className="menu">
            {reports.map((r) => (
              <li key={r.key}>
                <button className={selected === r.key ? "active" : ""} onClick={() => setSelected(r.key)}>
                  <div>{r.title}</div>
                  <div className="concepts">{r.concepts.join(" · ")}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="span-3 stack">
          {result && (
            <>
              <Card title={result.report.title} subtitle={result.report.description} actions={<span className="muted xs">{running ? "Running…" : `${result.rowCount} row(s) · ${result.ms} ms`}</span>}>
                <div className="chips mb">{result.report.concepts.map((c) => <Badge key={c} tone="info">{c}</Badge>)}</div>
                <SqlBlock sql={result.report.sql} title="SQL statement" />
              </Card>
              <Card title="Result set" subtitle={`${result.columns.length} columns · ${result.rowCount} rows`}>
                {err && <Alert tone="error">{err}</Alert>}
                {running ? <Loading label="Executing query…" /> : <DataTable rows={result.rows} columns={result.columns.map((c) => ({ key: c, label: c }))} />}
              </Card>
            </>
          )}
          {!result && !err && <Loading label="Executing query…" />}
          {!result && err && <Alert tone="error">{err}</Alert>}
        </div>
      </div>
      <Card title="Read-only SQL console" subtitle="Write your own SELECT query. Runs inside START TRANSACTION READ ONLY with MAX_EXECUTION_TIME = 5 s – INSERT/UPDATE/DELETE are rejected.">
        <div className="grid cols-3">
          <div className="span-2">
            <Textarea rows={7} value={query} onChange={(e) => setQuery(e.target.value)} className="mono" spellCheck={false} />
            <div className="row auto mt">
              <Button onClick={runConsole} disabled={cbusy}>{cbusy ? "Running…" : "Run query"}</Button>
              {cres && <span className="muted xs">{cres.rowCount} row(s) · {cres.ms} ms</span>}
            </div>
          </div>
          <div>
            <div className="muted xs mb"><b>EXAMPLES</b></div>
            <div className="chips">{EXAMPLES.map((e) => <button key={e.label} className="chip" onClick={() => setQuery(e.sql)}>{e.label}</button>)}</div>
            <div className="muted xs mt">Tables: patient, medical_record, blood_sugar_record, lab_report, meal, meal_record, activity, activity_record, prediction, recommendation</div>
          </div>
        </div>
        <div className="mt">
          {cerr && <Alert tone="error">{cerr}</Alert>}
          {cres && <DataTable rows={cres.rows} columns={cres.columns.map((c) => ({ key: c, label: c }))} />}
        </div>
      </Card>
      <Card title="DML statements used by the application" subtitle="INSERT / UPDATE / DELETE with referential-integrity behaviour">
        <div className="grid cols-2">{(catalog?.dml || []).map((d) => <SqlBlock key={d.title} title={d.title} sql={d.sql} />)}</div>
      </Card>
    </div>
  );
}
