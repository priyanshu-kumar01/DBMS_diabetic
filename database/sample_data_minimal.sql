-- =====================================================================
--  Sample INSERT statements (MySQL syntax)
--  The web application loads a larger synthetic dataset through
--  src/lib/seed.ts (TRUNCATE + INSERT inside one transaction).
-- =====================================================================
USE diabetes_dbms;
START TRANSACTION;

-- 1. patient (bmi is supplied here; in MySQL the BEFORE INSERT trigger recomputes it)
INSERT INTO patient (name, age, gender, phone, email, height, weight, bmi) VALUES
('Ravi Kumar',      52, 'Male',   '9876500011', 'ravi.kumar@example.com',   170.00, 82.00, 28.37),
('Anita Sharma',    45, 'Female', '9876500012', 'anita.sharma@example.com', 158.00, 70.00, 28.04),
('Mohammed Irfan',  61, 'Male',   '9876500013', 'irfan.m@example.com',      172.00, 90.00, 30.42),
('Priya Nair',      34, 'Female', '9876500014', 'priya.nair@example.com',   162.00, 55.00, 20.96),
('Suresh Reddy',    58, 'Male',   '9876500015', 'suresh.reddy@example.com', 168.00, 95.00, 33.66),
('Lakshmi Iyer',    49, 'Female', '9876500016', 'lakshmi.iyer@example.com', 155.00, 68.00, 28.30),
('Arjun Mehta',     29, 'Male',   '9876500017', 'arjun.mehta@example.com',  178.00, 72.00, 22.72),
('Fatima Begum',    66, 'Female', '9876500018', 'fatima.b@example.com',     150.00, 74.00, 32.89),
('Deepak Verma',    41, 'Male',   '9876500019', 'deepak.verma@example.com', 175.00, 88.00, 28.73),
('Kavya Krishnan',  38, 'Female', '9876500020', 'kavya.k@example.com',      160.00, 58.00, 22.66);

-- 2. medical_record
INSERT INTO medical_record (patient_id, medical_history, existing_conditions, medications, record_date) VALUES
(1, 'Diagnosed with Type 2 diabetes in 2019. Family history of diabetes (father).', 'Type 2 Diabetes, Hypertension', 'Metformin 500mg BD, Amlodipine 5mg OD', '2024-05-10'),
(1, 'Follow-up visit. Lifestyle counselling given.', 'Type 2 Diabetes, Hypertension', 'Metformin 500mg BD, Amlodipine 5mg OD', '2024-08-20'),
(2, 'Pre-diabetic range detected during annual check-up 2023.', 'Pre-diabetes', 'None', '2024-06-01'),
(3, 'Long-standing Type 2 diabetes (12 years). Mild neuropathy symptoms.', 'Type 2 Diabetes, Hypertension, Dyslipidemia', 'Metformin 1000mg BD, Glimepiride 2mg OD, Atorvastatin 10mg', '2024-04-15'),
(4, 'No chronic illness. Routine wellness monitoring.', 'None', 'None', '2024-07-05'),
(5, 'Type 2 diabetes since 2016; obesity; started lifestyle programme.', 'Type 2 Diabetes, Obesity', 'Metformin 850mg BD, Sitagliptin 100mg OD', '2024-07-22');

-- 3. blood_sugar_record
INSERT INTO blood_sugar_record (patient_id, glucose_level, measurement_type, record_date) VALUES
(1, 138.0, 'Fasting',   '2024-09-01 07:30:00'),
(1, 192.5, 'Post-Meal', '2024-09-01 14:10:00'),
(1, 142.0, 'Fasting',   '2024-09-02 07:20:00'),
(2, 110.0, 'Fasting',   '2024-09-01 07:45:00'),
(2, 151.0, 'Post-Meal', '2024-09-01 14:00:00'),
(3, 165.0, 'Fasting',   '2024-09-01 07:00:00'),
(3, 228.0, 'Post-Meal', '2024-09-01 13:50:00'),
(4,  89.0, 'Fasting',   '2024-09-01 07:35:00'),
(5, 150.0, 'Fasting',   '2024-09-01 07:10:00'),
(7,  91.0, 'Fasting',   '2024-09-01 06:55:00'),
(8, 141.0, 'Fasting',   '2024-09-01 07:40:00'),
(9, 123.0, 'Fasting',   '2024-09-01 07:25:00');

-- 4. lab_report (blood pressure 138/88 stored as two atomic columns)
INSERT INTO lab_report (patient_id, hba1c, bp_systolic, bp_diastolic, report_date) VALUES
(1, 6.90, 136, 86, '2024-03-10'),
(1, 7.10, 138, 88, '2024-08-28'),
(2, 6.00, 126, 82, '2024-08-15'),
(3, 8.20, 146, 92, '2024-08-30'),
(4, 5.20, 112, 74, '2024-07-01'),
(5, 7.60, 142, 90, '2024-08-05'),
(8, 7.00, 150, 94, '2024-08-12'),
(9, 6.30, 132, 86, '2024-08-18');

-- 5. meal (master data)
INSERT INTO meal (meal_name, meal_type, calories, carbohydrates, description) VALUES
('Oats Porridge',                 'Breakfast', 250, 40.00, 'Rolled oats cooked in low-fat milk; high soluble fibre.'),
('Vegetable Upma',                'Breakfast', 280, 45.00, 'Semolina with vegetables.'),
('Egg White Omelette',            'Breakfast', 180,  5.00, 'Very low carbohydrate breakfast.'),
('Brown Rice with Dal',           'Lunch',     420, 65.00, 'Whole-grain rice with lentils.'),
('Grilled Chicken Salad',         'Lunch',     350, 15.00, 'Lean protein with greens.'),
('Vegetable Khichdi',             'Dinner',    350, 55.00, 'Light rice-lentil dinner.'),
('Grilled Fish with Vegetables',  'Dinner',    320, 12.00, 'Low carbohydrate dinner.'),
('Roasted Chana',                 'Snack',     150, 20.00, 'Protein-rich low glycaemic snack.'),
('Apple with Peanut Butter',      'Snack',     200, 22.00, 'Fruit and healthy fat.');

-- 6. meal_record
INSERT INTO meal_record (patient_id, meal_id, meal_date, status) VALUES
(1, 1, '2024-09-01', 'Consumed'), (1, 4, '2024-09-01', 'Consumed'), (1, 6, '2024-09-01', 'Skipped'),
(2, 2, '2024-09-01', 'Consumed'), (2, 5, '2024-09-01', 'Consumed'),
(3, 1, '2024-09-01', 'Consumed'), (3, 4, '2024-09-01', 'Consumed'), (3, 8, '2024-09-01', 'Consumed'),
(4, 3, '2024-09-01', 'Consumed'), (4, 5, '2024-09-01', 'Consumed'), (4, 7, '2024-09-01', 'Planned');

-- 7. activity (master data)
INSERT INTO activity (activity_name, activity_type, recommended_duration, description) VALUES
('Brisk Walking',            'Aerobic',     30, 'Walking at 5-6 km/h.'),
('Cycling',                  'Aerobic',     30, 'Moderate pace cycling.'),
('Yoga',                     'Flexibility', 40, 'Asanas and breathing exercises.'),
('Resistance Band Training', 'Strength',    25, 'Upper and lower body resistance work.'),
('Tai Chi',                  'Balance',     30, 'Slow controlled movements.'),
('Badminton',                'Sports',      45, 'Recreational racquet sport.');

-- 8. activity_record
INSERT INTO activity_record (patient_id, activity_id, duration, steps, activity_date) VALUES
(1, 1, 25, 2600, '2024-09-01'),
(2, 1, 35, 3900, '2024-09-01'), (2, 3, 40,  300, '2024-09-02'),
(4, 2, 45, 4800, '2024-09-01'), (4, 6, 50, 5200, '2024-09-02'), (4, 4, 30,  200, '2024-09-03'),
(7, 1, 40, 4500, '2024-09-01'), (7, 6, 60, 6100, '2024-09-02'),
(9, 1, 30, 3100, '2024-09-02');

-- 9. prediction (result of the basic rule-based classifier)
INSERT INTO prediction (patient_id, risk_level, risk_score, remarks, prediction_date) VALUES
(1, 'High Risk',     75, 'Avg fasting 138 (+35); HbA1c 7.10 (+35); BMI 28.4 (+10); age (+5)', '2024-09-02 09:00:00'),
(2, 'Moderate Risk', 55, 'Avg fasting 110 (+20); HbA1c 6.00 (+20); BMI 28.0 (+10); age (+5)', '2024-09-02 09:00:00'),
(3, 'High Risk',     95, 'Avg fasting 165 (+35); HbA1c 8.20 (+35); BMI 30.4 (+15); age (+5); hypertension (+5)', '2024-09-02 09:00:00'),
(4, 'Low Risk',       0, 'All monitored indicators within normal range', '2024-09-02 09:00:00');

-- 10. recommendation
INSERT INTO recommendation (patient_id, recommendation_type, recommendation_text, recommendation_date) VALUES
(1, 'Meal',     'Prefer low-glycaemic meals; keep each meal under 45 g carbohydrates.', '2024-09-02'),
(1, 'Activity', 'Increase activity to at least 150 minutes per week: brisk walking 30 min on 5 days.', '2024-09-02'),
(1, 'General',  'Monitor fasting glucose daily and repeat HbA1c in 3 months.', '2024-09-02'),
(2, 'Meal',     'Replace refined grains with whole grains; add a salad before main meals.', '2024-09-02'),
(4, 'General',  'Continue healthy habits; schedule an annual HbA1c test.', '2024-09-02');

COMMIT;
