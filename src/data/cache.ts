import { Redis } from "ioredis";
import { CacheProvider, NullCacheProvider } from "./repo.js";

export class RedisCacheProvider implements CacheProvider {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
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
