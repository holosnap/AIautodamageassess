import "server-only";
import { db } from "@/lib/db";
import type { DamageAnalysis } from "@/lib/analyze";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Every function here takes `userId` and applies it as a `where` filter at
 * the query level. Callers must never trust a report id alone — always pass
 * the current signed-in user's id so one user's rows are structurally
 * unreachable by another, regardless of what the UI does or doesn't show.
 */

export type NewReportInput = {
  userId: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  claimNumber?: string | null;
  dateOfIncident?: Date | null;
};

export async function createProcessingReport(input: NewReportInput) {
  return db.report.create({
    data: {
      userId: input.userId,
      make: input.make ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      claimNumber: input.claimNumber ?? null,
      dateOfIncident: input.dateOfIncident ?? null,
      status: "PROCESSING",
    },
  });
}

/**
 * Only ever called immediately after `createProcessingReport` returns a
 * fresh report id owned by the caller — there is no separate userId check
 * here because the id is not yet known to anyone else.
 */
export async function addReportImages(reportId: string, s3Keys: string[]) {
  await db.reportImage.createMany({
    data: s3Keys.map((s3Key, order) => ({ reportId, s3Key, order })),
  });
}

export async function markReportComplete(
  reportId: string,
  userId: string,
  analysis: DamageAnalysis,
  pdfS3Key: string,
) {
  return db.report.updateMany({
    where: { id: reportId, userId },
    data: {
      status: "COMPLETE",
      analysis: analysis as unknown as Prisma.InputJsonValue,
      pdfS3Key,
    },
  });
}

export async function markReportFailed(reportId: string, userId: string, errorMessage: string) {
  return db.report.updateMany({
    where: { id: reportId, userId },
    data: { status: "FAILED", errorMessage },
  });
}

export async function listReportsForUser(userId: string, claimNumberQuery?: string) {
  return db.report.findMany({
    where: {
      userId,
      ...(claimNumberQuery
        ? { claimNumber: { contains: claimNumberQuery, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { order: "asc" } } },
  });
}

export async function getReportForUser(reportId: string, userId: string) {
  return db.report.findFirst({
    where: { id: reportId, userId },
    include: { images: { orderBy: { order: "asc" } } },
  });
}
