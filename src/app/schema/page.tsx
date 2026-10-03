"use client";

import { useState } from "react";
import ERDiagram from "@/components/ERDiagram";
import { Alert, Badge, Card, DataTable, Loading, PageHeader, SqlBlock } from "@/components/ui";
import { useFetch } from "@/lib/client";

type Row = Record<string, unknown>;
interface SchemaResp { columns: Row[]; constraints: Row[]; indexes: Row[]; foreignKeys: Row[]; mysqlDdl: string; sampleData: string; queries: string }

const TABLES = ["patient", "medical_record", "blood_sugar_record", "lab_report", "meal", "meal_record", "activity", "activity_record", "prediction", "recommendation"];

export default function SchemaPage() {
  const { data, loading, error } = useFetch<SchemaResp>("/api/schema");
  const [tab, setTab] = useState<"dictionary" | "ddl" | "sample" | "queries">("dictionary");
  const [table, setTable] = useState("patient");

  return (
    <div className="space-y-6">
      <PageHeader title="ER Diagram & Relational Schema" description="Ten relations in 3NF. PATIENT is the central strong entity with seven 1:N relationships; MEAL and ACTIVITY are master tables connected to patients through the associative tables meal_record and activity_record (resolved M:N)." />

      <Card title="Entity–Relationship diagram" subtitle="Crow's-foot notation · every FK is enforced by the database with ON DELETE CASCADE (patient children) or ON DELETE RESTRICT (master tables)">
        <ERDiagram />
      </Card>

      <Card title="Relational schema" subtitle="Primary key underlined (bold) · foreign keys italic">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          {[
            ["patient", "<b><u>patient_id</u></b>, name, age, gender, phone, email, height, weight, bmi, created_at"],
            ["medical_record", "<b><u>record_id</u></b>, <i>patient_id</i>, medical_history, existing_conditions, medications, record_date"],
            ["blood_sugar_record", "<b><u>sugar_record_id</u></b>, <i>patient_id</i>, glucose_level, measurement_type, record_date"],
            ["lab_report", "<b><u>lab_id</u></b>, <i>patient_id</i>, hba1c, bp_systolic, bp_diastolic, report_date"],
            ["meal", "<b><u>meal_id</u></b>, meal_name, meal_type, calories, carbohydrates, description"],
            ["meal_record", "<b><u>meal_record_id</u></b>, <i>patient_id</i>, <i>meal_id</i>, meal_date, status"],
            ["activity", "<b><u>activity_id</u></b>, activity_name, activity_type, recommended_duration, description"],
            ["activity_record", "<b><u>activity_record_id</u></b>, <i>patient_id</i>, <i>activity_id</i>, duration, steps, activity_date"],
            ["prediction", "<b><u>prediction_id</u></b>, <i>patient_id</i>, risk_level, risk_score, remarks, prediction_date"],
            ["recommendation", "<b><u>recommendation_id</u></b>, <i>patient_id</i>, recommendation_type, recommendation_text, recommendation_date"],
          ].map(([t, a]) => (
            <div key={t} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs"><span className="font-bold text-teal-800">{t}</span> ( <span dangerouslySetInnerHTML={{ __html: a }} /> )</div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 text-xs text-slate-600 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 p-3"><b>1NF</b> – atomic values only (blood pressure split into systolic/diastolic; one reading per row).</div>
          <div className="rounded-md border border-slate-200 p-3"><b>2NF</b> – single-attribute surrogate keys, so no partial dependencies.</div>
          <div className="rounded-md border border-slate-200 p-3"><b>3NF</b> – meal/activity facts live only in their master tables; association tables store only the FK and event facts. BMI is a deliberately retained derived attribute.</div>
        </div>
      </Card>

      <Card title="Database catalogue & scripts" subtitle="The data dictionary is read live from information_schema / pg_catalog of the connected database">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["dictionary", "ddl", "sample", "queries"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              {{ dictionary: "Live data dictionary", ddl: "MySQL CREATE TABLE script", sample: "Sample INSERT script", queries: "SQL query file" }[t]}
            </button>
          ))}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {loading && !data ? <Loading label="Reading information_schema…" /> : data && (
          <>
            {tab === "dictionary" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1">{TABLES.map((t) => <button key={t} onClick={() => setTable(t)} className={`rounded px-2 py-1 font-mono text-xs ${table === t ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>{t}</button>)}</div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Columns – information_schema.columns</div>
                    <DataTable rows={data.columns.filter((c) => c.table_name === table)} rowKey={(r) => String(r.column_name)} columns={[
                      { key: "column_name", label: "Column", render: (r) => <code className="text-xs">{String(r.column_name)}</code> },
                      { key: "data_type", label: "Type", render: (r) => `${r.data_type}${r.character_maximum_length ? `(${r.character_maximum_length})` : r.numeric_precision && r.data_type === "numeric" ? `(${r.numeric_precision},${r.numeric_scale})` : ""}` },
                      { key: "is_nullable", label: "Nullable", render: (r) => <Badge tone={r.is_nullable === "NO" ? "bad" : "neutral"}>{r.is_nullable === "NO" ? "NOT NULL" : "NULL"}</Badge> },
                      { key: "column_default", label: "Default", className: "text-xs" },
                    ]} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Constraints – pg_constraint</div>
                      <DataTable rows={data.constraints.filter((c) => c.table_name === table)} rowKey={(r) => String(r.constraint_name)} columns={[
                        { key: "constraint_type", label: "Type", render: (r) => <Badge tone={r.constraint_type === "PRIMARY KEY" ? "bad" : r.constraint_type === "FOREIGN KEY" ? "info" : r.constraint_type === "UNIQUE" ? "warn" : "ok"}>{String(r.constraint_type)}</Badge> },
                        { key: "constraint_name", label: "Name", className: "font-mono text-xs" },
                        { key: "definition", label: "Definition", className: "font-mono text-xs" },
                      ]} />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Indexes – pg_indexes</div>
                      <DataTable rows={data.indexes.filter((c) => c.table_name === table)} rowKey={(r) => String(r.index_name)} columns={[
                        { key: "index_name", label: "Index", className: "font-mono text-xs" },
                        { key: "definition", label: "Definition", className: "font-mono text-xs" },
                      ]} />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase text-slate-500">All foreign-key relationships – information_schema.referential_constraints</div>
                  <DataTable rows={data.foreignKeys} rowKey={(r) => `${r.child_table}.${r.child_column}`} columns={[
                    { key: "child_table", label: "Child table" },
                    { key: "child_column", label: "Column" },
                    { key: "parent_table", label: "→ Parent table" },
                    { key: "parent_column", label: "Column" },
                    { key: "delete_rule", label: "ON DELETE", render: (r) => <Badge tone={r.delete_rule === "CASCADE" ? "warn" : "info"}>{String(r.delete_rule)}</Badge> },
                    { key: "update_rule", label: "ON UPDATE" },
                  ]} />
                </div>
              </div>
            )}
            {tab === "ddl" && <SqlBlock title="database/mysql_schema.sql" sql={data.mysqlDdl} />}
            {tab === "sample" && <SqlBlock title="database/sample_data.sql" sql={data.sampleData} />}
            {tab === "queries" && <SqlBlock title="database/queries.sql" sql={data.queries} />}
          </>
        )}
      </Card>
    </div>
  );
}
