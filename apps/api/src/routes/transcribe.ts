/**
 * Voice transcription endpoint. Mobile records audio via expo-av, uploads
 * it here; we relay to Groq's Whisper Large v3 Turbo (free tier) and
 * return the text. Kept inline (no BullMQ) because transcription is
 * interactive — the user is waiting to see their words appear.
 */
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3-turbo";
const MAX_BYTES = 20 * 1024 * 1024;

export async function transcribeRoutes(app: FastifyInstance) {
  app.post("/transcribe", { preHandler: requireAuth }, async (req, reply) => {
    if (!GROQ_KEY) {
      return reply.code(503).send({ error: "transcription_not_configured" });
    }
    if (!req.isMultipart()) {
      return reply.code(400).send({ error: "multipart_required" });
    }
    const file = await req.file({ limits: { fileSize: MAX_BYTES } });
    if (!file) return reply.code(400).send({ error: "audio_file_required" });

    const buf = await file.toBuffer();
    const fileName = file.filename || "voice.m4a";
    const mime = file.mimetype || "audio/m4a";

    // Forward to Groq. undici FormData accepts Blob; we construct one from
    // the buffer so we don't stream the client's upload into a temp file.
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), fileName);
    form.append("model", MODEL);
    form.append("response_format", "json");
    form.append("language", "en");

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
      body: form,
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return reply
        .code(502)
        .send({ error: "groq_whisper_failed", status: upstream.status, detail: text.slice(0, 400) });
    }
    try {
      const parsed = JSON.parse(text) as { text?: string };
      return { text: (parsed.text ?? "").trim(), model: MODEL };
    } catch {
      return { text: text.trim(), model: MODEL };
    }
  });
}
