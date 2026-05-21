import { Hono } from "hono";
import { cors } from "hono/cors";
import { allChecks, runAll } from "@zephyr/checks";
import { scoreResults } from "@zephyr/scoring";
import { renderBadge, type Grade } from "@zephyr/badge";

import {
  API_VERSION,
  CHECKS_TOTAL,
  LIMITED_COVERAGE_THRESHOLD,
  SCAN_CACHE_TTL_SECONDS,
  USER_AGENT,
  type Env,
} from "./env.js";
import { renderOgSvg } from "./og.js";
import { svgToPng } from "./og-png.js";
import { upsertZephyrContact } from "./marketing.js";
import { runChangeDetection } from "./cron.js";
import {
  cacheKeyForUrl,
  nanoid12,
  normalizeUrl,
} from "./cache-key.js";
import {
  leaderboardEntries,
  latestScanForDomain,
  readOgPng,
  readScanById,
  readScanCache,
  writeOgPng,
  writeReportToR2,
  writeScanById,
  writeScanCache,
  writeScanRow,
  type StoredScan,
} from "./storage.js";

export const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "zephyr-scanner",
    version: API_VERSION,
    description: "Is your store agent-ready?",
    endpoints: [
      "/scan?url=https://example.com",
      "/badge/{domain}.svg",
      "/og/{domain}.svg",
      "/og/{domain}.png",
      "/leaderboard",
      "/scan/{id}",
      "POST /subscribe",
    ],
    docs: "https://github.com/Weaverse/zephyr-scanner",
  }),
);

app.get("/scan", async (c) => {
  const env = c.env;
  const raw = c.req.query("url");
  if (!raw) return c.json({ error: "missing url query param" }, 400);

  let target: URL;
  try {
    target = normalizeUrl(raw);
  } catch {
    return c.json({ error: "invalid url" }, 400);
  }

  const fresh = c.req.query("fresh") === "true";
  const cacheKey = await cacheKeyForUrl(target.toString());

  if (!fresh) {
    const cached = await readScanCache(env, cacheKey);
    if (cached) {
      return c.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }
  }

  const ctx = {
    url: target.toString(),
    origin: target.origin,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...(init?.headers || {}) },
        cf: { cacheTtl: 60 },
      } as RequestInit)) as typeof fetch,
  };

  const startedAt = Date.now();
  const results = await runAll(ctx);
  const score = scoreResults(results);
  const durationMs = Date.now() - startedAt;

  const checksCovered = allChecks.length;
  const limitedCoverage = checksCovered < LIMITED_COVERAGE_THRESHOLD;

  const scan: StoredScan = {
    id: nanoid12(),
    target: target.toString(),
    scannedAt: new Date().toISOString(),
    meta: {
      apiVersion: API_VERSION,
      checksCovered,
      checksTotal: CHECKS_TOTAL,
      limitedCoverage,
      cached: false,
      durationMs,
      ...(limitedCoverage
        ? {
            disclaimer: `Scanner is in early development. Score reflects ${checksCovered} of ${CHECKS_TOTAL} planned checks.`,
          }
        : {}),
    },
    score,
    results,
  };

  // Fan out persistence in parallel; failures are non-fatal so scans still
  // succeed even when bindings are missing in dev.
  await Promise.all([
    writeScanCache(env, cacheKey, scan, SCAN_CACHE_TTL_SECONDS),
    writeScanById(env, scan, SCAN_CACHE_TTL_SECONDS),
    writeReportToR2(env, scan).catch(() => undefined),
    writeScanRow(env, scan).catch(() => undefined),
  ]);

  return c.json(scan);
});

app.get("/scan/:id", async (c) => {
  const scan = await readScanById(c.env, c.req.param("id"));
  if (!scan) return c.json({ error: "scan not found" }, 404);
  return c.json({ ...scan, meta: { ...scan.meta, cached: true } });
});

app.get("/badge/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (!filename.endsWith(".svg")) {
    return c.json({ error: "expected .svg suffix" }, 400);
  }
  const domain = filename.slice(0, -".svg".length).toLowerCase();
  const scan = await latestScanForDomain(c.env, domain);
  if (!scan) return c.json({ error: "no scan for domain" }, 404);

  const svg = renderBadge({
    grade: scan.score.grade as Grade,
    score: scan.score.overall as number,
  });
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

function ogInputFromScan(scan: StoredScan) {
  return {
    domain: new URL(scan.target).hostname,
    score: scan.score.overall as number,
    grade: scan.score.grade as Grade,
    scannedAt: scan.scannedAt,
    categories: (scan.score.categories ?? []) as Array<{ category: string; score: number }>,
  };
}

app.get("/og/:filename", async (c) => {
  const filename = c.req.param("filename");
  const isSvg = filename.endsWith(".svg");
  const isPng = filename.endsWith(".png");
  if (!isSvg && !isPng) {
    return c.json({ error: "expected .svg or .png suffix" }, 400);
  }
  const domain = filename
    .slice(0, -(isSvg ? ".svg".length : ".png".length))
    .toLowerCase();
  const scan = await latestScanForDomain(c.env, domain);
  if (!scan) return c.json({ error: "no scan for domain" }, 404);

  if (isSvg) {
    const svg = renderOgSvg(ogInputFromScan(scan));
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }

  // PNG path — cached in R2 keyed by scan id (the OG image is invariant
  // for a given scan, so we only render once per scan id).
  const cached = scan.id ? await readOgPng(c.env, scan.id) : null;
  if (cached) {
    return new Response(cached, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      },
    });
  }

  const svg = renderOgSvg(ogInputFromScan(scan));
  let png: Uint8Array;
  try {
    png = await svgToPng(svg);
  } catch (e) {
    return c.json({ error: `og render failed: ${(e as Error).message}` }, 500);
  }

  if (scan.id) {
    c.executionCtx.waitUntil(writeOgPng(c.env, scan.id, png));
  }

  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
    },
  });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/subscribe", async (c) => {
  let body: { email?: unknown; domain?: unknown };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const domainRaw = typeof body.domain === "string" ? body.domain.trim() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ error: "invalid email" }, 400);
  }
  if (!domainRaw) {
    return c.json({ error: "missing domain" }, 400);
  }
  let domain: string;
  try {
    domain = new URL(
      domainRaw.startsWith("http") ? domainRaw : `https://${domainRaw}`,
    ).hostname.toLowerCase();
  } catch {
    return c.json({ error: "invalid domain" }, 400);
  }

  try {
    await upsertZephyrContact(c.env, {
      email,
      shopDomain: domain,
      event: "zephyr_subscribed",
      source: "zephyr",
    });
  } catch (e) {
    return c.json(
      { error: "subscription upstream unavailable", detail: (e as Error).message },
      502,
    );
  }

  return c.json({ ok: true, email, domain });
});

app.get("/leaderboard", async (c) => {
  const periodParam = c.req.query("period") ?? "30d";
  const period: "7d" | "30d" | "all" =
    periodParam === "7d" || periodParam === "all" ? periodParam : "30d";
  const category = c.req.query("category") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 50);

  const entries = await leaderboardEntries(c.env, {
    period,
    category,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return c.json({ period, category: category ?? null, entries });
});

// Export a Worker module so we can ship both the Hono fetch handler AND
// a scheduled() handler for the daily change-detection cron. wrangler.toml
// declares the cron trigger; CF invokes scheduled() at the trigger time.
export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runChangeDetection(env));
  },
};
