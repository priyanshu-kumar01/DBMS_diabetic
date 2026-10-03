/**
 * Sample data loader. Runs inside ONE transaction (atomicity): either the whole
 * dataset is loaded or nothing changes.  Equivalent SQL INSERT statements are
 * provided in database/sample_data.sql.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  patient,
  medicalRecord,
  bloodSugarRecord,
  labReport,
  meal,
  mealRecord,
  activity,
  activityRecord,
  prediction,
  recommendation,
} from "@/db/schema";
import { calcBmi } from "@/lib/api-helpers";
import { assessPatientRisk, buildRecommendations } from "@/lib/risk";

/* deterministic pseudo-random generator so every reload gives the same data */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rand = rng(20240915);
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

function daysAgo(n: number, hour = 7, minute = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

interface Profile {
  name: string; age: number; gender: string; phone: string; email: string;
  height: number; weight: number;
  fasting: number; hba1c: number; trend: number; activity: "low" | "medium" | "high";
  bp: [number, number];
  history: string; conditions: string; meds: string;
}

const PROFILES: Profile[] = [
  { name: "Ravi Kumar", age: 52, gender: "Male", phone: "9876500011", email: "ravi.kumar@example.com", height: 170, weight: 82, fasting: 135, hba1c: 7.1, trend: 0.6, activity: "low", bp: [138, 88], history: "Diagnosed with Type 2 diabetes in 2019. Family history of diabetes (father).", conditions: "Type 2 Diabetes, Hypertension", meds: "Metformin 500mg BD, Amlodipine 5mg OD" },
  { name: "Anita Sharma", age: 45, gender: "Female", phone: "9876500012", email: "anita.sharma@example.com", height: 158, weight: 70, fasting: 112, hba1c: 6.0, trend: 0, activity: "medium", bp: [126, 82], history: "Pre-diabetic range detected during annual check-up 2023.", conditions: "Pre-diabetes", meds: "None" },
  { name: "Mohammed Irfan", age: 61, gender: "Male", phone: "9876500013", email: "irfan.m@example.com", height: 172, weight: 90, fasting: 160, hba1c: 8.2, trend: 0.9, activity: "low", bp: [146, 92], history: "Long-standing Type 2 diabetes (12 years). Mild neuropathy symptoms.", conditions: "Type 2 Diabetes, Hypertension, Dyslipidemia", meds: "Metformin 1000mg BD, Glimepiride 2mg OD, Atorvastatin 10mg" },
  { name: "Priya Nair", age: 34, gender: "Female", phone: "9876500014", email: "priya.nair@example.com", height: 162, weight: 55, fasting: 88, hba1c: 5.2, trend: 0, activity: "high", bp: [112, 74], history: "No chronic illness. Routine wellness monitoring.", conditions: "None", meds: "None" },
  { name: "Suresh Reddy", age: 58, gender: "Male", phone: "9876500015", email: "suresh.reddy@example.com", height: 168, weight: 95, fasting: 148, hba1c: 7.6, trend: -0.5, activity: "low", bp: [142, 90], history: "Type 2 diabetes since 2016; obesity; started lifestyle programme last month.", conditions: "Type 2 Diabetes, Obesity", meds: "Metformin 850mg BD, Sitagliptin 100mg OD" },
  { name: "Lakshmi Iyer", age: 49, gender: "Female", phone: "9876500016", email: "lakshmi.iyer@example.com", height: 155, weight: 68, fasting: 118, hba1c: 6.2, trend: 0.4, activity: "medium", bp: [130, 84], history: "Gestational diabetes history (2005). Elevated fasting glucose recently.", conditions: "Pre-diabetes, Hypothyroidism", meds: "Levothyroxine 50mcg OD" },
  { name: "Arjun Mehta", age: 29, gender: "Male", phone: "9876500017", email: "arjun.mehta@example.com", height: 178, weight: 72, fasting: 92, hba1c: 5.4, trend: 0, activity: "high", bp: [118, 76], history: "Healthy adult; family history of diabetes (mother).", conditions: "None", meds: "None" },
  { name: "Fatima Begum", age: 66, gender: "Female", phone: "9876500018", email: "fatima.b@example.com", height: 150, weight: 74, fasting: 140, hba1c: 7.0, trend: 0.1, activity: "low", bp: [150, 94], history: "Type 2 diabetes for 8 years, knee osteoarthritis limits mobility.", conditions: "Type 2 Diabetes, Hypertension, Osteoarthritis", meds: "Metformin 500mg BD, Telmisartan 40mg OD" },
  { name: "Deepak Verma", age: 41, gender: "Male", phone: "9876500019", email: "deepak.verma@example.com", height: 175, weight: 88, fasting: 121, hba1c: 6.3, trend: 0.5, activity: "medium", bp: [132, 86], history: "Sedentary IT professional; fasting glucose rising over last year.", conditions: "Pre-diabetes, Fatty Liver", meds: "None" },
  { name: "Kavya Krishnan", age: 38, gender: "Female", phone: "9876500020", email: "kavya.k@example.com", height: 160, weight: 58, fasting: 95, hba1c: 5.5, trend: 0, activity: "high", bp: [116, 76], history: "PCOS diagnosed 2018, otherwise healthy.", conditions: "PCOS", meds: "None" },
];

const MEALS = [
  ["Oats Porridge", "Breakfast", 250, 40, "Rolled oats cooked in low-fat milk with cinnamon; high soluble fibre."],
  ["Vegetable Upma", "Breakfast", 280, 45, "Semolina with carrots, beans and peas; moderate glycaemic load."],
  ["Idli with Sambar", "Breakfast", 300, 50, "Steamed rice-lentil cakes with lentil-vegetable stew."],
  ["Egg White Omelette", "Breakfast", 180, 5, "Three egg whites with spinach and onions; very low carbohydrate."],
  ["Ragi Dosa", "Breakfast", 220, 35, "Finger-millet crepe; rich in calcium and fibre."],
  ["Brown Rice with Dal", "Lunch", 420, 65, "Whole-grain rice with yellow lentils and cucumber salad."],
  ["Chapati with Mixed Veg Curry", "Lunch", 380, 55, "Two whole-wheat chapatis with seasonal vegetables."],
  ["Grilled Chicken Salad", "Lunch", 350, 15, "Lean grilled chicken breast on greens with olive-oil dressing."],
  ["Quinoa Vegetable Bowl", "Lunch", 400, 50, "Quinoa with roasted vegetables and chickpeas."],
  ["Vegetable Khichdi", "Dinner", 350, 55, "Rice-lentil porridge with vegetables; light dinner."],
  ["Grilled Fish with Vegetables", "Dinner", 320, 12, "Grilled fish fillet with steamed broccoli and beans."],
  ["Millet Roti with Palak Paneer", "Dinner", 390, 45, "Bajra roti with spinach and cottage cheese."],
  ["Chicken Soup with Whole Wheat Bread", "Dinner", 300, 30, "Clear chicken-vegetable soup and one slice of whole-wheat bread."],
  ["Roasted Chana", "Snack", 150, 20, "Roasted chickpeas; protein-rich, low glycaemic snack."],
  ["Apple with Peanut Butter", "Snack", 200, 22, "One medium apple with a tablespoon of unsweetened peanut butter."],
  ["Greek Yogurt with Nuts", "Snack", 180, 10, "Unsweetened Greek yogurt with almonds and walnuts."],
  ["Sprouts Chaat", "Snack", 160, 22, "Moong sprouts with tomato, onion and lemon."],
] as const;

const ACTIVITIES = [
  ["Brisk Walking", "Aerobic", 30, "Walking at 5–6 km/h; the most recommended activity for glucose control."],
  ["Cycling", "Aerobic", 30, "Stationary or outdoor cycling at moderate pace."],
  ["Swimming", "Aerobic", 30, "Low-impact full-body aerobic exercise."],
  ["Yoga", "Flexibility", 40, "Asanas and breathing exercises; improves flexibility and stress levels."],
  ["Resistance Band Training", "Strength", 25, "Upper and lower body resistance exercises."],
  ["Bodyweight Squats & Lunges", "Strength", 20, "Lower-body strength circuit without equipment."],
  ["Tai Chi", "Balance", 30, "Slow controlled movements improving balance – suitable for seniors."],
  ["Badminton", "Sports", 45, "Recreational racquet sport; moderate to vigorous intensity."],
] as const;

export interface SeedSummary {
  patients: number; medicalRecords: number; glucoseReadings: number; labReports: number;
  meals: number; mealRecords: number; activities: number; activityRecords: number;
  predictions: number; recommendations: number;
}

export async function seedDatabase(): Promise<SeedSummary> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE TABLE recommendation, prediction, activity_record, meal_record,
      lab_report, blood_sugar_record, medical_record, activity, meal, patient RESTART IDENTITY CASCADE`);

    /* patients */
    const patients = await tx
      .insert(patient)
      .values(
        PROFILES.map((p) => ({
          name: p.name, age: p.age, gender: p.gender, phone: p.phone, email: p.email,
          height: p.height.toFixed(2), weight: p.weight.toFixed(2), bmi: calcBmi(p.weight, p.height).toFixed(2),
        })),
      )
      .returning({ id: patient.patientId });

    /* medical records */
    const medRows: (typeof medicalRecord.$inferInsert)[] = [];
    PROFILES.forEach((p, i) => {
      const pid = patients[i].id;
      medRows.push({ patientId: pid, medicalHistory: p.history, existingConditions: p.conditions, medications: p.meds, recordDate: iso(daysAgo(120)) });
      medRows.push({ patientId: pid, medicalHistory: "Follow-up visit. Lifestyle counselling given; advised regular glucose monitoring.", existingConditions: p.conditions, medications: p.meds, recordDate: iso(daysAgo(15)) });
      if (i % 3 === 0) {
        medRows.push({ patientId: pid, medicalHistory: "Complained of fatigue and increased thirst. Repeat labs ordered.", existingConditions: p.conditions, medications: p.meds, recordDate: iso(daysAgo(60)) });
      }
    });
    await tx.insert(medicalRecord).values(medRows);

    /* glucose readings – last 30 days */
    const sugarRows: (typeof bloodSugarRecord.$inferInsert)[] = [];
    PROFILES.forEach((p, i) => {
      const pid = patients[i].id;
      for (let d = 29; d >= 0; d--) {
        const drift = p.trend * (29 - d); // trend across the month
        const fasting = p.fasting + drift + between(-9, 9);
        sugarRows.push({ patientId: pid, glucoseLevel: fasting.toFixed(1), measurementType: "Fasting", recordDate: daysAgo(d, 7, 15 + Math.floor(rand() * 30)) });
        if (rand() < 0.6) {
          sugarRows.push({ patientId: pid, glucoseLevel: (fasting + between(35, 70)).toFixed(1), measurementType: "Post-Meal", recordDate: daysAgo(d, 14, Math.floor(rand() * 59)) });
        }
        if (rand() < 0.2) {
          sugarRows.push({ patientId: pid, glucoseLevel: (fasting + between(10, 40)).toFixed(1), measurementType: pick(["Random", "Bedtime"]), recordDate: daysAgo(d, 21, Math.floor(rand() * 59)) });
        }
      }
    });
    await tx.insert(bloodSugarRecord).values(sugarRows);

    /* lab reports – 3 per patient over 6 months */
    const labRows: (typeof labReport.$inferInsert)[] = [];
    PROFILES.forEach((p, i) => {
      const pid = patients[i].id;
      const steps = [180, 90, 7];
      steps.forEach((ago, k) => {
        const h = p.hba1c - p.trend * 0.35 * (2 - k) + between(-0.15, 0.15);
        labRows.push({
          patientId: pid,
          hba1c: Math.max(4, h).toFixed(2),
          bpSystolic: Math.round(p.bp[0] + between(-6, 6)),
          bpDiastolic: Math.round(p.bp[1] + between(-4, 4)),
          reportDate: iso(daysAgo(ago)),
        });
      });
    });
    await tx.insert(labReport).values(labRows);

    /* meal & activity catalogs */
    const mealIds = await tx
      .insert(meal)
      .values(MEALS.map((m) => ({ mealName: m[0], mealType: m[1], calories: m[2], carbohydrates: m[3].toFixed(2), description: m[4] })))
      .returning({ id: meal.mealId, type: meal.mealType });
    const actIds = await tx
      .insert(activity)
      .values(ACTIVITIES.map((a) => ({ activityName: a[0], activityType: a[1], recommendedDuration: a[2], description: a[3] })))
      .returning({ id: activity.activityId, name: activity.activityName, dur: activity.recommendedDuration });

    /* meal records – last 14 days */
    const byType = (t: string) => mealIds.filter((m) => m.type === t);
    const mealRows: (typeof mealRecord.$inferInsert)[] = [];
    PROFILES.forEach((_, i) => {
      const pid = patients[i].id;
      for (let d = 13; d >= 0; d--) {
        for (const t of ["Breakfast", "Lunch", "Dinner"]) {
          if (rand() < 0.85) {
            const r = rand();
            mealRows.push({ patientId: pid, mealId: pick(byType(t)).id, mealDate: iso(daysAgo(d)), status: r < 0.85 ? "Consumed" : r < 0.95 ? "Skipped" : "Planned" });
          }
        }
        if (rand() < 0.5) mealRows.push({ patientId: pid, mealId: pick(byType("Snack")).id, mealDate: iso(daysAgo(d)), status: "Consumed" });
      }
    });
    await tx.insert(mealRecord).values(mealRows);

    /* activity records – last 28 days */
    const actRows: (typeof activityRecord.$inferInsert)[] = [];
    PROFILES.forEach((p, i) => {
      const pid = patients[i].id;
      const prob = p.activity === "high" ? 0.8 : p.activity === "medium" ? 0.45 : 0.2;
      for (let d = 27; d >= 0; d--) {
        if (rand() < prob) {
          const a = p.age > 60 ? pick(actIds.filter((x) => ["Brisk Walking", "Tai Chi", "Yoga"].includes(x.name))) : pick(actIds);
          const dur = Math.max(10, Math.round(a.dur + between(-10, 15)));
          const steps = ["Brisk Walking", "Cycling", "Badminton"].includes(a.name) ? Math.round(dur * between(85, 115)) : Math.round(dur * between(5, 25));
          actRows.push({ patientId: pid, activityId: a.id, duration: dur, steps, activityDate: iso(daysAgo(d)) });
        }
      }
    });
    await tx.insert(activityRecord).values(actRows);

    // Predictions/recommendations are computed after COMMIT because
    // assessPatientRisk() reads through the shared pool and rows inserted in
    // this transaction are only visible inside it until it commits.
    return { patients: patients.length, medicalRecords: medRows.length, glucoseReadings: sugarRows.length, labReports: labRows.length, meals: mealIds.length, mealRecords: mealRows.length, activities: actIds.length, activityRecords: actRows.length, predictions: 0, recommendations: 0 };
  }).then(async (summary) => {
    // Second phase (after commit): store one historical + one current prediction per patient.
    const ids = await db.select({ id: patient.patientId }).from(patient);
    let predCount = 0;
    let recoCount = 0;
    for (const { id } of ids) {
      const a = await assessPatientRisk(id);
      if (!a) continue;
      const olderScore = Math.max(0, Math.min(100, a.riskScore + Math.round(between(-12, 8))));
      const olderLevel = olderScore >= 60 ? "High Risk" : olderScore >= 30 ? "Moderate Risk" : "Low Risk";
      await db.insert(prediction).values([
        { patientId: id, riskLevel: olderLevel, riskScore: olderScore, remarks: "Initial assessment at enrolment", predictionDate: daysAgo(45, 10, 0) },
        { patientId: id, riskLevel: a.riskLevel, riskScore: a.riskScore, remarks: a.remarks, predictionDate: daysAgo(1, 9, 0) },
      ]);
      predCount += 2;
      const recos = buildRecommendations(a);
      await db.insert(recommendation).values(recos.map((r) => ({ patientId: id, recommendationType: r.type, recommendationText: r.text, recommendationDate: iso(daysAgo(1)) })));
      recoCount += recos.length;
    }
    return { ...summary, predictions: predCount, recommendations: recoCount };
  });
}

/** Loads sample data automatically when the database is empty (first run). */
export async function ensureSeeded(): Promise<boolean> {
  const r = await db.execute<{ c: string }>(sql`SELECT COUNT(*) AS c FROM patient`);
  if (Number(r.rows[0]?.c ?? 0) > 0) return false;
  await seedDatabase();
  return true;
}
