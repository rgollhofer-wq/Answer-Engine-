import { z } from "zod";
import { LlmProvider } from "../providers/llm.js";
import { AnswerRequestContext } from "./validators.js";

export const ALLOWED_INTENTS = [
  "PART_AVAILABILITY_LOCAL",
  "PART_ELIGIBILITY",
  "PART_AVAILABILITY_AND_ELIGIBILITY",
  "CLARIFY_REQUEST",
  "UNKNOWN_INTENT",
] as const;

export type Intent = (typeof ALLOWED_INTENTS)[number];

const entitiesSchema = z.object({
  vehicle: z
    .object({
      year: z.number().int().nullable().optional(),
      make: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      trim: z.string().nullable().optional(),
      engine: z.string().nullable().optional(),
      vin: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  part: z
    .object({
      name: z.string().nullable().optional(),
      oem_part_number: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  location: z
    .object({
      postal_code: z.string().nullable().optional(),
      radius_miles: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const intentResponseSchema = z.object({
  intent: z.enum(ALLOWED_INTENTS),
  entities: entitiesSchema,
  missing_required_fields: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

export type IntentExtraction = z.infer<typeof intentResponseSchema>;

const SYSTEM_PROMPT = `Output must be strict JSON. No extra text.

You are an information extraction engine for an automotive parts Answer Engine.
Return ONLY valid JSON that matches the provided schema.
Do not guess missing fields. Use null when unknown.
Choose intent ONLY from:
PART_AVAILABILITY_LOCAL, PART_ELIGIBILITY, PART_AVAILABILITY_AND_ELIGIBILITY, CLARIFY_REQUEST, UNKNOWN_INTENT`;

const USER_PROMPT_SCHEMA = `{
  "intent": "string",
  "entities": {
    "vehicle": { "year": 0, "make": "string", "model": "string", "trim": "string|null", "engine": "string|null", "vin": "string|null" },
    "part": { "name": "string|null", "oem_part_number": "string|null" },
    "location": { "postal_code": "string|null", "radius_miles": 0 }
  },
  "missing_required_fields": ["string"],
  "notes": "string|null"
}`;

export async function extractIntentEntities(params: {
  provider: LlmProvider;
  question: string;
  context: AnswerRequestContext | null;
  temperature: number;
  timeoutMs: number;
}): Promise<IntentExtraction> {
  const userPrompt = `Question: ${params.question}\nContext: ${JSON.stringify(
    params.context ?? {}
  )}\n\nReturn JSON with this schema:\n${USER_PROMPT_SCHEMA}`;

  const response = await params.provider.completeJson<IntentExtraction>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: params.temperature,
    timeoutMs: params.timeoutMs,
  });

  const parsed = intentResponseSchema.safeParse(response);
  if (!parsed.success) {
    return {
      intent: "UNKNOWN_INTENT",
      entities: { vehicle: null, part: null, location: null },
      missing_required_fields: ["intent"],
      notes: "Invalid intent extraction response.",
    };
  }

  return parsed.data;
}
