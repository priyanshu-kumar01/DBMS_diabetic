"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, DataTable, PageHeader } from "@/components/ui";
import { api, useFetch } from "@/lib/client";

type Row = Record<string, unknown>;

const MODULES = [
  { href: "/patients", title: "Patient management", desc: "Add / view / update / delete / search patients, complete history", table: "patient" },
  { href: "/medical-records", title: "Medical records", desc: "Add, update, filter by date", table: "medical_record" },
  { href: "/glucose", title: "Blood sugar", desc: "Readings, AVG/MAX/MIN, trends", table: "blood_sugar_record" },
  { href: "/lab-reports", title: "Lab reports", desc: "HbA1c, blood pressure, comparison", table: "lab_report" },
  { href: "/meals", title: "Meals", desc: "Catalog CRUD, search, filter, patient meal records", table: "meal / meal_record" },
  { href: "/activities", title: "Activities", desc: "Catalog CRUD, steps, duration, weekly stats", table: "activity / activity_record" },
  { href: "/predictions", title: "Predictions", desc: "Rule-based risk classification stored per patient", table: "prediction" },
  { href: "/recommendations", title: "Recommendations", desc: "Meal / activity / general lifestyle advice", table: "recommendation" },
  { href: "/reports", title: "SQL reports", desc: "12 demonstration queries + read-only console", table: "all" },
  { href: "/schema", title: "ER diagram & schema", desc: "Diagram, relational schema, DDL, data dictionary", table: "catalog" },
];

const ENDPOINTS = [
  ["GET/POST", "/api/patients", "list+search / insert"], ["GET/PUT/DELETE", "/api/patients/:id", "read / update / delete (cascade)"], ["GET", "/api/patients/:id/history", "complete history (all child tables)"],
  ["GET/POST", "/api/medical-records", "filter by patient & date / insert"], ["PUT/DELETE", "/api/medical-records/:id", "update / delete"],
  ["GET/POST", "/api/glucose", "readings + stats + trend / insert"], ["DELETE", "/api/glucose/:id", "delete reading"],
  ["GET/POST", "/api/lab-reports", "reports with LAG comparison / insert"], ["DELETE", "/api/lab-reports/:id", "delete report"],
  ["GET/POST", "/api/meals", "search + filter / insert"], ["PUT/DELETE", "/api/meals/:id", "update / delete (restrict)"], ["GET/POST", "/api/meal-records", "joined records / insert"], ["DELETE", "/api/meal-records/:id", "delete"],
  ["GET/POST", "/api/activities", "catalog + usage / insert"], ["PUT/DELETE", "/api/activities/:id", "update / delete (restrict)"], ["GET/POST", "/api/activity-records", "records + weekly stats / insert"], ["DELETE", "/api/activity-records/:id", "delete"],
  ["GET/POST", "/api/predictions", "history + distribution / compute & insert"], ["DELETE", "/api/predictions/:id", "delete"],
  ["GET/POST", "/api/recommendations", "list / insert"], ["DELETE", "/api/recommendations/:id", "delete"],
  ["GET", "/api/reports, /api/reports/:key", "report catalogue / execute report"], ["POST", "/api/sql", "read-only SELECT console"],
  ["GET", "/api/dashboard", "KPI aggregates"], ["GET", "/api/schema", "data dictionary + scripts"], ["POST", "/api/seed", "reload sample data"],
];

export default function AdminPage() {
  const { data, refresh } = useFetch<{ tableCounts: Row[] }>("/api/dashboard");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function reseed() {
    if (!confirm("This will TRUNCATE all ten tables and reload the sample dataset inside one transaction. Continue?")) return;
    setBusy(true);
    try {
      const r = await api<{ summary: Record<string, number> }>("/api/seed", { method: "POST" });
      setMsg({ tone: "success", text: "Sample data reloaded: " + Object.entries(r.summary).map(([k, v]) => `${k}=${v}`).join(", ") });
      refresh();
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin" description="Central entry point for all management modules, database maintenance and the API surface of the backend." actions={<Button onClick={reseed} disabled={busy} variant="danger">{busy ? "Reloading…" : "Reset & reload sample data"}</Button>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-400 hover:shadow">
            <div className="text-sm font-semibold text-slate-900">{m.title}</div>
            <div className="mt-1 text-xs text-slate-600">{m.desc}</div>
            <code className="mt-2 block text-[11px] text-teal-700">{m.table}</code>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Row counts" subtitle="SELECT COUNT(*) per table (UNION ALL)">
          <DataTable rows={data?.tableCounts ?? []} rowKey={(r) => String(r.table_name)} columns={[{ key: "table_name", label: "Table", className: "font-mono text-xs" }, { key: "rows", label: "Rows" }]} />
        </Card>
        <Card title="Backend API endpoints" subtitle="REST routes implemented in the backend (all SQL runs server-side)" className="lg:col-span-2">
          <DataTable rows={ENDPOINTS.map(([m, p, d]) => ({ method: m, path: p, desc: d }))} columns={[
            { key: "method", label: "Method", className: "font-mono text-xs" },
            { key: "path", label: "Path", className: "font-mono text-xs" },
            { key: "desc", label: "Purpose" },
          ]} />
        </Card>
      </div>
      <Card title="Database maintenance notes">
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Schema is defined once (src/db/schema.ts) and pushed with <code>drizzle-kit push</code>; the MySQL equivalent is in <code>database/mysql_schema.sql</code>.</li>
          <li>Sample data is loaded by <code>src/lib/seed.ts</code> inside a single transaction (TRUNCATE … RESTART IDENTITY CASCADE followed by INSERTs) – atomicity demonstration.</li>
          <li>Deleting a patient cascades to 7 child tables; deleting a meal or activity that is referenced fails with a FOREIGN KEY error (ON DELETE RESTRICT).</li>
          <li>CHECK, UNIQUE and NOT NULL violations are reported back to the UI with the violated constraint name.</li>
        </ul>
      </Card>
    </div>
  );
}
