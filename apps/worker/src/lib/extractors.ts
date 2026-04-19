/**
 * Text extractors for ingested documents. Each source type returns plain
 * UTF-8 text; PDFs use `pdf-parse`, DOCX uses `mammoth`, HTML strips tags,
 * TXT is passed through, URL fetches + routes to html/pdf by Content-Type.
 */
import { Buffer } from "node:buffer";

export type SourceType = "pdf" | "docx" | "txt" | "html" | "url";

export async function extractText(
  source: Buffer | string,
  sourceType: SourceType,
): Promise<string> {
  switch (sourceType) {
    case "pdf":
      return extractPdf(asBuffer(source));
    case "docx":
      return extractDocx(asBuffer(source));
    case "html":
      return extractHtml(asString(source));
    case "txt":
      return asString(source);
    case "url":
      return extractUrl(asString(source));
    default: {
      const never: never = sourceType;
      throw new Error(`unknown sourceType: ${String(never)}`);
    }
  }
}

async function extractPdf(buf: Buffer): Promise<string> {
  const pdfModule = await import("pdf-parse");
  const pdfParse =
    (pdfModule as { default?: (b: Buffer) => Promise<{ text?: string }> }).default ??
    (pdfModule as unknown as (b: Buffer) => Promise<{ text?: string }>);
  const parsed = await pdfParse(buf);
  return (parsed.text ?? "").trim();
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return (result.value ?? "").trim();
}

function extractHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function extractUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "Axon-RAG-Ingest/0.1" },
  });
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return extractPdf(buf);
  }
  if (contentType.includes("application/vnd.openxmlformats")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return extractDocx(buf);
  }
  const body = await res.text();
  if (contentType.includes("text/html")) return extractHtml(body);
  return body.trim();
}

function asBuffer(source: Buffer | string): Buffer {
  if (Buffer.isBuffer(source)) return source;
  throw new Error("extractor expected a Buffer");
}

function asString(source: Buffer | string): string {
  if (typeof source === "string") return source;
  return source.toString("utf8");
}
