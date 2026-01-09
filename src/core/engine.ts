import { v4 as uuidv4 } from "uuid";
import { LlmProvider } from "../providers/llm.js";
import { AnswerRequest, AnswerRequestContext } from "./validators.js";
import { normalizeContext, normalizeQuestion } from "./normalize.js";
import { extractIntentEntities, Intent } from "./intent.js";
import { computeMissingRequiredFields, evaluateConfidence } from "./rules.js";
import { AnswerResponse, EngineTrace } from "./trace.js";
import { hashPayload } from "../utils/hash.js";
import { AnswerLogRepository, CacheProvider } from "../data/repo.js";
import { timeOperation } from "../utils/timing.js";
import { z } from "zod";

const DRAFT_SYSTEM_PROMPT = `You are Answer Engine™. You return ONE direct operational answer.
Rules:
- No links, no lists.
- Do not claim you checked inventory systems.
- Match tone to a dealership operator: concise, confident, calm.
- If confidence=unknown: answer must be "Unknown" or "I can't confirm yet."
- If confidence=medium: use "likely" or "probably" once, not repeatedly.
Return ONLY valid JSON.`;

const DRAFT_SCHEMA = `{
  "answer": "string",
  "reason": "string",
  "next_action": "string"
}`;

const draftResponseSchema = z.object({
  answer: z.string(),
  reason: z.string(),
  next_action: z.string(),
});

function buildDraftUserPrompt(params: {
  normalizedQuestion: string;
  entities: AnswerRequestContext | null;
  confidence: string;
  missingFields: string[];
}): string {
  return `Normalized question: ${params.normalizedQuestion}\nExtracted entities: ${JSON.stringify(
    params.entities ?? {}
  )}\nConfidence: ${params.confidence}\nMissing fields: ${JSON.stringify(
    params.missingFields
  )}\n\nReturn JSON with this schema:\n${DRAFT_SCHEMA}`;
}

function buildFallbackAnswer(confidence: string, missingFields: string[]): {
  answer: string;
  reason: string;
  next_action: string;
} {
  if (confidence === "unknown") {
    const missing = missingFields.length ? `Missing: ${missingFields.join(", ")}.` : "Missing required details.";
    return {
      answer: "Unknown",
      reason: missing,
      next_action: missingFields.length
        ? `Provide ${missingFields.join(", ")} to confirm.`
        : "Provide the missing required details to confirm.",
    };
  }

  return {
    answer: "I can't confirm yet.",
    reason: "Additional information is required.",
    next_action: "Provide more details to continue.",
  };
}

export async function handleAnswerRequest(params: {
  request: AnswerRequest;
  provider: LlmProvider;
  repo: AnswerLogRepository;
  cache: CacheProvider;
  cacheTtlSeconds: number;
  temperature: number;
  timeoutMs: number;
}): Promise<AnswerResponse> {
  const normalizedQuestion = normalizeQuestion(params.request.question);
  const normalizedContext = normalizeContext(params.request.context ?? null);
  const cacheKey = hashPayload(
    JSON.stringify({ question: normalizedQuestion, context: normalizedContext })
  );

  const cached = await params.cache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      trace: {
        ...cached.trace,
        request_id: uuidv4(),
        provider: {
          ...cached.trace.provider,
          latency_ms: 0,
        },
      },
    };
  }

  const { result: intentResult, latencyMs: intentLatency } = await timeOperation(() =>
    extractIntentEntities({
      provider: params.provider,
      question: normalizedQuestion,
      context: normalizedContext,
      temperature: params.temperature,
      timeoutMs: params.timeoutMs,
    })
  );

  const intent = intentResult.intent as Intent;
  const entities = intentResult.entities as AnswerRequestContext | null;

  const computedMissing = computeMissingRequiredFields(intent, entities);
  const missingFields = Array.from(
    new Set([...(intentResult.missing_required_fields ?? []), ...computedMissing])
  );

  const confidenceResult = evaluateConfidence({
    intent,
    entities,
    question: normalizedQuestion,
    missingRequiredFields: missingFields,
  });

  const { result: draftResult, latencyMs: draftLatency } = await timeOperation(async () => {
    const draftPrompt = buildDraftUserPrompt({
      normalizedQuestion,
      entities,
      confidence: confidenceResult.confidence,
      missingFields,
    });

    try {
      const response = await params.provider.completeJson<{ answer: string; reason: string; next_action: string }>({
        systemPrompt: DRAFT_SYSTEM_PROMPT,
        userPrompt: draftPrompt,
        temperature: params.temperature,
        timeoutMs: params.timeoutMs,
      });

      const parsed = draftResponseSchema.safeParse(response);
      if (!parsed.success) {
        return buildFallbackAnswer(confidenceResult.confidence, missingFields);
      }

      return parsed.data;
    } catch {
      return buildFallbackAnswer(confidenceResult.confidence, missingFields);
    }
  });

  const trace: EngineTrace = {
    request_id: uuidv4(),
    normalized_question: normalizedQuestion,
    missing_fields: missingFields,
    rules_applied: confidenceResult.rulesApplied,
    provider: {
      llm_model: params.provider.model,
      latency_ms: intentLatency + draftLatency,
    },
  };

  const response: AnswerResponse = {
    answer: draftResult.answer,
    confidence: confidenceResult.confidence,
    reason: draftResult.reason,
    next_action: draftResult.next_action,
    intent,
    entities,
    trace,
  };

  await params.repo.create({
    question: params.request.question,
    normalizedQuestion,
    context: normalizedContext,
    intent,
    entities: entities ?? {},
    answer: response.answer,
    confidence: response.confidence,
    reason: response.reason,
    nextAction: response.next_action,
    trace,
    latencyMs: trace.provider.latency_ms,
    providerModel: params.provider.model,
  });

  await params.cache.set(cacheKey, response, params.cacheTtlSeconds);

  return response;
}
