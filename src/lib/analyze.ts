import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = "claude-opus-5";

const PhotoObservationSchema = z.object({
  photo_index: z.number().int().describe("0-based index matching the order photos were submitted"),
  description: z.string().describe("What damage, if any, is visible in this specific photo"),
  damage_types: z
    .array(z.string())
    .describe("Short tags for the kinds of damage seen, e.g. 'dent', 'scratch', 'broken glass', 'panel misalignment'"),
  severity: z.enum(["none", "minor", "moderate", "severe"]),
});

export const DamageAnalysisSchema = z.object({
  vehicle: z.object({
    make: z.string().nullable().describe("Best guess at vehicle make from the photos, or null if not confidently identifiable"),
    model: z.string().nullable().describe("Best guess at vehicle model from the photos, or null if not confidently identifiable"),
    year: z.number().int().nullable().describe("Best guess at model year, or null if not confidently identifiable"),
  }),
  overall_severity: z.enum(["minor", "moderate", "severe", "total_loss"]),
  affected_components: z
    .array(z.string())
    .describe("Vehicle components/panels showing damage, e.g. 'front bumper', 'left headlight', 'hood'"),
  possible_hidden_or_structural_damage: z
    .boolean()
    .describe("True if the visible damage pattern suggests possible frame, structural, airbag, or mechanical damage not fully visible in photos"),
  hidden_damage_notes: z
    .string()
    .describe("Explanation supporting the hidden/structural damage flag, or a brief note that none is suspected"),
  photo_observations: z.array(PhotoObservationSchema),
  summary: z.string().describe("2-4 sentence plain-language summary of overall condition"),
});

export type DamageAnalysis = z.infer<typeof DamageAnalysisSchema>;

export type ReportMetadataInput = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  claimNumber?: string | null;
  dateOfIncident?: Date | null;
};

const SYSTEM_PROMPT = `You are an assistant that produces preliminary, AI-generated vehicle damage summaries from photographs, for licensed adjusters and shop staff to use as a starting point.

Rules:
- Only describe damage you can actually observe in the photos. Do not speculate about causes of the accident.
- Never estimate or state a repair cost, dollar amount, or price range of any kind. Only classify severity and flag possible hidden/structural damage — leave all costing to a certified appraiser.
- Be conservative: if a photo is unclear or damage is ambiguous, say so rather than guessing.
- Flag possible_hidden_or_structural_damage whenever visible damage is consistent with frame damage, airbag deployment, suspension/mechanical damage, or other damage that photos alone cannot confirm.`;

/**
 * Sends the uploaded photos to Claude (vision) and returns a structured,
 * schema-validated damage analysis. Never returns dollar estimates by design
 * — the schema has no field for them and the system prompt forbids it.
 */
export async function analyzeVehicleDamage(
  images: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }[],
  metadata: ReportMetadataInput,
): Promise<DamageAnalysis> {
  const metadataLines = [
    metadata.make ? `Reported make: ${metadata.make}` : null,
    metadata.model ? `Reported model: ${metadata.model}` : null,
    metadata.year ? `Reported year: ${metadata.year}` : null,
    metadata.claimNumber ? `Claim number: ${metadata.claimNumber}` : null,
    metadata.dateOfIncident ? `Date of incident: ${metadata.dateOfIncident.toISOString().slice(0, 10)}` : null,
  ].filter(Boolean);

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((image) => ({
    type: "image",
    source: { type: "base64", media_type: image.mediaType, data: image.base64 },
  }));

  const instructionText = [
    `Analyze the ${images.length} attached photo(s) of a damaged vehicle, in the order given (photo_index 0 to ${images.length - 1}).`,
    metadataLines.length > 0
      ? `Metadata reported by the submitter (not verified — cross-check against what you see in the photos):\n${metadataLines.join("\n")}`
      : "No metadata was provided by the submitter — identify the vehicle from the photos if possible.",
  ].join("\n\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: instructionText }],
      },
    ],
    output_config: {
      format: zodOutputFormat(DamageAnalysisSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable structured damage analysis");
  }

  return response.parsed_output;
}
