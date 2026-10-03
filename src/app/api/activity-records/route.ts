import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { activityRecord } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity-records?patient_id=&from=&to=
 * Returns records + weekly statistics (GROUP BY week) + totals.
 */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const pid = toInt(sp.get("patient_id"));
  const from = str(sp.get("from"));
  const to = str(sp.get("to"));
  const conds = [sql`1 = 1`];
  if (pid) conds.push(sql`ar.patient_id = ${pid}`);
  if (from) conds.push(sql`ar.activity_date >= ${from}::date`);
  if (to) conds.push(sql`ar.activity_date <= ${to}::date`);
  const where = sql.join(conds, sql` AND `);

  const [rows, weekly, totals, byType] = await Promise.all([
    db.execute(sql`
      SELECT ar.activity_record_id, ar.patient_id, p.name AS patient_name, ar.activity_id, a.activity_name, a.activity_type,
             a.recommended_duration, ar.duration, ar.steps, ar.activity_date
      FROM activity_record ar
      INNER JOIN patient p ON p.patient_id = ar.patient_id
      INNER JOIN activity a ON a.activity_id = ar.activity_id
      WHERE ${where}
      ORDER BY ar.activity_date DESC, ar.activity_record_id DESC LIMIT 300`),
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('week', ar.activity_date), 'YYYY-MM-DD') AS week_start,
             COUNT(*) AS sessions, SUM(ar.duration) AS total_minutes, SUM(ar.steps) AS total_steps,
             ROUND(AVG(ar.duration), 1) AS avg_duration
      FROM activity_record ar
      WHERE ${where} AND ar.activity_date >= CURRENT_DATE - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', ar.activity_date)
      ORDER BY week_start`),
    db.execute(sql`
      SELECT COUNT(*) AS sessions, COALESCE(SUM(ar.duration), 0) AS total_minutes, COALESCE(SUM(ar.steps), 0) AS total_steps,
             ROUND(AVG(ar.duration), 1) AS avg_duration, MAX(ar.steps) AS max_steps,
             COALESCE(SUM(CASE WHEN ar.activity_date >= CURRENT_DATE - INTERVAL '7 days' THEN ar.duration ELSE 0 END), 0) AS minutes_last_7d
      FROM activity_record ar WHERE ${where}`),
    db.execute(sql`
      SELECT a.activity_type, COUNT(*) AS sessions, SUM(ar.duration) AS total_minutes
      FROM activity_record ar INNER JOIN activity a ON a.activity_id = ar.activity_id
      WHERE ${where}
      GROUP BY a.activity_type ORDER BY total_minutes DESC`),
  ]);
  return ok({ rows: rows.rows, weekly: weekly.rows, totals: totals.rows[0], byType: byType.rows });
});

/** POST /api/activity-records – record a patient activity (duration + steps) */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id);
  const activityId = toInt(b.activity_id);
  const duration = toInt(b.duration);
  if (!patientId || !activityId || duration === null) return fail("patient_id, activity_id and duration are required");
  const { rows, executedSql } = await capture(
    db
      .insert(activityRecord)
      .values({
        patientId,
        activityId,
        duration,
        steps: toInt(b.steps, 0) ?? 0,
        activityDate: str(b.activity_date) ?? new Date().toISOString().slice(0, 10),
      })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
