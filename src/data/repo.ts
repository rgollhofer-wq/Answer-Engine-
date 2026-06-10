import { PrismaClient } from "@prisma/client";
import { AnswerResponse, EngineTrace } from "../core/trace.js";
import { AnswerRequestContext } from "../core/validators.js";

export interface AnswerLogInput {
  question: string;
  normalizedQuestion: string;
  context: AnswerRequestContext | null;
  intent: string;
  entities: Record<string, unknown>;
  answer: string;
  confidence: string;
  reason: string;
  nextAction: string;
  trace: EngineTrace;
  latencyMs: number;
  providerModel: string;
}

export interface AnswerLogRepository {
  create(input: AnswerLogInput): Promise<void>;
}

export class PrismaAnswerLogRepository implements AnswerLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: AnswerLogInput): Promise<void> {
    await this.prisma.answerLog.create({
      data: {
        question: input.question,
        normalized_question: input.normalizedQuestion,
        context_json: input.context ?? {},
        intent: input.intent,
        entities_json: input.entities,
        answer: input.answer,
        confidence: input.confidence,
        reason: input.reason,
        next_action: input.nextAction,
        trace_json: input.trace,
        latency_ms: input.latencyMs,
        provider_model: input.providerModel,
      },
    });
  }
}

export class InMemoryAnswerLogRepository implements AnswerLogRepository {
  public entries: AnswerLogInput[] = [];

  async create(input: AnswerLogInput): Promise<void> {
    this.entries.push(input);
  }
}

export interface CacheProvider {
  get<T = AnswerResponse>(key: string): Promise<T | null>;
  set<T = AnswerResponse>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

export class NullCacheProvider implements CacheProvider {
  async get<T = AnswerResponse>(): Promise<T | null> {
    return null;
  }

  async set<T = AnswerResponse>(): Promise<void> {
    return undefined;
  }
}
