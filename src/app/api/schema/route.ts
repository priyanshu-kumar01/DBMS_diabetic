import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ok, withDb } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/schema – live data dictionary read from the system catalog
 * (information_schema / pg_catalog) plus the MySQL DDL & sample scripts.
 */
export const GET = withDb(async () => {
  const [columns, constraints, indexes, fks] = await Promise.all([
    db.execute(sql`
      SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale,
             is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`),
    db.execute(sql`
      SELECT c.conrelid::regclass::text AS table_name, c.conname AS constraint_name,
             CASE c.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' ELSE c.contype::text END AS constraint_type,
             pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.connamespace = 'public'::regnamespace
      ORDER BY table_name, c.contype, c.conname`),
    db.execute(sql`
      SELECT tablename AS table_name, indexname AS index_name, indexdef AS definition
      FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`),
    db.execute(sql`
      SELECT tc.table_name AS child_table, kcu.column_name AS child_column,
             ccu.table_name AS parent_table, ccu.column_name AS parent_column,
             rc.delete_rule, rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY child_table, child_column`),
  ]);

  const read = async (f: string) => {
    try {
      return await readFile(path.join(process.cwd(), "database", f), "utf8");
    } catch {
      return `-- ${f} not found`;
    }
  };
  const [mysqlDdl, sampleData, queries] = await Promise.all([read("mysql_schema.sql"), read("sample_data.sql"), read("queries.sql")]);

  return ok({ columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows, foreignKeys: fks.rows, mysqlDdl, sampleData, queries });
});
