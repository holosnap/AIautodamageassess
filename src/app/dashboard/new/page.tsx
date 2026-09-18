import { NewReportForm } from "@/components/NewReportForm";

export default function NewReportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">New damage report</h1>
      <p className="mb-8 text-sm text-slate-600">
        Upload 2–6 photos of the vehicle. Claude will analyze the damage and generate a
        preliminary summary — this is not a certified appraisal.
      </p>
      <NewReportForm />
    </div>
  );
}
