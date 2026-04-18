"""MCP bridge: spawn Axon MCP servers as subprocesses and expose their tools
to LangGraph.

Each agent run gets a fresh MCP client session so env vars like ORG_ID can
be set per-tenant. The resulting LangChain tool objects carry the MCP
transport under the hood; ToolNode calls them the same way as native Python
tools.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

REPO_ROOT = Path(__file__).resolve().parents[3]


def _node_binary() -> str:
    """Pick a Node 20+ binary. The Python subprocess doesn't inherit nvm's
    PATH, so we search nvm's versions dir explicitly. NODE_BIN env wins."""
    explicit = os.environ.get("NODE_BIN")
    if explicit and Path(explicit).exists():
        return explicit
    nvm_dir = Path(os.environ.get("NVM_DIR", str(Path.home() / ".nvm")))
    versions = nvm_dir / "versions" / "node"
    if versions.exists():
        for v in sorted(versions.iterdir(), reverse=True):
            candidate = v / "bin" / "node"
            if candidate.exists():
                try:
                    major = int(v.name.lstrip("v").split(".")[0])
                except ValueError:
                    continue
                if major >= 20:
                    return str(candidate)
    which = shutil.which("node")
    if which:
        return which
    raise RuntimeError("could not find a Node 20+ binary; set NODE_BIN")


def _postgres_mcp_entrypoint() -> str:
    """Absolute path to the built postgres-mcp dist. Build on first run."""
    path = REPO_ROOT / "packages/mcp-servers/postgres-mcp/dist/index.js"
    if not path.exists():
        raise FileNotFoundError(
            f"postgres-mcp not built; run `pnpm --filter @axon/postgres-mcp build` "
            f"(expected {path})"
        )
    return str(path)


def _server_configs(org_id: str | None) -> dict[str, Any]:
    """MCP server definitions. Each entry spawns a fresh subprocess per run."""
    db_url = os.environ.get("DATABASE_URL_APP") or os.environ.get("DATABASE_URL", "")
    pg_env = {"DATABASE_URL_APP": db_url, "MCP_MAX_ROWS": "50"}
    if org_id:
        pg_env["ORG_ID"] = org_id

    return {
        "postgres": {
            "command": _node_binary(),
            "args": [_postgres_mcp_entrypoint()],
            "env": pg_env,
            "transport": "stdio",
        },
    }


async def load_mcp_tools(org_id: str | None) -> list[BaseTool]:
    """Spawn MCP servers scoped to this org, return their tools as LangChain
    BaseTool instances.
    """
    client = MultiServerMCPClient(_server_configs(org_id))
    tools = await client.get_tools()
    return tools
