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


def _mcp_entrypoint(package_dir: str, package_name: str) -> str:
    """Absolute path to a built MCP server's dist/index.js. Raise if not built."""
    path = REPO_ROOT / f"packages/mcp-servers/{package_dir}/dist/index.js"
    if not path.exists():
        raise FileNotFoundError(
            f"{package_dir} not built; run `pnpm --filter {package_name} build` "
            f"(expected {path})"
        )
    return str(path)


def _server_configs(org_id: str | None) -> dict[str, Any]:
    """MCP server definitions. Each entry spawns a fresh subprocess per run.

    Scoping rules:
      - postgres-mcp gets ORG_ID so RLS fences queries to the calling tenant.
      - github-mcp inherits the agents-service-wide GITHUB_TOKEN / OWNER /
        ALLOW_WRITES; write enablement is deliberately a deploy decision, not
        a per-request one. Skip the entry entirely if GITHUB_TOKEN isn't set.
    """
    node = _node_binary()
    configs: dict[str, Any] = {}

    db_url = os.environ.get("DATABASE_URL_APP") or os.environ.get("DATABASE_URL", "")
    if db_url:
        pg_env = {"DATABASE_URL_APP": db_url, "MCP_MAX_ROWS": "50"}
        if org_id:
            pg_env["ORG_ID"] = org_id
        configs["postgres"] = {
            "command": node,
            "args": [_mcp_entrypoint("postgres-mcp", "@axon/postgres-mcp")],
            "env": pg_env,
            "transport": "stdio",
        }

    gh_token = os.environ.get("GITHUB_TOKEN", "").strip()
    if gh_token:
        gh_env = {
            "GITHUB_TOKEN": gh_token,
            "GITHUB_ALLOW_WRITES": os.environ.get("GITHUB_ALLOW_WRITES", "false"),
            "MCP_MAX_RESULTS": "50",
        }
        owner = os.environ.get("GITHUB_OWNER", "").strip()
        if owner:
            gh_env["GITHUB_OWNER"] = owner
        configs["github"] = {
            "command": node,
            "args": [_mcp_entrypoint("github-mcp", "@axon/github-mcp")],
            "env": gh_env,
            "transport": "stdio",
        }

    return configs


async def load_mcp_tools(org_id: str | None) -> list[BaseTool]:
    """Spawn MCP servers scoped to this org, return their tools as LangChain
    BaseTool instances. Returns an empty list if no MCP servers are configured.
    """
    configs = _server_configs(org_id)
    if not configs:
        return []
    client = MultiServerMCPClient(configs)
    tools = await client.get_tools()
    return tools
