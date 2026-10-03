"""9. SQL reports – DBMS query demonstration + read-only SQL console."""
import re
import time

from fastapi import APIRouter, HTTPException
from mysql.connector import Error as MySQLError

from db import connection, run_query
from report_catalog import DML_EXAMPLES, REPORTS, get_report
from schemas import SqlIn

router = APIRouter(prefix="/api", tags=["9. SQL reports"])

FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|load|call|replace|set|lock)\b", re.I)


@router.get("/reports")
def list_reports():
    return {"reports": REPORTS, "dml": DML_EXAMPLES}


@router.get("/reports/{key}")
def run_report(key: str):
    """Executes the named report SQL exactly as written."""
    report = get_report(key)
    if not report:
        raise HTTPException(404, "Unknown report")
    result = run_query(report["sql"].rstrip().rstrip(";"))
    return {"report": report, "columns": result["columns"], "rows": result["rows"], "rowCount": result["rowCount"], "ms": result["ms"]}


@router.post("/sql")
def sql_console(body: SqlIn):
    """Single SELECT statement executed inside a READ ONLY transaction with a 5 s limit."""
    text = body.query.strip().rstrip(";").strip()
    if not text:
        raise HTTPException(400, "Query is empty")
    if not re.match(r"^(select|with)\b", text, re.I):
        raise HTTPException(400, "Only SELECT queries are allowed in the console.")
    if ";" in text:
        raise HTTPException(400, "Only a single statement is allowed.")
    if FORBIDDEN.search(text):
        raise HTTPException(400, "Data-modifying keywords are not allowed in the read-only console.")
    started = time.perf_counter()
    with connection() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("SET SESSION MAX_EXECUTION_TIME = 5000")
            cur.execute("START TRANSACTION READ ONLY")
            try:
                cur.execute(text)
                rows = cur.fetchall()
                columns = [d[0] for d in cur.description] if cur.description else []
            except MySQLError as e:
                raise HTTPException(400, {"error": e.msg, "code": e.errno})
            finally:
                cur.execute("COMMIT")
        finally:
            cur.close()
    return {"columns": columns, "rows": rows[:500], "rowCount": len(rows), "ms": int((time.perf_counter() - started) * 1000)}
