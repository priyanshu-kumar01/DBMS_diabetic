import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { capture, fail, ok, routeId, withDb } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Factory producing a `DELETE /api/<resource>/:id` handler for a table.
 * Demonstrates DELETE ... WHERE <pk> = ? and returns the executed SQL.
 */
export function makeDeleteHandler(table: PgTable, idColumn: PgColumn, label: string) {
  return withDb(async (_req: NextRequest, ctx: Ctx) => {
    const id = await routeId(ctx);
    if (!id) return fail(`Invalid ${label} id`);
    const { rows, executedSql } = await capture(db.delete(table).where(eq(idColumn, id)).returning());
    if (!rows.length) return fail(`${label} not found`, 404);
    return ok({ deleted: id, executedSql });
  });
}
