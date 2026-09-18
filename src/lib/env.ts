import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
  /** Optional: point the S3 client at a local S3-compatible server (e.g. s3rver, MinIO, LocalStack) for local dev/testing. Leave unset to use real AWS. */
  AWS_S3_ENDPOINT: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
});

/** Validated server-only environment variables. Never import this from client code. */
export const env = envSchema.parse(process.env);
