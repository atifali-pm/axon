"""Multi-provider LLM router with automatic fallback.

Call `get_llm("groq")` for a direct client, or `call_with_fallback(messages,
providers=...)` to try each provider in order until one succeeds.

Defaults (per blueprint):
  primary:   groq  (Llama 3.3 70B, free)
  fallback:  gemini (2.0 Flash, free)
  reasoning: openrouter (DeepSeek/Llama free models)
  premium:   anthropic, openai
  local:     ollama
"""

from __future__ import annotations

import os
from typing import Any, Callable

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

Provider = str  # groq | gemini | openrouter | anthropic | openai | ollama


def _groq(model: str | None, **kwargs: Any) -> BaseChatModel:
    return ChatGroq(
        model=model or "llama-3.3-70b-versatile",
        api_key=os.environ["GROQ_API_KEY"],
        **kwargs,
    )


def _gemini(model: str | None, **kwargs: Any) -> BaseChatModel:
    return ChatGoogleGenerativeAI(
        model=model or "gemini-2.0-flash",
        google_api_key=os.environ["GEMINI_API_KEY"],
        **kwargs,
    )


def _openrouter(model: str | None, **kwargs: Any) -> BaseChatModel:
    return ChatOpenAI(
        model=model or "deepseek/deepseek-chat",
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url="https://openrouter.ai/api/v1",
        **kwargs,
    )


def _anthropic(model: str | None, **kwargs: Any) -> BaseChatModel:
    return ChatAnthropic(
        model=model or "claude-sonnet-4-5",
        api_key=os.environ["ANTHROPIC_API_KEY"],
        **kwargs,
    )


def _openai(model: str | None, **kwargs: Any) -> BaseChatModel:
    return ChatOpenAI(
        model=model or "gpt-4o-mini",
        api_key=os.environ["OPENAI_API_KEY"],
        **kwargs,
    )


def _ollama(model: str | None, **kwargs: Any) -> BaseChatModel:
    return ChatOllama(
        model=model or "llama3.1:8b",
        base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
        **kwargs,
    )


_PROVIDERS: dict[Provider, Callable[[str | None], BaseChatModel]] = {
    "groq": _groq,
    "gemini": _gemini,
    "openrouter": _openrouter,
    "anthropic": _anthropic,
    "openai": _openai,
    "ollama": _ollama,
}


def get_llm(provider: Provider = "groq", model: str | None = None, **kwargs: Any) -> BaseChatModel:
    factory = _PROVIDERS.get(provider)
    if not factory:
        raise ValueError(f"unknown provider: {provider}")
    return factory(model, **kwargs)


DEFAULT_FALLBACK: tuple[Provider, ...] = ("groq", "gemini", "openrouter")


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, max=8), reraise=True)
async def call_with_fallback(messages: list, providers: tuple[Provider, ...] = DEFAULT_FALLBACK):
    """Try each provider in order. Returns the first successful AIMessage."""
    last_err: Exception | None = None
    for provider in providers:
        try:
            llm = get_llm(provider)
            return await llm.ainvoke(messages)
        except Exception as err:  # noqa: BLE001
            last_err = err
            continue
    assert last_err is not None
    raise last_err
