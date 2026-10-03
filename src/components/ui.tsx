"use client";

import Link from "next/link";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from "react";
import type { ExecutedSql } from "@/lib/client";

/* ---------- layout ------------------------------------------------------- */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = "" }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const tones = {
  teal: "from-teal-500 to-teal-600",
  blue: "from-sky-500 to-sky-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
  violet: "from-violet-500 to-violet-600",
  slate: "from-slate-600 to-slate-700",
  emerald: "from-emerald-500 to-emerald-600",
};
export function StatCard({ label, value, hint, tone = "teal", sql }: { label: string; value: ReactNode; hint?: string; tone?: keyof typeof tones; sql?: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-4 text-white shadow-sm`} title={sql}>
      <div className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/80">{hint}</div>}
      {sql && <code className="mt-2 block truncate text-[10px] text-white/70">{sql}</code>}
    </div>
  );
}

/* ---------- table -------------------------------------------------------- */
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
}
export function DataTable<T extends Record<string, unknown>>({ columns, rows, empty = "No rows returned.", rowKey }: { columns: Column<T>[]; rows: T[]; empty?: string; rowKey?: (r: T, i: number) => string | number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${c.className ?? ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i} className="hover:bg-teal-50/40">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 align-top text-slate-700 ${c.className ?? ""}`}>
                  {c.render ? c.render(r) : formatCell(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function formatCell(v: unknown): ReactNode {
  if (v === null || v === undefined) return <span className="text-slate-400">NULL</span>;
  if (v instanceof Date) return v.toLocaleString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* ---------- forms -------------------------------------------------------- */
export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
const inputCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200";
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

const btn = {
  primary: "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-300",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  ghost: "text-teal-700 hover:bg-teal-50",
};
export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btn }) {
  return <button {...props} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed ${btn[variant]} ${className}`} />;
}

/* ---------- badges / alerts --------------------------------------------- */
const badgeTone = {
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-rose-100 text-rose-800",
  info: "bg-sky-100 text-sky-800",
  neutral: "bg-slate-100 text-slate-700",
};
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTone; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone[tone]}`}>{children}</span>;
}
export function RiskBadge({ level }: { level: unknown }) {
  if (!level) return <Badge tone="neutral">Not assessed</Badge>;
  const l = String(level);
  return <Badge tone={l === "High Risk" ? "bad" : l === "Moderate Risk" ? "warn" : "ok"}>{l}</Badge>;
}
export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warn"; children: ReactNode }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  }[tone];
  return <div className={`rounded-md border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/* ---------- SQL display -------------------------------------------------- */
export function SqlBlock({ sql, title }: { sql: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      {title && <div className="border-b border-slate-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-300">{title}</div>}
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-slate-100">
        <code>{sql}</code>
      </pre>
    </div>
  );
}
export function SqlPanel({ executed }: { executed: ExecutedSql | null }) {
  if (!executed) return null;
  return (
    <Card title="Last executed SQL statement" subtitle="Captured from the ORM query builder and sent to the database">
      <SqlBlock sql={executed.inlined} />
    </Card>
  );
}

export function Loading({ label = "Loading from database…" }: { label?: string }) {
  return <div className="animate-pulse rounded-md bg-slate-100 px-4 py-6 text-center text-sm text-slate-500">{label}</div>;
}

export function PatientLink({ id, name }: { id: unknown; name: unknown }) {
  return (
    <Link href={`/patients/${id}`} className="font-medium text-teal-700 hover:underline">
      {String(name)} <span className="text-xs text-slate-400">#{String(id)}</span>
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
