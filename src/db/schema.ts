/**
 * Diabetes Patient Management and Lifestyle Recommendation System
 * ---------------------------------------------------------------
 * Relational schema (3NF).  One PATIENT has many:
 *   medical_record, blood_sugar_record, lab_report, meal_record,
 *   activity_record, prediction, recommendation.
 * MEAL and ACTIVITY are independent master (catalog) tables that are linked
 * to patients only through the junction/transaction tables meal_record and
 * activity_record (many-to-many resolved into two 1:N relationships).
 *
 * Constraints demonstrated: PRIMARY KEY, FOREIGN KEY (ON DELETE CASCADE /
 * RESTRICT), NOT NULL, UNIQUE, CHECK, DEFAULT and secondary INDEXes.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  date,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";

/* 1. PATIENT --------------------------------------------------------------- */
export const patient = pgTable(
  "patient",
  {
    patientId: serial("patient_id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    age: integer("age").notNull(),
    gender: varchar("gender", { length: 10 }).notNull(),
    phone: varchar("phone", { length: 15 }).notNull().unique("uq_patient_phone"),
    email: varchar("email", { length: 100 }).unique("uq_patient_email"),
    height: numeric("height", { precision: 5, scale: 2 }).notNull(), // centimetres
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull(), // kilograms
    bmi: numeric("bmi", { precision: 5, scale: 2 }).notNull(), // derived: weight / (height in m)^2
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    check("chk_patient_age", sql`${t.age} BETWEEN 1 AND 120`),
    check("chk_patient_gender", sql`${t.gender} IN ('Male', 'Female', 'Other')`),
    check("chk_patient_height", sql`${t.height} > 0`),
    check("chk_patient_weight", sql`${t.weight} > 0`),
    index("idx_patient_name").on(t.name),
  ],
);

/* 2. MEDICAL_RECORD -------------------------------------------------------- */
export const medicalRecord = pgTable(
  "medical_record",
  {
    recordId: serial("record_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    medicalHistory: text("medical_history"),
    existingConditions: varchar("existing_conditions", { length: 255 }),
    medications: varchar("medications", { length: 255 }),
    recordDate: date("record_date").notNull().defaultNow(),
  },
  (t) => [index("idx_medrec_patient_date").on(t.patientId, t.recordDate)],
);

/* 3. BLOOD_SUGAR_RECORD ---------------------------------------------------- */
export const bloodSugarRecord = pgTable(
  "blood_sugar_record",
  {
    sugarRecordId: serial("sugar_record_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    glucoseLevel: numeric("glucose_level", { precision: 5, scale: 1 }).notNull(), // mg/dL
    measurementType: varchar("measurement_type", { length: 20 }).notNull(),
    recordDate: timestamp("record_date").notNull().defaultNow(),
  },
  (t) => [
    check("chk_glucose_range", sql`${t.glucoseLevel} BETWEEN 20 AND 600`),
    check(
      "chk_measurement_type",
      sql`${t.measurementType} IN ('Fasting', 'Post-Meal', 'Random', 'Bedtime')`,
    ),
    index("idx_sugar_patient_date").on(t.patientId, t.recordDate),
    index("idx_sugar_level").on(t.glucoseLevel),
  ],
);

/* 4. LAB_REPORT ------------------------------------------------------------ */
export const labReport = pgTable(
  "lab_report",
  {
    labId: serial("lab_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    hba1c: numeric("hba1c", { precision: 4, scale: 2 }).notNull(), // percentage
    // blood pressure stored atomically (1NF) as systolic / diastolic
    bpSystolic: integer("bp_systolic").notNull(),
    bpDiastolic: integer("bp_diastolic").notNull(),
    reportDate: date("report_date").notNull().defaultNow(),
  },
  (t) => [
    check("chk_hba1c_range", sql`${t.hba1c} BETWEEN 3 AND 20`),
    check("chk_bp_systolic", sql`${t.bpSystolic} BETWEEN 60 AND 260`),
    check("chk_bp_diastolic", sql`${t.bpDiastolic} BETWEEN 30 AND 160`),
    index("idx_lab_patient_date").on(t.patientId, t.reportDate),
  ],
);

/* 5. MEAL (master table) --------------------------------------------------- */
export const meal = pgTable(
  "meal",
  {
    mealId: serial("meal_id").primaryKey(),
    mealName: varchar("meal_name", { length: 100 }).notNull().unique("uq_meal_name"),
    mealType: varchar("meal_type", { length: 20 }).notNull(),
    calories: integer("calories").notNull(),
    carbohydrates: numeric("carbohydrates", { precision: 6, scale: 2 }).notNull(), // grams
    description: text("description"),
  },
  (t) => [
    check("chk_meal_type", sql`${t.mealType} IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')`),
    check("chk_meal_calories", sql`${t.calories} >= 0`),
    check("chk_meal_carbs", sql`${t.carbohydrates} >= 0`),
    index("idx_meal_type").on(t.mealType),
  ],
);

/* 6. MEAL_RECORD (patient <-> meal) ---------------------------------------- */
export const mealRecord = pgTable(
  "meal_record",
  {
    mealRecordId: serial("meal_record_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    mealId: integer("meal_id")
      .notNull()
      .references(() => meal.mealId, { onDelete: "restrict" }),
    mealDate: date("meal_date").notNull().defaultNow(),
    status: varchar("status", { length: 20 }).notNull().default("Consumed"),
  },
  (t) => [
    check("chk_meal_status", sql`${t.status} IN ('Consumed', 'Skipped', 'Planned')`),
    index("idx_mealrec_patient_date").on(t.patientId, t.mealDate),
    index("idx_mealrec_meal").on(t.mealId),
  ],
);

/* 7. ACTIVITY (master table) ----------------------------------------------- */
export const activity = pgTable(
  "activity",
  {
    activityId: serial("activity_id").primaryKey(),
    activityName: varchar("activity_name", { length: 100 }).notNull().unique("uq_activity_name"),
    activityType: varchar("activity_type", { length: 30 }).notNull(),
    recommendedDuration: integer("recommended_duration").notNull(), // minutes
    description: text("description"),
  },
  (t) => [
    check(
      "chk_activity_type",
      sql`${t.activityType} IN ('Aerobic', 'Strength', 'Flexibility', 'Balance', 'Sports')`,
    ),
    check("chk_activity_duration", sql`${t.recommendedDuration} > 0`),
    index("idx_activity_type").on(t.activityType),
  ],
);

/* 8. ACTIVITY_RECORD (patient <-> activity) -------------------------------- */
export const activityRecord = pgTable(
  "activity_record",
  {
    activityRecordId: serial("activity_record_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activity.activityId, { onDelete: "restrict" }),
    duration: integer("duration").notNull(), // minutes
    steps: integer("steps").notNull().default(0),
    activityDate: date("activity_date").notNull().defaultNow(),
  },
  (t) => [
    check("chk_actrec_duration", sql`${t.duration} > 0`),
    check("chk_actrec_steps", sql`${t.steps} >= 0`),
    index("idx_actrec_patient_date").on(t.patientId, t.activityDate),
    index("idx_actrec_activity").on(t.activityId),
  ],
);

/* 9. PREDICTION ------------------------------------------------------------ */
export const prediction = pgTable(
  "prediction",
  {
    predictionId: serial("prediction_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    riskLevel: varchar("risk_level", { length: 15 }).notNull(),
    riskScore: integer("risk_score").notNull(),
    remarks: text("remarks"),
    predictionDate: timestamp("prediction_date").notNull().defaultNow(),
  },
  (t) => [
    check("chk_risk_level", sql`${t.riskLevel} IN ('Low Risk', 'Moderate Risk', 'High Risk')`),
    check("chk_risk_score", sql`${t.riskScore} BETWEEN 0 AND 100`),
    index("idx_pred_patient_date").on(t.patientId, t.predictionDate),
    index("idx_pred_risk").on(t.riskLevel),
  ],
);

/* 10. RECOMMENDATION ------------------------------------------------------- */
export const recommendation = pgTable(
  "recommendation",
  {
    recommendationId: serial("recommendation_id").primaryKey(),
    patientId: integer("patient_id")
      .notNull()
      .references(() => patient.patientId, { onDelete: "cascade" }),
    recommendationType: varchar("recommendation_type", { length: 20 }).notNull(),
    recommendationText: text("recommendation_text").notNull(),
    recommendationDate: date("recommendation_date").notNull().defaultNow(),
  },
  (t) => [
    check(
      "chk_recommendation_type",
      sql`${t.recommendationType} IN ('Meal', 'Activity', 'General')`,
    ),
    index("idx_reco_patient_type").on(t.patientId, t.recommendationType),
  ],
);

/* Inferred TypeScript row types -------------------------------------------- */
export type Patient = typeof patient.$inferSelect;
export type MedicalRecord = typeof medicalRecord.$inferSelect;
export type BloodSugarRecord = typeof bloodSugarRecord.$inferSelect;
export type LabReport = typeof labReport.$inferSelect;
export type Meal = typeof meal.$inferSelect;
export type MealRecordRow = typeof mealRecord.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type ActivityRecordRow = typeof activityRecord.$inferSelect;
export type Prediction = typeof prediction.$inferSelect;
export type Recommendation = typeof recommendation.$inferSelect;
