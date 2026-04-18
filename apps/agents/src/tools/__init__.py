"""Native Python tools that always ship with the agent.

DB queries are provided by the `@axon/postgres-mcp` server via MCP (see
src/mcp_bridge.py), so we don't register a native db_query tool here.
"""

from .rag_search import rag_search
from .web_search import web_search

TOOLS = [web_search, rag_search]
