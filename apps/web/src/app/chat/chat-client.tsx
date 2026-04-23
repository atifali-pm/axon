"use client";

import { useEffect, useState } from "react";

type Msg = {
  role: "user" | "assistant";
  content: string;
  id?: string; // populated from SSE frames once the server has persisted it
  rating?: 1 | -1 | null;
};

type Template = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  useEffect(() => {
    fetch(`${API_URL}/api/agents`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d: { templates: Template[] }) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  async function rate(messageId: string, rating: 1 | -1) {
    setMessages((m) =>
      m.map((msg) => (msg.id === messageId ? { ...msg, rating } : msg)),
    );
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${messageId}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      // Roll back the optimistic update on failure.
      setMessages((m) =>
        m.map((msg) => (msg.id === messageId ? { ...msg, rating: null } : msg)),
      );
      setError((err as Error).message);
    }
  }

  async function unrate(messageId: string) {
    setMessages((m) =>
      m.map((msg) => (msg.id === messageId ? { ...msg, rating: null } : msg)),
    );
    await fetch(`${API_URL}/api/chat/messages/${messageId}/feedback`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
          templateId: templateId || undefined,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`chat failed: ${res.status} ${text.slice(0, 200)}`);
      }

      const convHeader = res.headers.get("X-Conversation-Id");
      if (convHeader) setConversationId(convHeader);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffered.indexOf("\n\n")) !== -1) {
          const frame = buffered.slice(0, idx).trim();
          buffered = buffered.slice(idx + 2);
          if (!frame.startsWith("data:")) continue;
          const payload = frame.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload) as {
              type: string;
              content?: string;
              name?: string;
              id?: string;
            };
            if (ev.type === "token" && typeof ev.content === "string") {
              setMessages((m) => {
                const last = m[m.length - 1];
                if (!last || last.role !== "assistant") return m;
                return [
                  ...m.slice(0, -1),
                  { ...last, content: last.content + ev.content },
                ];
              });
            } else if (ev.type === "tool_start" && ev.name) {
              setMessages((m) => {
                const last = m[m.length - 1];
                if (!last || last.role !== "assistant") return m;
                return [
                  ...m.slice(0, -1),
                  { ...last, content: last.content + `\n> calling tool: ${ev.name}\n` },
                ];
              });
            } else if (ev.type === "user_message" && ev.id) {
              const id = ev.id;
              setMessages((m) => {
                // Attach id to the most recent user message that doesn't have one yet.
                for (let i = m.length - 1; i >= 0; i--) {
                  const x = m[i];
                  if (x && x.role === "user" && !x.id) {
                    const copy = [...m];
                    copy[i] = { ...x, id };
                    return copy;
                  }
                }
                return m;
              });
            } else if (ev.type === "assistant_message" && ev.id) {
              const id = ev.id;
              setMessages((m) => {
                const last = m[m.length - 1];
                if (!last || last.role !== "assistant") return m;
                return [...m.slice(0, -1), { ...last, id }];
              });
            }
          } catch {
            // ignore malformed frames
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onNewChat() {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }

  const activeTemplate = templates.find((t) => t.id === templateId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Chat</h1>
        <div className="flex items-center gap-2">
          <select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              setMessages([]);
              setConversationId(null);
              setError(null);
            }}
            disabled={loading}
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
          >
            <option value="">Default agent</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <a
            href="/agents"
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Agents
          </a>
          <button
            onClick={onNewChat}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            New chat
          </button>
        </div>
      </div>

      {activeTemplate?.description && (
        <p className="rounded border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-400">
          Using <span className="text-neutral-200">{activeTemplate.name}</span>:{" "}
          {activeTemplate.description}
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 min-h-[60vh]">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            {templateId
              ? `Ready with ${activeTemplate?.name ?? "your template"}. Ask anything.`
              : "Try: \"What can you help me with?\" or \"Summarize the latest uploaded doc\"."}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                m.role === "user"
                  ? "inline-block max-w-[80%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
                  : "inline-block max-w-[80%] whitespace-pre-wrap rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-100"
              }
            >
              {m.content || (loading && i === messages.length - 1 ? "…" : "")}
            </div>
            {m.role === "assistant" && m.id && m.content && (
              <div className="mt-1 flex gap-1 text-left">
                <button
                  onClick={() => (m.rating === 1 ? unrate(m.id!) : rate(m.id!, 1))}
                  aria-label="thumbs up"
                  className={
                    m.rating === 1
                      ? "rounded border border-emerald-700 bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300"
                      : "rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
                  }
                >
                  👍
                </button>
                <button
                  onClick={() => (m.rating === -1 ? unrate(m.id!) : rate(m.id!, -1))}
                  aria-label="thumbs down"
                  className={
                    m.rating === -1
                      ? "rounded border border-red-800 bg-red-900/40 px-2 py-0.5 text-xs text-red-300"
                      : "rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800"
                  }
                >
                  👎
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          disabled={loading}
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
        >
          {loading ? "…" : "Send"}
        </button>
      </form>

      <p className="text-xs text-neutral-600">
        SSE streaming · Postgres RLS via <code>withOrg</code> · templates load per-run ·
        thumbs-up/down captured for fine-tune training (JSONL export at{" "}
        <a
          href={`${API_URL}/api/chat/feedback/export`}
          className="underline hover:text-neutral-400"
          target="_blank"
          rel="noreferrer"
        >
          /api/chat/feedback/export
        </a>
        ).
      </p>
    </div>
  );
}
