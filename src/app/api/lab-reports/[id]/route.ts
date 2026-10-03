import { labReport } from "@/db/schema";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** DELETE /api/lab-reports/:id */
export const DELETE = makeDeleteHandler(labReport, labReport.labId, "Lab report");
