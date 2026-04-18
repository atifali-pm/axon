/**
 * Embeddings client. Defaults to a local Ollama server running
 * `nomic-embed-text` (768 dimensions; matches the `chunks.embedding` column
 * in Drizzle schema). Batched to keep request count down on large documents.
 */
const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";

type OllamaEmbedResponse = { embedding: number[] };

async function embedOne(text: string, signal?: AbortSignal): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ollama ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as OllamaEmbedResponse;
  if (!Array.isArray(data.embedding)) {
    throw new Error("ollama returned no embedding");
  }
  return data.embedding;
}

export async function generateEmbeddings(
  texts: string[],
  opts: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<number[][]> {
  const concurrency = opts.concurrency ?? 4;
  const out: number[][] = new Array(texts.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= texts.length) return;
      out[i] = await embedOne(texts[i]!, opts.signal);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
  return out;
}
