"""Web search tool (stub).

Real implementation uses Brave, Tavily, or DuckDuckGo. The stub keeps the
LangGraph tool-calling loop functional without a paid key in early phases.
"""

from langchain_core.tools import tool


@tool
def web_search(query: str) -> str:
    """Search the public web and return a brief summary of the top results.

    Args:
        query: the search query
    """
    return (
        f"[web_search stub] no live search wired yet. The agent asked: {query!r}. "
        "Real implementation lands alongside Tavily/Brave integration."
    )
