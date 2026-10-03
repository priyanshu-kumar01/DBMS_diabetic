import { useState } from "react";
import ERDiagram from "../components/ERDiagram.jsx";
import { Alert, Badge, Card, DataTable, Loading, PageHeader, SqlBlock } from "../components/ui.jsx";
import { useFetch } from "../api.js";

const TABLES = ["patient", "medical_record", "blood_sugar_record", "lab_report", "meal", "meal_record", "activity", "activity_record", "prediction", "recommendation"];
const RELATIONS = [
  ["patient", ["patient_id*", "name", "age", "gender", "phone", "email", "height", "weight", "bmi", "created_at"]],
  ["medical_record", ["record_id*", "patient_id^", "medical_history", "existing_conditions", "medications", "record_date"]],
  ["blood_sugar_record", ["sugar_record_id*", "patient_id^", "glucose_level", "measurement_type", "record_date"]],
  ["lab_report", ["lab_id*", "patient_id^", "hba1c", "bp_systolic", "bp_diastolic", "report_date"]],
  ["meal", ["meal_id*", "meal_name", "meal_type", "calories", "carbohydrates", "description"]],
  ["meal_record", ["meal_record_id*", "patient_id^", "meal_id^", "meal_date", "status"]],
  ["activity", ["activity_id*", "activity_name", "activity_type", "recommended_duration", "description"]],
  ["activity_record", ["activity_record_id*", "patient_id^", "activity_id^", "duration", "steps", "activity_date"]],
  ["prediction", ["prediction_id*", "patient_id^", "risk_level", "risk_score", "remarks", "prediction_date"]],
  ["recommendation", ["recommendation_id*", "patient_id^", "recommendation_type", "recommendation_text", "recommendation_date"]],
];
const TABS = { dictionary: "Live data dictionary", ddl: "MySQL CREATE TABLE script", sample: "Sample INSERT script", queries: "SQL query file" };

function Attr({ a, last }) {
  const pk = a.endsWith("*"), fk = a.endsWith("^");
  const name = a.replace(/[*^]$/, "");
  return <>{pk ? <b><u>{name}</u></b> : fk ? <i>{name}</i> : name}{last ? "" : ", "}</>;
}

export default function Schema() {
  const { data, loading, error } = useFetch("/api/schema");
  const [tab, setTab] = useState("dictionary");
  const [table, setTable] = useState("patient");
  const ctone = (t) => (t === "PRIMARY KEY" ? "bad" : t === "FOREIGN KEY" ? "info" : t === "UNIQUE" ? "warn" : "ok");

  return (
    <div className="stack">
      <PageHeader title="ER Diagram & Relational Schema" description="Ten relations in 3NF. PATIENT is the central strong entity with seven 1:N relationships; MEAL and ACTIVITY are master tables connected to patients through the associative tables meal_record and activity_record (resolved M:N)." />
      <Card title="Entity–Relationship diagram" subtitle="Crow's-foot notation · every FK is enforced by MySQL with ON DELETE CASCADE (patient children) or ON DELETE RESTRICT (master tables)">
        <ERDiagram />
      </Card>
      <Card title="Relational schema" subtitle="Primary key underlined (bold) · foreign keys italic">
        <div className="grid cols-2 tight">
          {RELATIONS.map(([t, attrs]) => (
            <div key={t} className="schema-rel"><b className="t">{t}</b> ( {attrs.map((a, i) => <Attr key={a} a={a} last={i === attrs.length - 1} />)} )</div>
          ))}
        </div>
        <div className="grid cols-3 tight mt">
          <div className="note"><b>1NF</b> – atomic values only (blood pressure split into systolic/diastolic; one reading per row).</div>
          <div className="note"><b>2NF</b> – single-attribute surrogate keys, so no partial dependencies.</div>
          <div className="note"><b>3NF</b> – meal/activity facts live only in their master tables; association tables store only the FK and event facts. BMI is a deliberately retained derived attribute.</div>
        </div>
      </Card>
      <Card title="Database catalogue & scripts" subtitle="The data dictionary is read live from MySQL information_schema of the connected database">
        <div className="chips mb">{Object.keys(TABS).map((t) => <button key={t} className={`chip ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{TABS[t]}</button>)}</div>
        {error && <Alert tone="error">{error}</Alert>}
        {loading && !data ? <Loading label="Reading information_schema…" /> : data && (
          <>
            {tab === "dictionary" && (
              <div className="stack">
                <div className="chips">{TABLES.map((t) => <button key={t} className={`chip mono ${table === t ? "active" : ""}`} onClick={() => setTable(t)}>{t}</button>)}</div>
                <div className="grid cols-2">
                  <div>
                    <div className="muted xs mb"><b>COLUMNS – information_schema.columns</b></div>
                    <DataTable rows={data.columns.filter((c) => c.table_name === table)} rowKey={(r) => r.column_name} columns={[
                      { key: "column_name", label: "Column", className: "mono" },
                      { key: "data_type", label: "Type", className: "mono" },
                      { key: "is_nullable", label: "Nullable", render: (r) => <Badge tone={r.is_nullable === "NO" ? "bad" : "neutral"}>{r.is_nullable === "NO" ? "NOT NULL" : "NULL"}</Badge> },
                      { key: "column_key", label: "Key" },
                      { key: "column_default", label: "Default", className: "xs" },
                      { key: "extra", label: "Extra", className: "xs" },
                    ]} />
                  </div>
                  <div className="stack">
                    <div>
                      <div className="muted xs mb"><b>CONSTRAINTS – information_schema.table_constraints / check_constraints</b></div>
                      <DataTable rows={data.constraints.filter((c) => c.table_name === table)} rowKey={(r) => r.constraint_name} columns={[
                        { key: "constraint_type", label: "Type", render: (r) => <Badge tone={ctone(r.constraint_type)}>{r.constraint_type}</Badge> },
                        { key: "constraint_name", label: "Name", className: "mono" },
                        { key: "definition", label: "Definition", className: "mono wrap" },
                      ]} />
                    </div>
                    <div>
                      <div className="muted xs mb"><b>INDEXES – information_schema.statistics</b></div>
                      <DataTable rows={data.indexes.filter((c) => c.table_name === table)} rowKey={(r) => r.index_name} columns={[
                        { key: "index_name", label: "Index", className: "mono" },
                        { key: "index_columns", label: "Columns", className: "mono" },
                        { key: "uniqueness", label: "Unique?" },
                      ]} />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="muted xs mb"><b>ALL FOREIGN-KEY RELATIONSHIPS – information_schema.referential_constraints</b></div>
                  <DataTable rows={data.foreignKeys} rowKey={(r) => `${r.child_table}.${r.child_column}`} columns={[
                    { key: "child_table", label: "Child table" },
                    { key: "child_column", label: "Column" },
                    { key: "parent_table", label: "→ Parent table" },
                    { key: "parent_column", label: "Column" },
                    { key: "delete_rule", label: "ON DELETE", render: (r) => <Badge tone={r.delete_rule === "CASCADE" ? "warn" : "info"}>{r.delete_rule}</Badge> },
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
