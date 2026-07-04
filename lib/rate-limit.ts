// Lightweight, edge-safe, in-memory sliding-window rate limiter.
//
// This is a first line of defence against automated abuse (bots / AI scripts
// mass-populating the database through the app's own endpoints). It is
// per-instance and in-memory: on a serverless platform each region/instance
// keeps its own counters, so treat the limits as best-effort. For hard
// guarantees put Cloudflare (or another WAF/rate-limiting proxy) in front of
// the app AND enable Supabase's built-in rate limits — direct Supabase REST
// calls do not pass through this middleware.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically drop stale buckets so the map doesn't grow unbounded.
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    buckets.forEach((b, k) => {
      if (now - b.windowStart > windowMs) buckets.delete(k);
    });
    // Still too big (burst of unique keys) — reset entirely rather than OOM.
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
