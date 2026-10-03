import type { Metadata } from "next";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diabetes Patient Management & Lifestyle Recommendation System – DBMS Project",
  description: "Academic DBMS project demonstrating relational design, SQL queries, joins, aggregates and CRUD operations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">MCA · Database Management Systems</span> — project demonstration
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                Academic demo · risk prediction is rule-based, not a medical diagnosis
              </div>
            </header>
            <main className="flex-1 px-6 py-6">{children}</main>
            <footer className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
              All data shown is read from and written to the relational database through SQL. Sample data is synthetic.
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
