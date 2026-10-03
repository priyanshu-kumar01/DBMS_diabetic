"""7. Risk prediction – basic rule-based classification stored per patient (academic, NOT a diagnosis)."""
from fastapi import APIRouter, HTTPException

from db import execute, fetch_all, fetch_one, qint
from risk import assess_patient_risk, build_recommendations
from schemas import PredictionIn

router = APIRouter(prefix="/api/predictions", tags=["7. Risk prediction"])

DISTRIBUTION_SQL = """SELECT risk_level, COUNT(*) AS patient_count
FROM prediction
WHERE prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)
GROUP BY risk_level ORDER BY patient_count DESC"""


@router.get("")
def list_predictions(patient_id: str = "", risk: str = ""):
    sql = """SELECT pr.prediction_id, pr.patient_id, p.name AS patient_name, p.age, p.bmi, pr.risk_level, pr.risk_score, pr.remarks, pr.prediction_date
             FROM prediction pr INNER JOIN patient p ON p.patient_id = pr.patient_id
             WHERE 1 = 1"""
    params: list = []
    pid = qint(patient_id)
    if pid:
        sql += " AND pr.patient_id = %s"; params.append(pid)
    if risk:
        sql += " AND pr.risk_level = %s"; params.append(risk)
    sql += " ORDER BY pr.prediction_date DESC, pr.prediction_id DESC LIMIT 300"
    return {"rows": fetch_all(sql, tuple(params)), "distribution": fetch_all(DISTRIBUTION_SQL)}


@router.post("", status_code=201)
def predict(body: PredictionIn):
    """Reads the stored data through sub-queries, computes the score and INSERTs the result."""
    assessment = assess_patient_risk(body.patient_id)
    if not assessment:
        raise HTTPException(404, "Patient not found")
    r = execute(
        "INSERT INTO prediction (patient_id, risk_level, risk_score, remarks) VALUES (%s, %s, %s, %s)",
        (body.patient_id, assessment["riskLevel"], assessment["riskScore"], assessment["remarks"]),
    )
    recommendations = []
    if body.generate_recommendations:
        for rtype, text in build_recommendations(assessment):
            ins = execute(
                "INSERT INTO recommendation (patient_id, recommendation_type, recommendation_text) VALUES (%s, %s, %s)",
                (body.patient_id, rtype, text),
            )
            recommendations.append({"recommendation_id": ins["lastrowid"], "recommendation_type": rtype, "recommendation_text": text})
    row = fetch_one("SELECT * FROM prediction WHERE prediction_id = %s", (r["lastrowid"],))
    return {"row": row, "assessment": assessment, "recommendations": recommendations, "executedSql": r["executedSql"]}


@router.delete("/{prediction_id}")
def delete_prediction(prediction_id: int):
    r = execute("DELETE FROM prediction WHERE prediction_id = %s", (prediction_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Prediction not found")
    return {"deleted": prediction_id, "executedSql": r["executedSql"]}
