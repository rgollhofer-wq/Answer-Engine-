import { AnswerRequestContext } from "./validators.js";

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

export function normalizeQuestion(input: string): string {
  const cleaned = input
    .replace(EMOJI_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 400) return cleaned;
  return cleaned.slice(0, 400).trim();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeContext(context?: AnswerRequestContext | null): AnswerRequestContext | null {
  if (!context) return null;
  return {
    vehicle: context.vehicle
      ? {
          year: context.vehicle.year ?? null,
          make: normalizeOptionalString(context.vehicle.make),
          model: normalizeOptionalString(context.vehicle.model),
          trim: normalizeOptionalString(context.vehicle.trim),
          engine: normalizeOptionalString(context.vehicle.engine),
          vin: normalizeOptionalString(context.vehicle.vin),
        }
      : null,
    part: context.part
      ? {
          name: normalizeOptionalString(context.part.name),
          oem_part_number: normalizeOptionalString(context.part.oem_part_number),
        }
      : null,
    location: context.location
      ? {
          postal_code: normalizeOptionalString(context.location.postal_code),
          radius_miles: context.location.radius_miles ?? null,
        }
      : null,
  };
}
