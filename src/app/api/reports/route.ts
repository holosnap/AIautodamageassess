import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { addReportImages, createProcessingReport, markReportComplete, markReportFailed } from "@/lib/reports";
import { reportImageKey, reportPdfKey, uploadToS3 } from "@/lib/s3";
import { analyzeVehicleDamage } from "@/lib/analyze";
import { generateReportPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 120;

const MIN_IMAGES = 2;
const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

function extensionFor(mediaType: string): string {
  switch (mediaType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  const user = await getOrCreateUser();

  const formData = await request.formData();
  const files = formData.getAll("images").filter((v): v is File => v instanceof File);

  if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Please upload between ${MIN_IMAGES} and ${MAX_IMAGES} photos.` },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!ACCEPTED_TYPES[file.type]) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type || "unknown"}. Use JPEG, PNG, or WebP.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Each photo must be under ${MAX_IMAGE_BYTES / 1024 / 1024}MB.` }, { status: 400 });
    }
  }

  const make = optionalString(formData.get("make"));
  const model = optionalString(formData.get("model"));
  const yearRaw = optionalString(formData.get("year"));
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
  const claimNumber = optionalString(formData.get("claimNumber"));
  const dateOfIncidentRaw = optionalString(formData.get("dateOfIncident"));
  const dateOfIncident = dateOfIncidentRaw ? new Date(dateOfIncidentRaw) : null;

  const report = await createProcessingReport({
    userId: user.id,
    make,
    model,
    year: Number.isFinite(year) ? year : null,
    claimNumber,
    dateOfIncident,
  });

  try {
    const images = await Promise.all(
      files.map(async (file, index) => {
        const mediaType = ACCEPTED_TYPES[file.type];
        const buffer = Buffer.from(await file.arrayBuffer());
        const s3Key = reportImageKey(user.id, report.id, index, extensionFor(mediaType));
        await uploadToS3(s3Key, buffer, mediaType);
        return { index, s3Key, mediaType, base64: buffer.toString("base64") };
      }),
    );

    await addReportImages(
      report.id,
      images.map((i) => i.s3Key),
    );

    const analysis = await analyzeVehicleDamage(
      images.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
      { make, model, year: Number.isFinite(year) ? year : null, claimNumber, dateOfIncident },
    );

    const pdfBuffer = await generateReportPdf({
      reportId: report.id,
      claimNumber,
      dateOfIncident,
      createdAt: report.createdAt,
      analysis,
      photoDataUris: images.map((i) => `data:${i.mediaType};base64,${i.base64}`),
    });

    const pdfS3Key = reportPdfKey(user.id, report.id);
    await uploadToS3(pdfS3Key, pdfBuffer, "application/pdf");

    await markReportComplete(report.id, user.id, analysis, pdfS3Key);

    return NextResponse.json({ reportId: report.id });
  } catch (error) {
    console.error(`Report ${report.id} failed:`, error);
    const message = error instanceof Error ? error.message : "Unknown error while generating the report";
    await markReportFailed(report.id, user.id, message);
    return NextResponse.json({ error: "Failed to generate report", reportId: report.id }, { status: 500 });
  }
}
