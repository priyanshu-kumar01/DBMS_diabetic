import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { prediction, recommendation } from "@/db/schema";
import { capture, fail, ok, readJson, toInt, withDb } from "@/lib/api-helpers";
import { assessPatientRisk, buildRecommendations } from "@/lib/risk";

export const dynamic = "force-dynamic";

/** GET /api/predictions?patient_id=&risk= – prediction history (JOIN patient) */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const pid = toInt(sp.get("patient_id"));
  const risk = sp.get("risk");
  const conds = [sql`1 = 1`];
  if (pid) conds.push(sql`pr.patient_id = ${pid}`);
  if (risk) conds.push(sql`pr.risk_level = ${risk}`);
  const [rows, dist] = await Promise.all([
    db.execute(sql`
      SELECT pr.prediction_id, pr.patient_id, p.name AS patient_name, p.age, p.bmi, pr.risk_level, pr.risk_score, pr.remarks, pr.prediction_date
      FROM prediction pr INNER JOIN patient p ON p.patient_id = pr.patient_id
      WHERE ${sql.join(conds, sql` AND `)}
      ORDER BY pr.prediction_date DESC, pr.prediction_id DESC LIMIT 300`),
    db.execute(sql`
      SELECT risk_level, COUNT(*) AS patient_count
      FROM prediction WHERE prediction_id IN (SELECT MAX(prediction_id) FROM prediction GROUP BY patient_id)
      GROUP BY risk_level ORDER BY patient_count DESC`),
  ]);
  return ok({ rows: rows.rows, distribution: dist.rows });
});

/**
 * POST /api/predictions { patient_id, generate_recommendations? }
 * Runs the rule-based assessment on stored data and INSERTs the result.
 */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id);
  if (!patientId) return fail("patient_id is required");
  const assessment = await assessPatientRisk(patientId);
  if (!assessment) return fail("Patient not found", 404);

  const { rows, executedSql } = await capture(
    db
      .insert(prediction)
      .values({ patientId, riskLevel: assessment.riskLevel, riskScore: assessment.riskScore, remarks: assessment.remarks })
      .returning(),
  );

  let recommendations: unknown[] = [];
  if (b.generate_recommendations) {
    const recos = buildRecommendations(assessment);
    recommendations = await db
      .insert(recommendation)
      .values(recos.map((r) => ({ patientId, recommendationType: r.type, recommendationText: r.text })))
      .returning();
  }
  return ok({ row: rows[0], assessment, recommendations, executedSql }, 201);
});
