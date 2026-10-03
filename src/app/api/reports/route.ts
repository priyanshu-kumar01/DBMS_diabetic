import { ok } from "@/lib/api-helpers";
import { DML_EXAMPLES, REPORTS } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports – catalogue of demonstration queries */
export async function GET() {
  return ok({ reports: REPORTS, dml: DML_EXAMPLES });
}
