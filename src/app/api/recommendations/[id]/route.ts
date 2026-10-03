import { recommendation } from "@/db/schema";
import { makeDeleteHandler } from "@/lib/crud";

export const dynamic = "force-dynamic";

/** DELETE /api/recommendations/:id */
export const DELETE = makeDeleteHandler(recommendation, recommendation.recommendationId, "Recommendation");
