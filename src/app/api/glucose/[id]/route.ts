import { bloodSugarRecord } from "@/db/schema";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** DELETE /api/glucose/:id */
export const DELETE = makeDeleteHandler(bloodSugarRecord, bloodSugarRecord.sugarRecordId, "Glucose reading");
