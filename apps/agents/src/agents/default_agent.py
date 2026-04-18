"""Default LangGraph agent.

State machine: llm -> (tools | END). The LLM either calls tools or returns
a final answer. Tool outputs feed back into the LLM until it has enough to
answer. Tools are composed per-run from the native Python tools + MCP
tools spawned per-tenant.
"""

from __future__ import annotations

import operator
import sys
from collections.abc import AsyncIterator
from typing import Annotated, Any, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

from src.llm_router import get_llm
from src.mcp_bridge import load_mcp_tools
from src.tools import TOOLS
from src.tools.rag_search import current_org_id

SYSTEM_PROMPT = (
    "You are Axon, a helpful AI assistant for an organization. "
    "You have access to tools for web search, RAG over the org's documents, "
    "and read-only database queries via MCP servers. Call a tool when it "
    "would produce a better answer than your prior knowledge. Be concise. "
    "When the user asks about documents or policies, prefer rag_search. "
    "When they ask about record counts, schemas, or 'how many X are in the "
    "system', use the postgres MCP tools (list_tables, query). Always cite "
    "document titles and quote the number you return from the database."
)


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    org_id: str
    conversation_id: str | None


def _make_llm(tools):
    # Prefer openai/gpt-oss-120b on Groq for tool-calling. Groq's Llama 3.3
    # emits malformed function-call syntax (tool_use_failed 400) on
    # continuation turns in current deployments. gpt-oss handles structured
    # tool output cleanly. Fall back to Llama if gpt-oss is busy.
    primary = get_llm("groq", model="openai/gpt-oss-120b").bind_tools(tools)
    fallback = get_llm("groq", model="llama-3.3-70b-versatile").bind_tools(tools)
    return primary.with_fallbacks([fallback])


def _should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return END


def _build_graph(tools: list):
    async def call_llm(state: AgentState) -> dict[str, Any]:
        llm = _make_llm(tools)
        response = await llm.ainvoke(list(state["messages"]))
        return {"messages": [response]}

    workflow = StateGraph(AgentState)
    workflow.add_node("llm", call_llm)
    workflow.add_node("tools", ToolNode(tools))
    workflow.set_entry_point("llm")
    workflow.add_conditional_edges("llm", _should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "llm")
    return workflow.compile()


def _initial_state(
    message: str, org_id: str, conversation_id: str | None
) -> AgentState:
    return {
        "messages": [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=message),
        ],
        "org_id": org_id,
        "conversation_id": conversation_id,
    }


def _serialize(msg: BaseMessage) -> dict[str, Any]:
    base = {"role": msg.__class__.__name__, "content": msg.content}
    tool_calls = getattr(msg, "tool_calls", None)
    if tool_calls:
        base["tool_calls"] = tool_calls
    return base


async def _tools_for(org_id: str) -> list:
    mcp_tools: list = []
    try:
        mcp_tools = await load_mcp_tools(org_id)
    except Exception as err:  # noqa: BLE001
        print(f"[default_agent] mcp bridge unavailable: {err}", file=sys.stderr)
    return [*TOOLS, *mcp_tools]


async def run_default_agent(
    *,
    message: str,
    org_id: str,
    conversation_id: str | None,
) -> dict[str, Any]:
    token = current_org_id.set(org_id)
    try:
        tools = await _tools_for(org_id)
        graph = _build_graph(tools)
        state = _initial_state(message, org_id, conversation_id)
        result = await graph.ainvoke(state)
        messages = [_serialize(m) for m in result["messages"]]
        final = result["messages"][-1].content if result["messages"] else ""
        return {"content": final, "messages": messages}
    finally:
        current_org_id.reset(token)


async def stream_default_agent(
    *,
    message: str,
    org_id: str,
    conversation_id: str | None,
) -> AsyncIterator[dict[str, Any]]:
    token = current_org_id.set(org_id)
    try:
        tools = await _tools_for(org_id)
        graph = _build_graph(tools)
        state = _initial_state(message, org_id, conversation_id)
        async for event in graph.astream_events(state, version="v2"):
            kind = event.get("event")
            if kind == "on_chat_model_stream":
                data = event.get("data", {})
                chunk = data.get("chunk")
                if chunk is not None and getattr(chunk, "content", None):
                    yield {"type": "token", "content": chunk.content}
            elif kind == "on_tool_start":
                yield {
                    "type": "tool_start",
                    "name": event.get("name"),
                    "input": event.get("data", {}).get("input"),
                }
            elif kind == "on_tool_end":
                yield {
                    "type": "tool_end",
                    "name": event.get("name"),
                    "output": str(event.get("data", {}).get("output"))[:2000],
                }
    finally:
        current_org_id.reset(token)
