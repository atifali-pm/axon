/**
 * Token-aware text chunker. Uses a cheap 4-chars-per-token heuristic so we
 * can split without loading a tokenizer; the embedding model has its own
 * truncation, and this keeps chunks in a reasonable size band.
 *
 * Defaults per blueprint: 500 tokens (~2000 chars), 50 token overlap (~200 chars).
 * Chunks are cut on paragraph/sentence boundaries when possible.
 */
export type ChunkOptions = {
  size?: number;
  overlap?: number;
};

const CHARS_PER_TOKEN = 4;

export function chunkText(
  text: string,
  { size = 500, overlap = 50 }: ChunkOptions = {},
): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];

  const targetChars = size * CHARS_PER_TOKEN;
  const overlapChars = overlap * CHARS_PER_TOKEN;
  if (clean.length <= targetChars) return [clean];

  const chunks: string[] = [];
  let pos = 0;
  const step = Math.max(1, targetChars - overlapChars);

  while (pos < clean.length) {
    const end = Math.min(clean.length, pos + targetChars);
    let slice = clean.slice(pos, end);

    // Don't cut mid-paragraph/sentence if we can find a recent boundary.
    if (end < clean.length) {
      const boundary = findBoundary(slice);
      if (boundary > targetChars * 0.5) {
        slice = slice.slice(0, boundary);
      }
    }

    const trimmed = slice.trim();
    if (trimmed) chunks.push(trimmed);

    if (end >= clean.length) break;
    pos += Math.max(step, slice.length - overlapChars);
  }

  return chunks;
}

function findBoundary(s: string): number {
  const lastPara = s.lastIndexOf("\n\n");
  if (lastPara > 0) return lastPara + 2;
  const lastPeriod = s.lastIndexOf(". ");
  if (lastPeriod > 0) return lastPeriod + 2;
  const lastNewline = s.lastIndexOf("\n");
  if (lastNewline > 0) return lastNewline + 1;
  return s.length;
}

/** Rough token count for a string using the 4-char heuristic. */
export function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / CHARS_PER_TOKEN));
}
