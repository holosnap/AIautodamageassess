import "server-only";
import type { DamageAnalysis } from "@/lib/analyze";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SEVERITY_COLOR: Record<string, string> = {
  none: "#64748b",
  minor: "#16a34a",
  moderate: "#d97706",
  severe: "#dc2626",
  total_loss: "#7f1d1d",
};

export type ReportPdfInput = {
  reportId: string;
  claimNumber?: string | null;
  dateOfIncident?: Date | null;
  createdAt: Date;
  analysis: DamageAnalysis;
  /** Data URIs (data:image/jpeg;base64,...) in photo_index order. */
  photoDataUris: string[];
};

export function renderReportHtml(input: ReportPdfInput): string {
  const { analysis } = input;
  const vehicleParts = [analysis.vehicle.year, analysis.vehicle.make, analysis.vehicle.model]
    .filter((v) => v !== null && v !== undefined)
    .join(" ");
  const vehicleLabel = vehicleParts || "Unknown vehicle";
  const severityColor = SEVERITY_COLOR[analysis.overall_severity] ?? "#334155";

  const photoRows = analysis.photo_observations
    .map((obs) => {
      const photo = input.photoDataUris[obs.photo_index];
      const damageTypes = obs.damage_types.map((t) => escapeHtml(t)).join(", ") || "—";
      return `
        <div class="photo-row">
          <img src="${photo ?? ""}" alt="Photo ${obs.photo_index + 1}" />
          <div class="photo-details">
            <div class="photo-header">
              <span>Photo ${obs.photo_index + 1}</span>
              <span class="badge" style="background:${SEVERITY_COLOR[obs.severity] ?? "#334155"}">${escapeHtml(obs.severity)}</span>
            </div>
            <p>${escapeHtml(obs.description)}</p>
            <p class="damage-types">Damage: ${damageTypes}</p>
          </div>
        </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Vehicle Damage Report</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; font-size: 10.5px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 { font-size: 12px; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
  .subtitle { color: #475569; margin: 0 0 10px; font-size: 11px; }
  .disclaimer { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 8px 10px; font-size: 9.5px; color: #78350f; margin-bottom: 12px; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .meta-item { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; }
  .meta-item .label { display: block; color: #64748b; font-size: 8.5px; text-transform: uppercase; }
  .meta-item .value { font-weight: 600; font-size: 11px; }
  .badge { display: inline-block; color: white; border-radius: 999px; padding: 2px 8px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
  .severity-line { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .hidden-flag { border-radius: 6px; padding: 8px 10px; font-size: 9.5px; margin-bottom: 10px; }
  .hidden-flag.flagged { background: #fee2e2; border: 1px solid #dc2626; color: #7f1d1d; }
  .hidden-flag.clear { background: #ecfdf5; border: 1px solid #16a34a; color: #14532d; }
  .components { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
  .components span { background: #f1f5f9; border-radius: 999px; padding: 2px 8px; font-size: 9px; }
  .summary { font-size: 10.5px; line-height: 1.4; margin-bottom: 10px; }
  .photo-row { display: flex; gap: 8px; border-top: 1px solid #e2e8f0; padding: 6px 0; }
  .photo-row img { width: 70px; height: 70px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; flex-shrink: 0; }
  .photo-details { flex: 1; }
  .photo-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 10px; margin-bottom: 2px; }
  .photo-details p { margin: 2px 0; }
  .damage-types { color: #475569; font-size: 9px; }
  footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <h1>Vehicle Damage Report</h1>
  <p class="subtitle">Preliminary AI-assisted summary &mdash; ${escapeHtml(vehicleLabel)}</p>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is an AI-generated preliminary summary based solely on submitted
    photographs. It is <strong>not a certified appraisal</strong> and includes no repair cost estimate. A
    licensed appraiser or adjuster must verify all findings, including any flagged hidden or structural damage,
    before this report is used for claims or repair decisions.
  </div>

  <div class="meta-grid">
    <div class="meta-item"><span class="label">Claim Number</span><span class="value">${escapeHtml(input.claimNumber ?? "—")}</span></div>
    <div class="meta-item"><span class="label">Vehicle</span><span class="value">${escapeHtml(vehicleLabel)}</span></div>
    <div class="meta-item"><span class="label">Date of Incident</span><span class="value">${input.dateOfIncident ? escapeHtml(input.dateOfIncident.toISOString().slice(0, 10)) : "—"}</span></div>
    <div class="meta-item"><span class="label">Report Generated</span><span class="value">${escapeHtml(input.createdAt.toISOString().slice(0, 10))}</span></div>
  </div>

  <div class="severity-line">
    <span class="badge" style="background:${severityColor}">${escapeHtml(analysis.overall_severity.replace("_", " "))}</span>
    <span>Overall severity</span>
  </div>

  <div class="hidden-flag ${analysis.possible_hidden_or_structural_damage ? "flagged" : "clear"}">
    <strong>${analysis.possible_hidden_or_structural_damage ? "⚠ Possible hidden/structural damage flagged" : "No hidden/structural damage suspected"}:</strong>
    ${escapeHtml(analysis.hidden_damage_notes)}
  </div>

  <h2>Affected Components</h2>
  <div class="components">
    ${analysis.affected_components.length ? analysis.affected_components.map((c) => `<span>${escapeHtml(c)}</span>`).join("") : "<span>None identified</span>"}
  </div>

  <h2>Summary</h2>
  <p class="summary">${escapeHtml(analysis.summary)}</p>

  <h2>Photo-by-Photo Observations</h2>
  ${photoRows}

  <footer>
    <span>Report ID: ${escapeHtml(input.reportId)}</span>
    <span>AI-assisted preliminary summary — not a certified appraisal</span>
  </footer>
</body>
</html>`;
}
