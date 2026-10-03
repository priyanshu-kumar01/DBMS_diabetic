"""DBMS query demonstration – named report queries (MySQL 8 syntax), executed verbatim."""

REPORTS = [
    {
        "key": "high-glucose",
        "title": "1. Patients with high glucose levels",
        "description": "Every reading above 180 mg/dL together with the patient it belongs to.",
        "concepts": ["SELECT", "INNER JOIN", "WHERE", "ORDER BY"],
        "sql": """SELECT p.patient_id, p.name, b.glucose_level, b.measurement_type, b.record_date
FROM patient p
INNER JOIN blood_sugar_record b ON b.patient_id = p.patient_id
WHERE b.glucose_level > 180
ORDER BY b.glucose_level DESC, b.record_date DESC;""",
    },
    {
        "key": "avg-glucose",
        "title": "2. Average glucose level of each patient",
        "description": "Aggregate statistics per patient. LEFT JOIN keeps patients that have no readings yet.",
        "concepts": ["LEFT JOIN", "GROUP BY", "COUNT()", "AVG()", "MAX()", "MIN()", "COALESCE"],
        "sql": """SELECT p.patient_id, p.name,
       COUNT(b.sugar_record_id)          AS total_readings,
       ROUND(AVG(b.glucose_level), 1)    AS avg_glucose,
       MAX(b.glucose_level)              AS highest,
       MIN(b.glucose_level)              AS lowest
FROM patient p
LEFT JOIN blood_sugar_record b ON b.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
ORDER BY COALESCE(AVG(b.glucose_level), 0) DESC;""",
    },
    {
        "key": "high-hba1c",
        "title": "3. Patients with high HbA1c",
        "description": "Patients whose most recent lab report shows HbA1c >= 6.5 %. A correlated sub-query picks the latest report.",
        "concepts": ["INNER JOIN", "Correlated subquery", "MAX()", "WHERE", "ORDER BY"],
        "sql": """SELECT p.patient_id, p.name, l.hba1c,
       CONCAT(l.bp_systolic, '/', l.bp_diastolic) AS blood_pressure, l.report_date
FROM patient p
INNER JOIN lab_report l ON l.patient_id = p.patient_id
WHERE l.hba1c >= 6.5
  AND l.lab_id = (SELECT MAX(l2.lab_id) FROM lab_report l2 WHERE l2.patient_id = p.patient_id)
ORDER BY l.hba1c DESC;""",
    },
    {
        "key": "top-meals",
        "title": "4. Most frequently consumed meals",
        "description": "Ranks catalogue meals by how many times patients recorded them as consumed.",
        "concepts": ["INNER JOIN", "GROUP BY", "COUNT()", "ORDER BY", "LIMIT"],
        "sql": """SELECT m.meal_id, m.meal_name, m.meal_type, m.calories,
       COUNT(mr.meal_record_id) AS times_consumed
FROM meal m
INNER JOIN meal_record mr ON mr.meal_id = m.meal_id
WHERE mr.status = 'Consumed'
GROUP BY m.meal_id, m.meal_name, m.meal_type, m.calories
ORDER BY times_consumed DESC, m.meal_name
LIMIT 10;""",
    },
    {
        "key": "total-activities",
        "title": "5. Total activities performed by each patient",
        "description": "Counts sessions and sums minutes/steps per patient, including patients with zero activity.",
        "concepts": ["LEFT JOIN", "GROUP BY", "COUNT()", "SUM()", "COALESCE"],
        "sql": """SELECT p.patient_id, p.name,
       COUNT(ar.activity_record_id)   AS total_activities,
       COALESCE(SUM(ar.duration), 0)  AS total_minutes,
       COALESCE(SUM(ar.steps), 0)     AS total_steps
FROM patient p
LEFT JOIN activity_record ar ON ar.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
ORDER BY total_activities DESC, p.name;""",
    },
    {
        "key": "avg-activity",
        "title": "6. Average activity duration per patient",
        "description": "HAVING filters the groups: only patients with at least 3 recorded sessions are shown.",
        "concepts": ["INNER JOIN", "GROUP BY", "HAVING", "AVG()", "COUNT()"],
        "sql": """SELECT p.patient_id, p.name,
       COUNT(ar.activity_record_id)  AS sessions,
       ROUND(AVG(ar.duration), 1)    AS avg_duration_min,
       ROUND(AVG(ar.steps), 0)       AS avg_steps
FROM patient p
INNER JOIN activity_record ar ON ar.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
HAVING COUNT(ar.activity_record_id) >= 3
ORDER BY avg_duration_min DESC;""",
    },
    {
        "key": "risk-distribution",
        "title": "7. Number of patients in each risk category",
        "description": "Uses only the latest prediction of each patient (sub-query with GROUP BY) and then counts per category.",
        "concepts": ["Subquery (IN)", "GROUP BY", "COUNT()", "MAX()", "ORDER BY"],
        "sql": """SELECT pr.risk_level, COUNT(*) AS patient_count,
       ROUND(AVG(pr.risk_score), 1) AS avg_score
FROM prediction pr
WHERE pr.prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)
GROUP BY pr.risk_level
ORDER BY patient_count DESC;""",
    },
    {
        "key": "latest-records",
        "title": "8. Latest health record of each patient",
        "description": "Scalar sub-queries in the SELECT list fetch the newest glucose, HbA1c, visit and risk for each patient.",
        "concepts": ["Scalar subqueries", "ORDER BY ... LIMIT 1", "SELECT"],
        "sql": """SELECT p.patient_id, p.name,
  (SELECT b.glucose_level FROM blood_sugar_record b
     WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1)   AS latest_glucose,
  (SELECT l.hba1c FROM lab_report l
     WHERE l.patient_id = p.patient_id ORDER BY l.report_date DESC LIMIT 1)   AS latest_hba1c,
  (SELECT m.record_date FROM medical_record m
     WHERE m.patient_id = p.patient_id ORDER BY m.record_date DESC LIMIT 1)   AS last_medical_visit,
  (SELECT pr.risk_level FROM prediction pr
     WHERE pr.patient_id = p.patient_id ORDER BY pr.prediction_date DESC LIMIT 1) AS latest_risk
FROM patient p
ORDER BY p.patient_id;""",
    },
    {
        "key": "increasing-glucose",
        "title": "9. Patients with increasing glucose levels",
        "description": "Compares the average of the last 7 days with the previous 7 days using two derived tables (sub-queries in FROM).",
        "concepts": ["Derived tables", "INNER JOIN", "AVG()", "GROUP BY", "Date arithmetic"],
        "sql": """SELECT p.patient_id, p.name,
       ROUND(earlier.avg_g, 1)                AS previous_week_avg,
       ROUND(recent.avg_g, 1)                 AS last_week_avg,
       ROUND(recent.avg_g - earlier.avg_g, 1) AS increase
FROM patient p
INNER JOIN (SELECT patient_id, AVG(glucose_level) AS avg_g
            FROM blood_sugar_record
            WHERE record_date >= CURDATE() - INTERVAL 7 DAY
            GROUP BY patient_id) recent ON recent.patient_id = p.patient_id
INNER JOIN (SELECT patient_id, AVG(glucose_level) AS avg_g
            FROM blood_sugar_record
            WHERE record_date >= CURDATE() - INTERVAL 14 DAY
              AND record_date <  CURDATE() - INTERVAL 7 DAY
            GROUP BY patient_id) earlier ON earlier.patient_id = p.patient_id
WHERE recent.avg_g > earlier.avg_g
ORDER BY increase DESC;""",
    },
    {
        "key": "health-summary",
        "title": "10. Patient-wise health summary",
        "description": "One row per patient combining five aggregated sub-queries with LEFT JOINs.",
        "concepts": ["Multiple LEFT JOINs", "Derived tables", "COUNT()", "AVG()", "SUM()", "Correlated subquery"],
        "sql": """SELECT p.patient_id, p.name, p.age, p.gender, p.bmi,
       COALESCE(g.readings, 0)        AS glucose_readings,
       g.avg_glucose,
       l.latest_hba1c,
       COALESCE(a.sessions, 0)        AS activity_sessions,
       COALESCE(a.total_minutes, 0)   AS activity_minutes,
       COALESCE(m.meals_consumed, 0)  AS meals_consumed,
       r.risk_level
FROM patient p
LEFT JOIN (SELECT patient_id, COUNT(*) AS readings, ROUND(AVG(glucose_level), 1) AS avg_glucose
           FROM blood_sugar_record GROUP BY patient_id) g ON g.patient_id = p.patient_id
LEFT JOIN (SELECT l1.patient_id, l1.hba1c AS latest_hba1c FROM lab_report l1
           WHERE l1.lab_id = (SELECT MAX(l2.lab_id) FROM lab_report l2
                              WHERE l2.patient_id = l1.patient_id)) l ON l.patient_id = p.patient_id
LEFT JOIN (SELECT patient_id, COUNT(*) AS sessions, SUM(duration) AS total_minutes
           FROM activity_record GROUP BY patient_id) a ON a.patient_id = p.patient_id
LEFT JOIN (SELECT patient_id, COUNT(*) AS meals_consumed FROM meal_record
           WHERE status = 'Consumed' GROUP BY patient_id) m ON m.patient_id = p.patient_id
LEFT JOIN (SELECT pr1.patient_id, pr1.risk_level FROM prediction pr1
           WHERE pr1.prediction_id = (SELECT MAX(pr2.prediction_id) FROM prediction pr2
                                      WHERE pr2.patient_id = pr1.patient_id)) r ON r.patient_id = p.patient_id
ORDER BY p.patient_id;""",
    },
    {
        "key": "meals-never-eaten",
        "title": "11. Meals never recorded by any patient",
        "description": "Classic LEFT JOIN ... IS NULL anti-join, plus an equivalent NOT IN sub-query form.",
        "concepts": ["LEFT JOIN", "IS NULL (anti-join)", "Subquery (NOT IN)"],
        "sql": """SELECT m.meal_id, m.meal_name, m.meal_type, m.calories, m.carbohydrates
FROM meal m
LEFT JOIN meal_record mr ON mr.meal_id = m.meal_id
WHERE mr.meal_record_id IS NULL
  AND m.meal_id NOT IN (SELECT meal_id FROM meal_record)
ORDER BY m.meal_type, m.meal_name;""",
    },
    {
        "key": "above-average-patients",
        "title": "12. Patients whose average glucose exceeds the overall average",
        "description": "Nested aggregate sub-query in HAVING compares each patient's mean with the global mean.",
        "concepts": ["GROUP BY", "HAVING", "Nested subquery", "AVG()"],
        "sql": """SELECT p.patient_id, p.name, ROUND(AVG(b.glucose_level), 1) AS patient_avg,
       (SELECT ROUND(AVG(glucose_level), 1) FROM blood_sugar_record) AS overall_avg
FROM patient p
INNER JOIN blood_sugar_record b ON b.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
HAVING AVG(b.glucose_level) > (SELECT AVG(glucose_level) FROM blood_sugar_record)
ORDER BY patient_avg DESC;""",
    },
]

DML_EXAMPLES = [
    {"title": "INSERT – register a patient",
     "sql": "INSERT INTO patient (name, age, gender, phone, email, height, weight, bmi)\nVALUES ('Ravi Kumar', 52, 'Male', '9876500011', 'ravi@example.com', 170.00, 82.00, 28.37);"},
    {"title": "INSERT – glucose reading (FK to patient)",
     "sql": "INSERT INTO blood_sugar_record (patient_id, glucose_level, measurement_type, record_date)\nVALUES (1, 142.0, 'Fasting', NOW());"},
    {"title": "UPDATE – change a patient's weight and derived BMI",
     "sql": "UPDATE patient\nSET weight = 78.50, bmi = ROUND(78.50 / POWER(height / 100, 2), 2)\nWHERE patient_id = 1;"},
    {"title": "UPDATE – edit a medical record",
     "sql": "UPDATE medical_record\nSET medications = 'Metformin 500mg twice daily', existing_conditions = 'Type 2 Diabetes, Hypertension'\nWHERE record_id = 3;"},
    {"title": "DELETE – remove one glucose reading",
     "sql": "DELETE FROM blood_sugar_record WHERE sugar_record_id = 25;"},
    {"title": "DELETE – remove a patient (ON DELETE CASCADE removes all child rows)",
     "sql": "DELETE FROM patient WHERE patient_id = 9;\n-- medical_record, blood_sugar_record, lab_report, meal_record,\n-- activity_record, prediction and recommendation rows are removed automatically."},
    {"title": "DELETE – blocked by ON DELETE RESTRICT",
     "sql": "DELETE FROM meal WHERE meal_id = 1;\n-- ERROR 1451: Cannot delete or update a parent row: a foreign key constraint fails\n--             (`diabetes_dbms`.`meal_record`, CONSTRAINT `fk_mealrec_meal` ...)"},
]


def get_report(key: str):
    return next((r for r in REPORTS if r["key"] == key), None)
