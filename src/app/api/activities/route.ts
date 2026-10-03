import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { activity } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/activities?q=&type= – activity catalog with usage statistics */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const q = str(sp.get("q"));
  const type = str(sp.get("type"));
  const conds = [sql`1 = 1`];
  if (q) conds.push(sql`a.activity_name ILIKE ${"%" + q + "%"}`);
  if (type) conds.push(sql`a.activity_type = ${type}`);
  const result = await db.execute(sql`
    SELECT a.activity_id, a.activity_name, a.activity_type, a.recommended_duration, a.description,
           COUNT(ar.activity_record_id) AS times_performed,
           COALESCE(SUM(ar.duration), 0) AS total_minutes,
           ROUND(AVG(ar.duration), 1) AS avg_duration
    FROM activity a
    LEFT JOIN activity_record ar ON ar.activity_id = a.activity_id
    WHERE ${sql.join(conds, sql` AND `)}
    GROUP BY a.activity_id
    ORDER BY a.activity_type, a.activity_name`);
  return ok({ rows: result.rows });
});

/** POST /api/activities – add activity to catalog */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const name = str(b.activity_name);
  const type = str(b.activity_type);
  const dur = toInt(b.recommended_duration);
  if (!name || !type || dur === null) return fail("activity_name, activity_type and recommended_duration are required");
  const { rows, executedSql } = await capture(
    db.insert(activity).values({ activityName: name, activityType: type, recommendedDuration: dur, description: str(b.description) }).returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
