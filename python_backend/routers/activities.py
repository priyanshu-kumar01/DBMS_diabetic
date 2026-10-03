"""6. Activity management – catalogue CRUD, patient activity records, steps, duration, weekly statistics."""
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from db import execute, fetch_all, fetch_one, qint
from schemas import ActivityIn, ActivityRecordIn, ActivityUpdate

router = APIRouter(prefix="/api", tags=["6. Activities"])


@router.get("/activities")
def list_activities(q: str = "", type: str = ""):
    sql = """SELECT a.activity_id, a.activity_name, a.activity_type, a.recommended_duration, a.description,
                    COUNT(ar.activity_record_id) AS times_performed,
                    COALESCE(SUM(ar.duration), 0) AS total_minutes,
                    ROUND(AVG(ar.duration), 1) AS avg_duration
             FROM activity a
             LEFT JOIN activity_record ar ON ar.activity_id = a.activity_id
             WHERE 1 = 1"""
    params: list = []
    if q:
        sql += " AND a.activity_name LIKE %s"; params.append(f"%{q}%")
    if type:
        sql += " AND a.activity_type = %s"; params.append(type)
    sql += " GROUP BY a.activity_id ORDER BY a.activity_type, a.activity_name"
    return {"rows": fetch_all(sql, tuple(params))}


@router.post("/activities", status_code=201)
def add_activity(a: ActivityIn):
    r = execute(
        "INSERT INTO activity (activity_name, activity_type, recommended_duration, description) VALUES (%s, %s, %s, %s)",
        (a.activity_name, a.activity_type, a.recommended_duration, a.description),
    )
    return {"row": fetch_one("SELECT * FROM activity WHERE activity_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.put("/activities/{activity_id}")
def update_activity(activity_id: int, a: ActivityUpdate):
    cur = fetch_one("SELECT * FROM activity WHERE activity_id = %s", (activity_id,))
    if not cur:
        raise HTTPException(404, "Activity not found")
    r = execute(
        "UPDATE activity SET activity_name = %s, activity_type = %s, recommended_duration = %s, description = %s WHERE activity_id = %s",
        (a.activity_name or cur["activity_name"], a.activity_type or cur["activity_type"],
         a.recommended_duration or cur["recommended_duration"],
         a.description if a.description is not None else cur["description"], activity_id),
    )
    return {"row": fetch_one("SELECT * FROM activity WHERE activity_id = %s", (activity_id,)), "executedSql": r["executedSql"]}


@router.delete("/activities/{activity_id}")
def delete_activity(activity_id: int):
    """ON DELETE RESTRICT – fails while activity_record rows reference the activity."""
    r = execute("DELETE FROM activity WHERE activity_id = %s", (activity_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Activity not found")
    return {"deleted": activity_id, "executedSql": r["executedSql"]}


@router.get("/activity-records")
def list_activity_records(patient_id: str = "", from_date: str = Query("", alias="from"), to_date: str = Query("", alias="to")):
    where, params = ["1 = 1"], []
    pid = qint(patient_id)
    if pid:
        where.append("ar.patient_id = %s"); params.append(pid)
    if from_date:
        where.append("ar.activity_date >= %s"); params.append(from_date)
    if to_date:
        where.append("ar.activity_date <= %s"); params.append(to_date)
    w = " AND ".join(where)
    p = tuple(params)
    return {
        "rows": fetch_all(
            f"""SELECT ar.activity_record_id, ar.patient_id, p.name AS patient_name, ar.activity_id, a.activity_name, a.activity_type,
                       a.recommended_duration, ar.duration, ar.steps, ar.activity_date
                FROM activity_record ar
                INNER JOIN patient p ON p.patient_id = ar.patient_id
                INNER JOIN activity a ON a.activity_id = ar.activity_id
                WHERE {w}
                ORDER BY ar.activity_date DESC, ar.activity_record_id DESC LIMIT 300""", p),
        "weekly": fetch_all(
            f"""SELECT DATE_SUB(ar.activity_date, INTERVAL WEEKDAY(ar.activity_date) DAY) AS week_start,
                       COUNT(*) AS sessions, SUM(ar.duration) AS total_minutes, SUM(ar.steps) AS total_steps,
                       ROUND(AVG(ar.duration), 1) AS avg_duration
                FROM activity_record ar
                WHERE {w} AND ar.activity_date >= CURDATE() - INTERVAL 8 WEEK
                GROUP BY week_start ORDER BY week_start""", p),
        "totals": fetch_one(
            f"""SELECT COUNT(*) AS sessions, COALESCE(SUM(ar.duration), 0) AS total_minutes, COALESCE(SUM(ar.steps), 0) AS total_steps,
                       ROUND(AVG(ar.duration), 1) AS avg_duration, MAX(ar.steps) AS max_steps,
                       COALESCE(SUM(CASE WHEN ar.activity_date >= CURDATE() - INTERVAL 7 DAY THEN ar.duration ELSE 0 END), 0) AS minutes_last_7d
                FROM activity_record ar WHERE {w}""", p),
        "byType": fetch_all(
            f"""SELECT a.activity_type, COUNT(*) AS sessions, SUM(ar.duration) AS total_minutes
                FROM activity_record ar INNER JOIN activity a ON a.activity_id = ar.activity_id
                WHERE {w} GROUP BY a.activity_type ORDER BY total_minutes DESC""", p),
    }


@router.post("/activity-records", status_code=201)
def add_activity_record(a: ActivityRecordIn):
    r = execute(
        "INSERT INTO activity_record (patient_id, activity_id, duration, steps, activity_date) VALUES (%s, %s, %s, %s, %s)",
        (a.patient_id, a.activity_id, a.duration, a.steps or 0, a.activity_date or date.today()),
    )
    return {"row": fetch_one("SELECT * FROM activity_record WHERE activity_record_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.delete("/activity-records/{activity_record_id}")
def delete_activity_record(activity_record_id: int):
    r = execute("DELETE FROM activity_record WHERE activity_record_id = %s", (activity_record_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Activity record not found")
    return {"deleted": activity_record_id, "executedSql": r["executedSql"]}
