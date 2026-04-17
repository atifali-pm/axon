"""Default LangGraph agent.

State machine: llm -> (tools | END). The LLM either calls tools or returns
a final answer. Tool outputs feed back into the LLM until it has enough to
answer.
"""

from __future__ import annotations

import operator
from collections.abc import AsyncIterator
from typing import Annotated, Any, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

from src.llm_router import get_llm
from src.tools import TOOLS

SYSTEM_PROMPT = (
    "You are Axon, a helpful AI assistant for an organization. "
    "You have access to tools for web search, RAG over the org's documents, "
    "and read-only database queries. Call a tool when it would produce a "
    "better answer than your prior knowledge. Be concise."
)


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    org_id: str
    conversation_id: str | None


async def _call_llm(state: AgentState) -> dict[str, Any]:
    llm = get_llm("groq").bind_tools(TOOLS)
    response = await llm.ainvoke(list(state["messages"]))
    return {"messages": [response]}


def _should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return END


def _build_graph():
    workflow = StateGraph(AgentState)
    workflow.add_node("llm", _call_llm)
    workflow.add_node("tools", ToolNode(TOOLS))
    workflow.set_entry_point("llm")
    workflow.add_conditional_edges("llm", _should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "llm")
    return workflow.compile()


_graph = _build_graph()


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


async def run_default_agent(
    *,
    message: str,
    org_id: str,
    conversation_id: str | None,
) -> dict[str, Any]:
    state = _initial_state(message, org_id, conversation_id)
    result = await _graph.ainvoke(state)
    messages = [_serialize(m) for m in result["messages"]]
    final = result["messages"][-1].content if result["messages"] else ""
    return {"content": final, "messages": messages}


async def stream_default_agent(
    *,
    message: str,
    org_id: str,
    conversation_id: str | None,
) -> AsyncIterator[dict[str, Any]]:
    state = _initial_state(message, org_id, conversation_id)
    async for event in _graph.astream_events(state, version="v2"):
        kind = event.get("event")
        # Stream token chunks from the LLM as the primary content.
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
