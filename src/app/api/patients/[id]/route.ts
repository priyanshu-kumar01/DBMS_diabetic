import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patient } from "@/db/schema";
import { calcBmi, capture, fail, ok, readJson, routeId, str, toInt, toNum, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/patients/:id */
export const GET = withDb(async (_req: NextRequest, ctx: Ctx) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid patient id");
  const rows = await db.select().from(patient).where(eq(patient.patientId, id));
  if (!rows.length) return fail("Patient not found", 404);
  return ok({ row: rows[0] });
});

/** PUT /api/patients/:id – update patient (BMI is recomputed) */
export const PUT = withDb(async (req: NextRequest, ctx: Ctx) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid patient id");
  const body = await readJson(req);
  const existing = (await db.select().from(patient).where(eq(patient.patientId, id)))[0];
  if (!existing) return fail("Patient not found", 404);

  const height = toNum(body.height) ?? Number(existing.height);
  const weight = toNum(body.weight) ?? Number(existing.weight);
  const { rows, executedSql } = await capture(
    db
      .update(patient)
      .set({
        name: str(body.name) ?? existing.name,
        age: toInt(body.age) ?? existing.age,
        gender: str(body.gender) ?? existing.gender,
        phone: str(body.phone) ?? existing.phone,
        email: body.email === undefined ? existing.email : str(body.email),
        height: height.toFixed(2),
        weight: weight.toFixed(2),
        bmi: calcBmi(weight, height).toFixed(2),
      })
      .where(eq(patient.patientId, id))
      .returning(),
  );
  return ok({ row: rows[0], executedSql });
});

/** DELETE /api/patients/:id – cascades to all child tables */
export const DELETE = withDb(async (_req: NextRequest, ctx: Ctx) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid patient id");
  const { rows, executedSql } = await capture(
    db.delete(patient).where(eq(patient.patientId, id)).returning({ patientId: patient.patientId }),
  );
  if (!rows.length) return fail("Patient not found", 404);
  return ok({ deleted: rows[0].patientId, executedSql });
});
