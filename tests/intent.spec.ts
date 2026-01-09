import { describe, it, expect } from "vitest";
import { extractIntentEntities, ALLOWED_INTENTS } from "../src/core/intent.js";
import { LlmProvider, LlmRequest } from "../src/providers/llm.js";

class InvalidIntentProvider implements LlmProvider {
  model = "test-model";
  async completeJson<T>(_request: LlmRequest): Promise<T> {
    return {
      intent: "NOT_REAL",
      entities: { vehicle: null, part: null, location: null },
      missing_required_fields: [],
      notes: null,
    } as T;
  }
}

describe("intent extraction", () => {
  it("returns unknown when intent is invalid", async () => {
    const result = await extractIntentEntities({
      provider: new InvalidIntentProvider(),
      question: "Is it eligible?",
      context: null,
      temperature: 0,
      timeoutMs: 1000,
    });

    expect(result.intent).toBe("UNKNOWN_INTENT");
  });

  it("uses allowed intent list", () => {
    expect(ALLOWED_INTENTS).toContain("PART_ELIGIBILITY");
  });
});
