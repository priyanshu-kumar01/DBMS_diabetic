"""
Basic rule-based diabetes-risk classification.
ACADEMIC DEMONSTRATION ONLY – this is NOT a medical diagnosis.

All inputs are read from the database with correlated sub-queries; the result
is stored in the `prediction` table by the /api/predictions endpoint.
"""
from __future__ import annotations

from typing import Any, Optional

from db import fetch_one


def assess_patient_risk(patient_id: int) -> Optional[dict[str, Any]]:
    row = fetch_one(
        """
        SELECT p.age, p.bmi,
               (SELECT AVG(b.glucose_level) FROM blood_sugar_record b
                 WHERE b.patient_id = p.patient_id AND b.measurement_type = 'Fasting'
                   AND b.record_date >= NOW() - INTERVAL 30 DAY)                       AS avg_fasting,
               (SELECT l.hba1c FROM lab_report l WHERE l.patient_id = p.patient_id
                 ORDER BY l.report_date DESC, l.lab_id DESC LIMIT 1)                    AS latest_hba1c,
               (SELECT SUM(a.duration) / 4.0 FROM activity_record a
                 WHERE a.patient_id = p.patient_id
                   AND a.activity_date >= CURDATE() - INTERVAL 28 DAY)                  AS weekly_minutes,
               (SELECT COUNT(*) FROM medical_record m
                 WHERE m.patient_id = p.patient_id
                   AND (m.existing_conditions LIKE %s OR m.medical_history LIKE %s))   AS cond_flag
        FROM patient p
        WHERE p.patient_id = %s
        """,
        ("%hypertension%", "%hypertension%", patient_id),
    )
    if not row:
        return None

    age = int(row["age"])
    bmi = float(row["bmi"])
    avg_fasting = None if row["avg_fasting"] is None else float(row["avg_fasting"])
    hba1c = None if row["latest_hba1c"] is None else float(row["latest_hba1c"])
    weekly = 0 if row["weekly_minutes"] is None else round(float(row["weekly_minutes"]))
    hyper = int(row["cond_flag"] or 0) > 0

    factors: list[dict[str, Any]] = []

    def add(factor: str, value: str, points: int, note: str) -> None:
        factors.append({"factor": factor, "value": value, "points": points, "note": note})

    # fasting glucose (max 35)
    if avg_fasting is None:
        add("Avg fasting glucose (30d)", "no data", 10, "No fasting readings – uncertainty penalty")
    elif avg_fasting < 100:
        add("Avg fasting glucose (30d)", f"{avg_fasting:.1f} mg/dL", 0, "Normal (< 100)")
    elif avg_fasting < 126:
        add("Avg fasting glucose (30d)", f"{avg_fasting:.1f} mg/dL", 20, "Elevated (100 – 125)")
    else:
        add("Avg fasting glucose (30d)", f"{avg_fasting:.1f} mg/dL", 35, "High (>= 126)")

    # HbA1c (max 35)
    if hba1c is None:
        add("Latest HbA1c", "no data", 10, "No lab report – uncertainty penalty")
    elif hba1c < 5.7:
        add("Latest HbA1c", f"{hba1c:.2f} %", 0, "Normal (< 5.7)")
    elif hba1c < 6.5:
        add("Latest HbA1c", f"{hba1c:.2f} %", 20, "Elevated (5.7 – 6.4)")
    else:
        add("Latest HbA1c", f"{hba1c:.2f} %", 35, "High (>= 6.5)")

    # BMI (max 15)
    if bmi < 25:
        add("BMI", f"{bmi:.2f}", 0, "Normal (< 25)")
    elif bmi < 30:
        add("BMI", f"{bmi:.2f}", 10, "Overweight (25 – 29.9)")
    else:
        add("BMI", f"{bmi:.2f}", 15, "Obese (>= 30)")

    # age (max 5)
    add("Age", f"{age} yrs", 0 if age < 45 else 5, "Below 45" if age < 45 else "45 or above")

    # activity (max 5)
    if weekly >= 150:
        add("Weekly activity", f"{weekly} min", 0, "Meets 150 min / week")
    elif weekly >= 75:
        add("Weekly activity", f"{weekly} min", 3, "Below recommended 150 min")
    else:
        add("Weekly activity", f"{weekly} min", 5, "Sedentary (< 75 min)")

    # hypertension (max 5)
    add("Hypertension in records", "Yes" if hyper else "No", 5 if hyper else 0,
        "Found in medical_record" if hyper else "Not found")

    score = min(100, sum(f["points"] for f in factors))
    level = "High Risk" if score >= 60 else "Moderate Risk" if score >= 30 else "Low Risk"
    remarks = "; ".join(f"{f['factor']}: {f['value']} (+{f['points']})" for f in factors if f["points"] > 0) \
        or "All monitored indicators within normal range"

    return {
        "riskLevel": level,
        "riskScore": score,
        "factors": factors,
        "remarks": remarks,
        "inputs": {"age": age, "bmi": bmi, "avgFastingGlucose": avg_fasting, "latestHba1c": hba1c,
                   "weeklyActivityMinutes": weekly, "hasHypertensionHistory": hyper},
    }


def build_recommendations(a: dict[str, Any]) -> list[tuple[str, str]]:
    """Lifestyle recommendations derived from the assessment (stored in `recommendation`)."""
    out: list[tuple[str, str]] = []
    g = a["inputs"]["avgFastingGlucose"]
    h = a["inputs"]["latestHba1c"]
    bmi = a["inputs"]["bmi"]
    weekly = a["inputs"]["weeklyActivityMinutes"]

    if (g is not None and g >= 126) or (h is not None and h >= 6.5):
        out.append(("Meal", "Prefer low-glycaemic meals (oats, millets, leafy vegetables, legumes); keep each meal under 45 g carbohydrates and avoid sugary drinks."))
    elif (g is not None and g >= 100) or (h is not None and h >= 5.7):
        out.append(("Meal", "Replace refined grains with whole grains, add a salad before main meals and limit desserts to once a week."))
    else:
        out.append(("Meal", "Maintain a balanced plate: half vegetables, a quarter whole grains, a quarter lean protein; keep sugary snacks occasional."))

    if weekly < 150:
        out.append(("Activity", f"Increase activity to at least 150 minutes per week (currently ~{weekly} min): brisk walking 30 min on 5 days plus 2 light strength sessions."))
    else:
        out.append(("Activity", "Good activity level – keep 150+ minutes weekly and add flexibility or balance exercises such as yoga twice a week."))

    if bmi >= 25:
        out.append(("General", f"BMI is {bmi:.1f}; a gradual 5–7 % weight reduction through diet and activity is advisable. Record weight monthly."))
    if a["riskLevel"] == "High Risk":
        out.append(("General", "Risk indicators are high – monitor fasting glucose daily, repeat HbA1c in 3 months and consult a physician for a proper clinical evaluation."))
    elif a["riskLevel"] == "Moderate Risk":
        out.append(("General", "Monitor fasting glucose at least 3 times a week, sleep 7–8 hours and repeat lab tests in 6 months."))
    else:
        out.append(("General", "Continue healthy habits; schedule an annual HbA1c test and keep hydration adequate."))
    return out
