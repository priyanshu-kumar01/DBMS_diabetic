import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { meal } from "@/db/schema";
import { capture, fail, ok, readJson, routeId, str, toInt, toNum, withDb } from "@/lib/api-helpers";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** PUT /api/meals/:id – update meal */
export const PUT = withDb(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid meal id");
  const b = await readJson(req);
  const existing = (await db.select().from(meal).where(eq(meal.mealId, id)))[0];
  if (!existing) return fail("Meal not found", 404);
  const carbs = toNum(b.carbohydrates);
  const { rows, executedSql } = await capture(
    db
      .update(meal)
      .set({
        mealName: str(b.meal_name) ?? existing.mealName,
        mealType: str(b.meal_type) ?? existing.mealType,
        calories: toInt(b.calories) ?? existing.calories,
        carbohydrates: carbs === null ? existing.carbohydrates : carbs.toFixed(2),
        description: b.description === undefined ? existing.description : str(b.description),
      })
      .where(eq(meal.mealId, id))
      .returning(),
  );
  return ok({ row: rows[0], executedSql });
});

/** DELETE /api/meals/:id – fails with FK error if meal_record rows reference it (ON DELETE RESTRICT) */
export const DELETE = makeDeleteHandler(meal, meal.mealId, "Meal");
