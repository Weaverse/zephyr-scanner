/**
 * KV-backed rate limiting for /scan.
 *
 * Two independent throttles:
 *   - Per-IP: 10 scans / IP / rolling hour. Stops one bad actor from
 *     racking up Worker invocations.
 *   - Per-URL: 1 scan / 5 minutes. Forces cache hits when many users
 *     scan the same hot domain in a short window.
 *
 * The internal-bypass header `X-Zephyr-Internal: ${INTERNAL_SECRET}` lets
 * the daily cron (and future warming jobs) scan without tripping the
 * counter — otherwise the cron's own re-scans would be rate-limited.
 *
 * When throttled we return 429 + Retry-After; the response shape stays
 * `{ error, retryAfter }` to match what apps/web's fetchScan handler
 * surfaces today.
 */
import type { Env } from "./env.js";
import { sha256Hex } from "./cache-key.js";

const IP_HOURLY_LIMIT = 10;
const URL_THROTTLE_SECONDS = 5 * 60;

export interface RateLimitDecision {
  allowed: boolean;
  reason?: "ip-quota-exceeded" | "url-throttled";
  retryAfterSeconds?: number;
}

function hourBucket(date = new Date()): string {
  // YYYYMMDDHH — rolls every wall-clock hour, KV TTL handles the actual
  // expiry. Stable across colos because we use the request's UTC.
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  return `${y}${m}${d}${h}`;
}

function clientIp(req: Request): string {
  // CF-Connecting-IP is the canonical client IP behind Cloudflare's edge.
  // Fall back to X-Forwarded-For first hop, then "unknown" — better to
  // share-throttle anonymous clients than to fail open entirely.
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isInternalBypass(req: Request, env: Env): boolean {
  const header = req.headers.get("X-Zephyr-Internal");
  return !!(header && env.INTERNAL_SECRET && header === env.INTERNAL_SECRET);
}

export async function checkAndIncrement(
  env: Env,
  req: Request,
  targetUrl: string,
): Promise<RateLimitDecision> {
  if (!env.SCANS) {
    // KV unbound (local dev without bindings) — skip limiting.
    return { allowed: true };
  }
  if (isInternalBypass(req, env)) {
    return { allowed: true };
  }

  const ip = clientIp(req);
  const ipKey = `rl:ip:${ip}:${hourBucket()}`;
  const urlKey = `rl:url:${await sha256Hex(targetUrl)}`;

  // URL throttle first — cheaper than IP since same-URL hits are common
  // and we'd want to fail those without incrementing the IP counter.
  const urlLockedAt = await env.SCANS.get(urlKey);
  if (urlLockedAt) {
    const lockedAtMs = Number(urlLockedAt);
    if (Number.isFinite(lockedAtMs)) {
      const ageSeconds = (Date.now() - lockedAtMs) / 1000;
      if (ageSeconds < URL_THROTTLE_SECONDS) {
        return {
          allowed: false,
          reason: "url-throttled",
          retryAfterSeconds: Math.ceil(URL_THROTTLE_SECONDS - ageSeconds),
        };
      }
    }
  }

  // IP hourly quota
  const currentRaw = await env.SCANS.get(ipKey);
  const current = currentRaw ? Number(currentRaw) : 0;
  if (current >= IP_HOURLY_LIMIT) {
    return {
      allowed: false,
      reason: "ip-quota-exceeded",
      retryAfterSeconds: secondsToNextHour(),
    };
  }

  // Both gates passed — increment both. expirationTtl ensures stale keys
  // don't linger in KV.
  await Promise.all([
    env.SCANS.put(ipKey, String(current + 1), {
      expirationTtl: 60 * 60 + 60, // hourly bucket + 1 min of slack
    }),
    env.SCANS.put(urlKey, String(Date.now()), {
      expirationTtl: URL_THROTTLE_SECONDS + 30,
    }),
  ]);

  return { allowed: true };
}

function secondsToNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}
