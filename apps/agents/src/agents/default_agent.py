"""Default LangGraph agent.

State machine: llm -> (tools | END). The LLM either calls tools or returns
a final answer. Tool outputs feed back into the LLM until it has enough to
answer. Tools are composed per-run from the native Python tools + MCP
tools spawned per-tenant.

When an agent template is passed in, its system prompt replaces the built-in
default and its allowedTools/allowedProviders narrow what the graph can call.
"""

from __future__ import annotations

import operator
import sys
from collections.abc import AsyncIterator
from typing import Annotated, Any, Sequence, TypedDict

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

from src.agent_templates import Template, load_template
from src.llm_router import get_llm
from src.mcp_bridge import load_mcp_tools
from src.observability import langfuse_callback
from src.tools import TOOLS
from src.tools.rag_search import current_org_id

DEFAULT_SYSTEM_PROMPT = (
    "You are Axon, a helpful AI assistant for an organization. "
    "You have access to tools for web search, RAG over the org's documents, "
    "and read-only database queries via MCP servers. Call a tool when it "
    "would produce a better answer than your prior knowledge. Be concise. "
    "When the user asks about documents or policies, prefer rag_search. "
    "When they ask about record counts, schemas, or 'how many X are in the "
    "system', use the postgres MCP tools (list_tables, query). Always cite "
    "document titles and quote the number you return from the database."
)

# Provider order for the LLM router fallback chain. Trimmed to whichever
# subset the active template allows; an empty allowlist means all providers
# are fair game.
ROUTER_CHAIN: tuple[tuple[str, str], ...] = (
    ("groq", "openai/gpt-oss-120b"),
    ("groq", "llama-3.3-70b-versatile"),
    ("gemini", "gemini-2.0-flash"),
    ("anthropic", "claude-sonnet-4-5"),
    ("openai", "gpt-4o-mini"),
)


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    org_id: str
    conversation_id: str | None


def _filtered_providers(allowed: list[str]) -> list[tuple[str, str]]:
    if not allowed:
        return list(ROUTER_CHAIN)
    allowed_set = {p.lower() for p in allowed}
    picked = [(p, m) for (p, m) in ROUTER_CHAIN if p in allowed_set]
    return picked or list(ROUTER_CHAIN[:2])  # never leave the router empty


def _make_llm(tools: list[BaseTool], allowed_providers: list[str]) -> BaseChatModel:
    chain = _filtered_providers(allowed_providers)
    primary_provider, primary_model = chain[0]
    primary = get_llm(primary_provider, model=primary_model).bind_tools(tools)
    fallbacks: list[BaseChatModel] = []
    for provider, model in chain[1:]:
        try:
            fallbacks.append(get_llm(provider, model=model).bind_tools(tools))
        except Exception:  # noqa: BLE001
            # Missing API keys for premium providers are fine; just skip.
            continue
    return primary.with_fallbacks(fallbacks) if fallbacks else primary


def _should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return END


def _build_graph(tools: list[BaseTool], allowed_providers: list[str]):
    async def call_llm(state: AgentState) -> dict[str, Any]:
        llm = _make_llm(tools, allowed_providers)
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
    message: str,
    org_id: str,
    conversation_id: str | None,
    system_prompt: str,
) -> AgentState:
    return {
        "messages": [
            SystemMessage(content=system_prompt),
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


def _filter_tools(tools: list[BaseTool], allowed_tool_names: list[str]) -> list[BaseTool]:
    if not allowed_tool_names:
        return tools
    allowed = {n.lower() for n in allowed_tool_names}
    picked = [t for t in tools if t.name.lower() in allowed]
    if not picked:
        # Empty after filter usually means the template's list is stale;
        # fall back to the full toolbox rather than leave the model blind.
        print(
            f"[default_agent] template allowed_tools {allowed_tool_names!r} "
            f"matched no available tool; using the full toolbox as a fallback",
            file=sys.stderr,
        )
        return tools
    return picked


async def _tools_for(org_id: str) -> list[BaseTool]:
    mcp_tools: list[BaseTool] = []
    try:
        mcp_tools = await load_mcp_tools(org_id)
    except Exception as err:  # noqa: BLE001
        print(f"[default_agent] mcp bridge unavailable: {err}", file=sys.stderr)
    return [*TOOLS, *mcp_tools]


def _run_config(
    org_id: str, conversation_id: str | None, template: Template | None
) -> dict[str, Any]:
    metadata: dict[str, Any] = {"org_id": org_id, "conversation_id": conversation_id}
    tags = [f"org:{org_id}"]
    if template is not None:
        metadata["template_id"] = template.id
        metadata["template_slug"] = template.slug
        tags.append(f"template:{template.slug}")
    cfg: dict[str, Any] = {"metadata": metadata, "tags": tags}
    cb = langfuse_callback()
    if cb is not None:
        cfg["callbacks"] = [cb]
    return cfg


async def _resolve(
    org_id: str, template_id: str | None
) -> tuple[Template | None, str, list[BaseTool], list[str]]:
    template: Template | None = None
    if template_id:
        try:
            template = await load_template(org_id, template_id)
        except Exception as err:  # noqa: BLE001
            print(f"[default_agent] template load failed ({err}); using default", file=sys.stderr)

    system_prompt = template.system_prompt if template else DEFAULT_SYSTEM_PROMPT
    allowed_providers = template.allowed_providers if template else []
    allowed_tool_names = template.allowed_tools if template else []

    all_tools = await _tools_for(org_id)
    tools = _filter_tools(all_tools, allowed_tool_names)
    return template, system_prompt, tools, allowed_providers


async def run_default_agent(
    *,
    message: str,
    org_id: str,
    conversation_id: str | None,
    template_id: str | None = None,
) -> dict[str, Any]:
    token = current_org_id.set(org_id)
    try:
        template, system_prompt, tools, allowed_providers = await _resolve(org_id, template_id)
        graph = _build_graph(tools, allowed_providers)
        state = _initial_state(message, org_id, conversation_id, system_prompt)
        result = await graph.ainvoke(
            state, config=_run_config(org_id, conversation_id, template)
        )
        messages = [_serialize(m) for m in result["messages"]]
        final = result["messages"][-1].content if result["messages"] else ""
        return {
            "content": final,
            "messages": messages,
            "template": {"id": template.id, "slug": template.slug} if template else None,
        }
    finally:
        current_org_id.reset(token)


async def stream_default_agent(
    *,
    message: str,
    org_id: str,
    conversation_id: str | None,
    template_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    token = current_org_id.set(org_id)
    try:
        template, system_prompt, tools, allowed_providers = await _resolve(org_id, template_id)
        graph = _build_graph(tools, allowed_providers)
        state = _initial_state(message, org_id, conversation_id, system_prompt)
        async for event in graph.astream_events(
            state, version="v2", config=_run_config(org_id, conversation_id, template)
        ):
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
