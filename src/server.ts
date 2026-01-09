import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerHealthRoute } from "./routes/health.js";
import { registerAnswerRoute } from "./routes/answer.js";
import { loadEnv, parseCorsOrigins } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { OpenAiProvider } from "./providers/openai.js";
import { getPrismaClient } from "./data/db.js";
import { PrismaAnswerLogRepository } from "./data/repo.js";
import { createCacheProvider } from "./data/cache.js";
import { LlmProvider } from "./providers/llm.js";
import { AnswerLogRepository, CacheProvider } from "./data/repo.js";

const env = loadEnv();

export interface ServerDependencies {
  provider: LlmProvider;
  repo: AnswerLogRepository;
  cache: CacheProvider;
}

export function buildServer(deps?: Partial<ServerDependencies>) {
  const app = Fastify({ logger });

  const origins = parseCorsOrigins(env.CORS_ORIGINS);
  app.register(cors, {
    origin: origins ?? (env.NODE_ENV === "development" ? true : false),
  });

  app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });

  const provider =
    deps?.provider ??
    (() => {
      if (!env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required");
      }
      return new OpenAiProvider({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        timeoutMs: env.LLM_TIMEOUT_MS,
      });
    })();

  const repo = deps?.repo ?? new PrismaAnswerLogRepository(getPrismaClient());
  const cache = deps?.cache ?? createCacheProvider(env.REDIS_URL);

  registerHealthRoute(app);
  registerAnswerRoute(app, {
    provider,
    repo,
    cache,
    cacheTtlSeconds: env.CACHE_TTL_SECONDS,
    temperature: env.LLM_TEMPERATURE,
    timeoutMs: env.LLM_TIMEOUT_MS,
    apiKey: env.API_KEY,
  });

  return app;
}

const app = buildServer();

app
  .listen({ port: Number(env.PORT), host: "0.0.0.0" })
  .then(() => {
    logger.info("Answer Engine listening");
  })
  .catch((error) => {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  });
