import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { patient } from "@/db/schema";
import { calcBmi, capture, fail, ok, readJson, str, toInt, toNum, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/patients?q=&gender=  – list / search patients */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const q = str(sp.get("q"));
  const gender = str(sp.get("gender"));
  const filters = [];
  if (q) {
    filters.push(or(ilike(patient.name, `%${q}%`), ilike(patient.phone, `%${q}%`), ilike(patient.email, `%${q}%`)));
  }
  if (gender) filters.push(eq(patient.gender, gender));

  const query = db
    .select({
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      height: patient.height,
      weight: patient.weight,
      bmi: patient.bmi,
      createdAt: patient.createdAt,
      // NOTE: explicit table qualification (patient.patient_id) is required so the
      // correlated sub-query refers to the OUTER row and not to its own alias.
      glucoseCount: sql<number>`(SELECT COUNT(*) FROM blood_sugar_record b WHERE b.patient_id = patient.patient_id)`.mapWith(Number),
      latestRisk: sql<string | null>`(SELECT pr.risk_level FROM prediction pr WHERE pr.patient_id = patient.patient_id ORDER BY pr.prediction_date DESC LIMIT 1)`,
    })
    .from(patient)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(patient.patientId));

  const { rows, executedSql } = await capture(query);
  return ok({ rows, executedSql });
});

/** POST /api/patients – add patient */
export const POST = withDb(async (req: NextRequest) => {
  const body = await readJson(req);
  const name = str(body.name);
  const age = toInt(body.age);
  const gender = str(body.gender);
  const phone = str(body.phone);
  const email = str(body.email);
  const height = toNum(body.height);
  const weight = toNum(body.weight);
  if (!name || age === null || !gender || !phone || height === null || weight === null) {
    return fail("name, age, gender, phone, height and weight are required (NOT NULL columns).");
  }
  const { rows, executedSql } = await capture(
    db
      .insert(patient)
      .values({
        name,
        age,
        gender,
        phone,
        email,
        height: height.toFixed(2),
        weight: weight.toFixed(2),
        bmi: calcBmi(weight, height).toFixed(2),
      })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
