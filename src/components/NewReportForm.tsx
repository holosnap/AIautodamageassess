"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

const MIN_IMAGES = 2;
const MAX_IMAGES = 6;

export function NewReportForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [dateOfIncident, setDateOfIncident] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).slice(0, MAX_IMAGES);
    setFiles(selected);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      setError(`Please select between ${MIN_IMAGES} and ${MAX_IMAGES} photos.`);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);
      if (make) formData.append("make", make);
      if (model) formData.append("model", model);
      if (year) formData.append("year", year);
      if (claimNumber) formData.append("claimNumber", claimNumber);
      if (dateOfIncident) formData.append("dateOfIncident", dateOfIncident);

      const response = await fetch("/api/reports", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate report");
      }

      router.push(`/dashboard/reports/${data.reportId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Photos ({MIN_IMAGES}–{MAX_IMAGES})
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFilesChange}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        {files.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {files.map((file, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${file.name}-${i}`}
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-20 w-full rounded-md border border-slate-200 object-cover"
              />
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500">{files.length} of {MAX_IMAGES} selected</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Make (optional)</label>
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Toyota"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Model (optional)</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Camry"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Year (optional)</label>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            type="number"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="2020"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Claim number (optional)</label>
          <input
            value={claimNumber}
            onChange={(e) => setClaimNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="CLM-00123"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700">Date of incident (optional)</label>
          <input
            value={dateOfIncident}
            onChange={(e) => setDateOfIncident(e.target.value)}
            type="date"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Analyzing photos… this can take up to a minute" : "Generate report"}
      </button>
    </form>
  );
}
