"""10. Dashboard – KPI figures and chart series, all computed by SQL aggregates."""
from fastapi import APIRouter

from db import TABLE_COUNTS_SQL, fetch_all, fetch_one

router = APIRouter(prefix="/api/dashboard", tags=["10. Dashboard"])


@router.get("")
def dashboard():
    return {
        "kpi": fetch_one("""
            SELECT (SELECT COUNT(*) FROM patient)                                  AS total_patients,
                   (SELECT COUNT(*) FROM medical_record)                           AS total_medical_records,
                   (SELECT ROUND(AVG(glucose_level), 1) FROM blood_sugar_record)   AS avg_glucose,
                   (SELECT ROUND(AVG(hba1c), 2) FROM lab_report)                   AS avg_hba1c,
                   (SELECT COUNT(*) FROM prediction
                     WHERE risk_level = 'High Risk'
                       AND prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)) AS high_risk_patients,
                   (SELECT COUNT(*) FROM activity_record)                          AS total_activities,
                   (SELECT COUNT(*) FROM blood_sugar_record)                       AS total_glucose_readings,
                   (SELECT COUNT(*) FROM recommendation)                           AS total_recommendations"""),
        "mostCommonMeal": fetch_one("""
            SELECT m.meal_name, m.meal_type, COUNT(*) AS times
            FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
            WHERE mr.status = 'Consumed'
            GROUP BY m.meal_id, m.meal_name, m.meal_type ORDER BY times DESC LIMIT 1"""),
        "riskDistribution": fetch_all("""
            SELECT risk_level, COUNT(*) AS patient_count
            FROM prediction WHERE prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)
            GROUP BY risk_level ORDER BY risk_level"""),
        "glucoseTrend": fetch_all("""
            SELECT DATE(record_date) AS day,
                   ROUND(AVG(CASE WHEN measurement_type = 'Fasting' THEN glucose_level END), 1) AS fasting,
                   ROUND(AVG(CASE WHEN measurement_type = 'Post-Meal' THEN glucose_level END), 1) AS post_meal
            FROM blood_sugar_record
            WHERE record_date >= NOW() - INTERVAL 14 DAY
            GROUP BY DATE(record_date) ORDER BY day"""),
        "mealTypes": fetch_all("""
            SELECT m.meal_type, COUNT(*) AS records, ROUND(AVG(m.calories), 0) AS avg_calories
            FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
            GROUP BY m.meal_type ORDER BY m.meal_type"""),
        "weeklyActivity": fetch_all("""
            SELECT DATE_SUB(activity_date, INTERVAL WEEKDAY(activity_date) DAY) AS week_start,
                   COUNT(*) AS sessions, SUM(duration) AS total_minutes, SUM(steps) AS total_steps
            FROM activity_record
            WHERE activity_date >= CURDATE() - INTERVAL 6 WEEK
            GROUP BY week_start ORDER BY week_start"""),
        "recentPatients": fetch_all("""
            SELECT p.patient_id, p.name, p.age, p.gender, p.bmi,
                   (SELECT b.glucose_level FROM blood_sugar_record b WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1) AS latest_glucose,
                   (SELECT b.record_date FROM blood_sugar_record b WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1) AS latest_reading_at,
                   (SELECT l.hba1c FROM lab_report l WHERE l.patient_id = p.patient_id ORDER BY l.report_date DESC LIMIT 1) AS latest_hba1c,
                   (SELECT pr.risk_level FROM prediction pr WHERE pr.patient_id = p.patient_id ORDER BY pr.prediction_date DESC LIMIT 1) AS risk_level
            FROM patient p ORDER BY p.patient_id DESC LIMIT 8"""),
        "tableCounts": fetch_all(TABLE_COUNTS_SQL),
    }
