/**
 * Storage abstraction layer
 * - local  → filesystem ./storage/ (development)
 * - s3     → AWS S3 or Cloudflare R2 (production)
 *
 * Set STORAGE_PROVIDER=s3 + S3_* env vars for production.
 * Cloudflare R2: set S3_ENDPOINT to your R2 endpoint.
 */

import path from "path";
import fs from "fs/promises";
import type { S3Client as S3ClientType } from "@aws-sdk/client-s3";

export interface StorageFile {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface UploadInput {
  key: string;
  content: Buffer | string;
  mimeType: string;
  metadata?: Record<string, string>;
}

// ── S3 config ──────────────────────────────────────────────────────────────────

function getS3Config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "us-east-1";
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.");
  }
  return { bucket, region, endpoint, accessKeyId, secretAccessKey };
}

let _s3Client: S3ClientType | null = null;
async function getS3Client(): Promise<S3ClientType> {
  if (_s3Client) return _s3Client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  const cfg = getS3Config();
  _s3Client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: !!cfg.endpoint,
  });
  return _s3Client;
}

// ── Local provider ─────────────────────────────────────────────────────────────

const LOCAL_BASE = path.join(process.cwd(), "storage");

async function localUpload(input: UploadInput): Promise<StorageFile> {
  const fullPath = path.join(LOCAL_BASE, input.key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const buffer = typeof input.content === "string" ? Buffer.from(input.content, "utf8") : input.content;
  await fs.writeFile(fullPath, buffer);
  return { key: input.key, url: `/api/storage/${input.key}`, size: buffer.length, mimeType: input.mimeType, uploadedAt: new Date() };
}

async function localGet(key: string): Promise<Buffer> {
  return fs.readFile(path.join(LOCAL_BASE, key));
}

async function localDelete(key: string): Promise<void> {
  await fs.unlink(path.join(LOCAL_BASE, key)).catch(() => {});
}

// ── S3 provider ────────────────────────────────────────────────────────────────

async function s3Upload(input: UploadInput): Promise<StorageFile> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const cfg = getS3Config();
  const client = await getS3Client();
  const buffer = typeof input.content === "string" ? Buffer.from(input.content, "utf8") : input.content;
  await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: input.key, Body: buffer, ContentType: input.mimeType, Metadata: input.metadata ?? {} }));
  return { key: input.key, url: s3PublicUrl(input.key), size: buffer.length, mimeType: input.mimeType, uploadedAt: new Date() };
}

async function s3Get(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const cfg = getS3Config();
  const client = await getS3Client();
  const response = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function s3Delete(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const cfg = getS3Config();
  const client = await getS3Client();
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

async function s3SignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const cfg = getS3Config();
  const client = await getS3Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), { expiresIn });
}

function s3PublicUrl(key: string): string {
  const cfg = getS3Config();
  const customDomain = process.env.S3_PUBLIC_URL;
  if (customDomain) return `${customDomain}/${key}`;
  if (cfg.endpoint) return `${cfg.endpoint}/${cfg.bucket}/${key}`;
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

const isS3 = () => (process.env.STORAGE_PROVIDER ?? "local") === "s3";

export const storage = {
  upload: (i: UploadInput) => isS3() ? s3Upload(i) : localUpload(i),
  get: (k: string) => isS3() ? s3Get(k) : localGet(k),
  delete: (k: string) => isS3() ? s3Delete(k) : localDelete(k),
  signedUrl: (k: string, exp = 3600) => isS3() ? s3SignedUrl(k, exp) : Promise.resolve(`/api/storage/${k}`),
  url: (k: string) => isS3() ? s3PublicUrl(k) : `/api/storage/${k}`,
  voucherKey: (companyId: string, voucherId: string, tipo: string, filename: string) =>
    `companies/${companyId}/vouchers/${voucherId}/${tipo.toLowerCase()}/${filename}`,
  reportKey: (companyId: string, reportId: string, filename: string) =>
    `companies/${companyId}/reports/${reportId}/${filename}`,
};
