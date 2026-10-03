import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activity } from "@/db/schema";
import { capture, fail, ok, readJson, routeId, str, toInt, withDb } from "@/lib/api-helpers";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** PUT /api/activities/:id – update activity */
export const PUT = withDb(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid activity id");
  const b = await readJson(req);
  const existing = (await db.select().from(activity).where(eq(activity.activityId, id)))[0];
  if (!existing) return fail("Activity not found", 404);
  const { rows, executedSql } = await capture(
    db
      .update(activity)
      .set({
        activityName: str(b.activity_name) ?? existing.activityName,
        activityType: str(b.activity_type) ?? existing.activityType,
        recommendedDuration: toInt(b.recommended_duration) ?? existing.recommendedDuration,
        description: b.description === undefined ? existing.description : str(b.description),
      })
      .where(eq(activity.activityId, id))
      .returning(),
  );
  return ok({ row: rows[0], executedSql });
});

/** DELETE /api/activities/:id – restricted while activity_record rows reference it */
export const DELETE = makeDeleteHandler(activity, activity.activityId, "Activity");
