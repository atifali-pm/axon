"""Load an agent template row for the current tenant.

The web/api layer stamps the caller's org_id on the agent run; this module
resolves a template UUID (scoped to that org) into a typed Template.
Templates are org-private or publicly forked, so the SQL filters on
organization_id to match withOrg's RLS in TypeScript land. We use the same
axon_app connection (via rag_db.org_scope) so RLS applies defensively
even if the explicit filter below were ever dropped.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from src.rag_db import org_scope


@dataclass(frozen=True)
class Template:
    id: str
    name: str
    slug: str
    system_prompt: str
    allowed_tools: list[str]
    allowed_providers: list[str]


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


async def load_template(org_id: str, template_id: str) -> Template | None:
    if not _UUID_RE.match(template_id):
        return None
    sql = """
    SELECT id::text AS id,
           name,
           slug,
           system_prompt,
           COALESCE(allowed_tools, '[]'::jsonb) AS allowed_tools,
           COALESCE(allowed_providers, '[]'::jsonb) AS allowed_providers
      FROM agent_templates
     WHERE id = $1::uuid
       AND organization_id = $2::uuid
    """
    async with org_scope(org_id) as conn:
        row = await conn.fetchrow(sql, template_id, org_id)
    if not row:
        return None

    def _as_list(v: object) -> list[str]:
        import json

        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
            except Exception:  # noqa: BLE001
                return []
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        return []

    return Template(
        id=row["id"],
        name=row["name"],
        slug=row["slug"],
        system_prompt=row["system_prompt"],
        allowed_tools=_as_list(row["allowed_tools"]),
        allowed_providers=_as_list(row["allowed_providers"]),
    )
