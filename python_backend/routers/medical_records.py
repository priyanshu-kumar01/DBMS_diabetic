"""2. Medical records – add / update / view / filter by date."""
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from db import execute, fetch_all, fetch_one, qint
from schemas import MedicalRecordIn, MedicalRecordUpdate

router = APIRouter(prefix="/api/medical-records", tags=["2. Medical records"])


@router.get("")
def list_records(patient_id: str = "", from_date: str = Query("", alias="from"), to_date: str = Query("", alias="to")):
    sql = """SELECT m.record_id, m.patient_id, p.name AS patient_name, m.medical_history,
                    m.existing_conditions, m.medications, m.record_date
             FROM medical_record m
             INNER JOIN patient p ON p.patient_id = m.patient_id
             WHERE 1 = 1"""
    params: list = []
    pid = qint(patient_id)
    if pid:
        sql += " AND m.patient_id = %s"; params.append(pid)
    if from_date:
        sql += " AND m.record_date >= %s"; params.append(from_date)
    if to_date:
        sql += " AND m.record_date <= %s"; params.append(to_date)
    sql += " ORDER BY m.record_date DESC, m.record_id DESC LIMIT 300"
    return {"rows": fetch_all(sql, tuple(params))}


@router.post("", status_code=201)
def add_record(m: MedicalRecordIn):
    r = execute(
        "INSERT INTO medical_record (patient_id, medical_history, existing_conditions, medications, record_date) VALUES (%s, %s, %s, %s, %s)",
        (m.patient_id, m.medical_history, m.existing_conditions, m.medications, m.record_date or date.today()),
    )
    return {"row": fetch_one("SELECT * FROM medical_record WHERE record_id = %s", (r["lastrowid"],)), "executedSql": r["executedSql"]}


@router.put("/{record_id}")
def update_record(record_id: int, m: MedicalRecordUpdate):
    cur = fetch_one("SELECT * FROM medical_record WHERE record_id = %s", (record_id,))
    if not cur:
        raise HTTPException(404, "Record not found")
    r = execute(
        "UPDATE medical_record SET medical_history = %s, existing_conditions = %s, medications = %s, record_date = %s WHERE record_id = %s",
        (m.medical_history if m.medical_history is not None else cur["medical_history"],
         m.existing_conditions if m.existing_conditions is not None else cur["existing_conditions"],
         m.medications if m.medications is not None else cur["medications"],
         m.record_date or cur["record_date"], record_id),
    )
    return {"row": fetch_one("SELECT * FROM medical_record WHERE record_id = %s", (record_id,)), "executedSql": r["executedSql"]}


@router.delete("/{record_id}")
def delete_record(record_id: int):
    r = execute("DELETE FROM medical_record WHERE record_id = %s", (record_id,))
    if r["rowcount"] == 0:
        raise HTTPException(404, "Record not found")
    return {"deleted": record_id, "executedSql": r["executedSql"]}
