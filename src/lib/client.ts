"use client";

import { useCallback, useEffect, useState } from "react";

export interface ExecutedSql {
  sql: string;
  params: unknown[];
  inlined: string;
}

/** Small fetch wrapper: throws Error(message) for non-2xx JSON responses. */
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Simple data-loading hook with manual refresh. */
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    api<T>(url)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

export const today = () => new Date().toISOString().slice(0, 10);

export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const s = String(v);
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const num = (v: unknown, digits = 1): string => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : String(v);
};

export function glucoseTone(v: unknown, type?: string): "ok" | "warn" | "bad" {
  const n = Number(v);
  if (!Number.isFinite(n)) return "ok";
  if (n < 70 || n > 180) return "bad";
  if (type === "Fasting" ? n >= 100 : n >= 140) return "warn";
  return "ok";
}

export function hba1cTone(v: unknown): "ok" | "warn" | "bad" {
  const n = Number(v);
  if (n >= 6.5) return "bad";
  if (n >= 5.7) return "warn";
  return "ok";
}
