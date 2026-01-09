import { describe, it, expect } from "vitest";
import { buildServer } from "../src/server.js";
import { InMemoryAnswerLogRepository, NullCacheProvider } from "../src/data/repo.js";
import { LlmRequest, LlmProvider } from "../src/providers/llm.js";

const fixtureQuestion = "Is a front brake pad available locally and eligible for a 2021 Hyundai Tucson?";
const fixtureContext = {
  vehicle: { year: 2021, make: "Hyundai", model: "Tucson", trim: null, engine: null, vin: null },
  part: { name: "front brake pad", oem_part_number: null },
  location: { postal_code: "80112", radius_miles: 25 },
};

class MockProvider implements LlmProvider {
  model = "test-model";

  async completeJson<T>(request: LlmRequest): Promise<T> {
    if (request.systemPrompt.includes("information extraction engine")) {
      return {
        intent: "PART_AVAILABILITY_AND_ELIGIBILITY",
        entities: fixtureContext,
        missing_required_fields: [],
        notes: null,
      } as T;
    }

    return {
      answer: "Likely yes — front brake pads are commonly available locally for this vehicle class.",
      reason: "Common wear item; eligibility appears consistent for 2021 Tucson but trim/engine could change exact fitment.",
      next_action: "Confirm trim or VIN if exact fitment is required before ordering.",
    } as T;
  }
}

describe("/answer", () => {
  it("returns a valid response schema", async () => {
    const app = buildServer({
      provider: new MockProvider(),
      repo: new InMemoryAnswerLogRepository(),
      cache: new NullCacheProvider(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/answer",
      payload: {
        question: fixtureQuestion,
        context: fixtureContext,
        mode: "pilot",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.answer).toBeTypeOf("string");
    expect(body.confidence).toBeTypeOf("string");
    expect(body.reason).toBeTypeOf("string");
    expect(body.next_action).toBeTypeOf("string");
    expect(body.intent).toBe("PART_AVAILABILITY_AND_ELIGIBILITY");
    expect(body.entities?.vehicle?.make).toBe("Hyundai");
    expect(body.trace?.request_id).toBeTypeOf("string");
  });

  it("is deterministic for identical requests", async () => {
    const app = buildServer({
      provider: new MockProvider(),
      repo: new InMemoryAnswerLogRepository(),
      cache: new NullCacheProvider(),
    });

    const payload = {
      question: fixtureQuestion,
      context: fixtureContext,
      mode: "pilot",
    };

    const first = await app.inject({ method: "POST", url: "/answer", payload });
    const second = await app.inject({ method: "POST", url: "/answer", payload });

    const firstBody = first.json();
    const secondBody = second.json();

    expect(firstBody.answer).toBe(secondBody.answer);
    expect(firstBody.confidence).toBe(secondBody.confidence);
    expect(firstBody.reason).toBe(secondBody.reason);
    expect(firstBody.next_action).toBe(secondBody.next_action);
    expect(firstBody.intent).toBe(secondBody.intent);
    expect(firstBody.entities).toEqual(secondBody.entities);
    expect(firstBody.trace.normalized_question).toBe(secondBody.trace.normalized_question);
    expect(firstBody.trace.missing_fields).toEqual(secondBody.trace.missing_fields);
    expect(firstBody.trace.rules_applied).toEqual(secondBody.trace.rules_applied);
    expect(firstBody.trace.request_id).not.toBe(secondBody.trace.request_id);
  });
});
