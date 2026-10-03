"""
Database access layer (MySQL via mysql-connector-python).

* one connection pool for the whole application
* helpers: fetch_all / fetch_one / run_query / execute / execute_script
* MySQL error numbers are translated into readable DBMS messages so the UI can
  show *which* constraint (UNIQUE / FOREIGN KEY / CHECK / NOT NULL) was violated.
"""
from __future__ import annotations

import os
import re
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional

from dotenv import load_dotenv
from fastapi import HTTPException
from mysql.connector import Error as MySQLError
from mysql.connector import pooling

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent   # project root
DATABASE_DIR = BASE_DIR / "database"                 # SQL scripts (schema, sample data, queries)

_POOL: Optional[pooling.MySQLConnectionPool] = None


def _config() -> dict[str, Any]:
    return {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DB", "diabetes_dbms"),
        "charset": "utf8mb4",
    }


def get_pool() -> pooling.MySQLConnectionPool:
    global _POOL
    if _POOL is None:
        _POOL = pooling.MySQLConnectionPool(
            pool_name="diabetes_pool", pool_size=int(os.getenv("MYSQL_POOL_SIZE", "5")), **_config()
        )
    return _POOL


_CONSTRAINT_RE = re.compile(r"for key '(?:\w+\.)?(\w+)'|constraint '(\w+)'|CONSTRAINT `(\w+)`", re.IGNORECASE)


def to_http_error(e: MySQLError) -> HTTPException:
    """Map MySQL error numbers to HTTP errors with DBMS-friendly explanations."""
    msg = e.msg or str(e)
    match = _CONSTRAINT_RE.search(msg)
    constraint = next((g for g in (match.groups() if match else ()) if g), None)
    suffix = f" (constraint: {constraint})" if constraint else ""
    extra = {"code": e.errno, "constraint": constraint, "detail": msg}
    if e.errno == 1062:
        return HTTPException(409, {"error": f"UNIQUE constraint violated – a record with the same value already exists{suffix}.", **extra})
    if e.errno in (1451, 1452, 1216, 1217):
        return HTTPException(409, {"error": f"FOREIGN KEY / referential-integrity violation – the referenced row does not exist or is still referenced by child rows{suffix}.", **extra})
    if e.errno == 3819:
        return HTTPException(422, {"error": f"CHECK constraint violated – value outside the allowed domain{suffix}.", **extra})
    if e.errno in (1048, 1364):
        return HTTPException(422, {"error": f"NOT NULL constraint violated – a required column was left empty. {msg}", **extra})
    if e.errno in (1264, 1292, 1366, 1406):
        return HTTPException(422, {"error": f"Invalid value for a typed column – {msg}", **extra})
    return HTTPException(500, {"error": msg, **extra})


@contextmanager
def connection(commit: bool = False) -> Iterator[Any]:
    conn = get_pool().get_connection()
    try:
        yield conn
        if commit:
            conn.commit()
    except MySQLError as e:
        try:
            conn.rollback()
        except MySQLError:
            pass
        raise to_http_error(e) from e
    finally:
        conn.close()  # returns the connection to the pool


def fetch_all(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    with connection() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, params)
            return cur.fetchall()
        finally:
            cur.close()


def fetch_one(sql: str, params: tuple = ()) -> Optional[dict[str, Any]]:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def run_query(sql: str, params: tuple = ()) -> dict[str, Any]:
    """SELECT that also returns column names, timing and the executed statement."""
    started = time.perf_counter()
    with connection() as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
            columns = [d[0] for d in cur.description] if cur.description else []
            statement = cur.statement
        finally:
            cur.close()
    return {
        "columns": columns,
        "rows": rows,
        "rowCount": len(rows),
        "ms": int((time.perf_counter() - started) * 1000),
        "executedSql": {"sql": sql.strip(), "params": list(params), "inlined": statement},
    }


def execute(sql: str, params: tuple = ()) -> dict[str, Any]:
    """INSERT / UPDATE / DELETE inside a transaction (commit on success, rollback on error)."""
    with connection(commit=True) as conn:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute(sql, params)
            return {
                "lastrowid": cur.lastrowid,
                "rowcount": cur.rowcount,
                "executedSql": {"sql": sql.strip(), "params": list(params), "inlined": cur.statement},
            }
        finally:
            cur.close()


def split_statements(script: str) -> list[str]:
    """Split an SQL script on ';' while respecting single-quoted strings and '--' comments."""
    statements: list[str] = []
    buf: list[str] = []
    in_string = False
    for line in script.splitlines():
        stripped = line.strip()
        if not in_string and (not stripped or stripped.startswith("--")):
            continue
        for ch in line:
            if ch == "'":
                in_string = not in_string
            if ch == ";" and not in_string:
                stmt = "".join(buf).strip()
                if stmt:
                    statements.append(stmt)
                buf = []
            else:
                buf.append(ch)
        buf.append("\n")
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def execute_script(statements: list[str]) -> int:
    """Run many statements on one connection (used by /api/seed)."""
    with connection() as conn:
        cur = conn.cursor()
        try:
            for stmt in statements:
                cur.execute(stmt)
                if cur.with_rows:
                    cur.fetchall()
            conn.commit()
        finally:
            cur.close()
    return len(statements)


def qint(value: Any) -> Optional[int]:
    """Query-string helper: '' -> None, '12' -> 12."""
    try:
        return int(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


TABLE_COUNTS_SQL = """
SELECT 'patient' AS table_name, COUNT(*) AS total_rows FROM patient
UNION ALL SELECT 'medical_record', COUNT(*) FROM medical_record
UNION ALL SELECT 'blood_sugar_record', COUNT(*) FROM blood_sugar_record
UNION ALL SELECT 'lab_report', COUNT(*) FROM lab_report
UNION ALL SELECT 'meal', COUNT(*) FROM meal
UNION ALL SELECT 'meal_record', COUNT(*) FROM meal_record
UNION ALL SELECT 'activity', COUNT(*) FROM activity
UNION ALL SELECT 'activity_record', COUNT(*) FROM activity_record
UNION ALL SELECT 'prediction', COUNT(*) FROM prediction
UNION ALL SELECT 'recommendation', COUNT(*) FROM recommendation
"""
