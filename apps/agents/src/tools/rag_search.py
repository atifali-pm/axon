"""RAG search tool (stub until Phase 5).

Phase 5 wires this to the Postgres hybrid search (pgvector + FTS) scoped to
the caller's organization via RLS.
"""

from langchain_core.tools import tool


@tool
def rag_search(query: str) -> str:
    """Search this organization's uploaded documents for passages relevant to the query.

    Args:
        query: the natural-language question to search for
    """
    return (
        f"[rag_search stub] RAG pipeline is not wired yet (Phase 5). "
        f"Query was: {query!r}. No documents indexed."
    )
