"""4. Lab reports – HbA1c + blood pressure, comparison with previous report (LAG window function)."""
from datetime import date

from fastapi import APIRouter, HTTPException

from db import execute, fetch_all, fetch_one, qint
from schemas import LabReportIn

router = APIRouter(prefix="/api/lab-reports", tags=["4. Lab reports"])


@router.get("")
def list_reports(patient_id: str = ""):
    pid = qint(patient_id)
    where = "WHERE l.patient_id = %s" if pid else ""
    params = (pid,) if pid else ()
    return {
        "rows": fetch_all(
            f"""SELECT l.lab_id, l.patient_id, p.name AS patient_name, l.hba1c, l.bp_systolic, l.bp_diastolic,
                       CONCAT(l.bp_systolic, '/', l.bp_diastolic) AS blood_pressure, l.report_date,
                       LAG(l.hba1c) OVER w AS previous_hba1c,
                       ROUND(l.hba1c - LAG(l.hba1c) OVER w, 2) AS hba1c_change
                FROM lab_report l INNER JOIN patient p ON p.patient_id = l.patient_id
                {where}
                WINDOW w AS (PARTITION BY l.patient_id ORDER BY l.report_date, l.lab_id)
                ORDER BY l.report_date DESC, l.lab_id DESC LIMIT 300""", params),
        "stats": fetch_one(
            f"""SELECT COUNT(*) AS total, ROUND(AVG(l.hba1c), 2) AS avg_hba1c, MAX(l.hba1c) AS max_hba1c, MIN(l.hba1c) AS min_hba1c,
                       ROUND(AVG(l.bp_systolic), 0) AS avg_systolic, ROUND(AVG(l.bp_diastolic), 0) AS avg_diastolic
                FROM lab_report l {where}""", params),
    }


@router.post("", status_code=201)
def add_report(l: LabReportIn):
    systolic, diastolic = l.bp_systolic, l.bp_diastolic
    if l.blood_pressure and "/" in l.blood_pressure:
        try:
            systolic, diastolic = (int(x) for x in l.blood_pressure.split("/", 1))
        except ValueError:
            raise HTTPException(422, "blood_pressure must look like 120/80")
    if systolic is None or diastolic is None:
        raise HTTPException(422, "blood_pressure (e.g. 120/80) is required")
    r = execute(
        "INSERT INTO lab_report (patient_id, hba1c, bp_systolic, bp_diastolic, report_date) VALUES (%s, %s, %s, %s, %s)",
        (l.patient_id, l.hba1c, systolic, diastolic, l.report_date or date.today()),
    )
    return {"row": fetch_one("SELECT * FROM lab_report WHERE lab_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.delete("/{lab_id}")
def delete_report(lab_id: int):
    r = execute("DELETE FROM lab_report WHERE lab_id = %s", (lab_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Lab report not found")
    return {"deleted": lab_id, "executedSql": r["executedSql"]}
