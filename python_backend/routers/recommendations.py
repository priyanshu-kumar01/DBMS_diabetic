"""8. Recommendation management – meal / activity / general lifestyle suggestions per patient."""
from datetime import date

from fastapi import APIRouter, HTTPException

from db import execute, fetch_all, fetch_one, qint
from schemas import RecommendationIn

router = APIRouter(prefix="/api/recommendations", tags=["8. Recommendations"])


@router.get("")
def list_recommendations(patient_id: str = "", type: str = ""):
    sql = """SELECT r.recommendation_id, r.patient_id, p.name AS patient_name, r.recommendation_type, r.recommendation_text, r.recommendation_date
             FROM recommendation r INNER JOIN patient p ON p.patient_id = r.patient_id
             WHERE 1 = 1"""
    params: list = []
    pid = qint(patient_id)
    if pid:
        sql += " AND r.patient_id = %s"; params.append(pid)
    if type:
        sql += " AND r.recommendation_type = %s"; params.append(type)
    sql += " ORDER BY r.recommendation_date DESC, r.recommendation_id DESC LIMIT 300"
    return {
        "rows": fetch_all(sql, tuple(params)),
        "byType": fetch_all("SELECT recommendation_type, COUNT(*) AS cnt FROM recommendation GROUP BY recommendation_type ORDER BY cnt DESC"),
    }


@router.post("", status_code=201)
def add_recommendation(r_in: RecommendationIn):
    r = execute(
        "INSERT INTO recommendation (patient_id, recommendation_type, recommendation_text, recommendation_date) VALUES (%s, %s, %s, %s)",
        (r_in.patient_id, r_in.recommendation_type, r_in.recommendation_text, r_in.recommendation_date or date.today()),
    )
    return {"row": fetch_one("SELECT * FROM recommendation WHERE recommendation_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.delete("/{recommendation_id}")
def delete_recommendation(recommendation_id: int):
    r = execute("DELETE FROM recommendation WHERE recommendation_id = %s", (recommendation_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Recommendation not found")
    return {"deleted": recommendation_id, "executedSql": r["executedSql"]}
