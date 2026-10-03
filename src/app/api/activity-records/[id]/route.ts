import { activityRecord } from "@/db/schema";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** DELETE /api/activity-records/:id */
export const DELETE = makeDeleteHandler(activityRecord, activityRecord.activityRecordId, "Activity record");
