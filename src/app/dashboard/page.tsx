import Link from "next/link";
import { getOrCreateUser } from "@/lib/auth";
import { listReportsForUser } from "@/lib/reports";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import type { DamageAnalysis } from "@/lib/analyze";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;

  const user = await getOrCreateUser();
  const reports = await listReportsForUser(user.id, q);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Your reports</h1>
        <Link
          href="/dashboard/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          New Report
        </Link>
      </div>

      <form className="mb-6" action="/dashboard" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by claim number…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </form>

      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">
          {q ? `No reports match claim number "${q}".` : "No reports yet. Create your first one."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {reports.map((report) => {
            const analysis = report.analysis as DamageAnalysis | null;
            const vehicleLabel =
              [report.year, report.make, report.model].filter(Boolean).join(" ") || "Unknown vehicle";
            return (
              <li key={report.id}>
                <Link
                  href={`/dashboard/reports/${report.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{vehicleLabel}</p>
                    <p className="text-sm text-slate-500">
                      {report.claimNumber ? `Claim ${report.claimNumber}` : "No claim number"} ·{" "}
                      {report.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis && <SeverityBadge severity={analysis.overall_severity} />}
                    <StatusBadge status={report.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
