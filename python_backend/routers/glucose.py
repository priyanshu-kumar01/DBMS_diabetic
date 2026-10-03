"""3. Blood sugar management – readings, AVG / MAX / MIN, daily trend."""
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from db import execute, fetch_all, fetch_one, qint
from schemas import GlucoseIn

router = APIRouter(prefix="/api/glucose", tags=["3. Blood sugar"])


@router.get("")
def list_glucose(patient_id: str = "", type: str = "", from_date: str = Query("", alias="from"), to_date: str = Query("", alias="to")):
    where, params = ["1 = 1"], []
    pid = qint(patient_id)
    if pid:
        where.append("b.patient_id = %s"); params.append(pid)
    if type:
        where.append("b.measurement_type = %s"); params.append(type)
    if from_date:
        where.append("b.record_date >= %s"); params.append(from_date)
    if to_date:
        where.append("b.record_date < DATE_ADD(%s, INTERVAL 1 DAY)"); params.append(to_date)
    w = " AND ".join(where)
    p = tuple(params)
    return {
        "rows": fetch_all(
            f"""SELECT b.sugar_record_id, b.patient_id, p.name AS patient_name, b.glucose_level, b.measurement_type, b.record_date
                FROM blood_sugar_record b INNER JOIN patient p ON p.patient_id = b.patient_id
                WHERE {w} ORDER BY b.record_date DESC LIMIT 300""", p),
        "stats": fetch_one(
            f"""SELECT COUNT(*) AS total, ROUND(AVG(b.glucose_level), 1) AS avg, MAX(b.glucose_level) AS max, MIN(b.glucose_level) AS min,
                       ROUND(AVG(CASE WHEN b.measurement_type = 'Fasting' THEN b.glucose_level END), 1) AS avg_fasting,
                       ROUND(AVG(CASE WHEN b.measurement_type = 'Post-Meal' THEN b.glucose_level END), 1) AS avg_post_meal,
                       SUM(CASE WHEN b.glucose_level > 180 THEN 1 ELSE 0 END) AS high_count,
                       SUM(CASE WHEN b.glucose_level < 70 THEN 1 ELSE 0 END) AS low_count
                FROM blood_sugar_record b WHERE {w}""", p),
        "highest": fetch_one(
            f"""SELECT b.glucose_level, b.measurement_type, b.record_date, p.name AS patient_name
                FROM blood_sugar_record b INNER JOIN patient p ON p.patient_id = b.patient_id
                WHERE {w} ORDER BY b.glucose_level DESC, b.record_date DESC LIMIT 1""", p),
        "lowest": fetch_one(
            f"""SELECT b.glucose_level, b.measurement_type, b.record_date, p.name AS patient_name
                FROM blood_sugar_record b INNER JOIN patient p ON p.patient_id = b.patient_id
                WHERE {w} ORDER BY b.glucose_level ASC, b.record_date DESC LIMIT 1""", p),
        "trend": fetch_all(
            f"""SELECT DATE(b.record_date) AS day,
                       ROUND(AVG(CASE WHEN b.measurement_type = 'Fasting' THEN b.glucose_level END), 1) AS fasting,
                       ROUND(AVG(CASE WHEN b.measurement_type = 'Post-Meal' THEN b.glucose_level END), 1) AS post_meal,
                       ROUND(AVG(b.glucose_level), 1) AS overall
                FROM blood_sugar_record b
                WHERE {w} AND b.record_date >= NOW() - INTERVAL 30 DAY
                GROUP BY DATE(b.record_date) ORDER BY day""", p),
    }


@router.post("", status_code=201)
def add_reading(g: GlucoseIn):
    r = execute(
        "INSERT INTO blood_sugar_record (patient_id, glucose_level, measurement_type, record_date) VALUES (%s, %s, %s, %s)",
        (g.patient_id, g.glucose_level, g.measurement_type, g.record_date or datetime.now()),
    )
    return {"row": fetch_one("SELECT * FROM blood_sugar_record WHERE sugar_record_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.delete("/{sugar_record_id}")
def delete_reading(sugar_record_id: int):
    r = execute("DELETE FROM blood_sugar_record WHERE sugar_record_id = %s", (sugar_record_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Glucose reading not found")
    return {"deleted": sugar_record_id, "executedSql": r["executedSql"]}
