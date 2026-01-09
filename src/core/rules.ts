import { Intent } from "./intent.js";
import { AnswerRequestContext } from "./validators.js";

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

export interface ConfidenceResult {
  confidence: ConfidenceLevel;
  missingRequiredFields: string[];
  rulesApplied: string[];
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function computeMissingRequiredFields(
  intent: Intent,
  entities: AnswerRequestContext | null
): string[] {
  const missing: string[] = [];
  const part = entities?.part ?? null;
  const vehicle = entities?.vehicle ?? null;
  const location = entities?.location ?? null;

  const hasPartName = hasValue(part?.name);
  const hasPartNumber = hasValue(part?.oem_part_number);
  const hasPart = hasPartName || hasPartNumber;

  const hasVehicleYear = hasValue(vehicle?.year);
  const hasVehicleMake = hasValue(vehicle?.make);
  const hasVehicleModel = hasValue(vehicle?.model);

  const hasLocationPostal = hasValue(location?.postal_code);

  if (intent === "PART_AVAILABILITY_LOCAL") {
    if (!hasPartName) missing.push("part.name");
    if (!hasPartNumber) missing.push("part.oem_part_number");
    if (!hasLocationPostal) missing.push("location.postal_code");
  }

  if (intent === "PART_ELIGIBILITY") {
    if (!hasPartName) missing.push("part.name");
    if (!hasPartNumber) missing.push("part.oem_part_number");
    if (!hasVehicleYear) missing.push("vehicle.year");
    if (!hasVehicleMake) missing.push("vehicle.make");
    if (!hasVehicleModel) missing.push("vehicle.model");
  }

  if (intent === "PART_AVAILABILITY_AND_ELIGIBILITY") {
    if (!hasPartName) missing.push("part.name");
    if (!hasPartNumber) missing.push("part.oem_part_number");
    if (!hasLocationPostal) missing.push("location.postal_code");
    if (!hasVehicleYear) missing.push("vehicle.year");
    if (!hasVehicleMake) missing.push("vehicle.make");
    if (!hasVehicleModel) missing.push("vehicle.model");
  }

  if (hasPart) {
    return missing.filter(
      (field) => field !== "part.name" && field !== "part.oem_part_number"
    );
  }

  return missing;
}

function detectExactFitment(question: string): boolean {
  return question.toLowerCase().includes("exact fitment");
}

function detectGuarantee(question: string): boolean {
  const lowered = question.toLowerCase();
  return lowered.includes("guarantee") || lowered.includes("guaranteed");
}

export function evaluateConfidence(params: {
  intent: Intent;
  entities: AnswerRequestContext | null;
  question: string;
  missingRequiredFields: string[];
}): ConfidenceResult {
  const rulesApplied: string[] = ["R01_INTENT_CLASSIFIED"];

  if (params.intent === "UNKNOWN_INTENT") {
    rulesApplied.push("R03_UNKNOWN_INTENT", "R10_CONFIDENCE_GATED");
    return { confidence: "unknown", missingRequiredFields: params.missingRequiredFields, rulesApplied };
  }

  if (params.missingRequiredFields.length > 0) {
    rulesApplied.push("R02_MISSING_REQUIRED_FIELDS", "R10_CONFIDENCE_GATED");
    return { confidence: "unknown", missingRequiredFields: params.missingRequiredFields, rulesApplied };
  }

  let confidence: ConfidenceLevel = "high";

  const missingDetail =
    params.intent === "PART_AVAILABILITY_AND_ELIGIBILITY" &&
    (!params.entities?.vehicle?.trim ||
      !params.entities?.vehicle?.engine ||
      !params.entities?.vehicle?.vin);

  if (missingDetail) {
    confidence = "medium";
    rulesApplied.push("R11_MISSING_DETAIL_CAP");
  }

  if (!params.entities?.vehicle?.vin) {
    if (detectGuarantee(params.question)) {
      confidence = "unknown";
      rulesApplied.push("R12_GUARANTEE_NEEDS_VIN");
    } else if (detectExactFitment(params.question)) {
      confidence = confidence === "unknown" ? "unknown" : "medium";
      rulesApplied.push("R12_EXACT_FITMENT_NEEDS_VIN");
    }
  }

  rulesApplied.push("R10_CONFIDENCE_GATED");

  return { confidence, missingRequiredFields: params.missingRequiredFields, rulesApplied };
}
