"""Axon agent service.

Endpoints:
  GET  /health          health check
  POST /run             sync agent run (internal, Bearer-auth)
  POST /stream          SSE streaming run (internal, Bearer-auth)

Auth:
  All non-health endpoints require `Authorization: Bearer <AGENT_API_KEY>`.
  The API and worker services share this env var.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from src.agents.default_agent import run_default_agent, stream_default_agent  # noqa: E402

AGENT_API_KEY = os.environ.get("AGENT_API_KEY")

app = FastAPI(title="Axon Agents", version="0.0.1")


def require_internal(authorization: str = Header(...)) -> None:
    if not AGENT_API_KEY:
        raise HTTPException(500, "agents service misconfigured: AGENT_API_KEY not set")
    if authorization != f"Bearer {AGENT_API_KEY}":
        raise HTTPException(401, "unauthorized")


class RunInput(BaseModel):
    agent_id: str = Field(default="default", alias="agentId")
    message: str
    conversation_id: str | None = Field(default=None, alias="conversationId")
    org_id: str = Field(alias="orgId")

    model_config = {"populate_by_name": True}


@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "agents"}


@app.post("/run", dependencies=[Depends(require_internal)])
async def run(payload: RunInput) -> dict[str, object]:
    if payload.agent_id != "default":
        raise HTTPException(400, f"unknown agent: {payload.agent_id}")
    result = await run_default_agent(
        message=payload.message,
        org_id=payload.org_id,
        conversation_id=payload.conversation_id,
    )
    return result


@app.post("/stream", dependencies=[Depends(require_internal)])
async def stream(payload: RunInput) -> StreamingResponse:
    if payload.agent_id != "default":
        raise HTTPException(400, f"unknown agent: {payload.agent_id}")

    async def sse() -> AsyncIterator[bytes]:
        async for event in stream_default_agent(
            message=payload.message,
            org_id=payload.org_id,
            conversation_id=payload.conversation_id,
        ):
            yield f"data: {json.dumps(event)}\n\n".encode()
        yield b"data: [DONE]\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")
