import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { LlmProvider } from "../providers/llm.js";
import { CacheProvider } from "../data/repo.js";
import { handleRadarRequest, radarRequestSchema } from "../core/radar.js";

export interface RadarRouteOptions {
  provider: LlmProvider;
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

export function registerRadarRoute(app: FastifyInstance, options: RadarRouteOptions): void {
  app.post("/radar", async (request, reply) => {
    if (!requireAuth(options.apiKey, request, reply)) return;

    const parsed = radarRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: "validation_error", details: parsed.error.issues });
      return;
    }

    try {
      const response = await handleRadarRequest({
        request: parsed.data,
        provider: options.provider,
        cache: options.cache,
        cacheTtlSeconds: options.cacheTtlSeconds,
        temperature: options.temperature,
        timeoutMs: options.timeoutMs,
      });

      reply.status(200).send(response);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("website_url must")) {
        reply.status(400).send({ error: "validation_error", details: [{ message: error.message }] });
        return;
      }

      reply.status(502).send({
        error: "scout_failed",
        message: error instanceof Error ? error.message : "Unable to scout website",
      });
    }
  });
}
