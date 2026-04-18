import { Buffer } from "node:buffer";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET ?? "uploads";
const accessKeyId = process.env.MINIO_USER ?? "minioadmin";
const secretAccessKey = process.env.MINIO_PASSWORD ?? "minioadmin";

export const S3_BUCKET = bucket;

export const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

export async function downloadObject(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error(`s3 object ${key} has no body`);
  const chunks: Buffer[] = [];
  // @ts-expect-error Node stream typing: Body is Readable | ReadableStream
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
