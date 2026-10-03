import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { bloodSugarRecord } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, toNum, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/glucose?patient_id=&type=&from=&to=
 * Returns readings + aggregate statistics (AVG/MAX/MIN/COUNT) + daily trend.
 */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const pid = toInt(sp.get("patient_id"));
  const type = str(sp.get("type"));
  const from = str(sp.get("from"));
  const to = str(sp.get("to"));

  const conds = [sql`1 = 1`];
  if (pid) conds.push(sql`b.patient_id = ${pid}`);
  if (type) conds.push(sql`b.measurement_type = ${type}`);
  if (from) conds.push(sql`b.record_date >= ${from}::date`);
  if (to) conds.push(sql`b.record_date < (${to}::date + INTERVAL '1 day')`);
  const where = sql.join(conds, sql` AND `);

  const [rows, stats, highest, lowest, trend] = await Promise.all([
    db.execute(sql`
      SELECT b.sugar_record_id, b.patient_id, p.name AS patient_name, b.glucose_level, b.measurement_type, b.record_date
      FROM blood_sugar_record b INNER JOIN patient p ON p.patient_id = b.patient_id
      WHERE ${where} ORDER BY b.record_date DESC LIMIT 300`),
    db.execute(sql`
      SELECT COUNT(*) AS total, ROUND(AVG(b.glucose_level), 1) AS avg, MAX(b.glucose_level) AS max, MIN(b.glucose_level) AS min,
             ROUND(AVG(CASE WHEN b.measurement_type = 'Fasting' THEN b.glucose_level END), 1) AS avg_fasting,
             ROUND(AVG(CASE WHEN b.measurement_type = 'Post-Meal' THEN b.glucose_level END), 1) AS avg_post_meal,
             SUM(CASE WHEN b.glucose_level > 180 THEN 1 ELSE 0 END) AS high_count,
             SUM(CASE WHEN b.glucose_level < 70 THEN 1 ELSE 0 END) AS low_count
      FROM blood_sugar_record b WHERE ${where}`),
    db.execute(sql`
      SELECT b.glucose_level, b.measurement_type, b.record_date, p.name AS patient_name
      FROM blood_sugar_record b INNER JOIN patient p ON p.patient_id = b.patient_id
      WHERE ${where} ORDER BY b.glucose_level DESC, b.record_date DESC LIMIT 1`),
    db.execute(sql`
      SELECT b.glucose_level, b.measurement_type, b.record_date, p.name AS patient_name
      FROM blood_sugar_record b INNER JOIN patient p ON p.patient_id = b.patient_id
      WHERE ${where} ORDER BY b.glucose_level ASC, b.record_date DESC LIMIT 1`),
    db.execute(sql`
      SELECT TO_CHAR(b.record_date::date, 'YYYY-MM-DD') AS day,
             ROUND(AVG(CASE WHEN b.measurement_type = 'Fasting' THEN b.glucose_level END), 1) AS fasting,
             ROUND(AVG(CASE WHEN b.measurement_type = 'Post-Meal' THEN b.glucose_level END), 1) AS post_meal,
             ROUND(AVG(b.glucose_level), 1) AS overall
      FROM blood_sugar_record b
      WHERE ${where} AND b.record_date >= NOW() - INTERVAL '30 days'
      GROUP BY b.record_date::date ORDER BY day`),
  ]);

  return ok({
    rows: rows.rows,
    stats: stats.rows[0],
    highest: highest.rows[0] ?? null,
    lowest: lowest.rows[0] ?? null,
    trend: trend.rows,
  });
});

/** POST /api/glucose – add reading */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id);
  const level = toNum(b.glucose_level);
  const type = str(b.measurement_type);
  if (!patientId || level === null || !type) return fail("patient_id, glucose_level and measurement_type are required");
  const when = str(b.record_date);
  const { rows, executedSql } = await capture(
    db
      .insert(bloodSugarRecord)
      .values({
        patientId,
        glucoseLevel: level.toFixed(1),
        measurementType: type,
        recordDate: when ? new Date(when) : new Date(),
      })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
