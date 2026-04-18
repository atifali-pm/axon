"use client";

import { useEffect, useState } from "react";

type Doc = {
  id: string;
  title: string;
  source: string | null;
  chunkCount: number;
  createdAt: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function DocumentsClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function refresh() {
    const res = await fetch(`${API}/api/documents`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { documents: Doc[] };
      setDocs(data.documents);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API}/api/documents/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`upload failed: ${res.status} ${t.slice(0, 200)}`);
      }
      setFile(null);
      (document.getElementById("file-input") as HTMLInputElement | null)!.value = "";
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documents</h1>
        <a
          href="/chat"
          className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
        >
          Chat
        </a>
      </div>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold">Upload</h2>
        <form onSubmit={onUpload} className="flex gap-2">
          <input
            id="file-input"
            type="file"
            accept=".pdf,.docx,.txt,.md,.html,.htm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <p className="text-xs text-neutral-500">
          PDF, DOCX, TXT, MD, or HTML up to 50 MB. The file is extracted, chunked, embedded
          (Ollama nomic-embed-text), and indexed into pgvector. Scoped to your active org by
          RLS.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-semibold">Your documents ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-neutral-400">No documents yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded border border-neutral-800 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(d.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={
                    d.chunkCount > 0
                      ? "rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300"
                      : "rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-300"
                  }
                >
                  {d.chunkCount > 0 ? `${d.chunkCount} chunks` : "indexing..."}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
