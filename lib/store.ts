import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SEEN_KEY = "reality:seen_ids";
const TTL = 60 * 60 * 24 * 30;

export async function filterNewIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  const stored = await redis.smembers(SEEN_KEY);
  const storedSet = new Set(stored || []);
  const newIds = ids.filter((id) => !storedSet.has(id));

  if (newIds.length > 0) {
    await redis.sadd(SEEN_KEY, ...newIds);
    await redis.expire(SEEN_KEY, TTL);
  }

  return newIds;
}