import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ok, withDb } from "@/lib/api-helpers";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** GET /api/dashboard – KPI figures and chart series, all straight from SQL */
export const GET = withDb(async () => {
  const seeded = await ensureSeeded();

  const [kpi, topMeal, riskDist, glucoseTrend, mealTypes, weeklyActivity, recent, tableCounts] = await Promise.all([
    db.execute(sql`
      SELECT (SELECT COUNT(*) FROM patient)                                   AS total_patients,
             (SELECT COUNT(*) FROM medical_record)                            AS total_medical_records,
             (SELECT ROUND(AVG(glucose_level), 1) FROM blood_sugar_record)    AS avg_glucose,
             (SELECT ROUND(AVG(hba1c), 2) FROM lab_report)                    AS avg_hba1c,
             (SELECT COUNT(*) FROM prediction
               WHERE risk_level = 'High Risk'
                 AND prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)) AS high_risk_patients,
             (SELECT COUNT(*) FROM activity_record)                           AS total_activities,
             (SELECT COUNT(*) FROM blood_sugar_record)                        AS total_glucose_readings,
             (SELECT COUNT(*) FROM recommendation)                            AS total_recommendations`),
    db.execute(sql`
      SELECT m.meal_name, m.meal_type, COUNT(*) AS times
      FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
      WHERE mr.status = 'Consumed'
      GROUP BY m.meal_id, m.meal_name, m.meal_type ORDER BY times DESC LIMIT 1`),
    db.execute(sql`
      SELECT risk_level, COUNT(*) AS patient_count
      FROM prediction WHERE prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)
      GROUP BY risk_level ORDER BY risk_level`),
    db.execute(sql`
      SELECT TO_CHAR(record_date::date, 'YYYY-MM-DD') AS day,
             ROUND(AVG(CASE WHEN measurement_type = 'Fasting' THEN glucose_level END), 1) AS fasting,
             ROUND(AVG(CASE WHEN measurement_type = 'Post-Meal' THEN glucose_level END), 1) AS post_meal
      FROM blood_sugar_record
      WHERE record_date >= NOW() - INTERVAL '14 days'
      GROUP BY record_date::date ORDER BY day`),
    db.execute(sql`
      SELECT m.meal_type, COUNT(*) AS records, ROUND(AVG(m.calories), 0) AS avg_calories
      FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
      GROUP BY m.meal_type ORDER BY m.meal_type`),
    db.execute(sql`
      SELECT TO_CHAR(DATE_TRUNC('week', activity_date), 'YYYY-MM-DD') AS week_start,
             COUNT(*) AS sessions, SUM(duration) AS total_minutes, SUM(steps) AS total_steps
      FROM activity_record
      WHERE activity_date >= CURRENT_DATE - INTERVAL '6 weeks'
      GROUP BY DATE_TRUNC('week', activity_date) ORDER BY week_start`),
    db.execute(sql`
      SELECT p.patient_id, p.name, p.age, p.gender, p.bmi,
             (SELECT b.glucose_level FROM blood_sugar_record b WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1) AS latest_glucose,
             (SELECT b.record_date FROM blood_sugar_record b WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1) AS latest_reading_at,
             (SELECT l.hba1c FROM lab_report l WHERE l.patient_id = p.patient_id ORDER BY l.report_date DESC LIMIT 1) AS latest_hba1c,
             (SELECT pr.risk_level FROM prediction pr WHERE pr.patient_id = p.patient_id ORDER BY pr.prediction_date DESC LIMIT 1) AS risk_level
      FROM patient p ORDER BY p.patient_id DESC LIMIT 8`),
    db.execute(sql`
      SELECT 'patient' AS table_name, COUNT(*) AS rows FROM patient
      UNION ALL SELECT 'medical_record', COUNT(*) FROM medical_record
      UNION ALL SELECT 'blood_sugar_record', COUNT(*) FROM blood_sugar_record
      UNION ALL SELECT 'lab_report', COUNT(*) FROM lab_report
      UNION ALL SELECT 'meal', COUNT(*) FROM meal
      UNION ALL SELECT 'meal_record', COUNT(*) FROM meal_record
      UNION ALL SELECT 'activity', COUNT(*) FROM activity
      UNION ALL SELECT 'activity_record', COUNT(*) FROM activity_record
      UNION ALL SELECT 'prediction', COUNT(*) FROM prediction
      UNION ALL SELECT 'recommendation', COUNT(*) FROM recommendation`),
  ]);

  return ok({
    seeded,
    kpi: kpi.rows[0],
    mostCommonMeal: topMeal.rows[0] ?? null,
    riskDistribution: riskDist.rows,
    glucoseTrend: glucoseTrend.rows,
    mealTypes: mealTypes.rows,
    weeklyActivity: weeklyActivity.rows,
    recentPatients: recent.rows,
    tableCounts: tableCounts.rows,
  });
});
