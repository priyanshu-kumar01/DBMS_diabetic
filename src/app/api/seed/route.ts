import { ok, withDb } from "@/lib/api-helpers";
import { seedDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** POST /api/seed – reload the sample dataset (TRUNCATE + INSERT in one transaction) */
export const POST = withDb(async () => {
  const summary = await seedDatabase();
  return ok({ ok: true, summary });
});
