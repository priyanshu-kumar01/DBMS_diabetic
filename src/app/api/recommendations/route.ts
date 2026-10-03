import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { recommendation } from "@/db/schema";
import { capture, fail, ok, readJson, str, toInt, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/recommendations?patient_id=&type= */
export const GET = withDb(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const pid = toInt(sp.get("patient_id"));
  const type = str(sp.get("type"));
  const conds = [sql`1 = 1`];
  if (pid) conds.push(sql`r.patient_id = ${pid}`);
  if (type) conds.push(sql`r.recommendation_type = ${type}`);
  const [rows, byType] = await Promise.all([
    db.execute(sql`
      SELECT r.recommendation_id, r.patient_id, p.name AS patient_name, r.recommendation_type, r.recommendation_text, r.recommendation_date
      FROM recommendation r INNER JOIN patient p ON p.patient_id = r.patient_id
      WHERE ${sql.join(conds, sql` AND `)}
      ORDER BY r.recommendation_date DESC, r.recommendation_id DESC LIMIT 300`),
    db.execute(sql`SELECT recommendation_type, COUNT(*) AS cnt FROM recommendation GROUP BY recommendation_type ORDER BY cnt DESC`),
  ]);
  return ok({ rows: rows.rows, byType: byType.rows });
});

/** POST /api/recommendations – add a lifestyle recommendation */
export const POST = withDb(async (req: NextRequest) => {
  const b = await readJson(req);
  const patientId = toInt(b.patient_id);
  const type = str(b.recommendation_type);
  const text = str(b.recommendation_text);
  if (!patientId || !type || !text) return fail("patient_id, recommendation_type and recommendation_text are required");
  const { rows, executedSql } = await capture(
    db
      .insert(recommendation)
      .values({ patientId, recommendationType: type, recommendationText: text, recommendationDate: str(b.recommendation_date) ?? new Date().toISOString().slice(0, 10) })
      .returning(),
  );
  return ok({ row: rows[0], executedSql }, 201);
});
