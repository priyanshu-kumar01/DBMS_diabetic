// Shared presentational components (plain CSS classes from styles.css).
import { Link } from "react-router-dom";

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <div className="subtitle">{subtitle}</div>}
          </div>
          {actions}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "teal", sql, small = false }) {
  return (
    <div className={`stat ${tone}`} title={sql}>
      <div className="label">{label}</div>
      <div className={`value ${small ? "sm" : ""}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
      {sql && <code>{sql}</code>}
    </div>
  );
}

function formatCell(v) {
  if (v === null || v === undefined) return <span className="null">NULL</span>;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function DataTable({ columns, rows, empty = "No rows returned.", rowKey }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty">{empty}</td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.className || ""}>{c.render ? c.render(r) : formatCell(r[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}
export function Input(props) {
  return <input {...props} className={`input ${props.className || ""}`} />;
}
export function Select(props) {
  return <select {...props} className={`input ${props.className || ""}`} />;
}
export function Textarea(props) {
  return <textarea {...props} className={`input ${props.className || ""}`} />;
}
export function Button({ variant = "primary", className = "", ...props }) {
  return <button type="button" {...props} className={`btn ${variant} ${className}`} />;
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function RiskBadge({ level }) {
  if (!level) return <Badge>Not assessed</Badge>;
  return <Badge tone={level === "High Risk" ? "bad" : level === "Moderate Risk" ? "warn" : "ok"}>{level}</Badge>;
}
export function Alert({ tone = "info", children }) {
  return <div className={`alert ${tone}`}>{children}</div>;
}

export function SqlBlock({ sql, title }) {
  return (
    <div className="sql">
      {title && <div className="sql-title">{title}</div>}
      <pre>
        <code>{sql}</code>
      </pre>
    </div>
  );
}
export function SqlPanel({ executed }) {
  if (!executed) return null;
  return (
    <Card title="Last executed SQL statement" subtitle="Statement sent to MySQL by the FastAPI backend (mysql-connector cursor.statement)">
      <SqlBlock sql={executed.inlined || executed.sql} />
    </Card>
  );
}
export function Loading({ label = "Loading from database…" }) {
  return <div className="loading">{label}</div>;
}
export function PatientLink({ id, name }) {
  return (
    <Link to={`/patients/${id}`}>
      {name} <span className="muted xs">#{id}</span>
    </Link>
  );
}

export const GENDERS = ["Male", "Female", "Other"];
export const MEASUREMENT_TYPES = ["Fasting", "Post-Meal", "Random", "Bedtime"];
export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
export const MEAL_STATUS = ["Consumed", "Skipped", "Planned"];
export const ACTIVITY_TYPES = ["Aerobic", "Strength", "Flexibility", "Balance", "Sports"];
export const RECO_TYPES = ["Meal", "Activity", "General"];
export const RISK_LEVELS = ["Low Risk", "Moderate Risk", "High Risk"];
