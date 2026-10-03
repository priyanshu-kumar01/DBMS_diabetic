import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fail, ok, routeId, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/patients/:id/history – complete patient history.
 * Joins every child table of `patient` (one query per table).
 */
export const GET = withDb(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const id = await routeId(ctx);
  if (!id) return fail("Invalid patient id");

  const p = await db.execute(sql`SELECT * FROM patient WHERE patient_id = ${id}`);
  if (!p.rows.length) return fail("Patient not found", 404);

  const [medical, glucose, glucoseStats, labs, meals, activities, weekly, predictions, recommendations] =
    await Promise.all([
      db.execute(sql`SELECT * FROM medical_record WHERE patient_id = ${id} ORDER BY record_date DESC, record_id DESC`),
      db.execute(sql`SELECT * FROM blood_sugar_record WHERE patient_id = ${id} ORDER BY record_date DESC LIMIT 200`),
      db.execute(sql`SELECT COUNT(*) AS total, ROUND(AVG(glucose_level),1) AS avg, MAX(glucose_level) AS max, MIN(glucose_level) AS min,
                       ROUND(AVG(CASE WHEN measurement_type = 'Fasting' THEN glucose_level END),1) AS avg_fasting,
                       ROUND(AVG(CASE WHEN measurement_type = 'Post-Meal' THEN glucose_level END),1) AS avg_post_meal
                     FROM blood_sugar_record WHERE patient_id = ${id}`),
      db.execute(sql`SELECT lab_id, patient_id, hba1c, bp_systolic, bp_diastolic,
                            bp_systolic || '/' || bp_diastolic AS blood_pressure, report_date
                     FROM lab_report WHERE patient_id = ${id} ORDER BY report_date DESC, lab_id DESC`),
      db.execute(sql`SELECT mr.meal_record_id, mr.meal_date, mr.status, m.meal_id, m.meal_name, m.meal_type, m.calories, m.carbohydrates
                     FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
                     WHERE mr.patient_id = ${id} ORDER BY mr.meal_date DESC, mr.meal_record_id DESC LIMIT 100`),
      db.execute(sql`SELECT ar.activity_record_id, ar.activity_date, ar.duration, ar.steps, a.activity_id, a.activity_name, a.activity_type
                     FROM activity_record ar INNER JOIN activity a ON a.activity_id = ar.activity_id
                     WHERE ar.patient_id = ${id} ORDER BY ar.activity_date DESC, ar.activity_record_id DESC LIMIT 100`),
      db.execute(sql`SELECT TO_CHAR(DATE_TRUNC('week', activity_date), 'YYYY-MM-DD') AS week_start,
                            COUNT(*) AS sessions, SUM(duration) AS total_minutes, SUM(steps) AS total_steps
                     FROM activity_record WHERE patient_id = ${id}
                     GROUP BY DATE_TRUNC('week', activity_date) ORDER BY week_start`),
      db.execute(sql`SELECT * FROM prediction WHERE patient_id = ${id} ORDER BY prediction_date DESC`),
      db.execute(sql`SELECT * FROM recommendation WHERE patient_id = ${id} ORDER BY recommendation_date DESC, recommendation_id DESC`),
    ]);

  return ok({
    patient: p.rows[0],
    medicalRecords: medical.rows,
    glucose: glucose.rows,
    glucoseStats: glucoseStats.rows[0],
    labReports: labs.rows,
    mealRecords: meals.rows,
    activityRecords: activities.rows,
    weeklyActivity: weekly.rows,
    predictions: predictions.rows,
    recommendations: recommendations.rows,
  });
});
