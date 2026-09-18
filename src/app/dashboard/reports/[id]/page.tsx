import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { getReportForUser } from "@/lib/reports";
import { getSignedDownloadUrl } from "@/lib/s3";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import type { DamageAnalysis } from "@/lib/analyze";

export default async function ReportDetailPage(props: PageProps<"/dashboard/reports/[id]">) {
  const { id } = await props.params;
  const user = await getOrCreateUser();
  const report = await getReportForUser(id, user.id);

  if (!report) {
    notFound();
  }

  const vehicleLabel = [report.year, report.make, report.model].filter(Boolean).join(" ") || "Unknown vehicle";
  const analysis = report.analysis as DamageAnalysis | null;

  const photoUrls =
    analysis && report.images.length > 0
      ? await Promise.all(report.images.map((image) => getSignedDownloadUrl(image.s3Key)))
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to dashboard
      </Link>

      <div className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{vehicleLabel}</h1>
          <p className="text-sm text-slate-500">
            {report.claimNumber ? `Claim ${report.claimNumber}` : "No claim number"} ·{" "}
            {report.createdAt.toLocaleString()}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {report.status === "PROCESSING" && (
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          This report is still being generated. Refresh in a moment.
        </p>
      )}

      {report.status === "FAILED" && (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          Report generation failed{report.errorMessage ? `: ${report.errorMessage}` : "."} You can try creating a
          new report.
        </p>
      )}

      {report.status === "COMPLETE" && analysis && (
        <div className="space-y-6">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            This is an AI-generated preliminary summary based on submitted photos only. It is{" "}
            <strong>not a certified appraisal</strong> and includes no repair cost estimate.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SeverityBadge severity={analysis.overall_severity} />
            <span className="text-sm text-slate-600">Overall severity</span>
            {report.pdfS3Key && (
              <a
                href={`/api/reports/${report.id}/pdf`}
                className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Download PDF
              </a>
            )}
          </div>

          <div
            className={`rounded-md border p-3 text-sm ${
              analysis.possible_hidden_or_structural_damage
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
          >
            <strong>
              {analysis.possible_hidden_or_structural_damage
                ? "⚠ Possible hidden/structural damage flagged"
                : "No hidden/structural damage suspected"}
              :
            </strong>{" "}
            {analysis.hidden_damage_notes}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Affected components
            </h2>
            <div className="flex flex-wrap gap-2">
              {analysis.affected_components.length > 0 ? (
                analysis.affected_components.map((c) => (
                  <span key={c} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">None identified</span>
              )}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Summary</h2>
            <p className="text-sm text-slate-700">{analysis.summary}</p>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Photo-by-photo observations
            </h2>
            <ul className="space-y-3">
              {analysis.photo_observations.map((obs) => (
                <li key={obs.photo_index} className="flex gap-3 rounded-md border border-slate-200 p-3">
                  {photoUrls[obs.photo_index] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrls[obs.photo_index]}
                      alt={`Photo ${obs.photo_index + 1}`}
                      className="h-20 w-20 flex-shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">Photo {obs.photo_index + 1}</span>
                      <SeverityBadge severity={obs.severity} />
                    </div>
                    <p className="text-sm text-slate-700">{obs.description}</p>
                    <p className="mt-1 text-xs text-slate-500">Damage: {obs.damage_types.join(", ") || "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
