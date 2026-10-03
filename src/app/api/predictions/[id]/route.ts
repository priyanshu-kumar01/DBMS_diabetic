import { prediction } from "@/db/schema";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** DELETE /api/predictions/:id */
export const DELETE = makeDeleteHandler(prediction, prediction.predictionId, "Prediction");
