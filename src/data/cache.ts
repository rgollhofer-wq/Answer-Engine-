import Redis from "ioredis";
import { AnswerResponse } from "../core/trace.js";
import { CacheProvider, NullCacheProvider } from "./repo.js";

export class RedisCacheProvider implements CacheProvider {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<AnswerResponse | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as AnswerResponse;
  }

  async set(key: string, value: AnswerResponse, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }
}

export function createCacheProvider(redisUrl?: string): CacheProvider {
  if (!redisUrl) {
    return new NullCacheProvider();
  }
  const client = new Redis(redisUrl);
  return new RedisCacheProvider(client);
}
