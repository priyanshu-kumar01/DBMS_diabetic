import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { labReport } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, toNum, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/lab-reports?patient_id=
 * Each row also carries the previous HbA1c of the same patient (LAG window
 * function) so the UI can show "compare with previous report".
 */
export const GET = withDb(async (req: NextRequest) => {
  const pid = toInt(req.nextUrl.searchParams.get("patient_id"));
  const where = pid ? sql`WHERE l.patient_id = ${pid}` : sql``;

  const [rows, stats] = await Promise.all([
    db.execute(sql`
      SELECT l.lab_id, l.patient_id, p.name AS patient_name, l.hba1c, l.bp_systolic, l.bp_diastolic,
             l.bp_systolic || '/' || l.bp_diastolic AS blood_pressure, l.report_date,
             LAG(l.hba1c) OVER (PARTITION BY l.patient_id ORDER BY l.report_date, l.lab_id) AS previous_hba1c,
             ROUND(l.hba1c - LAG(l.hba1c) OVER (PARTITION BY l.patient_id ORDER BY l.report_date, l.lab_id), 2) AS change
      FROM lab_report l INNER JOIN patient p ON p.patient_id = l.patient_id
      ${where}
      ORDER BY l.report_date DESC, l.lab_id DESC LIMIT 300`),
    db.execute(sql`
      SELECT COUNT(*) AS total, ROUND(AVG(l.hba1c), 2) AS avg_hba1c, MAX(l.hba1c) AS max_hba1c, MIN(l.hba1c) AS min_hba1c,
             ROUND(AVG(l.bp_systolic), 0) AS avg_systolic, ROUND(AVG(l.bp_diastolic), 0) AS avg_diastolic
      FROM lab_report l ${where}`),
  ]);
  return ok({ rows: rows.rows, stats: stats.rows[0] });
});

/** POST /api/lab-reports – add HbA1c report (blood_pressure given as "120/80") */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id);
  const hba1c = toNum(b.hba1c);
  let sys = toInt(b.bp_systolic);
  let dia = toInt(b.bp_diastolic);
  const bp = str(b.blood_pressure);
  if (bp && bp.includes("/")) {
    const [s, d] = bp.split("/");
    sys = toInt(s);
    dia = toInt(d);
  }
  if (!patientId || hba1c === null || sys === null || dia === null) {
    return fail("patient_id, hba1c and blood_pressure (e.g. 120/80) are required");
  }
  const { rows, executedSql } = await capture(
    db
      .insert(labReport)
      .values({
        patientId,
        hba1c: hba1c.toFixed(2),
        bpSystolic: sys,
        bpDiastolic: dia,
        reportDate: str(b.report_date) ?? new Date().toISOString().slice(0, 10),
      })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
