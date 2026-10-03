import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { mealRecord } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/meal-records?patient_id=&status=&from=&to= – INNER JOIN patient + meal */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const pid = toInt(sp.get("patient_id"));
  const status = str(sp.get("status"));
  const from = str(sp.get("from"));
  const to = str(sp.get("to"));
  const conds = [sql`1 = 1`];
  if (pid) conds.push(sql`mr.patient_id = ${pid}`);
  if (status) conds.push(sql`mr.status = ${status}`);
  if (from) conds.push(sql`mr.meal_date >= ${from}::date`);
  if (to) conds.push(sql`mr.meal_date <= ${to}::date`);

  const [rows, summary] = await Promise.all([
    db.execute(sql`
      SELECT mr.meal_record_id, mr.patient_id, p.name AS patient_name, mr.meal_id, m.meal_name, m.meal_type,
             m.calories, m.carbohydrates, mr.meal_date, mr.status
      FROM meal_record mr
      INNER JOIN patient p ON p.patient_id = mr.patient_id
      INNER JOIN meal m ON m.meal_id = mr.meal_id
      WHERE ${sql.join(conds, sql` AND `)}
      ORDER BY mr.meal_date DESC, mr.meal_record_id DESC LIMIT 300`),
    db.execute(sql`
      SELECT mr.status, COUNT(*) AS cnt, SUM(m.calories) AS calories, SUM(m.carbohydrates) AS carbohydrates
      FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
      WHERE ${sql.join(conds, sql` AND `)}
      GROUP BY mr.status ORDER BY mr.status`),
  ]);
  return ok({ rows: rows.rows, summary: summary.rows });
});

/** POST /api/meal-records – record a meal consumed by a patient */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id);
  const mealId = toInt(b.meal_id);
  if (!patientId || !mealId) return fail("patient_id and meal_id are required");
  const { rows, executedSql } = await capture(
    db
      .insert(mealRecord)
      .values({
        patientId,
        mealId,
        mealDate: str(b.meal_date) ?? new Date().toISOString().slice(0, 10),
        status: str(b.status) ?? "Consumed",
      })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
