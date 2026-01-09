import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.string().default("development"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  LLM_TEMPERATURE: z.coerce.number().default(0),
  LLM_TIMEOUT_MS: z.coerce.number().default(8000),
  DATABASE_URL: z.string().default("sqlite:./dev.db"),
  REDIS_URL: z.string().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().default(300),
  API_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function parseCorsOrigins(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
