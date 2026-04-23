"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AgentTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  allowedTools: string[];
  allowedProviders: string[];
  samplePrompts: string[];
  isPublic: boolean;
  forkCount: number;
  createdAt: string;
  forkedFromId?: string | null;
};

type PublicTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  samplePrompts: string[];
  forkCount: number;
  createdAt: string;
  organizationName: string;
};

type Tab = "mine" | "browse";

export function AgentsClient() {
  const [tab, setTab] = useState<Tab>("mine");
  const [mine, setMine] = useState<AgentTemplate[]>([]);
  const [browse, setBrowse] = useState<PublicTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [forking, setForking] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    const r = await fetch(`${API}/api/agents`, { credentials: "include" });
    if (r.ok) {
      const d = (await r.json()) as { templates: AgentTemplate[] };
      setMine(d.templates);
    }
  }, []);

  const loadBrowse = useCallback(async () => {
    const r = await fetch(`${API}/api/agents/public`, { credentials: "include" });
    if (r.ok) {
      const d = (await r.json()) as { templates: PublicTemplate[] };
      setBrowse(d.templates);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadMine(), loadBrowse()])
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [loadMine, loadBrowse]);

  async function fork(id: string) {
    setError(null);
    setForking(id);
    try {
      const r = await fetch(`${API}/api/agents/${id}/fork`, {
        method: "POST",
        credentials: "include",
      });
      if (r.status === 401) {
        window.location.href = "/login?next=/agents";
        return;
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t.slice(0, 300));
      }
      await Promise.all([loadMine(), loadBrowse()]);
      setTab("mine");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setForking(null);
    }
  }

  async function togglePublic(t: AgentTemplate) {
    setError(null);
    const r = await fetch(`${API}/api/agents/${t.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !t.isPublic }),
    });
    if (!r.ok) {
      setError(`toggle failed: ${r.status}`);
      return;
    }
    await loadMine();
    await loadBrowse();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this template?")) return;
    const r = await fetch(`${API}/api/agents/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      setError(`delete failed: ${r.status}`);
      return;
    }
    await loadMine();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-sm text-neutral-400">
            Templates bundle a system prompt, a tool set, and an LLM allowlist. Share publicly or fork from the marketplace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800">
            Dashboard
          </a>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-neutral-200"
          >
            New template
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-800">
        <button
          onClick={() => setTab("mine")}
          className={
            tab === "mine"
              ? "px-4 py-2 text-sm border-b-2 border-white -mb-px"
              : "px-4 py-2 text-sm text-neutral-500 hover:text-neutral-300"
          }
        >
          Mine ({mine.length})
        </button>
        <button
          onClick={() => setTab("browse")}
          className={
            tab === "browse"
              ? "px-4 py-2 text-sm border-b-2 border-white -mb-px"
              : "px-4 py-2 text-sm text-neutral-500 hover:text-neutral-300"
          }
        >
          Browse ({browse.length})
        </button>
      </div>

      {error && (
        <p className="rounded border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : tab === "mine" ? (
        mine.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No templates yet. Click New template, or fork one from Browse.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {mine.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-neutral-500">
                      {t.slug} · {t.forkCount} forks
                      {t.forkedFromId ? " · forked" : ""}
                    </div>
                  </div>
                  <span
                    className={
                      t.isPublic
                        ? "rounded bg-emerald-900/40 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-300"
                        : "rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400"
                    }
                  >
                    {t.isPublic ? "public" : "private"}
                  </span>
                </div>
                {t.description && (
                  <div className="text-sm text-neutral-400">{t.description}</div>
                )}
                <div className="flex flex-wrap gap-1 text-xs text-neutral-500">
                  {t.allowedTools.length > 0
                    ? t.allowedTools.map((x) => (
                        <span key={x} className="rounded bg-neutral-800 px-2 py-0.5">
                          {x}
                        </span>
                      ))
                    : <span>all tools</span>}
                </div>
                <div className="mt-auto flex gap-2 pt-2">
                  <button
                    onClick={() => togglePublic(t)}
                    className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
                  >
                    {t.isPublic ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : browse.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing published yet. Publish one of your templates to seed the marketplace.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {browse.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-neutral-500">
                    by {t.organizationName} · {t.forkCount} forks
                  </div>
                </div>
              </div>
              {t.description && <div className="text-sm text-neutral-400">{t.description}</div>}
              {t.samplePrompts.length > 0 && (
                <ul className="space-y-1 text-xs text-neutral-500">
                  {t.samplePrompts.slice(0, 2).map((p, i) => (
                    <li key={i} className="truncate">• {p}</li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-2">
                <button
                  onClick={() => fork(t.id)}
                  disabled={forking === t.id}
                  className="rounded bg-white px-3 py-1 text-xs font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
                >
                  {forking === t.id ? "Forking…" : "Fork into workspace"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await loadMine();
            setTab("mine");
          }}
        />
      )}
    </div>
  );
}

type CreateModalProps = {
  onClose: () => void;
  onCreated: () => Promise<void>;
};

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assistant. Be concise and cite sources when using RAG.",
  );
  const [tools, setTools] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/agents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          systemPrompt,
          allowedTools: tools
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isPublic,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t.slice(0, 400));
      }
      await onCreated();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg space-y-3 rounded-lg border border-neutral-800 bg-neutral-950 p-6"
      >
        <h2 className="text-xl font-semibold">New agent template</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Legal research assistant)"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <textarea
          required
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          placeholder="System prompt..."
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500 font-mono"
        />
        <input
          value={tools}
          onChange={(e) => setTools(e.target.value)}
          placeholder="Allowed tools, comma-separated (blank = all)"
          className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-white"
          />
          Publish to marketplace
        </label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-white px-3 py-1 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
