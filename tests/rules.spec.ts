import { describe, it, expect } from "vitest";
import { computeMissingRequiredFields, evaluateConfidence } from "../src/core/rules.js";
import { Intent } from "../src/core/intent.js";

const baseEntities = {
  vehicle: { year: 2021, make: "Hyundai", model: "Tucson", trim: null, engine: null, vin: null },
  part: { name: "alternator", oem_part_number: null },
  location: { postal_code: null, radius_miles: 25 },
};

const completeEntities = {
  vehicle: { year: 2021, make: "Hyundai", model: "Tucson", trim: null, engine: null, vin: null },
  part: { name: "alternator", oem_part_number: null },
  location: { postal_code: "80112", radius_miles: 25 },
};

describe("rules", () => {
  it("marks missing required fields as unknown", () => {
    const intent: Intent = "PART_AVAILABILITY_LOCAL";
    const missing = computeMissingRequiredFields(intent, baseEntities);
    const result = evaluateConfidence({
      intent,
      entities: baseEntities,
      question: "Is an alternator available locally?",
      missingRequiredFields: missing,
    });

    expect(missing).toContain("location.postal_code");
    expect(result.confidence).toBe("unknown");
  });

  it("caps combined intent confidence when trim/engine/vin missing", () => {
    const intent: Intent = "PART_AVAILABILITY_AND_ELIGIBILITY";
    const missing = computeMissingRequiredFields(intent, completeEntities);
    const result = evaluateConfidence({
      intent,
      entities: completeEntities,
      question: "Is this eligible and available?",
      missingRequiredFields: missing,
    });

    expect(result.confidence).toBe("medium");
  });

  it("requires VIN when guaranteeing exact fitment", () => {
    const intent: Intent = "PART_ELIGIBILITY";
    const missing = computeMissingRequiredFields(intent, completeEntities);
    const result = evaluateConfidence({
      intent,
      entities: completeEntities,
      question: "Can you guarantee exact fitment?",
      missingRequiredFields: missing,
    });

    expect(result.confidence).toBe("unknown");
  });
});
