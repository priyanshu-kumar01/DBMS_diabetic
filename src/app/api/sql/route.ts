import { NextRequest } from "next/server";
import { fail, ok, readJson } from "@/lib/api-helpers";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/sql { query }
 * Read-only SQL console for the DBMS demonstration.  Only a single SELECT /
 * WITH statement is accepted and it runs inside a READ ONLY transaction with a
 * statement timeout, so data cannot be modified from here.
 */
export async function POST(req: NextRequest) {
  const { query } = await readJson<{ query?: string }>(req);
  const text = (query ?? "").trim().replace(/;\s*$/, "");
  if (!text) return fail("Query is empty");
  if (!/^(select|with)\b/i.test(text)) return fail("Only SELECT queries are allowed in the console.");
  if (text.includes(";")) return fail("Only a single statement is allowed.");
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy)\b/i.test(text)) {
    return fail("Data-modifying keywords are not allowed in the read-only console.");
  }
  const client = await pool.connect();
  const started = Date.now();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = 5000");
    const result = await client.query(text);
    await client.query("COMMIT");
    return ok({
      columns: result.fields.map((f) => f.name),
      rows: result.rows.slice(0, 500),
      rowCount: result.rowCount ?? result.rows.length,
      ms: Date.now() - started,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    const err = e as { message?: string; position?: string };
    return fail(err.message ?? "Query failed", 400, { position: err.position });
  } finally {
    client.release();
  }
}
