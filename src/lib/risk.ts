/**
 * Basic, rule-based diabetes risk classification.
 * ACADEMIC DEMONSTRATION ONLY – this is NOT a medical diagnosis.
 *
 * The score is computed purely from values already stored in the database
 * (patient, blood_sugar_record, lab_report, activity_record) and the result is
 * persisted in the `prediction` table so historical predictions can be queried.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type RiskLevel = "Low Risk" | "Moderate Risk" | "High Risk";

export interface RiskFactor {
  factor: string;
  value: string;
  points: number;
  note: string;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  remarks: string;
  inputs: {
    age: number;
    bmi: number;
    avgFastingGlucose: number | null;
    latestHba1c: number | null;
    weeklyActivityMinutes: number;
    hasHypertensionHistory: boolean;
  };
}

interface Row extends Record<string, unknown> {
  age: number;
  bmi: string;
  avg_fasting: string | null;
  latest_hba1c: string | null;
  weekly_minutes: string | null;
  cond_flag: number | null;
}

export async function assessPatientRisk(patientId: number): Promise<RiskAssessment | null> {
  // One SQL statement gathering every input via correlated sub-queries.
  const result = await db.execute<Row>(sql`
    SELECT p.age,
           p.bmi,
           (SELECT AVG(b.glucose_level) FROM blood_sugar_record b
              WHERE b.patient_id = p.patient_id
                AND b.measurement_type = 'Fasting'
                AND b.record_date >= NOW() - INTERVAL '30 days')          AS avg_fasting,
           (SELECT l.hba1c FROM lab_report l
              WHERE l.patient_id = p.patient_id
              ORDER BY l.report_date DESC, l.lab_id DESC LIMIT 1)          AS latest_hba1c,
           (SELECT SUM(a.duration) / 4.0 FROM activity_record a
              WHERE a.patient_id = p.patient_id
                AND a.activity_date >= CURRENT_DATE - INTERVAL '28 days')  AS weekly_minutes,
           (SELECT COUNT(*) FROM medical_record m
              WHERE m.patient_id = p.patient_id
                AND (m.existing_conditions ILIKE '%hypertension%'
                     OR m.medical_history ILIKE '%hypertension%'))       AS cond_flag
    FROM patient p
    WHERE p.patient_id = ${patientId}
  `);
  const row = result.rows[0];
  if (!row) return null;

  const age = Number(row.age);
  const bmi = Number(row.bmi);
  const avgFasting = row.avg_fasting === null ? null : Number(row.avg_fasting);
  const hba1c = row.latest_hba1c === null ? null : Number(row.latest_hba1c);
  const weekly = row.weekly_minutes === null ? 0 : Math.round(Number(row.weekly_minutes));
  const hyper = Number(row.cond_flag ?? 0) > 0;

  const factors: RiskFactor[] = [];

  // Fasting glucose (max 35)
  if (avgFasting === null) {
    factors.push({ factor: "Avg fasting glucose (30d)", value: "no data", points: 10, note: "No fasting readings – uncertainty penalty" });
  } else if (avgFasting < 100) {
    factors.push({ factor: "Avg fasting glucose (30d)", value: `${avgFasting.toFixed(1)} mg/dL`, points: 0, note: "Normal (< 100)" });
  } else if (avgFasting < 126) {
    factors.push({ factor: "Avg fasting glucose (30d)", value: `${avgFasting.toFixed(1)} mg/dL`, points: 20, note: "Elevated (100 – 125)" });
  } else {
    factors.push({ factor: "Avg fasting glucose (30d)", value: `${avgFasting.toFixed(1)} mg/dL`, points: 35, note: "High (≥ 126)" });
  }

  // HbA1c (max 35)
  if (hba1c === null) {
    factors.push({ factor: "Latest HbA1c", value: "no data", points: 10, note: "No lab report – uncertainty penalty" });
  } else if (hba1c < 5.7) {
    factors.push({ factor: "Latest HbA1c", value: `${hba1c.toFixed(2)} %`, points: 0, note: "Normal (< 5.7)" });
  } else if (hba1c < 6.5) {
    factors.push({ factor: "Latest HbA1c", value: `${hba1c.toFixed(2)} %`, points: 20, note: "Elevated (5.7 – 6.4)" });
  } else {
    factors.push({ factor: "Latest HbA1c", value: `${hba1c.toFixed(2)} %`, points: 35, note: "High (≥ 6.5)" });
  }

  // BMI (max 15)
  if (bmi < 25) factors.push({ factor: "BMI", value: bmi.toFixed(2), points: 0, note: "Normal (< 25)" });
  else if (bmi < 30) factors.push({ factor: "BMI", value: bmi.toFixed(2), points: 10, note: "Overweight (25 – 29.9)" });
  else factors.push({ factor: "BMI", value: bmi.toFixed(2), points: 15, note: "Obese (≥ 30)" });

  // Age (max 5)
  if (age < 45) factors.push({ factor: "Age", value: `${age} yrs`, points: 0, note: "Below 45" });
  else factors.push({ factor: "Age", value: `${age} yrs`, points: 5, note: "45 or above" });

  // Physical activity (max 5)
  if (weekly >= 150) factors.push({ factor: "Weekly activity", value: `${weekly} min`, points: 0, note: "Meets 150 min / week" });
  else if (weekly >= 75) factors.push({ factor: "Weekly activity", value: `${weekly} min`, points: 3, note: "Below recommended 150 min" });
  else factors.push({ factor: "Weekly activity", value: `${weekly} min`, points: 5, note: "Sedentary (< 75 min)" });

  // Hypertension history (max 5)
  factors.push({
    factor: "Hypertension in records",
    value: hyper ? "Yes" : "No",
    points: hyper ? 5 : 0,
    note: hyper ? "Found in medical_record" : "Not found",
  });

  const riskScore = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const riskLevel: RiskLevel = riskScore >= 60 ? "High Risk" : riskScore >= 30 ? "Moderate Risk" : "Low Risk";
  const remarks = factors
    .filter((f) => f.points > 0)
    .map((f) => `${f.factor}: ${f.value} (+${f.points})`)
    .join("; ") || "All monitored indicators within normal range";

  return {
    riskLevel,
    riskScore,
    factors,
    remarks,
    inputs: { age, bmi, avgFastingGlucose: avgFasting, latestHba1c: hba1c, weeklyActivityMinutes: weekly, hasHypertensionHistory: hyper },
  };
}

/** Builds lifestyle recommendations from the assessment (stored in `recommendation`). */
export function buildRecommendations(a: RiskAssessment): { type: "Meal" | "Activity" | "General"; text: string }[] {
  const out: { type: "Meal" | "Activity" | "General"; text: string }[] = [];
  const g = a.inputs.avgFastingGlucose;
  const h = a.inputs.latestHba1c;

  if ((g !== null && g >= 126) || (h !== null && h >= 6.5)) {
    out.push({ type: "Meal", text: "Prefer low-glycaemic meals (oats, millets, leafy vegetables, legumes); keep each meal under 45 g carbohydrates and avoid sugary drinks." });
  } else if ((g !== null && g >= 100) || (h !== null && h >= 5.7)) {
    out.push({ type: "Meal", text: "Replace refined grains with whole grains, add a salad before main meals and limit desserts to once a week." });
  } else {
    out.push({ type: "Meal", text: "Maintain a balanced plate: half vegetables, a quarter whole grains, a quarter lean protein; keep sugary snacks occasional." });
  }

  if (a.inputs.weeklyActivityMinutes < 150) {
    out.push({ type: "Activity", text: `Increase activity to at least 150 minutes per week (currently ~${a.inputs.weeklyActivityMinutes} min): brisk walking 30 min on 5 days plus 2 light strength sessions.` });
  } else {
    out.push({ type: "Activity", text: "Good activity level – keep 150+ minutes weekly and add flexibility or balance exercises such as yoga twice a week." });
  }

  if (a.inputs.bmi >= 25) {
    out.push({ type: "General", text: `BMI is ${a.inputs.bmi.toFixed(1)}; a gradual 5–7 % weight reduction through diet and activity is advisable. Record weight monthly.` });
  }
  if (a.riskLevel === "High Risk") {
    out.push({ type: "General", text: "Risk indicators are high – monitor fasting glucose daily, repeat HbA1c in 3 months and consult a physician for a proper clinical evaluation." });
  } else if (a.riskLevel === "Moderate Risk") {
    out.push({ type: "General", text: "Monitor fasting glucose at least 3 times a week, sleep 7–8 hours and repeat lab tests in 6 months." });
  } else {
    out.push({ type: "General", text: "Continue healthy habits; schedule an annual HbA1c test and keep hydration adequate." });
  }
  return out;
}
