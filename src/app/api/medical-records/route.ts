import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { medicalRecord } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/medical-records?patient_id=&from=&to= */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const pid = toInt(sp.get("patient_id"));
  const from = str(sp.get("from"));
  const to = str(sp.get("to"));

  const conds = [sql`1 = 1`];
  if (pid) conds.push(sql`m.patient_id = ${pid}`);
  if (from) conds.push(sql`m.record_date >= ${from}::date`);
  if (to) conds.push(sql`m.record_date <= ${to}::date`);

  const result = await db.execute(sql`
    SELECT m.record_id, m.patient_id, p.name AS patient_name, m.medical_history,
           m.existing_conditions, m.medications, m.record_date
    FROM medical_record m
    INNER JOIN patient p ON p.patient_id = m.patient_id
    WHERE ${sql.join(conds, sql` AND `)}
    ORDER BY m.record_date DESC, m.record_id DESC
    LIMIT 300`);
  return ok({ rows: result.rows });
});

/** POST /api/medical-records */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id ?? b.patientId);
  if (!patientId) return fail("patient_id is required");
  const { rows, executedSql } = await capture(
    db
      .insert(medicalRecord)
      .values({
        patientId,
        medicalHistory: str(b.medical_history),
        existingConditions: str(b.existing_conditions),
        medications: str(b.medications),
        recordDate: str(b.record_date) ?? new Date().toISOString().slice(0, 10),
      })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
