// Small fetch helper + hooks shared by all pages. All data comes from the FastAPI backend (MySQL).
import { useCallback, useEffect, useState } from "react";

export const API_URL = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:8000";

export async function api(path, init = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || data.detail || `Request failed (${res.status})`);
  return data;
}

export function useFetch(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    setLoading(true);
    api(path)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

export const today = () => new Date().toISOString().slice(0, 10);

export function fmtDate(v) {
  if (!v) return "—";
  const s = String(v);
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function num(v, digits = 1) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : String(v);
}

export function glucoseTone(v, type) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "neutral";
  if (n < 70 || n > 180) return "bad";
  if (type === "Fasting" ? n >= 100 : n >= 140) return "warn";
  return "ok";
}

export function hba1cTone(v) {
  const n = Number(v);
  if (n >= 6.5) return "bad";
  if (n >= 5.7) return "warn";
  return "ok";
}
