import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { medicalRecord } from "@/db/schema";
import { capture, fail, ok, readJson, routeId, str, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/medical-records/:id – update medical record */
export const PUT = withDb(async (req: NextRequest, ctx: Ctx) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid record id");
  const b = await readJson(req);
  const existing = (await db.select().from(medicalRecord).where(eq(medicalRecord.recordId, id)))[0];
  if (!existing) return fail("Record not found", 404);
  const { rows, executedSql } = await capture(
    db
      .update(medicalRecord)
      .set({
        medicalHistory: b.medical_history === undefined ? existing.medicalHistory : str(b.medical_history),
        existingConditions: b.existing_conditions === undefined ? existing.existingConditions : str(b.existing_conditions),
        medications: b.medications === undefined ? existing.medications : str(b.medications),
        recordDate: str(b.record_date) ?? existing.recordDate,
      })
      .where(eq(medicalRecord.recordId, id))
      .returning(),
  );
  return ok({ row: rows[0], executedSql });
});

/** DELETE /api/medical-records/:id */
export const DELETE = withDb(async (_req: NextRequest, ctx: Ctx) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid record id");
  const { rows, executedSql } = await capture(
    db.delete(medicalRecord).where(eq(medicalRecord.recordId, id)).returning({ id: medicalRecord.recordId }),
  );
  if (!rows.length) return fail("Record not found", 404);
  return ok({ deleted: id, executedSql });
});
