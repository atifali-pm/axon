"""RAG search over the caller's organization documents.

Hybrid retrieval: pgvector cosine similarity (weighted 70%) + Postgres FTS
ts_rank (30%). Scoped to the org via `set_config('app.current_org_id', ...)`
inside a transaction; RLS policies on `chunks` enforce isolation even if
the tool forgets to filter on organization_id.
"""

from __future__ import annotations

import contextvars
import os

import httpx
from langchain_core.tools import tool

from src.rag_db import org_scope

current_org_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "current_org_id", default=None
)

OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
VECTOR_WEIGHT = 0.7
KEYWORD_WEIGHT = 0.3
TOP_K = 5


async def _embed(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": EMBEDDING_MODEL, "prompt": text},
        )
        res.raise_for_status()
        return res.json()["embedding"]


def _embedding_literal(vec: list[float]) -> str:
    return "[" + ",".join(format(x, ".6f") for x in vec) + "]"


async def _hybrid_search(org_id: str, query: str) -> list[dict]:
    embedding = await _embed(query)
    emb_literal = _embedding_literal(embedding)
    sql = """
    WITH vector_matches AS (
      SELECT id, content, document_id,
             1 - (embedding <=> $1::vector) AS vec_score
      FROM chunks
      ORDER BY embedding <=> $1::vector
      LIMIT 20
    ),
    keyword_matches AS (
      SELECT id, content, document_id,
             ts_rank(to_tsvector('english', content),
                     plainto_tsquery('english', $2)) AS kw_score
      FROM chunks
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $2)
      LIMIT 20
    ),
    combined AS (
      SELECT c.id, c.content, c.document_id,
             COALESCE(v.vec_score, 0) * $3 + COALESCE(k.kw_score, 0) * $4 AS score
      FROM chunks c
      LEFT JOIN vector_matches v USING (id)
      LEFT JOIN keyword_matches k USING (id)
      WHERE v.id IS NOT NULL OR k.id IS NOT NULL
    )
    SELECT combined.id::text AS chunk_id,
           combined.content,
           combined.score,
           documents.title AS document_title,
           documents.id::text AS document_id
    FROM combined
    JOIN documents ON documents.id = combined.document_id
    ORDER BY combined.score DESC
    LIMIT $5
    """
    async with org_scope(org_id) as conn:
        rows = await conn.fetch(sql, emb_literal, query, VECTOR_WEIGHT, KEYWORD_WEIGHT, TOP_K)
        return [dict(row) for row in rows]


@tool
async def rag_search(query: str) -> str:
    """Search this organization's uploaded documents for passages relevant to the query.

    Use this whenever the user's question is about internal documents, policies,
    contracts, case files, or anything they may have uploaded.

    Args:
        query: a natural-language question to search for
    """
    org_id = current_org_id.get()
    if not org_id:
        return "[rag_search error] no org context bound; agent was invoked without org scope"

    rows = await _hybrid_search(org_id, query)

    if not rows:
        return "No relevant documents found in this organization's library."

    lines = [f"Found {len(rows)} relevant passage(s):\n"]
    for i, r in enumerate(rows, 1):
        excerpt = r["content"].replace("\n", " ")[:500]
        lines.append(
            f"[{i}] {r['document_title']} (score {r['score']:.3f})\n{excerpt}\n"
        )
    lines.append(
        "\nWhen answering, cite the document title. If the passages don't contain the "
        "answer, say so rather than guessing."
    )
    return "\n".join(lines)
