import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getReportForUser } from "@/lib/reports";
import { getSignedDownloadUrl } from "@/lib/s3";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/reports/[id]/pdf">) {
  const { id } = await context.params;
  const clerkUserId = await requireUserId();

  const user = await db.user.findUnique({ where: { clerkId: clerkUserId } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const report = await getReportForUser(id, user.id);
  if (!report || !report.pdfS3Key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(report.pdfS3Key, 60);
  return NextResponse.redirect(url);
}
