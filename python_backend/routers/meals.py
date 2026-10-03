"""5. Meal management – catalogue CRUD, search, filter by type, meals consumed by patients."""
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from db import execute, fetch_all, fetch_one, qint
from schemas import MealIn, MealRecordIn, MealUpdate

router = APIRouter(prefix="/api", tags=["5. Meals"])


@router.get("/meals")
def list_meals(q: str = "", type: str = ""):
    """meal LEFT JOIN meal_record ... GROUP BY meal_id (usage count per meal)."""
    sql = """SELECT m.meal_id, m.meal_name, m.meal_type, m.calories, m.carbohydrates, m.description,
                    COUNT(mr.meal_record_id) AS times_recorded
             FROM meal m
             LEFT JOIN meal_record mr ON mr.meal_id = m.meal_id
             WHERE 1 = 1"""
    params: list = []
    if q:
        sql += " AND (m.meal_name LIKE %s OR m.description LIKE %s)"; params += [f"%{q}%"] * 2
    if type:
        sql += " AND m.meal_type = %s"; params.append(type)
    sql += " GROUP BY m.meal_id ORDER BY m.meal_type, m.meal_name"
    return {"rows": fetch_all(sql, tuple(params))}


@router.post("/meals", status_code=201)
def add_meal(m: MealIn):
    r = execute(
        "INSERT INTO meal (meal_name, meal_type, calories, carbohydrates, description) VALUES (%s, %s, %s, %s, %s)",
        (m.meal_name, m.meal_type, m.calories, m.carbohydrates, m.description),
    )
    return {"row": fetch_one("SELECT * FROM meal WHERE meal_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.put("/meals/{meal_id}")
def update_meal(meal_id: int, m: MealUpdate):
    cur = fetch_one("SELECT * FROM meal WHERE meal_id = %s", (meal_id,))
    if not cur:
        raise HTTPException(404, "Meal not found")
    r = execute(
        "UPDATE meal SET meal_name = %s, meal_type = %s, calories = %s, carbohydrates = %s, description = %s WHERE meal_id = %s",
        (m.meal_name or cur["meal_name"], m.meal_type or cur["meal_type"],
         m.calories if m.calories is not None else cur["calories"],
         m.carbohydrates if m.carbohydrates is not None else cur["carbohydrates"],
         m.description if m.description is not None else cur["description"], meal_id),
    )
    return {"row": fetch_one("SELECT * FROM meal WHERE meal_id = %s", (meal_id,)), "executedSql": r["executedSql"]}


@router.delete("/meals/{meal_id}")
def delete_meal(meal_id: int):
    """Fails with a FOREIGN KEY error (1451) while meal_record rows reference the meal – ON DELETE RESTRICT."""
    r = execute("DELETE FROM meal WHERE meal_id = %s", (meal_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Meal not found")
    return {"deleted": meal_id, "executedSql": r["executedSql"]}


@router.get("/meal-records")
def list_meal_records(patient_id: str = "", status: str = "", from_date: str = Query("", alias="from"), to_date: str = Query("", alias="to")):
    where, params = ["1 = 1"], []
    pid = qint(patient_id)
    if pid:
        where.append("mr.patient_id = %s"); params.append(pid)
    if status:
        where.append("mr.status = %s"); params.append(status)
    if from_date:
        where.append("mr.meal_date >= %s"); params.append(from_date)
    if to_date:
        where.append("mr.meal_date <= %s"); params.append(to_date)
    w = " AND ".join(where)
    p = tuple(params)
    return {
        "rows": fetch_all(
            f"""SELECT mr.meal_record_id, mr.patient_id, p.name AS patient_name, mr.meal_id, m.meal_name, m.meal_type,
                       m.calories, m.carbohydrates, mr.meal_date, mr.status
                FROM meal_record mr
                INNER JOIN patient p ON p.patient_id = mr.patient_id
                INNER JOIN meal m ON m.meal_id = mr.meal_id
                WHERE {w}
                ORDER BY mr.meal_date DESC, mr.meal_record_id DESC LIMIT 300""", p),
        "summary": fetch_all(
            f"""SELECT mr.status, COUNT(*) AS cnt, SUM(m.calories) AS calories, SUM(m.carbohydrates) AS carbohydrates
                FROM meal_record mr INNER JOIN meal m ON m.meal_id = mr.meal_id
                WHERE {w} GROUP BY mr.status ORDER BY mr.status""", p),
    }


@router.post("/meal-records", status_code=201)
def add_meal_record(m: MealRecordIn):
    r = execute(
        "INSERT INTO meal_record (patient_id, meal_id, meal_date, status) VALUES (%s, %s, %s, %s)",
        (m.patient_id, m.meal_id, m.meal_date or date.today(), m.status or "Consumed"),
    )
    return {"row": fetch_one("SELECT * FROM meal_record WHERE meal_record_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.delete("/meal-records/{meal_record_id}")
def delete_meal_record(meal_record_id: int):
    r = execute("DELETE FROM meal_record WHERE meal_record_id = %s", (meal_record_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Meal record not found")
    return {"deleted": meal_record_id, "executedSql": r["executedSql"]}
