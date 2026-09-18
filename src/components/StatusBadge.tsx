const STATUS_STYLES: Record<string, string> = {
  PROCESSING: "bg-amber-100 text-amber-800",
  COMPLETE: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

const SEVERITY_STYLES: Record<string, string> = {
  minor: "bg-emerald-100 text-emerald-800",
  moderate: "bg-amber-100 text-amber-800",
  severe: "bg-orange-100 text-orange-800",
  total_loss: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${SEVERITY_STYLES[severity] ?? "bg-slate-100 text-slate-700"}`}>
      {severity.replace("_", " ")}
    </span>
  );
}
