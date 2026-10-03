"""1. Patient management – add / view / update / delete / search / complete history."""
from fastapi import APIRouter, HTTPException

from db import execute, fetch_all, fetch_one, run_query
from schemas import PatientIn, PatientUpdate

router = APIRouter(prefix="/api/patients", tags=["1. Patient management"])


def bmi(weight: float, height: float) -> float:
    """Derived attribute: weight(kg) / height(m)^2."""
    return round(weight / ((height / 100) ** 2), 2)


@router.get("")
def list_patients(q: str = "", gender: str = ""):
    """SELECT ... WHERE name LIKE ? – search uses idx_patient_name."""
    sql = """SELECT p.patient_id, p.name, p.age, p.gender, p.phone, p.email, p.height, p.weight, p.bmi, p.created_at,
                    (SELECT COUNT(*) FROM blood_sugar_record b WHERE b.patient_id = p.patient_id) AS glucose_count,
                    (SELECT pr.risk_level FROM prediction pr WHERE pr.patient_id = p.patient_id
                      ORDER BY pr.prediction_date DESC, pr.prediction_id DESC LIMIT 1) AS latest_risk
             FROM patient p
             WHERE 1 = 1"""
    params: list = []
    if q:
        sql += " AND (p.name LIKE %s OR p.phone LIKE %s OR p.email LIKE %s)"
        params += [f"%{q}%"] * 3
    if gender:
        sql += " AND p.gender = %s"
        params.append(gender)
    sql += " ORDER BY p.patient_id DESC"
    result = run_query(sql, tuple(params))
    return {"rows": result["rows"], "executedSql": result["executedSql"]}


@router.post("", status_code=201)
def add_patient(p: PatientIn):
    """INSERT INTO patient (...) VALUES (...)"""
    r = execute(
        "INSERT INTO patient (name, age, gender, phone, email, height, weight, bmi) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (p.name, p.age, p.gender, p.phone, p.email, p.height, p.weight, bmi(p.weight, p.height)),
    )
    return {"row": fetch_one("SELECT * FROM patient WHERE patient_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.get("/{patient_id}")
def get_patient(patient_id: int):
    row = fetch_one("SELECT * FROM patient WHERE patient_id = %s", (patient_id,))
    if not row:
        raise HTTPException(404, "Patient not found")
    return {"row": row}


@router.put("/{patient_id}")
def update_patient(patient_id: int, p: PatientUpdate):
    """UPDATE patient SET ... WHERE patient_id = ?  (BMI recomputed)"""
    cur = fetch_one("SELECT * FROM patient WHERE patient_id = %s", (patient_id,))
    if not cur:
        raise HTTPException(404, "Patient not found")
    height = p.height if p.height is not None else float(cur["height"])
    weight = p.weight if p.weight is not None else float(cur["weight"])
    r = execute(
        "UPDATE patient SET name = %s, age = %s, gender = %s, phone = %s, email = %s, height = %s, weight = %s, bmi = %s WHERE patient_id = %s",
        (p.name or cur["name"], p.age or cur["age"], p.gender or cur["gender"], p.phone or cur["phone"],
         p.email if p.email is not None else cur["email"], height, weight, bmi(weight, height), patient_id),
    )
    return {"row": fetch_one("SELECT * FROM patient WHERE patient_id = %s", (patient_id,)), "executedSql": r["executedSql"]}


@router.delete("/{patient_id}")
def delete_patient(patient_id: int):
    """DELETE FROM patient WHERE patient_id = ?  – ON DELETE CASCADE removes all child rows."""
    r = execute("DELETE FROM patient WHERE patient_id = %s", (patient_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Patient not found")
    return {"deleted": patient_id, "executedSql": r["executedSql"]}


@router.get("/{patient_id}/history")
def patient_history(patient_id: int):
    """Complete history – one query per child table of PATIENT."""
    patient = fetch_one("SELECT * FROM patient WHERE patient_id = %s", (patient_id,))
    if not patient:
        raise HTTPException(404, "Patient not found")
    pid = (patient_id,)
    return {
        "patient": patient,
        "medicalRecords": fetch_all("SELECT * FROM medical_record WHERE patient_id = %s ORDER BY record_date DESC, record_id DESC", pid),
        "glucose": fetch_all("SELECT * FROM blood_sugar_record WHERE patient_id = %s ORDER BY record_date DESC LIMIT 200", pid),
        "glucoseStats": fetch_one(
            """SELECT COUNT(*) AS total, ROUND(AVG(glucose_level), 1) AS avg, MAX(glucose_level) AS max, MIN(glucose_level) AS min,
                      ROUND(AVG(CASE WHEN measurement_type = 'Fasting' THEN glucose_level END), 1) AS avg_fasting,
                      ROUND(AVG(CASE WHEN measurement_type = 'Post-Meal' THEN glucose_level END), 1) AS avg_post_meal
               FROM blood_sugar_record WHERE patient_id = %s""", pid),
        "labReports": fetch_all(
            """SELECT lab_id, patient_id, hba1c, bp_systolic, bp_diastolic,
                      CONCAT(bp_systolic, '/', bp_diastolic) AS blood_pressure, report_date
               FROM lab_report WHERE patient_id = %s ORDER BY report_date DESC, lab_id DESC""", pid),
        "mealRecords": fetch_all(
            """SELECT mr.meal_record_id, mr.meal_date, mr.status, m.meal_id, m.meal_name, m.meal_type, m.calories, m.carbohydrates
               FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
               WHERE mr.patient_id = %s ORDER BY mr.meal_date DESC, mr.meal_record_id DESC LIMIT 100""", pid),
        "activityRecords": fetch_all(
            """SELECT ar.activity_record_id, ar.activity_date, ar.duration, ar.steps, a.activity_id, a.activity_name, a.activity_type
               FROM activity_record ar INNER JOIN activity a ON a.activity_id = ar.activity_id
               WHERE ar.patient_id = %s ORDER BY ar.activity_date DESC, ar.activity_record_id DESC LIMIT 100""", pid),
        "weeklyActivity": fetch_all(
            """SELECT DATE_SUB(activity_date, INTERVAL WEEKDAY(activity_date) DAY) AS week_start,
                      COUNT(*) AS sessions, SUM(duration) AS total_minutes, SUM(steps) AS total_steps
               FROM activity_record WHERE patient_id = %s
               GROUP BY week_start ORDER BY week_start""", pid),
        "predictions": fetch_all("SELECT * FROM prediction WHERE patient_id = %s ORDER BY prediction_date DESC, prediction_id DESC", pid),
        "recommendations": fetch_all("SELECT * FROM recommendation WHERE patient_id = %s ORDER BY recommendation_date DESC, recommendation_id DESC", pid),
    }
