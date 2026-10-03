"""
Diabetes Patient Management and Lifestyle Recommendation System
FastAPI + MySQL backend  (MCA – DBMS project)

    pip install -r requirements.txt
    mysql -u root -p < ../database/mysql_schema.sql
    mysql -u root -p < ../database/sample_data.sql
    uvicorn main:app --reload --port 8000        # Swagger UI: http://localhost:8000/docs

Every endpoint executes plain SQL (SELECT / INSERT / UPDATE / DELETE, JOINs,
GROUP BY / HAVING, aggregates, sub-queries) through mysql-connector-python.
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mysql.connector import Error as MySQLError
from starlette.exceptions import HTTPException as StarletteHTTPException

from db import to_http_error
from routers import (activities, admin, dashboard, glucose, lab_reports, meals,
                     medical_records, patients, predictions, recommendations, reports)

app = FastAPI(
    title="Diabetes Patient Management & Lifestyle Recommendation System – DBMS API",
    version="1.0.0",
    description="Academic DBMS project. All data is stored in MySQL; the risk prediction is a basic rule-based classifier, not a medical diagnosis.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    body = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    problems = "; ".join(
        f"{'.'.join(str(p) for p in err['loc'][1:]) or 'body'}: {err['msg']}" for err in exc.errors()
    )
    return JSONResponse(status_code=422, content={"error": f"Validation failed – {problems}"})


@app.exception_handler(MySQLError)
async def mysql_exception_handler(_: Request, exc: MySQLError):
    http = to_http_error(exc)
    return JSONResponse(status_code=http.status_code, content=http.detail)


for router in (patients.router, medical_records.router, glucose.router, lab_reports.router, meals.router,
               activities.router, predictions.router, recommendations.router, reports.router,
               dashboard.router, admin.router):
    app.include_router(router)


@app.get("/", tags=["info"])
def root():
    return {
        "project": "Diabetes Patient Management and Lifestyle Recommendation System",
        "purpose": "DBMS demonstration – React + FastAPI + MySQL",
        "docs": "/docs",
        "health": "/api/health",
    }
