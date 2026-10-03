"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/patients", label: "Patients", icon: "👤" },
  { href: "/medical-records", label: "Medical Records", icon: "📋" },
  { href: "/glucose", label: "Blood Sugar", icon: "🩸" },
  { href: "/lab-reports", label: "Lab Reports (HbA1c)", icon: "🧪" },
  { href: "/meals", label: "Meals", icon: "🥗" },
  { href: "/activities", label: "Activities", icon: "🏃" },
  { href: "/predictions", label: "Risk Prediction", icon: "⚠️" },
  { href: "/recommendations", label: "Recommendations", icon: "💡" },
  { href: "/reports", label: "SQL Reports", icon: "🗄️" },
  { href: "/schema", label: "ER Diagram & Schema", icon: "🧬" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
  { href: "/source", label: "Source: React · FastAPI · SQL", icon: "📦" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-teal-400">DBMS Project</div>
        <div className="mt-1 text-lg font-bold leading-tight text-white">Diabetes Patient Management</div>
        <div className="text-xs text-slate-400">& Lifestyle Recommendation System</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${active ? "bg-teal-600 text-white" : "hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="w-5 text-center text-base leading-none">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 px-5 py-3 text-[11px] leading-relaxed text-slate-500">
        10 relational tables · PK/FK · CHECK · UNIQUE · Indexes · Joins · Aggregates · Subqueries
      </div>
    </aside>
  );
}
