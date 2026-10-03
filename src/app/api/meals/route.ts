import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { meal } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, toNum, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/meals?q=&type=  – search meals / filter by meal type (with usage count) */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const q = str(sp.get("q"));
  const type = str(sp.get("type"));
  const conds = [sql`1 = 1`];
  if (q) conds.push(sql`(m.meal_name ILIKE ${"%" + q + "%"} OR m.description ILIKE ${"%" + q + "%"})`);
  if (type) conds.push(sql`m.meal_type = ${type}`);

  const result = await db.execute(sql`
    SELECT m.meal_id, m.meal_name, m.meal_type, m.calories, m.carbohydrates, m.description,
           COUNT(mr.meal_record_id) AS times_recorded
    FROM meal m
    LEFT JOIN meal_record mr ON mr.meal_id = m.meal_id
    WHERE ${sql.join(conds, sql` AND `)}
    GROUP BY m.meal_id
    ORDER BY m.meal_type, m.meal_name`);
  return ok({ rows: result.rows });
});

/** POST /api/meals – add meal to catalog */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const name = str(b.meal_name);
  const type = str(b.meal_type);
  const calories = toInt(b.calories);
  const carbs = toNum(b.carbohydrates);
  if (!name || !type || calories === null || carbs === null) return fail("meal_name, meal_type, calories and carbohydrates are required");
  const { rows, executedSql } = await capture(
    db
      .insert(meal)
      .values({ mealName: name, mealType: type, calories, carbohydrates: carbs.toFixed(2), description: str(b.description) })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
