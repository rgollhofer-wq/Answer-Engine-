import { AnswerRequestContext } from "./validators.js";
import { ConfidenceLevel } from "./rules.js";

export interface ProviderTrace {
  llm_model: string;
  latency_ms: number;
}

export interface EngineTrace {
  request_id: string;
  normalized_question: string;
  missing_fields: string[];
  rules_applied: string[];
  provider: ProviderTrace;
}

export interface AnswerResponse {
  answer: string;
  confidence: ConfidenceLevel;
  reason: string;
  next_action: string;
  intent: string;
  entities: AnswerRequestContext | null;
  trace: EngineTrace;
}
