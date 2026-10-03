"""11. Admin – live data dictionary (information_schema), sample-data loader, health check."""
from fastapi import APIRouter, HTTPException

from db import DATABASE_DIR, TABLE_COUNTS_SQL, execute_script, fetch_all, fetch_one, split_statements

router = APIRouter(prefix="/api", tags=["11. Admin"])


def _read(name: str) -> str:
    path = DATABASE_DIR / name
    return path.read_text(encoding="utf-8") if path.exists() else f"-- {name} not found"


@router.get("/schema")
def schema():
    """Data dictionary read live from MySQL information_schema + the SQL scripts."""
    return {
        "columns": fetch_all("""
            SELECT c.table_name AS table_name, c.column_name AS column_name, c.column_type AS data_type,
                   c.is_nullable AS is_nullable, c.column_default AS column_default, c.column_key AS column_key,
                   c.extra AS extra, c.ordinal_position AS ordinal_position
            FROM information_schema.columns c
            WHERE c.table_schema = DATABASE()
            ORDER BY c.table_name, c.ordinal_position"""),
        "constraints": fetch_all("""
            SELECT tc.table_name AS table_name, tc.constraint_name AS constraint_name, tc.constraint_type AS constraint_type,
                   COALESCE(cc.check_clause, GROUP_CONCAT(kcu.column_name ORDER BY kcu.ordinal_position SEPARATOR ', ')) AS definition
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
                   ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name
            LEFT JOIN information_schema.check_constraints cc
                   ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
            WHERE tc.table_schema = DATABASE()
            GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, cc.check_clause
            ORDER BY tc.table_name, FIELD(tc.constraint_type, 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK'), tc.constraint_name"""),
        "indexes": fetch_all("""
            SELECT s.table_name AS table_name, s.index_name AS index_name,
                   GROUP_CONCAT(s.column_name ORDER BY s.seq_in_index SEPARATOR ', ') AS index_columns,
                   IF(MAX(s.non_unique) = 0, 'UNIQUE', 'NON-UNIQUE') AS uniqueness
            FROM information_schema.statistics s
            WHERE s.table_schema = DATABASE()
            GROUP BY s.table_name, s.index_name
            ORDER BY s.table_name, s.index_name"""),
        "foreignKeys": fetch_all("""
            SELECT kcu.table_name AS child_table, kcu.column_name AS child_column,
                   kcu.referenced_table_name AS parent_table, kcu.referenced_column_name AS parent_column,
                   rc.delete_rule AS delete_rule, rc.update_rule AS update_rule
            FROM information_schema.key_column_usage kcu
            INNER JOIN information_schema.referential_constraints rc
                    ON rc.constraint_schema = kcu.constraint_schema AND rc.constraint_name = kcu.constraint_name
            WHERE kcu.table_schema = DATABASE() AND kcu.referenced_table_name IS NOT NULL
            ORDER BY child_table, child_column"""),
        "mysqlDdl": _read("mysql_schema.sql"),
        "sampleData": _read("sample_data.sql"),
        "queries": _read("queries.sql"),
    }


@router.post("/seed")
def seed():
    """Reloads database/sample_data.sql (TRUNCATE + INSERT) through the API."""
    path = DATABASE_DIR / "sample_data.sql"
    if not path.exists():
        raise HTTPException(404, f"{path} not found")
    statements = split_statements(path.read_text(encoding="utf-8"))
    executed = execute_script(statements)
    return {"ok": True, "statements": executed, "summary": fetch_all(TABLE_COUNTS_SQL)}


@router.get("/health")
def health():
    fetch_one("SELECT 1")
    return {"ok": True}
