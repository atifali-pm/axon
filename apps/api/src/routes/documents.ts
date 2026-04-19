import { randomUUID } from "node:crypto";
import { schema, withOrg } from "@axon/db";
import { QUEUE_NAMES, type RagIngestData } from "@axon/shared/queues";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth";
import { enqueue } from "../queues";
import { S3_BUCKET, putObject } from "../lib/storage";

const MIME_MAP: Record<string, RagIngestData["sourceType"]> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/html": "html",
  "text/markdown": "txt",
};

function inferSourceTypeFromName(name: string): RagIngestData["sourceType"] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "txt";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return null;
}

export async function documentRoutes(app: FastifyInstance) {
  // Upload a file as multipart/form-data; Phase 5 ingest path.
  app.post("/upload", { preHandler: requireAuth }, async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(400).send({ error: "multipart_required" });
    }
    const file = await req.file({ limits: { fileSize: 50 * 1024 * 1024 } });
    if (!file) return reply.code(400).send({ error: "file_required" });

    const mime = file.mimetype || "application/octet-stream";
    const sourceType =
      MIME_MAP[mime] ?? inferSourceTypeFromName(file.filename ?? "");
    if (!sourceType) {
      return reply
        .code(400)
        .send({ error: "unsupported_type", mime, filename: file.filename });
    }

    const orgId = req.organization.id;
    const key = `${orgId}/${randomUUID()}-${file.filename}`;

    const bytes = await file.toBuffer();
    await putObject(key, bytes, mime);

    const doc = await withOrg(orgId, async (tx) => {
      const rows = await tx
        .insert(schema.documents)
        .values({
          organizationId: orgId,
          title: file.filename ?? key,
          source: key,
          metadata: {
            mime,
            sourceType,
            bucket: S3_BUCKET,
            size: bytes.length,
          },
        })
        .returning();
      return rows[0];
    });
    if (!doc) throw new Error("failed to insert document");

    const jobRow = await enqueue(
      QUEUE_NAMES.ragIngest,
      "ingest",
      { documentId: doc.id, source: key, sourceType },
      orgId,
    );

    return { document: doc, jobId: jobRow.id };
  });

  // JSON ingest (URL or pasted text). Convenient for quick testing.
  app.post<{
    Body: { title: string; sourceType: "url" | "txt"; source: string };
  }>("/", { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body;
    if (!body?.title || !body.source || !body.sourceType) {
      return reply.code(400).send({ error: "title_source_sourceType_required" });
    }
    if (body.sourceType !== "url" && body.sourceType !== "txt") {
      return reply.code(400).send({ error: "use_upload_for_binary_formats" });
    }

    const orgId = req.organization.id;
    let sourceRef = body.source;

    // For pasted text, stash it in object storage so the ingest worker
    // can load it the same way it loads uploaded files.
    if (body.sourceType === "txt") {
      const key = `${orgId}/${randomUUID()}.txt`;
      await putObject(key, body.source, "text/plain");
      sourceRef = key;
    }

    const doc = await withOrg(orgId, async (tx) => {
      const rows = await tx
        .insert(schema.documents)
        .values({
          organizationId: orgId,
          title: body.title,
          source: sourceRef,
          metadata: { sourceType: body.sourceType },
        })
        .returning();
      return rows[0];
    });
    if (!doc) throw new Error("failed to insert document");

    const jobRow = await enqueue(
      QUEUE_NAMES.ragIngest,
      "ingest",
      { documentId: doc.id, source: sourceRef, sourceType: body.sourceType },
      orgId,
    );

    return { document: doc, jobId: jobRow.id };
  });

  // List documents with chunk counts.
  app.get("/", { preHandler: requireAuth }, async (req) => {
    const rows = await withOrg(req.organization.id, async (tx) => {
      const docs = await tx.query.documents.findMany({
        orderBy: [desc(schema.documents.createdAt)],
        limit: 50,
      });
      const chunkCounts = await Promise.all(
        docs.map((d) =>
          tx
            .select({ count: schema.chunks.id })
            .from(schema.chunks)
            .where(eq(schema.chunks.documentId, d.id))
            .then((rows) => rows.length),
        ),
      );
      return docs.map((d, i) => ({ ...d, chunkCount: chunkCounts[i] }));
    });
    return { documents: rows };
  });

  app.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const doc = await withOrg(req.organization.id, (tx) =>
        tx.query.documents.findFirst({
          where: and(
            eq(schema.documents.id, req.params.id),
            eq(schema.documents.organizationId, req.organization.id),
          ),
        }),
      );
      if (!doc) return reply.code(404).send({ error: "not_found" });
      return doc;
    },
  );
}
