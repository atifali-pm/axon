import { HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

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

let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    const { CreateBucketCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function putObject(
  key: string,
  body: Readable | Buffer | string,
  contentType: string | undefined,
): Promise<void> {
  if (!bucketReady) bucketReady = ensureBucket();
  await bucketReady;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
