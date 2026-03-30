const rateLimitMap = new Map<string, number[]>();

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap) {
    const recent = timestamps.filter((t) => now - t < 120_000);
    if (recent.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, recent);
    }
  }
}, 60_000).unref?.();

/**
 * Simple in-memory sliding-window rate limiter.
 * Returns true if the request is allowed, false if rate-limited.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    rateLimitMap.set(key, recent);
    return false;
  }

  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
