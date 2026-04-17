"""DB query tool (stub).

Phase 6 wires this to the postgres-mcp server so queries run read-only and
scoped to the caller's organization via RLS.
"""

from langchain_core.tools import tool


@tool
def db_query(sql: str) -> str:
    """Run a read-only SQL query against this organization's data.

    Args:
        sql: a SELECT or WITH query
    """
    return (
        f"[db_query stub] postgres-mcp not wired yet (Phase 6). "
        f"Query was: {sql!r}. No execution."
    )
