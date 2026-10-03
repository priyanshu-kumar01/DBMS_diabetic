"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Loading, PageHeader, SqlBlock } from "@/components/ui";
import { api, useFetch } from "@/lib/client";

interface SourceFile { path: string; size: number }

const GROUPS: { root: string; title: string; tone: "ok" | "info" | "warn" | "neutral"; blurb: string }[] = [
  { root: "database", title: "MySQL – data & schema (SQL)", tone: "warn", blurb: "CREATE TABLE script with PK/FK/UNIQUE/CHECK/INDEX, sample INSERT data (1,236 rows, relative dates), query file, ER diagram." },
  { root: "python_backend", title: "Backend – Python FastAPI", tone: "info", blurb: "Raw-SQL REST API over MySQL (mysql-connector): CRUD, joins, aggregates, sub-queries, reports, read-only SQL console, data dictionary." },
  { root: "react_frontend", title: "Frontend – React (JavaScript, Vite)", tone: "ok", blurb: "13 pages: dashboard, all 8 modules, SQL reports, ER diagram, admin. Plain CSS + Recharts." },
  { root: "README.md", title: "README", tone: "neutral", blurb: "Setup and run instructions." },
];

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export default function SourcePage() {
  const { data, loading, error } = useFetch<{ files: SourceFile[] }>("/api/source");
  const [selected, setSelected] = useState<string>("README.md");
  const [content, setContent] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    api<{ content: string }>(`/api/source?file=${encodeURIComponent(selected)}`)
      .then((r) => alive && setContent(r.content))
      .catch((e: Error) => alive && setContent(`// ${e.message}`))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [selected]);

  const grouped = useMemo(() => {
    const files = data?.files ?? [];
    return GROUPS.map((g) => ({ ...g, files: files.filter((f) => f.path === g.root || f.path.startsWith(`${g.root}/`)) }));
  }, [data]);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Source – React · FastAPI · MySQL"
        description="The same DBMS project delivered in the requested stack: a standalone React (JavaScript) front-end, a Python FastAPI backend executing raw SQL, and all data as MySQL scripts. Browse the files below or download everything as a zip."
        actions={
          <a href="/api/source/download" className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700">
            ⬇ Download zip (React + FastAPI + SQL)
          </a>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="1 · MySQL" subtitle="database/">
          <pre className="whitespace-pre-wrap text-xs text-slate-700">{`mysql -u root -p < database/mysql_schema.sql
mysql -u root -p diabetes_dbms < database/sample_data.sql`}</pre>
        </Card>
        <Card title="2 · FastAPI backend" subtitle="python_backend/  →  http://localhost:8000/docs">
          <pre className="whitespace-pre-wrap text-xs text-slate-700">{`cd python_backend
pip install -r requirements.txt
cp .env.example .env   # set MYSQL_PASSWORD
uvicorn main:app --reload --port 8000`}</pre>
        </Card>
        <Card title="3 · React front-end" subtitle="react_frontend/  →  http://localhost:5173">
          <pre className="whitespace-pre-wrap text-xs text-slate-700">{`cd react_frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev`}</pre>
        </Card>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card title="Files" subtitle={`${data?.files.length ?? 0} files`} className="lg:col-span-1">
          {loading && !data ? (
            <Loading label="Listing files…" />
          ) : (
            <div className="space-y-4">
              {grouped.map((g) => (
                <div key={g.root}>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={g.tone}>{g.title}</Badge>
                  </div>
                  <p className="mb-1 text-[11px] text-slate-500">{g.blurb}</p>
                  <ul className="space-y-0.5">
                    {g.files.map((f) => (
                      <li key={f.path}>
                        <button
                          onClick={() => setSelected(f.path)}
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left font-mono text-[11px] ${selected === f.path ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
                          title={f.path}
                        >
                          <span className="truncate">{f.path.replace(`${g.root}/`, "")}</span>
                          <span className={selected === f.path ? "text-slate-300" : "text-slate-400"}>{fmtSize(f.size)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="lg:col-span-3">
          <Card
            title={selected}
            subtitle={busy ? "Loading…" : `${content.split("\n").length} lines`}
            actions={
              <Button variant="secondary" onClick={copy} disabled={busy}>
                {copied ? "Copied ✓" : "Copy to clipboard"}
              </Button>
            }
          >
            <div className="max-h-[75vh] overflow-auto">
              <SqlBlock sql={content} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
