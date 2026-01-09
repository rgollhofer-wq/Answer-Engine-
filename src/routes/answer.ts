import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { answerRequestSchema } from "../core/validators.js";
import { handleAnswerRequest } from "../core/engine.js";
import { LlmProvider } from "../providers/llm.js";
import { AnswerLogRepository, CacheProvider } from "../data/repo.js";

export interface AnswerRouteOptions {
  provider: LlmProvider;
  repo: AnswerLogRepository;
  cache: CacheProvider;
  cacheTtlSeconds: number;
  temperature: number;
  timeoutMs: number;
  apiKey?: string;
}

function requireAuth(apiKey: string | undefined, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!apiKey) return true;
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.status(401).send({ error: "unauthorized" });
    return false;
  }
  const token = authHeader.slice("Bearer ".length);
  if (token !== apiKey) {
    reply.status(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

export function registerAnswerRoute(app: FastifyInstance, options: AnswerRouteOptions): void {
  app.post("/answer", async (request, reply) => {
    if (!requireAuth(options.apiKey, request, reply)) return;

    const parsed = answerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: "validation_error", details: parsed.error.issues });
      return;
    }

    const response = await handleAnswerRequest({
      request: parsed.data,
      provider: options.provider,
      repo: options.repo,
      cache: options.cache,
      cacheTtlSeconds: options.cacheTtlSeconds,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
    });

    reply.status(200).send(response);
  });
}
