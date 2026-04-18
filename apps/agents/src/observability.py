"""Langfuse callback bridge.

If the env triple (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST)
is configured, `langfuse_callback()` returns a CallbackHandler the agent
passes into LangGraph's config['callbacks']. Otherwise it returns None and
the agent runs with no tracing attached.

Langfuse v4 moved the handler to `langfuse.langchain.CallbackHandler`. We
support both paths so downgrading the pinned version doesn't break the
import.
"""

from __future__ import annotations

import os
import sys
from typing import Any

_handler: Any | None = None
_loaded = False


def langfuse_callback() -> Any | None:
    global _handler, _loaded
    if _loaded:
        return _handler
    _loaded = True

    public = os.environ.get("LANGFUSE_PUBLIC_KEY")
    secret = os.environ.get("LANGFUSE_SECRET_KEY")
    host = os.environ.get("LANGFUSE_HOST")
    if not (public and secret and host):
        return None

    try:
        from langfuse.langchain import CallbackHandler  # type: ignore

        _handler = CallbackHandler(public_key=public, secret_key=secret, host=host)
    except Exception:  # noqa: BLE001
        try:
            from langfuse.callback import CallbackHandler  # type: ignore

            _handler = CallbackHandler(public_key=public, secret_key=secret, host=host)
        except Exception as err:  # noqa: BLE001
            print(f"[observability] langfuse unavailable: {err}", file=sys.stderr)
            _handler = None
    return _handler
