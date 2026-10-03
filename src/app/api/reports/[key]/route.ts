import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fail, ok, withDb } from "@/lib/api-helpers";
import { getReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/:key – executes the named report SQL exactly as written */
export const GET = withDb(async (_req: NextRequest, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  const report = getReport(key);
  if (!report) return fail("Unknown report", 404);
  const started = Date.now();
  const result = await db.execute(sql.raw(report.sql));
  return ok({
    report,
    columns: result.fields?.map((f) => f.name) ?? Object.keys(result.rows[0] ?? {}),
    rows: result.rows,
    rowCount: result.rows.length,
    ms: Date.now() - started,
  });
});
