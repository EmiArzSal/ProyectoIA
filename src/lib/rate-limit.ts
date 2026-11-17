import "server-only";

// Best-effort, in-memory sliding-window limiter. On serverless each instance
// has its own memory, so this only blunts bursts; the hard per-meeting limits
// live in the session state machine (src/modules/call/server/session.ts).
// Swap for a shared store (e.g. Upstash Redis) if stricter limits are needed.

const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return true;
}
