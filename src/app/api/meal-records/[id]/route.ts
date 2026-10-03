import { mealRecord } from "@/db/schema";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** DELETE /api/meal-records/:id */
export const DELETE = makeDeleteHandler(mealRecord, mealRecord.mealRecordId, "Meal record");
