"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, DataTable, Loading, PageHeader, SqlBlock, Textarea } from "@/components/ui";
import { api, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
interface ReportDef { key: string; title: string; description: string; concepts: string[]; sql: string }
interface RunResult { report: ReportDef; columns: string[]; rows: Row[]; rowCount: number; ms: number }
interface ConsoleResult { columns: string[]; rows: Row[]; rowCount: number; ms: number }

const CONCEPTS = ["SELECT", "INSERT", "UPDATE", "DELETE", "INNER JOIN", "LEFT JOIN", "GROUP BY", "HAVING", "ORDER BY", "COUNT()", "AVG()", "SUM()", "MAX()", "MIN()", "Subqueries"];

const CONSOLE_EXAMPLES = [
  { label: "Female patients over 40", sql: "SELECT patient_id, name, age, bmi FROM patient\nWHERE gender = 'Female' AND age > 40\nORDER BY age DESC;" },
  { label: "HAVING – patients with > 40 readings", sql: "SELECT p.name, COUNT(*) AS readings\nFROM patient p INNER JOIN blood_sugar_record b ON b.patient_id = p.patient_id\nGROUP BY p.patient_id, p.name\nHAVING COUNT(*) > 40\nORDER BY readings DESC;" },
  { label: "Subquery – patients never predicted High Risk", sql: "SELECT patient_id, name FROM patient\nWHERE patient_id NOT IN (SELECT patient_id FROM prediction WHERE risk_level = 'High Risk')\nORDER BY patient_id;" },
  { label: "Carbs per patient (SUM, JOIN)", sql: "SELECT p.name, SUM(m.carbohydrates) AS total_carbs_g, SUM(m.calories) AS total_kcal\nFROM meal_record mr\nINNER JOIN patient p ON p.patient_id = mr.patient_id\nINNER JOIN meal m ON m.meal_id = mr.meal_id\nWHERE mr.status = 'Consumed'\nGROUP BY p.patient_id, p.name\nORDER BY total_carbs_g DESC;" },
];

export default function ReportsPage() {
  const { data: catalog, error: catErr } = useFetch<{ reports: ReportDef[]; dml: { title: string; sql: string }[] }>("/api/reports");
  const [selected, setSelected] = useState<string>("high-glucose");
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState(CONSOLE_EXAMPLES[0].sql);
  const [cres, setCres] = useState<ConsoleResult | null>(null);
  const [cerr, setCerr] = useState<string | null>(null);
  const [cbusy, setCbusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setRunning(true);
    setErr(null);
    api<RunResult>(`/api/reports/${selected}`)
      .then((r) => alive && setResult(r))
      .catch((e: Error) => alive && setErr(e.message))
      .finally(() => alive && setRunning(false));
    return () => {
      alive = false;
    };
  }, [selected]);

  async function runConsole() {
    setCbusy(true);
    setCerr(null);
    try {
      setCres(await api<ConsoleResult>("/api/sql", { method: "POST", body: JSON.stringify({ query }) }));
    } catch (e) {
      setCerr((e as Error).message);
      setCres(null);
    } finally {
      setCbusy(false);
    }
  }

  const reports = catalog?.reports ?? [];
  const covered = new Set(reports.flatMap((r) => r.concepts).concat(["INSERT", "UPDATE", "DELETE", "SELECT"]));

  return (
    <div className="space-y-6">
      <PageHeader title="SQL Reports – DBMS Query Demonstration" description="Each report below is a hand-written SQL statement executed exactly as shown. Results are fetched live from the database; nothing is pre-computed in application code." />
      {catErr && <Alert tone="error">{catErr}</Alert>}

      <Card title="Concept coverage" subtitle="Operations required by the project brief and where they are demonstrated">
        <div className="flex flex-wrap gap-2">
          {CONCEPTS.map((c) => {
            const has = covered.has(c) || (c === "Subqueries" && [...covered].some((x) => x.toLowerCase().includes("subquer")));
            return <Badge key={c} tone={has ? "ok" : "neutral"}>{has ? "✓ " : ""}{c}</Badge>;
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">INSERT / UPDATE / DELETE are executed by the module pages (each shows the exact statement in the &quot;Last executed SQL&quot; panel) and are listed in the DML section below.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card title="Reports" className="lg:col-span-1">
          <ul className="space-y-1">
            {reports.map((r) => (
              <li key={r.key}>
                <button onClick={() => setSelected(r.key)} className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${selected === r.key ? "bg-teal-600 text-white" : "hover:bg-slate-100"}`}>
                  <div className="font-medium">{r.title}</div>
                  <div className={`mt-0.5 text-[11px] ${selected === r.key ? "text-teal-100" : "text-slate-500"}`}>{r.concepts.join(" · ")}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {result && (
            <>
              <Card title={result.report.title} subtitle={result.report.description} actions={<Button variant="secondary" onClick={() => setSelected((s) => s)} disabled={running}>{running ? "Running…" : `${result.rowCount} row(s) · ${result.ms} ms`}</Button>}>
                <div className="mb-3 flex flex-wrap gap-1">{result.report.concepts.map((c) => <Badge key={c} tone="info">{c}</Badge>)}</div>
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

      <Card title="Read-only SQL console" subtitle="Write your own SELECT query. Runs inside a READ ONLY transaction with a 5 s timeout – INSERT/UPDATE/DELETE are rejected.">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Textarea rows={7} value={query} onChange={(e) => setQuery(e.target.value)} className="font-mono !text-xs" spellCheck={false} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button onClick={runConsole} disabled={cbusy}>{cbusy ? "Running…" : "Run query"}</Button>
              {cres && <span className="text-xs text-slate-500">{cres.rowCount} row(s) · {cres.ms} ms</span>}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Examples</div>
            <ul className="space-y-1">
              {CONSOLE_EXAMPLES.map((e) => (
                <li key={e.label}><button onClick={() => setQuery(e.sql)} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs hover:bg-teal-50">{e.label}</button></li>
              ))}
            </ul>
            <div className="mt-3 text-[11px] text-slate-500">Tables: patient, medical_record, blood_sugar_record, lab_report, meal, meal_record, activity, activity_record, prediction, recommendation</div>
          </div>
        </div>
        <div className="mt-4">
          {cerr && <Alert tone="error">{cerr}</Alert>}
          {cres && <DataTable rows={cres.rows} columns={cres.columns.map((c) => ({ key: c, label: c }))} />}
        </div>
      </Card>

      <Card title="DML statements used by the application" subtitle="INSERT / UPDATE / DELETE with referential-integrity behaviour">
        <div className="grid gap-4 md:grid-cols-2">
          {(catalog?.dml ?? []).map((d) => (
            <SqlBlock key={d.title} title={d.title} sql={d.sql} />
          ))}
        </div>
      </Card>
    </div>
  );
}
