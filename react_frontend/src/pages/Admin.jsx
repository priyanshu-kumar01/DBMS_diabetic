import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, DataTable, PageHeader } from "../components/ui.jsx";
import { API_URL, api, useFetch } from "../api.js";

const MODULES = [
  { to: "/patients", title: "Patient management", desc: "Add / view / update / delete / search patients, complete history", table: "patient" },
  { to: "/medical-records", title: "Medical records", desc: "Add, update, filter by date", table: "medical_record" },
  { to: "/glucose", title: "Blood sugar", desc: "Readings, AVG/MAX/MIN, trends", table: "blood_sugar_record" },
  { to: "/lab-reports", title: "Lab reports", desc: "HbA1c, blood pressure, comparison", table: "lab_report" },
  { to: "/meals", title: "Meals", desc: "Catalogue CRUD, search, filter, patient meal records", table: "meal / meal_record" },
  { to: "/activities", title: "Activities", desc: "Catalogue CRUD, steps, duration, weekly stats", table: "activity / activity_record" },
  { to: "/predictions", title: "Predictions", desc: "Rule-based risk classification stored per patient", table: "prediction" },
  { to: "/recommendations", title: "Recommendations", desc: "Meal / activity / general lifestyle advice", table: "recommendation" },
  { to: "/reports", title: "SQL reports", desc: "12 demonstration queries + read-only console", table: "all" },
  { to: "/schema", title: "ER diagram & schema", desc: "Diagram, relational schema, DDL, data dictionary", table: "information_schema" },
];
const ENDPOINTS = [
  ["GET/POST", "/api/patients", "list+search / insert"], ["GET/PUT/DELETE", "/api/patients/{id}", "read / update / delete (cascade)"], ["GET", "/api/patients/{id}/history", "complete history (all child tables)"],
  ["GET/POST", "/api/medical-records", "filter by patient & date / insert"], ["PUT/DELETE", "/api/medical-records/{id}", "update / delete"],
  ["GET/POST", "/api/glucose", "readings + stats + trend / insert"], ["DELETE", "/api/glucose/{id}", "delete reading"],
  ["GET/POST", "/api/lab-reports", "reports with LAG comparison / insert"], ["DELETE", "/api/lab-reports/{id}", "delete report"],
  ["GET/POST", "/api/meals", "search + filter / insert"], ["PUT/DELETE", "/api/meals/{id}", "update / delete (restrict)"], ["GET/POST", "/api/meal-records", "joined records / insert"], ["DELETE", "/api/meal-records/{id}", "delete"],
  ["GET/POST", "/api/activities", "catalogue + usage / insert"], ["PUT/DELETE", "/api/activities/{id}", "update / delete (restrict)"], ["GET/POST", "/api/activity-records", "records + weekly stats / insert"], ["DELETE", "/api/activity-records/{id}", "delete"],
  ["GET/POST", "/api/predictions", "history + distribution / compute & insert"], ["DELETE", "/api/predictions/{id}", "delete"],
  ["GET/POST", "/api/recommendations", "list / insert"], ["DELETE", "/api/recommendations/{id}", "delete"],
  ["GET", "/api/reports, /api/reports/{key}", "report catalogue / execute report"], ["POST", "/api/sql", "read-only SELECT console"],
  ["GET", "/api/dashboard", "KPI aggregates"], ["GET", "/api/schema", "data dictionary + scripts"], ["POST", "/api/seed", "reload sample data"], ["GET", "/api/health", "health check"],
];

export default function Admin() {
  const { data, refresh } = useFetch("/api/dashboard");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function reseed() {
    if (!window.confirm("This will TRUNCATE all ten tables and reload database/sample_data.sql. Continue?")) return;
    setBusy(true);
    try {
      const r = await api("/api/seed", { method: "POST" });
      setMsg({ tone: "success", text: `Sample data reloaded (${r.statements} statements): ` + r.summary.map((s) => `${s.table_name}=${s.total_rows}`).join(", ") });
      refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Admin" description={`Central entry point for all management modules, database maintenance and the API surface of the FastAPI backend (${API_URL}).`} actions={<><a className="btn secondary" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">Swagger API docs ↗</a><Button variant="danger" onClick={reseed} disabled={busy}>{busy ? "Reloading…" : "Reset & reload sample data"}</Button></>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="tiles">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className="tile"><b>{m.title}</b><span>{m.desc}</span><code>{m.table}</code></Link>
        ))}
      </div>
      <div className="grid cols-3">
        <Card title="Row counts" subtitle="SELECT COUNT(*) per table (UNION ALL)">
          <DataTable rows={data?.tableCounts || []} rowKey={(r) => r.table_name} columns={[{ key: "table_name", label: "Table", className: "mono" }, { key: "total_rows", label: "Rows" }]} />
        </Card>
        <Card className="span-2" title="Backend API endpoints (FastAPI)" subtitle="REST routes – all SQL runs server-side in Python">
          <DataTable rows={ENDPOINTS.map(([method, path, desc]) => ({ method, path, desc }))} columns={[
            { key: "method", label: "Method", className: "mono" },
            { key: "path", label: "Path", className: "mono" },
            { key: "desc", label: "Purpose" },
          ]} />
        </Card>
      </div>
      <Card title="Database maintenance notes">
        <ul>
          <li>Schema: <code>database/mysql_schema.sql</code> (CREATE TABLE with PK, FK, UNIQUE, CHECK, INDEX, BMI trigger, view).</li>
          <li>Sample data: <code>database/sample_data.sql</code> – TRUNCATE + INSERT; dates relative to CURDATE() so time-based reports always work.</li>
          <li>Deleting a patient cascades to 7 child tables; deleting a meal or activity that is referenced fails with MySQL error 1451 (ON DELETE RESTRICT).</li>
          <li>CHECK (3819), UNIQUE (1062) and NOT NULL (1048) violations are reported back to the UI with the violated constraint name.</li>
        </ul>
      </Card>
    </div>
  );
}
