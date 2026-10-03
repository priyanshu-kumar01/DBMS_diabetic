import { NextRequest, NextResponse } from "next/server";

/* ---------- generic JSON helpers ----------------------------------------- */
export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function toInt(v: unknown, fallback: number | null = null): number | null {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/* ---------- SQL capture (for the "Executed SQL" panel in the UI) ---------- */
interface ToSqlable<T> extends PromiseLike<T> {
  toSQL(): { sql: string; params: unknown[] };
}

export interface ExecutedSql {
  sql: string;
  params: unknown[];
  inlined: string;
}

function fmtParam(p: unknown): string {
  if (p === null || p === undefined) return "NULL";
  if (typeof p === "number") return String(p);
  if (p instanceof Date) return `'${p.toISOString()}'`;
  return `'${String(p).replace(/'/g, "''")}'`;
}

/** Inline $1,$2… placeholders so the UI can show a human-readable statement. */
export function inlineSql(sqlText: string, params: unknown[]): string {
  return sqlText.replace(/\$(\d+)/g, (_, i) => fmtParam(params[Number(i) - 1]));
}

/**
 * Executes a Drizzle query and also returns the SQL text that was sent to the
 * database. Used by every INSERT / UPDATE / DELETE endpoint.
 */
export async function capture<T>(query: ToSqlable<T>): Promise<{ rows: T; executedSql: ExecutedSql }> {
  const { sql, params } = query.toSQL();
  const rows = await query;
  return { rows, executedSql: { sql, params, inlined: inlineSql(sql, params) } };
}

/* ---------- PostgreSQL error mapping -------------------------------------- */
interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

export function dbError(e: unknown) {
  // drizzle-orm wraps driver errors in DrizzleQueryError – the pg error is in `cause`
  const wrapped = e as { cause?: unknown };
  const source = wrapped && typeof wrapped === "object" && wrapped.cause && typeof wrapped.cause === "object" && "code" in (wrapped.cause as object) ? wrapped.cause : e;
  const err = (source ?? {}) as PgError;
  const constraint = err.constraint ? ` (constraint: ${err.constraint})` : "";
  switch (err.code) {
    case "23505":
      return fail(`UNIQUE constraint violated – a record with the same value already exists${constraint}.`, 409, {
        code: err.code,
        constraint: err.constraint,
      });
    case "23503":
      return fail(
        `FOREIGN KEY / referential-integrity violation – the referenced row does not exist or is still referenced by child rows${constraint}.`,
        409,
        { code: err.code, constraint: err.constraint, detail: err.detail },
      );
    case "23514":
      return fail(`CHECK constraint violated – value outside the allowed domain${constraint}.`, 422, {
        code: err.code,
        constraint: err.constraint,
      });
    case "23502":
      return fail(`NOT NULL constraint violated – a required column was left empty.`, 422, {
        code: err.code,
        detail: err.detail,
      });
    case "22P02":
    case "22003":
      return fail(`Invalid value supplied for a numeric / typed column.`, 422, { code: err.code });
    default:
      console.error("[api] unexpected error", e);
      return fail(err.message ?? "Internal server error", 500);
  }
}

/** Wraps a route handler so that every DB error becomes a friendly JSON error. */
export function withDb<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      return dbError(e);
    }
  };
}

/** Next.js 15+/16 passes route params as a Promise. */
export async function routeId(ctx: { params: Promise<{ id: string }> }): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 100) / 100;
}
