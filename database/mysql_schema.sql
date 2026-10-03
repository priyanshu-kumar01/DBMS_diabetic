-- =====================================================================
--  Diabetes Patient Management and Lifestyle Recommendation System
--  MySQL 8.x DDL  –  relational schema normalised to 3NF
--  (The running web application uses the identical schema on PostgreSQL;
--   see src/db/schema.ts.  Only dialect keywords differ.)
-- =====================================================================
CREATE DATABASE IF NOT EXISTS diabetes_dbms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE diabetes_dbms;

-- ---------------------------------------------------------------------
-- 1. PATIENT  (strong entity)
-- ---------------------------------------------------------------------
CREATE TABLE patient (
    patient_id   INT           NOT NULL AUTO_INCREMENT,
    name         VARCHAR(100)  NOT NULL,
    age          INT           NOT NULL,
    gender       VARCHAR(10)   NOT NULL,
    phone        VARCHAR(15)   NOT NULL,
    email        VARCHAR(100)  NULL,
    height       DECIMAL(5,2)  NOT NULL COMMENT 'centimetres',
    weight       DECIMAL(5,2)  NOT NULL COMMENT 'kilograms',
    bmi          DECIMAL(5,2)  NOT NULL COMMENT 'derived: weight / (height/100)^2',
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_patient          PRIMARY KEY (patient_id),
    CONSTRAINT uq_patient_phone    UNIQUE (phone),
    CONSTRAINT uq_patient_email    UNIQUE (email),
    CONSTRAINT chk_patient_age     CHECK (age BETWEEN 1 AND 120),
    CONSTRAINT chk_patient_gender  CHECK (gender IN ('Male','Female','Other')),
    CONSTRAINT chk_patient_height  CHECK (height > 0),
    CONSTRAINT chk_patient_weight  CHECK (weight > 0),
    INDEX idx_patient_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. MEDICAL_RECORD  (1 patient : N records)
-- ---------------------------------------------------------------------
CREATE TABLE medical_record (
    record_id            INT           NOT NULL AUTO_INCREMENT,
    patient_id           INT           NOT NULL,
    medical_history      TEXT          NULL,
    existing_conditions  VARCHAR(255)  NULL,
    medications          VARCHAR(255)  NULL,
    record_date          DATE          NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT pk_medical_record PRIMARY KEY (record_id),
    CONSTRAINT fk_medrec_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_medrec_patient_date (patient_id, record_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. BLOOD_SUGAR_RECORD  (1 patient : N readings)
-- ---------------------------------------------------------------------
CREATE TABLE blood_sugar_record (
    sugar_record_id   INT           NOT NULL AUTO_INCREMENT,
    patient_id        INT           NOT NULL,
    glucose_level     DECIMAL(5,1)  NOT NULL COMMENT 'mg/dL',
    measurement_type  VARCHAR(20)   NOT NULL,
    record_date       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_blood_sugar_record PRIMARY KEY (sugar_record_id),
    CONSTRAINT fk_sugar_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_glucose_range    CHECK (glucose_level BETWEEN 20 AND 600),
    CONSTRAINT chk_measurement_type CHECK (measurement_type IN ('Fasting','Post-Meal','Random','Bedtime')),
    INDEX idx_sugar_patient_date (patient_id, record_date),
    INDEX idx_sugar_level (glucose_level)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. LAB_REPORT  (1 patient : N reports)
--    blood pressure is stored atomically (1NF) as systolic / diastolic
-- ---------------------------------------------------------------------
CREATE TABLE lab_report (
    lab_id        INT           NOT NULL AUTO_INCREMENT,
    patient_id    INT           NOT NULL,
    hba1c         DECIMAL(4,2)  NOT NULL COMMENT 'percentage',
    bp_systolic   INT           NOT NULL,
    bp_diastolic  INT           NOT NULL,
    report_date   DATE          NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT pk_lab_report PRIMARY KEY (lab_id),
    CONSTRAINT fk_lab_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_hba1c_range  CHECK (hba1c BETWEEN 3 AND 20),
    CONSTRAINT chk_bp_systolic  CHECK (bp_systolic BETWEEN 60 AND 260),
    CONSTRAINT chk_bp_diastolic CHECK (bp_diastolic BETWEEN 30 AND 160),
    INDEX idx_lab_patient_date (patient_id, report_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. MEAL  (master / catalogue table – independent of patient)
-- ---------------------------------------------------------------------
CREATE TABLE meal (
    meal_id        INT           NOT NULL AUTO_INCREMENT,
    meal_name      VARCHAR(100)  NOT NULL,
    meal_type      VARCHAR(20)   NOT NULL,
    calories       INT           NOT NULL,
    carbohydrates  DECIMAL(6,2)  NOT NULL COMMENT 'grams',
    description    TEXT          NULL,
    CONSTRAINT pk_meal        PRIMARY KEY (meal_id),
    CONSTRAINT uq_meal_name   UNIQUE (meal_name),
    CONSTRAINT chk_meal_type  CHECK (meal_type IN ('Breakfast','Lunch','Dinner','Snack')),
    CONSTRAINT chk_meal_calories CHECK (calories >= 0),
    CONSTRAINT chk_meal_carbs    CHECK (carbohydrates >= 0),
    INDEX idx_meal_type (meal_type)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. MEAL_RECORD  (associative table: patient  M:N  meal)
-- ---------------------------------------------------------------------
CREATE TABLE meal_record (
    meal_record_id  INT          NOT NULL AUTO_INCREMENT,
    patient_id      INT          NOT NULL,
    meal_id         INT          NOT NULL,
    meal_date       DATE         NOT NULL DEFAULT (CURRENT_DATE),
    status          VARCHAR(20)  NOT NULL DEFAULT 'Consumed',
    CONSTRAINT pk_meal_record PRIMARY KEY (meal_record_id),
    CONSTRAINT fk_mealrec_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_mealrec_meal FOREIGN KEY (meal_id)
        REFERENCES meal(meal_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_meal_status CHECK (status IN ('Consumed','Skipped','Planned')),
    INDEX idx_mealrec_patient_date (patient_id, meal_date),
    INDEX idx_mealrec_meal (meal_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. ACTIVITY  (master / catalogue table)
-- ---------------------------------------------------------------------
CREATE TABLE activity (
    activity_id           INT           NOT NULL AUTO_INCREMENT,
    activity_name         VARCHAR(100)  NOT NULL,
    activity_type         VARCHAR(30)   NOT NULL,
    recommended_duration  INT           NOT NULL COMMENT 'minutes',
    description           TEXT          NULL,
    CONSTRAINT pk_activity       PRIMARY KEY (activity_id),
    CONSTRAINT uq_activity_name  UNIQUE (activity_name),
    CONSTRAINT chk_activity_type CHECK (activity_type IN ('Aerobic','Strength','Flexibility','Balance','Sports')),
    CONSTRAINT chk_activity_duration CHECK (recommended_duration > 0),
    INDEX idx_activity_type (activity_type)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. ACTIVITY_RECORD  (associative table: patient  M:N  activity)
-- ---------------------------------------------------------------------
CREATE TABLE activity_record (
    activity_record_id  INT   NOT NULL AUTO_INCREMENT,
    patient_id          INT   NOT NULL,
    activity_id         INT   NOT NULL,
    duration            INT   NOT NULL COMMENT 'minutes',
    steps               INT   NOT NULL DEFAULT 0,
    activity_date       DATE  NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT pk_activity_record PRIMARY KEY (activity_record_id),
    CONSTRAINT fk_actrec_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_actrec_activity FOREIGN KEY (activity_id)
        REFERENCES activity(activity_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_actrec_duration CHECK (duration > 0),
    CONSTRAINT chk_actrec_steps    CHECK (steps >= 0),
    INDEX idx_actrec_patient_date (patient_id, activity_date),
    INDEX idx_actrec_activity (activity_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. PREDICTION  (basic rule-based risk classification – academic only)
-- ---------------------------------------------------------------------
CREATE TABLE prediction (
    prediction_id    INT          NOT NULL AUTO_INCREMENT,
    patient_id       INT          NOT NULL,
    risk_level       VARCHAR(15)  NOT NULL,
    risk_score       INT          NOT NULL,
    remarks          TEXT         NULL,
    prediction_date  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_prediction PRIMARY KEY (prediction_id),
    CONSTRAINT fk_pred_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_risk_level CHECK (risk_level IN ('Low Risk','Moderate Risk','High Risk')),
    CONSTRAINT chk_risk_score CHECK (risk_score BETWEEN 0 AND 100),
    INDEX idx_pred_patient_date (patient_id, prediction_date),
    INDEX idx_pred_risk (risk_level)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. RECOMMENDATION  (1 patient : N recommendations)
-- ---------------------------------------------------------------------
CREATE TABLE recommendation (
    recommendation_id    INT          NOT NULL AUTO_INCREMENT,
    patient_id           INT          NOT NULL,
    recommendation_type  VARCHAR(20)  NOT NULL,
    recommendation_text  TEXT         NOT NULL,
    recommendation_date  DATE         NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT pk_recommendation PRIMARY KEY (recommendation_id),
    CONSTRAINT fk_reco_patient FOREIGN KEY (patient_id)
        REFERENCES patient(patient_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_recommendation_type CHECK (recommendation_type IN ('Meal','Activity','General')),
    INDEX idx_reco_patient_type (patient_id, recommendation_type)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Optional: trigger keeping the derived BMI consistent (MySQL syntax)
-- ---------------------------------------------------------------------
DELIMITER $$
CREATE TRIGGER trg_patient_bmi_ins BEFORE INSERT ON patient
FOR EACH ROW BEGIN
    SET NEW.bmi = ROUND(NEW.weight / POWER(NEW.height / 100, 2), 2);
END$$
CREATE TRIGGER trg_patient_bmi_upd BEFORE UPDATE ON patient
FOR EACH ROW BEGIN
    SET NEW.bmi = ROUND(NEW.weight / POWER(NEW.height / 100, 2), 2);
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Useful view: latest health snapshot per patient
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_patient_latest AS
SELECT p.patient_id, p.name, p.age, p.gender, p.bmi,
       (SELECT b.glucose_level FROM blood_sugar_record b WHERE b.patient_id = p.patient_id ORDER BY b.record_date DESC LIMIT 1) AS latest_glucose,
       (SELECT l.hba1c FROM lab_report l WHERE l.patient_id = p.patient_id ORDER BY l.report_date DESC LIMIT 1)            AS latest_hba1c,
       (SELECT pr.risk_level FROM prediction pr WHERE pr.patient_id = p.patient_id ORDER BY pr.prediction_date DESC LIMIT 1) AS latest_risk
FROM patient p;
