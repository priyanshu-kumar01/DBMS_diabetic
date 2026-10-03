-- =====================================================================
--  DBMS Query Demonstration – Diabetes Patient Management System
--  All queries are ANSI SQL and run on MySQL 8 and PostgreSQL.
--  (Date arithmetic differs:  MySQL  -> CURDATE() - INTERVAL 7 DAY
--                             Postgres -> CURRENT_DATE - INTERVAL '7 days')
-- =====================================================================

-- ---------- Basic SELECT / ORDER BY -----------------------------------
SELECT patient_id, name, age, gender, bmi FROM patient ORDER BY name;

-- ---------- INSERT ----------------------------------------------------
INSERT INTO patient (name, age, gender, phone, email, height, weight, bmi)
VALUES ('Test Patient', 40, 'Male', '9000000001', 'test@example.com', 170, 70, 24.22);

-- ---------- UPDATE ----------------------------------------------------
UPDATE patient SET weight = 68.5, bmi = ROUND(68.5 / POWER(height/100, 2), 2) WHERE patient_id = 1;

-- ---------- DELETE (ON DELETE CASCADE removes all child rows) ---------
DELETE FROM patient WHERE phone = '9000000001';

-- ---------- 1. Patients with high glucose levels (INNER JOIN) ---------
SELECT p.patient_id, p.name, b.glucose_level, b.measurement_type, b.record_date
FROM patient p
INNER JOIN blood_sugar_record b ON b.patient_id = p.patient_id
WHERE b.glucose_level > 180
ORDER BY b.glucose_level DESC;

-- ---------- 2. Average glucose of each patient (LEFT JOIN, GROUP BY, AVG/MAX/MIN/COUNT)
SELECT p.patient_id, p.name,
       COUNT(b.sugar_record_id)       AS total_readings,
       ROUND(AVG(b.glucose_level), 1) AS avg_glucose,
       MAX(b.glucose_level)           AS highest,
       MIN(b.glucose_level)           AS lowest
FROM patient p
LEFT JOIN blood_sugar_record b ON b.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
ORDER BY avg_glucose DESC;

-- ---------- 3. Patients with high HbA1c (correlated subquery) ---------
SELECT p.patient_id, p.name, l.hba1c, CONCAT(l.bp_systolic, '/', l.bp_diastolic) AS blood_pressure, l.report_date
FROM patient p
INNER JOIN lab_report l ON l.patient_id = p.patient_id
WHERE l.hba1c >= 6.5
  AND l.lab_id = (SELECT MAX(l2.lab_id) FROM lab_report l2 WHERE l2.patient_id = p.patient_id)
ORDER BY l.hba1c DESC;

-- ---------- 4. Most frequently consumed meals (COUNT, GROUP BY, LIMIT)
SELECT m.meal_id, m.meal_name, m.meal_type, COUNT(mr.meal_record_id) AS times_consumed
FROM meal m
INNER JOIN meal_record mr ON mr.meal_id = m.meal_id
WHERE mr.status = 'Consumed'
GROUP BY m.meal_id, m.meal_name, m.meal_type
ORDER BY times_consumed DESC
LIMIT 10;

-- ---------- 5. Total activities performed by each patient (SUM) ------
SELECT p.patient_id, p.name,
       COUNT(ar.activity_record_id)  AS total_activities,
       COALESCE(SUM(ar.duration), 0) AS total_minutes,
       COALESCE(SUM(ar.steps), 0)    AS total_steps
FROM patient p
LEFT JOIN activity_record ar ON ar.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
ORDER BY total_activities DESC;

-- ---------- 6. Average activity duration per patient (HAVING) --------
SELECT p.patient_id, p.name, COUNT(*) AS sessions, ROUND(AVG(ar.duration), 1) AS avg_duration_min
FROM patient p
INNER JOIN activity_record ar ON ar.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
HAVING COUNT(*) >= 3
ORDER BY avg_duration_min DESC;

-- ---------- 7. Number of patients in each risk category (subquery IN)
SELECT pr.risk_level, COUNT(*) AS patient_count
FROM prediction pr
WHERE pr.prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)
GROUP BY pr.risk_level
ORDER BY patient_count DESC;

-- ---------- 8. Latest health record of each patient (scalar subqueries)
SELECT p.patient_id, p.name,
  (SELECT b.glucose_level FROM blood_sugar_record b WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1) AS latest_glucose,
  (SELECT l.hba1c FROM lab_report l WHERE l.patient_id = p.patient_id ORDER BY l.report_date DESC LIMIT 1)             AS latest_hba1c,
  (SELECT m.record_date FROM medical_record m WHERE m.patient_id = p.patient_id ORDER BY m.record_date DESC LIMIT 1)    AS last_visit,
  (SELECT pr.risk_level FROM prediction pr WHERE pr.patient_id = p.patient_id ORDER BY pr.prediction_date DESC LIMIT 1) AS latest_risk
FROM patient p
ORDER BY p.patient_id;

-- ---------- 9. Patients with increasing glucose levels (derived tables)
--      MySQL version (use INTERVAL '7 days' on PostgreSQL)
SELECT p.patient_id, p.name,
       ROUND(earlier.avg_g, 1) AS previous_week_avg,
       ROUND(recent.avg_g, 1)  AS last_week_avg,
       ROUND(recent.avg_g - earlier.avg_g, 1) AS increase
FROM patient p
INNER JOIN (SELECT patient_id, AVG(glucose_level) AS avg_g FROM blood_sugar_record
            WHERE record_date >= CURDATE() - INTERVAL 7 DAY GROUP BY patient_id) recent
        ON recent.patient_id = p.patient_id
INNER JOIN (SELECT patient_id, AVG(glucose_level) AS avg_g FROM blood_sugar_record
            WHERE record_date >= CURDATE() - INTERVAL 14 DAY AND record_date < CURDATE() - INTERVAL 7 DAY
            GROUP BY patient_id) earlier
        ON earlier.patient_id = p.patient_id
WHERE recent.avg_g > earlier.avg_g
ORDER BY increase DESC;

-- ---------- 10. Patient-wise health summary (multiple LEFT JOINs) -----
SELECT p.patient_id, p.name, p.age, p.gender, p.bmi,
       COALESCE(g.readings, 0)       AS glucose_readings,
       g.avg_glucose,
       l.latest_hba1c,
       COALESCE(a.sessions, 0)       AS activity_sessions,
       COALESCE(a.total_minutes, 0)  AS activity_minutes,
       COALESCE(m.meals_consumed, 0) AS meals_consumed,
       r.risk_level
FROM patient p
LEFT JOIN (SELECT patient_id, COUNT(*) AS readings, ROUND(AVG(glucose_level),1) AS avg_glucose
           FROM blood_sugar_record GROUP BY patient_id) g ON g.patient_id = p.patient_id
LEFT JOIN (SELECT l1.patient_id, l1.hba1c AS latest_hba1c FROM lab_report l1
           WHERE l1.lab_id = (SELECT MAX(l2.lab_id) FROM lab_report l2 WHERE l2.patient_id = l1.patient_id)) l
       ON l.patient_id = p.patient_id
LEFT JOIN (SELECT patient_id, COUNT(*) AS sessions, SUM(duration) AS total_minutes
           FROM activity_record GROUP BY patient_id) a ON a.patient_id = p.patient_id
LEFT JOIN (SELECT patient_id, COUNT(*) AS meals_consumed FROM meal_record
           WHERE status = 'Consumed' GROUP BY patient_id) m ON m.patient_id = p.patient_id
LEFT JOIN (SELECT pr1.patient_id, pr1.risk_level FROM prediction pr1
           WHERE pr1.prediction_id = (SELECT MAX(pr2.prediction_id) FROM prediction pr2 WHERE pr2.patient_id = pr1.patient_id)) r
       ON r.patient_id = p.patient_id
ORDER BY p.patient_id;

-- ---------- Extra: meals never recorded (LEFT JOIN ... IS NULL) -------
SELECT m.meal_id, m.meal_name FROM meal m
LEFT JOIN meal_record mr ON mr.meal_id = m.meal_id
WHERE mr.meal_record_id IS NULL;

-- ---------- Extra: patients above the overall average (nested aggregate)
SELECT p.name, ROUND(AVG(b.glucose_level),1) AS patient_avg
FROM patient p INNER JOIN blood_sugar_record b ON b.patient_id = p.patient_id
GROUP BY p.patient_id, p.name
HAVING AVG(b.glucose_level) > (SELECT AVG(glucose_level) FROM blood_sugar_record);

-- ---------- Extra: weekly activity statistics (MySQL) -----------------
SELECT patient_id, YEARWEEK(activity_date, 1) AS yr_week, COUNT(*) AS sessions,
       SUM(duration) AS total_minutes, SUM(steps) AS total_steps
FROM activity_record
GROUP BY patient_id, YEARWEEK(activity_date, 1)
ORDER BY patient_id, yr_week;

-- ---------- Extra: HbA1c comparison with previous report (window fn) --
SELECT patient_id, report_date, hba1c,
       LAG(hba1c) OVER (PARTITION BY patient_id ORDER BY report_date) AS previous_hba1c,
       hba1c - LAG(hba1c) OVER (PARTITION BY patient_id ORDER BY report_date) AS change_in_hba1c
FROM lab_report;
